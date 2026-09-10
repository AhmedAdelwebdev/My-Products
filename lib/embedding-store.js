// Embedding storage abstraction.
//
// Embeddings are stored as a compact JSON string in Airtable's "Embedding"
// field. Values are quantized to 4 decimal places (~3.4 KB per product vs
// ~10 KB for raw floats) — cosine similarity is preserved to well under the
// visual-search threshold, so match ordering is unaffected, while a
// 1000-product index stays ~3.4 MB instead of ~10 MB. If a different/vector
// store is chosen later, only the two functions below need to change —
// nothing else in the app reads/writes raw embedding values.

const round4 = (x) => Math.round(x * 10000) / 10000;

export function encodeEmbedding(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return "";
  }
  return JSON.stringify(embedding.map((v) => round4(Number(v))));
}

export function decodeEmbedding(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const numbers = parsed.map(Number);
    if (numbers.length !== parsed.length) return null;
    return numbers;
  } catch {
    return null;
  }
}