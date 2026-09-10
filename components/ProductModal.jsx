"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { formatEGP } from "@/lib/format";
import { ProductImage } from "./ProductCard";

export default function ProductModal({ product, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="إغلاق المعاينة"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        className="relative w-full max-w-md animate-pop overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق المعاينة"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        >
          <X size={20} />
        </button>

        <div className="aspect-square w-full bg-surface">
          <ProductImage image={product.image} name={product.name} className="h-full w-full" />
        </div>

        <div className="px-5 pb-6 pt-4">
          <h2 className="text-xl font-semibold text-ink">{product.name}</h2>
          <p className="mt-1 text-2xl font-bold text-primary">
            {formatEGP(product.price)}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-primary-soft text-base font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}