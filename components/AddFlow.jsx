"use client";

import { useState } from "react";
import Camera from "./Camera";
import ProductForm from "./ProductForm";
import { createProduct, updateProduct } from "@/lib/api";
import { queueImageProcessing } from "@/lib/background";

export default function AddFlow({ product = null, categories = [], onDone, onClose }) {
  const isEdit = Boolean(product);
  const [phase, setPhase] = useState(isEdit ? "form" : "camera");
  const [image, setImage] = useState(product?.image || null);
  const [imageChanged, setImageChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleCapture(dataUrl) {
    setImage(dataUrl);
    if (isEdit) setImageChanged(true);
    setPhase("form");
  }

  // Saves only the text fields (instant). The image + visual fingerprint are
  // processed in the background so the user can keep adding products.
  async function handleSubmit(data) {
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await updateProduct(product.id, {
          name: data.name,
          price: data.price,
          category: data.category,
        });
        if (imageChanged && image) {
          queueImageProcessing(product.id, image);
        }
      } else {
        const response = await createProduct({
          name: data.name,
          price: data.price,
          category: data.category,
        });
        if (image) {
          queueImageProcessing(response.product.id, image);
        }
      }
      onDone();
    } catch (err) {
      setError(err?.message || "Could not save the product. Please try again.");
      setSaving(false);
    }
  }

  if (phase === "camera") {
    return (
      <Camera
        onCapture={handleCapture}
        onBack={onClose}
        title={isEdit ? "تغيير الصورة" : "إضافة منتج"}
      />
    );
  }

  return (
    <ProductForm
      image={image}
      initial={product}
      categories={categories}
      saving={saving}
      error={error}
      onSubmit={handleSubmit}
      onClose={onClose}
      onRetake={() => {
        setError("");
        setPhase("camera");
      }}
    />
  );
}