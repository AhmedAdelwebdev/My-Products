import { NextResponse } from "next/server";
import { updateProductEmbedding } from "@/lib/airtable";

export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const embedding = Array.isArray(body?.embedding) ? body.embedding.map(Number) : null;
  if (!embedding || embedding.length < 16 || embedding.some((value) => !Number.isFinite(value))) {
    return NextResponse.json(
      { error: "بيانات التعرف غير صالحة." },
      { status: 400 },
    );
  }

  try {
    await updateProductEmbedding(id, embedding);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/products/${id}/embedding`, err);
    return NextResponse.json(
      { error: userMessage(err) },
      { status: 500 },
    );
  }
}

function userMessage(err) {
  const message = err?.message || "";
  if (/Invalid Airtable credentials/i.test(message)) {
    return "بيانات اتصال Airtable غير صحيحة.";
  }
  if (/Could not reach Airtable/i.test(message)) {
    return "تعذّر الوصول إلى Airtable. تحقق من الاتصال.";
  }
  return "تعذّر حفظ بيانات التعرف على المنتج.";
}