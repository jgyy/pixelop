import type { Metadata, Viewport } from "next";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jade Lotus Ascension — a pixel xianxia RPG",
  description: "Guide Lin Yue, a female cultivator of the Azure Cloud Sect, from Qi Condensation to Immortal Ascension.",
};

export const viewport: Viewport = {
  themeColor: "#120c22",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
