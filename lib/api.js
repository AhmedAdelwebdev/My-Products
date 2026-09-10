"use client";

const REQUEST_TIMEOUT_MS = 20000;

async function clientFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* empty body */
    }
    if (!res.ok) {
      const message = body?.error || "حدث خطأ ما. حاول مرة أخرى.";
      throw new Error(message);
    }
    return body;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("انتهت مهلة الطلب. تحقق من اتصالك وحاول مجدداً.");
    }
    if (err instanceof TypeError) {
      throw new Error("تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.");
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export function fetchProducts() {
  return clientFetch("/api/products");
}

export function fetchCategories() {
  return clientFetch("/api/categories");
}

export function fetchProduct(id) {
  return clientFetch(`/api/products/${id}`);
}

export function createProduct(payload) {
  return clientFetch("/api/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id, payload) {
  return clientFetch(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(id) {
  return clientFetch(`/api/products/${id}`, { method: "DELETE" });
}

// Background-processing helpers (image + embedding are uploaded after saving).
export function uploadProductImage(id, image) {
  return clientFetch(`/api/products/${id}/image`, {
    method: "POST",
    body: JSON.stringify({ image }),
  });
}

export function updateProductEmbedding(id, embedding) {
  return clientFetch(`/api/products/${id}/embedding`, {
    method: "POST",
    body: JSON.stringify({ embedding }),
  });
}

export function renameCategory(oldName, newName) {
  return clientFetch("/api/categories", {
    method: "PATCH",
    body: JSON.stringify({ oldName, newName }),
  });
}

export function deleteCategory(name) {
  return clientFetch(`/api/categories/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export function visualSearch(embedding) {
  return clientFetch("/api/visual-search", {
    method: "POST",
    body: JSON.stringify({ embedding }),
  });
}