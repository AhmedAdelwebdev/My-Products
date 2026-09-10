"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, SearchX, RefreshCw, X } from "lucide-react";
import Camera from "@/components/Camera";
import BottomNav from "@/components/BottomNav";
import { SearchResultCard } from "@/components/ProductCard";
import ProductModal from "@/components/ProductModal";
import { visualSearch } from "@/lib/api";

// The last photo the user searched with, kept in sessionStorage so it survives
// reloads / in-app back (HistoryGuard), restoring the results screen. Pressing
// the camera-search button again clears it — wherever you are, the button always
// cancels the previous search and opens the camera screen for a fresh one.
const QUERY_KEY = "mp:camera-last-query";

function readLastQuery() {
  try {
    return window.sessionStorage.getItem(QUERY_KEY) || null;
  } catch {
    return null;
  }
}

function saveLastQuery(dataUrl) {
  try {
    window.sessionStorage.setItem(QUERY_KEY, dataUrl);
  } catch {
    /* storage unavailable — the current page still works */
  }
}

function clearLastQuery() {
  try {
    window.sessionStorage.removeItem(QUERY_KEY);
  } catch {
    /* ignore */
  }
}

export default function CameraSearch() {
  const [phase, setPhase] = useState("camera"); // camera | searching | results | error
  const [searchMessage, setSearchMessage] = useState("جاري البحث عن منتجات مشابهة…");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [seenOnce, setSeenOnce] = useState(false);
  const [queryImage, setQueryImage] = useState(null);
  // Token so "إلغاء" can abandon an in-flight search: bumping it makes every
  // pending search() give up before it flips the UI back to the results.
  const searchGen = useRef(0);

  const search = useCallback(async (dataUrl) => {
    const gen = ++searchGen.current;
    saveLastQuery(dataUrl);
    setQueryImage(dataUrl);
    setPhase("searching");
    try {
      setSearchMessage("جاري البحث عن منتجات مشابهة…");
      const visual = await import("@/lib/visual-search");
      if (gen !== searchGen.current) return;
      const embedding = await visual.encodeImage(dataUrl);
      if (gen !== searchGen.current) return;
      setSearchMessage("مقارنة الصور…");
      const response = await visualSearch(embedding);
      if (gen !== searchGen.current) return;
      setResults(response.results || []);
      setSeenOnce(true);
      setPhase("results");
    } catch (err) {
      if (gen !== searchGen.current) return;
      setPhase("error");
      setSearchMessage(
        err?.message || "تعذّر إكمال البحث بالصورة. حاول مرة أخرى.",
      );
    }
  }, []);

  // Preload the CLIP model as soon as this screen appears (including direct
  // visits where the home warm-up never fired), so the first capture → search
  // doesn't sit through a big model download on the spot.
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("@/lib/visual-search")
      .then((visual) => visual.getEmbedder().catch(() => {}))
      .catch(() => {});
  }, []);

  // Re-run the previous search when arriving here after having searched in
  // this session (avoids bouncing back to the capture screen every time).
  const autoSearched = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const lastQuery = readLastQuery();
    if (!lastQuery || autoSearched.current) return;
    const timer = window.setTimeout(() => {
      autoSearched.current = true;
      search(lastQuery);
    }, 0);
    // Note: dev StrictMode double-invokes effects; the guard is set inside the
    // timer callback so the cleanup cannot cancel the search before it runs.
    return () => window.clearTimeout(timer);
  }, [search]);

  const reset = useCallback(() => {
    searchGen.current += 1; // abandon any search still in flight
    clearLastQuery();
    setQueryImage(null);
    setResults([]);
    setSelected(null);
    setPhase("camera");
  }, []);

  // Same-page case: already on this screen when the camera-search button is
  // pressed again — the stored query was already cleared, and this event
  // cancels any in-flight search and reopens the fresh camera screen in place.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("mp:camera-search", reset);
    return () => window.removeEventListener("mp:camera-search", reset);
  }, [reset]);

  return (
    <main className="min-h-screen">
      {phase === "camera" && (
        <Camera
          onCapture={(dataUrl) => {
            setQueryImage(dataUrl);
            search(dataUrl);
          }}
          onBack={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
          title="البحث بالصورة"
        />
      )}

      {/* Searching phase */}
      {phase === "searching" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white px-8">
          <div className="relative h-40 w-40 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {queryImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={queryImage}
                alt="الصورة الملتقطة"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-muted">
                بدون صورة
              </span>
            )}
          </div>
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <p className="text-sm font-medium text-ink">{searchMessage}</p>
          {!seenOnce && (
            <p className="max-w-xs text-center text-xs leading-relaxed text-muted">
              في أول بحث يُحمَّل نموذج التعرف على الصور مرة واحدة وقد يستغرق لحظات.
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <X size={16} />
            إلغاء
          </button>
        </div>
      )}

      {/* Error phase */}
      {phase === "error" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
          <SearchX size={40} className="text-muted" />
          <p className="max-w-xs text-sm leading-relaxed text-ink">{searchMessage}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <RefreshCw size={16} />
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Results phase */}
      {phase === "results" && (
        <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-4 sm:max-w-3xl lg:max-w-4xl">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={queryImage}
                  alt="الصورة الملتقطة"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink">نتائج البحث</h1>
                <p className="mt-0.5 text-sm text-muted">
                  {results.length > 0
                    ? `${results.length} ${results.length === 1 ? "نتيجة" : "نتائج"}`
                    : "لا توجد نتائج"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <CameraIcon size={17} />
              بحث جديد
            </button>
          </header>

          {results.length === 0 ? (
            <div className="mt-10 rounded-xl bg-surface p-8 text-center">
              <p className="text-ink">لم يتم العثور على منتجات مشابهة.</p>
              <p className="mt-1 text-sm text-muted">
                حاول التقاط صورة أخرى مع توسيط المنتج داخل الإطار.
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                بحث من جديد
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((product, index) => (
                <SearchResultCard
                  key={product.id}
                  product={product}
                  index={index}
                  onClick={() => setSelected(product)}
                />
              ))}
            </div>
          )}

          <BottomNav />
        </div>
      )}

      {selected && (
        <ProductModal product={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}