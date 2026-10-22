import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Bundled files, so the production build does not fetch Google Fonts.
const plusJakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-plus-jakarta",
  weight: "500 800",
  display: "swap",
});

const sourceSans = localFont({
  src: "../fonts/source-sans-3-latin.woff2",
  variable: "--font-source-sans",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SKYMAP Stability Management System",
  description: "Stability Management System for Skymap Pharmaceuticals Pvt. Ltd. Developed by Satyajit Patri from Odisha.",
  authors: [{ name: "Satyajit Patri" }],
  creator: "Satyajit Patri",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/brand/skymap-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#071433",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${sourceSans.variable} h-full`}
    >
      <body className="glass-app min-h-full antialiased">{children}</body>
    </html>
  );
}
