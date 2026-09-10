"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import CategoryCard from "@/components/CategoryCard";
import AddFlow from "@/components/AddFlow";
import ProductModal from "@/components/ProductModal";
import {
  deleteProduct,
  fetchCategories,
  fetchProducts,
  renameCategory,
  deleteCategory,
} from "@/lib/api";
import {
  subscribeProcessing,
  getProcessingSnapshot,
  retryImageJob,
} from "@/lib/background";

const VIEWS = [
  { key: "all", label: "كل المنتجات" },
  { key: "categories", label: "الأقسام" },
];

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden rounded-xl border border-line bg-white"
        >
          <div className="aspect-square bg-surface" />
          <div className="space-y-2 p-3">
            <div className="h-3.5 w-3/4 rounded bg-surface" />
            <div className="h-4 w-1/2 rounded bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const pathname = usePathname();
  const searchRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("all");
  const [activeCategory, setActiveCategory] = useState("");
  const [query, setQuery] = useState("");

  const [flow, setFlow] = useState(null); // { mode, product } | null
  const [selected, setSelected] = useState(null); // product preview bottom sheet
  const [notice, setNotice] = useState("");
  // { kind: "product" | "category", id } — which card is busy (in-card loader).
  const [busy, setBusy] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);

  const processingJobs = useSyncExternalStore(
    subscribeProcessing,
    getProcessingSnapshot,
    getProcessingSnapshot,
  );

  // id -> "pending" | "running" | "failed"
  const processingStatus = useMemo(() => {
    const map = new Map();
    for (const job of processingJobs) map.set(job.id, job.status);
    return map;
  }, [processingJobs]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([productsRes, categoriesRes]) => {
        if (cancelled) return;
        setProducts(productsRes.products);
        setCategories(categoriesRes.categories);
        setLoadError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message || "تعذّر تحميل المنتجات.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Focus the search input when arriving with ?search=1 (bottom nav Search).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("search") === "1") {
      searchRef.current?.focus();
      window.history.replaceState({}, "", "/");
    }
  }, [pathname]);

  // Same-page case (already on / when tapping Search): focus immediately.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const focusSearch = () => searchRef.current?.focus();
    window.addEventListener("mp:focus-search", focusSearch);
    return () => window.removeEventListener("mp:focus-search", focusSearch);
  }, []);

  // Lock body scroll while the add/edit flow is open.
  useEffect(() => {
    document.body.style.overflow = flow ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [flow]);

  // Warm up the visual-search model in the background so the first camera
  // search doesn't download it on the spot. The download is deferred until the
  // first user interaction so a big model fetch never competes with the
  // photo-save flow and slows the phone down.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let timer = null;
    const warm = () => {
      if (cancelled || timer) return;
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
      timer = window.setTimeout(async () => {
        try {
          const visual = await import("@/lib/visual-search");
          if (cancelled) return;
          await visual.getEmbedder();
        } catch {
          /* model warm-up is best effort */
        }
      }, 4000);
    };
    window.addEventListener("pointerdown", warm);
    window.addEventListener("keydown", warm);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, []);

  // When a background photo finishes uploading ("ready") or fully finishes
  // ("done"), refetch so the card loses its badge and picks up the uploaded
  // photograph immediately — no page reload needed.
  const prevCompletedIds = useRef("");
  useEffect(() => {
    const completedIds = processingJobs
      .filter((job) => job.status === "ready" || job.status === "done")
      .map((job) => job.id)
      .sort()
      .join(",");
    const prev = prevCompletedIds.current;
    prevCompletedIds.current = completedIds;
    if (prev === "" && completedIds === "") return;
    if (prev !== completedIds) {
      const timer = window.setTimeout(refresh, 400);
      return () => window.clearTimeout(timer);
    }
  }, [processingJobs, refresh]);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function handleDelete(product) {
    setBusy({ kind: "product", id: product.id });
    try {
      await deleteProduct(product.id);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
    } catch (err) {
      showNotice(err?.message || "تعذّر حذف المنتج.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRenameCategory(oldName, newName) {
    setBusy({ kind: "category", id: oldName });
    try {
      const result = await renameCategory(oldName, newName);
      refresh();
      showNotice(
        `تم تحديث اسم القسم إلى "${newName}" (${result.updated || 0} ${
          (result.updated || 0) === 1 ? "منتج" : "منتجات"
        }).`,
      );
      if (activeCategory === oldName) setActiveCategory(newName);
    } catch (err) {
      showNotice(err?.message || "تعذّر تعديل القسم.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteCategory(name) {
    setBusy({ kind: "category", id: name });
    try {
      const result = await deleteCategory(name);
      refresh();
      if (activeCategory === name) setActiveCategory("");
      showNotice(`تم حذف القسم (${result.deleted || 0} منتجات).`);
    } catch (err) {
      showNotice(err?.message || "تعذّر حذف القسم.");
    } finally {
      setBusy(null);
    }
  }

  const visibleProducts = useMemo(() => {
    let list = products;
    if (activeCategory) {
      list = list.filter((product) => product.category === activeCategory);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      const qPrice = q.replaceAll(",", "");
      list = list.filter((product) => {
        if (product.name.toLowerCase().includes(q)) return true;
        const priceStr = String(product.price ?? "");
        return priceStr.includes(qPrice);
      });
    }
    return list;
  }, [products, activeCategory, query]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const product of products) {
      if (product.category) {
        counts[product.category] = (counts[product.category] || 0) + 1;
      }
    }
    return counts;
  }, [products]);

  const showingCategoryProducts = view === "categories" && Boolean(activeCategory);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-4 sm:max-w-3xl lg:max-w-4xl">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">منتجاتي</h1>
        <button
          type="button"
          onClick={() => setFlow({ mode: "add", product: null })}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          <Plus size={18} />
          إضافة منتج
        </button>
      </header>

      {/* View selector + search */}
      <section className="mt-4 space-y-3" aria-label="أدوات الكتالوج">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
          {VIEWS.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setView(item.key);
                  setActiveCategory("");
                }}
                aria-pressed={active}
                className={`rounded-[10px] py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو السعر…"
          aria-label="البحث في المنتجات بالاسم أو السعر"
          className="h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
      </section>

      {/* Category products header */}
      {showingCategoryProducts && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("")}
            aria-label="الرجوع إلى الأقسام"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <ArrowRight size={22} />
          </button>
          <h2 className="text-lg font-semibold text-ink">
            {activeCategory}
            <span className="ms-1.5 text-sm font-normal text-muted">
              ({visibleProducts.length}{" "}
              {visibleProducts.length === 1 ? "منتج" : "منتجات"})
            </span>
          </h2>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="mt-5">
          <SkeletonGrid />
        </div>
      ) : loadError ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-center">
          <p className="text-sm text-ink">{loadError}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : view === "all" && visibleProducts.length === 0 ? (
        <div className="mt-6 rounded-xl bg-surface p-8 text-center">
          <p className="text-sm text-ink">
            {query
              ? "لا توجد منتجات تطابق بحثك."
              : "لا توجد منتجات بعد. أضف أول منتج للبدء."}
          </p>
        </div>
      ) : view === "all" ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              processing={
                processingStatus.get(product.id) === "running" ||
                processingStatus.get(product.id) === "pending"
              }
              imageFailed={processingStatus.get(product.id) === "failed"}
              onRetryImage={() => retryImageJob(product.id)}
              busy={busy?.kind === "product" && busy.id === product.id}
              onEdit={(item) => setFlow({ mode: "edit", product: item })}
              onOpen={(item) => setSelected(item)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : view === "categories" && !activeCategory ? (
        categories.length === 0 ? (
          <div className="mt-6 rounded-xl bg-surface p-8 text-center">
            <p className="text-sm text-ink">
              لا توجد أقسام بعد. أضف منتجاً واختر قسماً لإنشاء واحد.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                count={categoryCounts[category.name] || 0}
                busy={busy?.kind === "category" && busy.id === category.name}
                onOpen={(name) => setActiveCategory(name)}
                onRename={handleRenameCategory}
                onDelete={handleDeleteCategory}
              />
            ))}
          </div>
        )
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              processing={
                processingStatus.get(product.id) === "running" ||
                processingStatus.get(product.id) === "pending"
              }
              imageFailed={processingStatus.get(product.id) === "failed"}
              onRetryImage={() => retryImageJob(product.id)}
              busy={busy?.kind === "product" && busy.id === product.id}
              onEdit={(item) => setFlow({ mode: "edit", product: item })}
              onOpen={(item) => setSelected(item)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Product preview bottom sheet */}
      {selected && (
        <ProductModal product={selected} onClose={() => setSelected(null)} />
      )}

      {/* Add / edit flow */}
      {flow && (
        <AddFlow
          product={flow.product}
          categories={categories}
          onDone={() => {
            setFlow(null);
            refresh();
          }}
          onClose={() => setFlow(null)}
        />
      )}

      {/* Transient notice */}
      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <p className="animate-fade-in max-w-sm rounded-2xl bg-ink px-4 py-2.5 text-center text-sm text-white shadow-md">
            {notice}
          </p>
        </div>
      )}

      <BottomNav />
    </main>
  );
}