import { NextResponse } from "next/server";
import { deleteCategory } from "@/lib/airtable";

// Deletes a category and all the products inside it.
export async function DELETE(request, { params }) {
  const { name } = await params;
  try {
    const result = await deleteCategory(name);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`DELETE /api/categories/${name}`, err);
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
  return "تعذّر حذف القسم. حاول مرة أخرى.";
}