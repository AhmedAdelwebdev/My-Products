"use client";

import { useState } from "react";
import { Check, MoreVertical, Pencil, Trash2, X } from "lucide-react";

export default function CategoryCard({ category, count, onOpen, onRename, onDelete, busy = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  function commitRename(event) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || value === category.name) {
      setEditing(false);
      return;
    }
    onRename(category.name, value);
    setEditing(false);
  }

  return (
    <div className="relative animate-fade-up rounded-xl border border-line bg-white transition-shadow hover:shadow-sm">
      {editing ? (
        <form onSubmit={commitRename} className="flex items-center gap-2 p-3">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="اسم القسم الجديد"
            autoFocus
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
          <button
            type="submit"
            aria-label="حفظ الاسم"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-dark"
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            aria-label="إلغاء"
            onClick={() => {
              setEditing(false);
              setDraft(category.name);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </form>
      ) : (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onOpen(category.name)}
            className="flex min-w-0 flex-1 items-center gap-3 p-4 text-start transition-colors hover:bg-surface/60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Pencil size={20} className="rotate-45" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-ink">
                {category.name}
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                {count} {count === 1 ? "منتج" : "منتجات"}
              </span>
            </span>
          </button>

          <div className="relative ml-3 shrink-0">
            <button
              type="button"
              aria-label={`خيارات القسم ${category.name}`}
              onClick={() => {
                setMenuOpen((open) => !open);
                setConfirmDelete(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      )}

      {menuOpen && !editing && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 animate-fade-in overflow-hidden rounded-lg border border-line bg-white shadow-md">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setDraft(category.name);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface"
          >
            <Pencil size={16} className="text-muted" />
            تعديل اسم القسم
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDelete) {
                onDelete(category.name);
                setMenuOpen(false);
                setConfirmDelete(false);
              } else {
                setConfirmDelete(true);
              }
            }}
            className={`flex w-full items-center gap-2.5 border-t border-line px-3 py-2.5 text-sm transition-colors ${
              confirmDelete
                ? "bg-danger text-white"
                : "text-danger hover:bg-red-50"
            }`}
          >
            <Trash2 size={16} />
            {confirmDelete ? "تأكيد؟ سيُحذف كل المنتجات" : "حذف القسم"}
          </button>
        </div>
      )}

      {/* Busy overlay — simple in-card loader during rename/delete. */}
      {busy && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-white/70">
          <span
            aria-label="جاري المعالجة"
            className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
          />
        </div>
      )}
    </div>
  );
}