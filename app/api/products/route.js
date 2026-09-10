import { NextResponse } from "next/server";
import { getProducts, createProduct, ensureCategory } from "@/lib/airtable";
import { decodeDataUrl } from "@/lib/image";

export async function GET() {
  try {
    const products = await getProducts();
    const response = NextResponse.json({ products });
    // Always serve the freshest catalog (no browser/proxy cache) so a
    // just-uploaded photograph appears immediately after the background
    // upload finishes — no page reload required.
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("GET /api/products", err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const error = validatePayload(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const { base64, contentType } = decodeDataUrl(body.image?.dataUrl);

  try {
    await ensureCategory(body.category);
    const product = await createProduct({
      name: body.name,
      price: Number(body.price),
      category: body.category,
      productURL: body.productURL || "",
      embedding: body.embedding || null,
      imageBase64: base64,
      imageContentType: contentType || "image/jpeg",
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error("POST /api/products", err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
}

function validatePayload(body) {
  if (!body || typeof body !== "object") return "طلب غير صالح.";
  if (!body.name || !String(body.name).trim()) return "أدخل اسم المنتج.";
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return "أدخل سعراً صحيحاً بالجنيه المصري.";
  if (!body.category || !String(body.category).trim()) return "اختر فئة.";
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
  return "تعذّر حفظ المنتج. حاول مرة أخرى.";
}