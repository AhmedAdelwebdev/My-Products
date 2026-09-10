"use client";

import { useState } from "react";
import { MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { formatEGP } from "@/lib/format";

export function ProductImage({ image, name, className = "" }) {
  if (!image) {
    return (
      <div
        className={`flex items-center justify-center bg-surface ${className}`}
        aria-label={`${name} بدون صورة`}
      >
        <span className="text-xs text-muted">بدون صورة</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={name} className={`object-cover ${className}`} loading="lazy" />
  );
}

export function ProductCard({
  product,
  onEdit,
  onDelete,
  onOpen,
  index = 0,
  processing = false,
  imageFailed = false,
  onRetryImage,
  busy = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleMenuAction(action, event) {
    if (event) event.stopPropagation();
    if (action === "edit") {
      onEdit(product);
      setMenuOpen(false);
    }
    if (action === "delete") {
      if (confirmDelete) {
        onDelete(product);
        setMenuOpen(false);
        setConfirmDelete(false);
      } else {
        setConfirmDelete(true);
      }
    }
  }

  return (
    <article
      className={`relative animate-fade-up rounded-xl border border-line bg-white transition-shadow ${
        menuOpen ? "shadow-lg" : "hover:shadow-sm"
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      onClick={() => onOpen?.(product)}
    >
      <div className="relative aspect-square overflow-hidden rounded-t-[11px] bg-surface">
        <ProductImage image={product.image} name={product.name} className="h-full w-full" />

        {processing && (
          <span className="absolute inset-x-2 top-2 flex items-center justify-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/40 border-t-white" />
            قيد المعالجة
          </span>
        )}

        {imageFailed && (
          <span className="absolute inset-x-2 top-2 flex items-center justify-between gap-1.5 rounded-full bg-danger px-2 py-1 text-[11px] font-medium text-white">
            <span>فشل رفع الصورة</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRetryImage?.();
              }}
              className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold transition-colors hover:bg-white/30"
            >
              <RefreshCw size={11} />
              إعادة المحاولة
            </button>
          </span>
        )}
      </div>

      <div className="relative px-3 pb-3 pt-2">
        <div className="flex items-center gap-1">
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {product.name}
          </h3>
          <button
            type="button"
            aria-label={`خيارات ${product.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
              setConfirmDelete(false);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <MoreVertical size={18} />
          </button>
        </div>

        <p className="mt-1 text-base font-bold text-primary">{formatEGP(product.price)}</p>

        {/* Menu overlays the card (absolute) so it never changes the card's
            height. It spans the full inner width of the card and is anchored
            below the kebab button, so it can never be clipped or overflow. */}
        {menuOpen && (
          <div className="absolute left-0 right-0 top-12 z-10 animate-fade-in overflow-hidden rounded-lg border border-line bg-white shadow-md">
            <button
              type="button"
              onClick={(event) => handleMenuAction("edit", event)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface"
            >
              <Pencil size={16} className="text-muted" />
              تعديل
            </button>
            <button
              type="button"
              onClick={(event) => handleMenuAction("delete", event)}
              className={`flex w-full items-center gap-2.5 border-t border-line px-3 py-2.5 text-sm transition-colors ${
                confirmDelete
                  ? "bg-danger text-white"
                  : "text-danger hover:bg-red-50"
              }`}
            >
              <Trash2 size={16} />
              {confirmDelete ? "تأكيد الحذف؟" : "حذف"}
            </button>
          </div>
        )}
      </div>
    {/* Busy overlay — a simple in-card loader while the product is being
          deleted (or otherwise updated). Covers the whole card so no other
          action can be triggered while it spins. */}
      {busy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/70">
          <span
            aria-label="جاري المعالجة"
            className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
          />
        </div>
      )}
    </article>
  );
}

export function SearchResultCard({ product, onClick, index = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-fade-up overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-primary/40"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <span className="block aspect-square overflow-hidden bg-surface">
        <ProductImage image={product.image} name={product.name} className="h-full w-full" />
      </span>
      <span className="block px-3 pb-3 pt-2">
        <span className="block truncate text-sm font-medium text-ink">{product.name}</span>
        <span className="mt-1 block text-lg font-bold text-primary">
          {formatEGP(product.price)}
        </span>
      </span>
    </button>
  );
}