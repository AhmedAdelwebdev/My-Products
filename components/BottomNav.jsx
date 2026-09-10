"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Camera } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchActive, setSearchActive] = useState(false);

  useEffect(() => {
    const sync = () =>
      setSearchActive(
        new URLSearchParams(window.location.search).get("search") === "1",
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const isHome = pathname === "/";
  const isCamera = pathname === "/camera-search";

  function navigate(path, search = false) {
    setSearchActive(search);
    router.push(path);
    if (search) window.dispatchEvent(new Event("mp:focus-search"));
  }

  const baseItem = "flex flex-col items-center gap-1 text-muted transition-colors";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="التنقل الرئيسي"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 items-center px-4 pt-1.5">
        <button
          type="button"
          onClick={() => navigate("/?search=1", true)}
          aria-label="البحث في المنتجات"
          className={`${baseItem} py-2 ${searchActive ? "text-primary" : ""}`}
        >
          <Search size={22} strokeWidth={2} />
          <span className="text-[11px] font-medium">البحث</span>
        </button>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              // Pressing the camera button always means a NEW search: drop the
              // previous query so the page opens the camera screen fresh and
              // never re-runs the old results.
              try {
                window.sessionStorage?.removeItem("mp:camera-last-query");
              } catch {
                /* ignore */
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("mp:camera-search"));
              }
              navigate("/camera-search");
            }}
            aria-label="البحث بالكاميرا"
            className="-mt-6 flex flex-col items-center gap-1"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform ${
                isCamera
                  ? "scale-105 bg-primary-dark"
                  : "bg-primary shadow-[0_4px_12px_rgba(47,125,92,0.35)]"
              }`}
            >
              <Camera size={26} />
            </span>
            <span
              className={`text-[11px] font-medium ${
                isCamera ? "text-primary-dark" : "text-muted"
              }`}
            >
              التصوير
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="الرئيسية"
          className={`${baseItem} py-2 ${isHome && !searchActive ? "text-primary" : ""}`}
        >
          <Home size={22} strokeWidth={2} />
          <span className="text-[11px] font-medium">الرئيسية</span>
        </button>
      </div>
    </nav>
  );
}