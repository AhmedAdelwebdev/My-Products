"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Keeps the OS back button inside the app.
//
// On a normal in-app jump (Home -> Camera) the browser already returns to the
// previous app page, so nothing is needed. The problem is the app's first
// entry: when a page is loaded directly (deep link / PWA stand alone / fresh
// tab) pressing back would exit the site. This guard reserves one extra
// history entry on load. When the back button pops it, the user is brought
// back into the app at the home page instead of leaving, and the guard is
// re-armed so the behavior keeps working.
export default function HistoryGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const seeded = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || seeded.current) return;
    seeded.current = true;

    window.history.pushState({ mp: "guard" }, "");

    const onPop = () => {
      const state = window.history.state;
      if (state?.mp === "guard") {
        // Popped back onto the reserved guard: the page above it was the
        // last real app page, and going any further would leave the site.
        // Land on the home page and re-arm the guard so it keeps working.
        // The replace is deferred so Next finishes its own popstate handling
        // first; otherwise the immediate navigation is dropped silently.
        window.setTimeout(() => router.replace("/"), 0);
        window.setTimeout(() => {
          window.history.pushState({ mp: "guard" }, "");
        }, 0);
        return;
      }
      // Popped the guard itself (deep link / PWA stand alone / fresh tab).
      // The only real page remains and a further back would exit the site,
      // so bounce to the home page (still inside the app) and re-arm the
      // guard so the behavior keeps working on every subsequent back.
      if (pathname !== window.location.pathname) return;
      window.setTimeout(() => router.replace("/"), 80);
      window.setTimeout(() => {
        window.history.pushState({ mp: "guard" }, "");
      }, 0);
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router, pathname]);

  return null;
}