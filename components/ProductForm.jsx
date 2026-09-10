"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Plus, X } from "lucide-react";
import { formatEGP } from "@/lib/format";

export default function ProductForm({
  image,
  initial = null,
  categories = [],
  saving = false,
  error = "",
  onSubmit,
  onClose,
  onRetake,
}) {
  const [name, setName] = useState(initial?.name || "");
  const [price, setPrice] = useState(
    initial?.price != null ? String(initial.price) : "",
  );
  const [category, setCategory] = useState(
    initial?.category || categories[0]?.name || "",
  );
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const categoryOptions = useMemo(() => {
    const names = categories.map((item) => item.name).filter(Boolean);
    if (initial?.category && !names.includes(initial.category)) {
      names.push(initial.category);
    }
    return names;
  }, [categories, initial]);

  const selectedCategory = category || categoryOptions[0] || "";

  const normalizedPrice = price.replace(/,/g, "");

  function validate() {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "أدخل اسم المنتج.";
    const parsedPrice = Number(normalizedPrice);
    if (
      normalizedPrice.trim() === "" ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      nextErrors.price = "أدخل سعراً صحيحاً بالجنيه المصري.";
    }
    const chosen = addingCategory ? newCategory.trim() : selectedCategory;
    if (!chosen) nextErrors.category = "اختر فئة أو أضف فئة جديدة.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      price: Number(normalizedPrice),
      category: addingCategory ? newCategory.trim() : selectedCategory,
    });
  }

  const previewName = name.trim() || (initial?.name ?? "اسم المنتج");
  const previewPrice = formatEGP(Number(price) || Number(initial?.price) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="إغلاق نموذج المنتج"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="تفاصيل المنتج"
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-4 pb-8 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-sheet-up sm:rounded-2xl sm:pb-6"
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />

        {/* Preview card */}
        <div className="flex gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="معاينة المنتج"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 self-center">
            <p className="truncate text-base font-semibold text-ink">{previewName}</p>
            <p className="mt-1 text-lg font-bold text-primary">{previewPrice}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="pf-name" className="mb-1 block text-sm font-medium text-ink">
              اسم المنتج
            </label>
            <input
              id="pf-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: سماعات لاسلكية"
              autoFocus
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            {errors.name && <p className="mt-1 text-sm text-danger">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="pf-price" className="mb-1 block text-sm font-medium text-ink">
              السعر (ج.م)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                ج.م
              </span>
              <input
                id="pf-price"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="1500"
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 pe-12 text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>
            {errors.price && <p className="mt-1 text-sm text-danger">{errors.price}</p>}
          </div>

          <div>
            <label htmlFor="pf-category" className="mb-1 block text-sm font-medium text-ink">
              الفئة
            </label>
            {addingCategory ? (
              <div className="flex gap-2">
                <input
                  id="pf-category"
                  type="text"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="اسم الفئة الجديدة"
                  autoFocus
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
                <button
                  type="button"
                  onClick={() => setAddingCategory(false)}
                  aria-label="إلغاء الفئة الجديدة"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  id="pf-category"
                  value={selectedCategory}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  {categoryOptions.length === 0 && (
                    <option value="">اختر فئة</option>
                  )}
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  aria-label="إضافة فئة"
                  className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-primary px-3 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
                >
                  <Plus size={18} />
                  إضافة
                </button>
              </div>
            )}
            {errors.category && (
              <p className="mt-1 text-sm text-danger">{errors.category}</p>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3" dir="ltr">
          <button
            type="button"
            onClick={onRetake}
            aria-label="تغيير الصورة"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-ink"
            title="تغيير الصورة"
          >
            <Camera size={22} />
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-70"
          >
            {saving && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {initial ? "حفظ التغييرات" : "حفظ المنتج"}
          </button>
        </div>
      </form>
    </div>
  );
}