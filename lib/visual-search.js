"use client";

// CLIP image embedding for visual search.
//
// Loading and encoding happen in the browser so:
//  - the model loads once and is reused across add-product + camera-search,
//  - the query embedding pipeline is identical to the product embedding pipeline,
//  - no heavy server-side ML runtime is required.
//
// To swap models later, change MODEL_ID and keep the encodeImage signature.
import { pipeline } from "@huggingface/transformers";
import { normalizeVector } from "./vectors";

const MODEL_ID = "Xenova/clip-vit-base-patch32";

let extractorPromise = null;

export function getEmbedder() {
  if (!extractorPromise) {
    extractorPromise = pipeline("image-feature-extraction", MODEL_ID, {
      dtype: "q8",
    });
  }
  return extractorPromise;
}

// Forget the cached model (useful after a failed/progress download).
export function resetEmbedder() {
  extractorPromise = null;
}

export async function encodeImage(imageSource) {
  const extractor = await getEmbedder();
  // CLIP vision models expose pooler/image_embeds output (512-dim) directly.
  const output = await extractor(imageSource);
  const data = output?.data || output?.tolist?.()[0];
  const values = Array.from(data || []);
  if (values.length === 0) {
    throw new Error("Could not compute a product embedding.");
  }
  return normalizeVector(values);
}