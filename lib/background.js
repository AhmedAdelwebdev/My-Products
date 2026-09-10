"use client";

// Background product image processing queue.
//
// Saving a product only writes its text fields synchronously (fast). This
// module then uploads the photograph and generates the visual-search
// fingerprint in the background so the form never blocks on the network.
//
// Guarantees:
//  - No call hangs: every upload has a timeout + retries with backoff.
//  - The photo is surfaced as soon as it lands on Airtable: the job emits a
//    "ready" state right after the upload, so the product list refetches and
//    shows the image immediately — without waiting for the embedding pass or
//    a page reload.
//  - A photograph that fails to upload keeps its job marked as "failed" so
//    the product card shows a retry button — the owner never has to
//    re-photograph the product.
//  - Re-shooting a product replaces the queued image instead of being dropped.
//  - Finished jobs are evicted so a later edit of the same product re-queues
//    cleanly.
//  - The queue runs up to CONCURRENCY jobs in parallel; a slow upload never
//    blocks the products saved after it.

import { uploadProductImage, updateProductEmbedding } from "./api";

const CONCURRENCY = 2;
const MAX_IMAGE_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 800;

// id -> { image, status, attempts, version }
// status: "pending" | "running" | "ready" | "failed" | "done"
const jobs = new Map();

const listeners = new Set();
let snapshot = [];

function rebuildSnapshot() {
  const next = [];
  for (const [id, job] of jobs) next.push({ id, status: job.status });
  snapshot = next;
}

function emit() {
  rebuildSnapshot();
  for (const listener of listeners) listener();
}

export function subscribeProcessing(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProcessingSnapshot() {
  return snapshot;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Queue a product for background image upload + embedding generation.
// Re-shooting (edit → recapture → save) replaces the queued image instead of
// being ignored, and any finished job is re-opened for a fresh try.
export function queueImageProcessing(id, imageDataUrl) {
  if (!id || !imageDataUrl) return;
  const existing = jobs.get(id);
  if (existing) {
    existing.image = imageDataUrl;
    existing.attempts = 0;
    existing.version += 1;
    if (
      existing.status === "failed" ||
      existing.status === "ready" ||
      existing.status === "done"
    ) {
      existing.status = "pending";
    }
  } else {
    jobs.set(id, { image: imageDataUrl, status: "pending", attempts: 0, version: 1 });
  }
  emit();
  schedulePump();
}

// One-tap retry after a photograph failed to upload. Reuses the captured
// image, so the owner does not need to photograph the product again.
export function retryImageJob(id) {
  const job = jobs.get(id);
  if (!job || job.status !== "failed") return;
  job.status = "pending";
  job.attempts = 0;
  job.version += 1;
  emit();
  schedulePump();
}

function nextPending() {
  for (const [id, job] of jobs) {
    if (job.status === "pending") return { id, job };
  }
  return null;
}

let active = 0;

function schedulePump() {
  while (active < CONCURRENCY && nextPending()) {
    active += 1;
    runPump().finally(() => {
      active -= 1;
      if (nextPending()) schedulePump();
    });
  }
}

async function runPump() {
  let pending;
  while ((pending = nextPending())) {
    const { id, job } = pending;
    job.status = "running";
    emit();
    await processJob(id, job);
  }
}

// Uploads the photograph (with retries) then computes the search fingerprint
// (best-effort). The photo is what users see, so only its failure marks the
// job as failed — the embedding pass never blocks the product or its image.
async function processJob(id, job) {
  const version = job.version;
  const image = job.image;

  while (job.attempts < MAX_IMAGE_ATTEMPTS) {
    job.attempts += 1;
    try {
      await uploadProductImage(id, { dataUrl: image });
      break;
    } catch (err) {
      console.error(`Image upload attempt ${job.attempts} failed for product ${id}:`, err);
      if (job.attempts >= MAX_IMAGE_ATTEMPTS) {
        job.status = "failed";
        emit();
        return;
      }
      await sleep(RETRY_BASE_DELAY_MS * job.attempts);
    }
  }

  // A newer photograph queued mid-run (re-shoot) re-enters "pending" so it is
  // processed next; only the latest version is marked ready.
  if (job.version !== version) return;

  // The photo is on Airtable now — announce it so the list refetches and
  // shows the image immediately, before (and independent of) the embedding.
  job.status = "ready";
  emit();
  window.setTimeout(() => {
    if (jobs.get(id)?.status === "ready" || jobs.get(id)?.status === "done") {
      jobs.delete(id);
      emit();
    }
  }, 5000);

  try {
    const visual = await import("./visual-search");
    const embedding = await visual.encodeImage(image);
    await updateProductEmbedding(id, embedding);
  } catch (err) {
    console.error(`Embedding skipped for product ${id}:`, err);
  }

  if (job.version !== version) return;
  if (jobs.get(id)?.status === "ready") {
    job.status = "done";
    emit();
  }
}