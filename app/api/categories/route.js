import { NextResponse } from "next/server";
import { getCategories, ensureCategory, renameCategory } from "@/lib/airtable";

export async function GET() {
  try {
    const categories = await getCategories();
    return jsonWithCache({ categories });
  } catch (err) {
    console.error("GET /api/categories", err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
}

// Always serve the freshest list (no browser/proxy cache) so a just-saved
// product — and its new photograph — shows up immediately.
function jsonWithCache(payload) {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const name = String(body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "اسم القسم مطلوب." }, { status: 400 });
  }

  try {
    const category = await ensureCategory(name);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    console.error("POST /api/categories", err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
}

// Rename a category across all of its products.
export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const oldName = String(body?.oldName || "").trim();
  const newName = String(body?.newName || "").trim();
  if (!oldName) {
    return NextResponse.json({ error: "اسم القسم مطلوب." }, { status: 400 });
  }
  if (!newName) {
    return NextResponse.json({ error: "أدخل الاسم الجديد للقسم." }, { status: 400 });
  }

  try {
    const result = await renameCategory(oldName, newName);
    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH /api/categories", err);
    return NextResponse.json({ error: userMessage(err) }, { status: 500 });
  }
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
  return "تعذّر إدارة الأقسام. حاول مرة أخرى.";
}