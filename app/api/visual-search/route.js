import { NextResponse } from "next/server";
import { getSearchIndex } from "@/lib/airtable";
import { cosineSimilarity, normalizeVector, similarityThreshold } from "@/lib/vectors";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const query = Array.isArray(body?.embedding) ? body.embedding.map(Number) : null;
  if (!query || query.length < 16 || query.some((value) => !Number.isFinite(value))) {
    return NextResponse.json(
      { error: "تعذّر حساب بيانات البحث. حاول مرة أخرى." },
      { status: 400 },
    );
  }

  try {
    const products = await getSearchIndex();
    const threshold = similarityThreshold();
    const normalizedQuery = normalizeVector(query);

    const scored = [];
    for (const product of products) {
      if (!Array.isArray(product.embedding) || product.embedding.length === 0) continue;
      const similarity = cosineSimilarity(normalizedQuery, product.embedding);
      if (!Number.isFinite(similarity)) continue;
      scored.push({ product, similarity });
    }

    scored.sort((a, b) => b.similarity - a.similarity);

    const results = scored
      .filter((entry) => entry.similarity >= threshold)
      .slice(0, 24)
      .map((entry) => ({
        ...entry.product,
        similarity: round(entry.similarity),
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("POST /api/visual-search", err);
    return NextResponse.json(
      { error: "تعذّر تنفيذ البحث بالصورة. حاول مرة أخرى." },
      { status: 500 },
    );
  }
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}