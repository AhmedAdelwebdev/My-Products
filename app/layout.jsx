import { createHash } from "node:crypto";
import "./globals.css";
import SiteGate from "@/components/SiteGate";
import HistoryGuard from "@/components/HistoryGuard";

export const metadata = {
  title: "منتجاتي",
  description: "كتالوج منتجات بسيط مناسب للهاتف مع بحث مرئي بالكاميرا.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#2F7D5C",
};

export default function RootLayout({ children }) {
  const password = process.env.SITE_PASSWORD || "";
  const passHash = password
    ? createHash("sha256").update(password).digest("hex")
    : "";

  return (
    <html lang="ar" dir="rtl">
      <body>
        <HistoryGuard />
        <SiteGate passHash={passHash}>{children}</SiteGate>
      </body>
    </html>
  );
}