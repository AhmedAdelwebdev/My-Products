import { encodeEmbedding, decodeEmbedding } from "./embedding-store.js";

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const PRODUCTS_TABLE = process.env.AIRTABLE_PRODUCTS_TABLE;

const CACHE_TTL_MS = Number(process.env.AIRTABLE_CACHE_TTL_MS || 30000);
const REQUEST_TIMEOUT_MS = 20000;
const cache = new Map(); // key -> { expiresAt, value }

const API = process.env.AIRTABLE_API_URL || "https://api.airtable.com/v0";
const CONTENT_API =
  process.env.AIRTABLE_CONTENT_URL || "https://content.airtable.com/v0";

function assertConfig() {
  if (!API_KEY || !BASE_ID) {
    throw new Error(
      "Airtable is not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env.local",
    );
  }
}

function tableUrl(table) {
  assertConfig();
  return `${API}/${BASE_ID}/${table}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Airtable network error:", err);
    throw new Error("Could not reach Airtable. Check your connection.");
  }

  if (!res.ok) {
    let detail = `Airtable request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body?.error?.message || detail;
    } catch {
      /* ignore parse errors */
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid Airtable credentials. Check AIRTABLE_API_KEY.");
    }
    console.error("Airtable error:", res.status, detail);
    throw new Error(detail);
  }
  return res.json();
}

function imageUrl(fields) {
  const image = Array.isArray(fields.Image) && fields.Image[0];
  return image?.url || null;
}

function mapRecord(record, includeEmbedding = false) {
  const { fields = {}, id } = record;
  const product = {
    id,
    name: fields.Name || "",
    price: fields.Price ?? null,
    category: fields.Category || "",
    image: imageUrl(fields),
    productURL: fields.ProductURL || "",
    embedding: null,
    createdAt: fields.CreatedAt || record.createdTime || "",
  };
  if (includeEmbedding) {
    product.embedding = decodeEmbedding(fields.Embedding);
  }
  return product;
}

async function getCached(key, loader) {
  const entry = cache.get(key);
  const now = Date.now();
  if (entry && now < entry.expiresAt) return entry.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export function invalidateDataCache() {
  cache.clear();
}

async function fetchAllRecords(urlQuery) {
  const records = [];
  let offset = null;
  do {
    const base = "?pageSize=100";
    const url =
      tableUrl(PRODUCTS_TABLE) +
      (offset ? `${base}&offset=${encodeURIComponent(offset)}` : base) +
      urlQuery;
    const data = await request(url);
    records.push(...(data.records || []));
    offset = data.offset || null;
    if (records.length > 2000) break;
  } while (offset);
  return records;
}

export async function getProducts() {
  const records = await fetchAllRecords("");
  return records
    .map((record) => mapRecord(record, false))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function getProduct(id) {
  if (!id) return null;
  const data = await request(`${tableUrl(PRODUCTS_TABLE)}/${id}`);
  return data.fields ? mapRecord(data, true) : null;
}

// Lightweight "search index": products with their decoded embeddings, loaded
// once per cache window. `/api/visual-search` uses this so it never re-parses
// every embedding on every request.
export async function getSearchIndex() {
  return getCached("search-index", async () => {
    const records = await fetchAllRecords("");
    return records
      .map((record) => mapRecord(record, true))
      .filter((product) => Array.isArray(product.embedding) && product.embedding.length > 0);
  });
}

export async function getCategories() {
  const products = await getProducts();
  const seen = new Set();
  const categories = [];
  for (const product of products) {
    const name = (product.category || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    categories.push({ id: name, name });
  }
  return categories;
}

export async function ensureCategory(name) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("Category name is required.");
  return { id: clean, name: clean };
}

async function uploadAttachment(recordId, fieldName, { base64, contentType }) {
  const res = await fetch(
    `${CONTENT_API}/${BASE_ID}/${recordId}/${fieldName}/uploadAttachment`,
    {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        contentType,
        filename: `product-${recordId}-${Date.now()}.jpg`,
        file: base64,
      }),
    },
  );
  if (!res.ok) {
    let detail = `Image upload failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body?.error?.message || detail;
    } catch {
      /* ignore */
    }
    console.error("Airtable image upload error:", res.status, detail);
    throw new Error(detail);
  }
  return res.json();
}

function buildFields(data, includeImage) {
  const fields = {
    Name: data.name,
    Price: Number(data.price),
    Category: data.category,
    ProductURL: data.productURL || "",
  };
  if (data.embedding) fields.Embedding = encodeEmbedding(data.embedding);
  if (includeImage) fields.Image = [];
  return fields;
}

// Create a product without attachments/embeddings. Image + embedding uploads
// happen afterwards in the background so the user is never blocked on save.
export async function createProduct(data) {
  const fields = buildFields(data, true);
  const record = await request(tableUrl(PRODUCTS_TABLE), {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  if (data.imageBase64 && data.imageContentType) {
    await uploadAttachment(
      record.id,
      "Image",
      { base64: data.imageBase64, contentType: data.imageContentType },
    );
  }
  invalidateDataCache();
  return mapRecord(record);
}

export async function updateProduct(id, data) {
  const fields = buildFields(data, false);

  if (data.replaceImage) {
    fields.Image = [];
  }

  const record = await request(`${tableUrl(PRODUCTS_TABLE)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });

  if (data.imageBase64 && data.imageContentType) {
    await uploadAttachment(
      id,
      "Image",
      { base64: data.imageBase64, contentType: data.imageContentType },
    );
  }
  invalidateDataCache();
  return mapRecord(record);
}

// Upload an image for an existing record (used by the background worker).
export async function uploadProductImage(id, { base64, contentType }) {
  if (!base64) throw new Error("No image data provided.");
  await uploadAttachment(id, "Image", {
    base64,
    contentType: contentType || "image/jpeg",
  });
  invalidateDataCache();
  return { ok: true };
}

// Store the visual-search embedding for an existing record.
export async function updateProductEmbedding(id, embedding) {
  const fields = { Embedding: encodeEmbedding(embedding) };
  await request(`${tableUrl(PRODUCTS_TABLE)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
  invalidateDataCache();
  return { ok: true };
}

function categoryFormula(name) {
  const escaped = String(name || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `{Category}="${escaped}"`;
}

async function recordsForCategory(name) {
  return fetchAllRecords(
    `&filterByFormula=${encodeURIComponent(categoryFormula(name))}`,
  );
}

// Rename a category by updating every product that uses it.
export async function renameCategory(oldName, newName) {
  const cleanOld = String(oldName || "").trim();
  const cleanNew = String(newName || "").trim();
  if (!cleanOld || !cleanNew) throw new Error("Category name is required.");
  const records = await recordsForCategory(cleanOld);
  for (const record of records) {
    await request(`${tableUrl(PRODUCTS_TABLE)}/${record.id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { Category: cleanNew } }),
    });
  }
  invalidateDataCache();
  return { updated: records.length };
}

// Delete a category by removing every product that belongs to it.
export async function deleteCategory(name) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("Category name is required.");
  const records = await recordsForCategory(clean);
  for (const record of records) {
    await request(`${tableUrl(PRODUCTS_TABLE)}/${record.id}`, { method: "DELETE" });
  }
  invalidateDataCache();
  return { deleted: records.length };
}

export async function deleteProduct(id) {
  if (!id) throw new Error("Missing product id.");
  const result = await request(`${tableUrl(PRODUCTS_TABLE)}/${id}`, { method: "DELETE" });
  invalidateDataCache();
  return result;
}