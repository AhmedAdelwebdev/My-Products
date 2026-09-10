import { NextResponse } from "next/server";
import { getProduct, updateProduct, deleteProduct } from "@/lib/airtable";
import { decodeDataUrl } from "@/lib/image";

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const product = await getProduct(id);
    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (err) {
    console.error(`GET /api/products/${id}`, err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const error = validatePayload(body, /* requireImage */ false);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const image = body.image?.dataUrl
    ? decodeDataUrl(body.image.dataUrl)
    : { base64: null, contentType: null };

  try {
    const product = await updateProduct(id, {
      name: body.name,
      price: Number(body.price),
      category: body.category,
      productURL: body.productURL || "",
      embedding: body.embedding || null,
      replaceImage: body.replaceImage,
      imageBase64: image.base64,
      imageContentType: image.contentType || "image/jpeg",
    });
    return NextResponse.json({ product });
  } catch (err) {
    console.error(`PUT /api/products/${id}`, err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    await deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/products/${id}`, err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
}

function validatePayload(body, requireImage) {
  if (!body || typeof body !== "object") return "طلب غير صالح.";
  if (!body.name || !String(body.name).trim()) return "أدخل اسم المنتج.";
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return "أدخل سعراً صحيحاً بالجنيه المصري.";
  if (requireImage && !body.image?.dataUrl) return "يجب إرفاق صورة للمنتج.";
  return null;
}

function userMessage(err) {
  const message = err?.message || "";
  if (/Invalid Airtable credentials/i.test(message)) {
    return "بيانات اتصال Airtable غير صحيحة.";
  }
  if (/Airtable is not configured/i.test(message)) {
    return "لم يتم إعداد Airtable بعد.";
  }
  if (/Could not reach Airtable/i.test(message)) {
    return "تعذّر الوصول إلى Airtable. تحقق من الاتصال.";
  }
  return "تعذّر تحديث المنتج. حاول مرة أخرى.";
}