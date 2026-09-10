import { NextResponse } from "next/server";
import { uploadProductImage } from "@/lib/airtable";
import { decodeDataUrl } from "@/lib/image";

export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const { base64, contentType } = decodeDataUrl(body?.image?.dataUrl);
  if (!base64) {
    return NextResponse.json({ error: "يجب إرفاق صورة صالحة للمنتج." }, { status: 400 });
  }

  try {
    await uploadProductImage(id, { base64, contentType: contentType || "image/jpeg" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/products/${id}/image`, err);
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
  return "تعذّر رفع صورة المنتج. حاول مرة أخرى.";
}