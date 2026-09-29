import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "@fontsource/be-vietnam-pro/400-italic.css";
import "@fontsource/be-vietnam-pro/700-italic.css";
import "./enhancements.css";
export const metadata: Metadata = {
  title: "MITUNI · Học tập số",
  description: "Không gian học tập số MIT University",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MITUNI LMS",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#842d29",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
