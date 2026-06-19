import type { Metadata } from "next";
import { Outfit, Sora } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Dubai AI Broker",
  description: "AI broker assistant for Dubai real-estate agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${sora.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
