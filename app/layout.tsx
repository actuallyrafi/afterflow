import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa";

const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-nunito", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Afterflow",
  description: "Keep the people you meet in your life. Made for the Grok Bot Community Engineering London Hackathon.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Afterflow", statusBarStyle: "default" },
  // v4.1c PWA (D21). Icons by Pixel (design-spec-v41c.md §6). Token pages swap in a per-user manifest.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/afterflow-icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  // Next 15.5 emits only mobile-web-app-capable for appleWebApp.capable; older iOS still reads the apple- one.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
};

// Set once per load, never animated: a slightly warmer ground in the morning and evening,
// and solid chrome on devices that struggle with blur.
const BOOT = `(function(){try{var h=new Date().getHours(),d=document.documentElement;d.dataset.tod=h<5?"night":h<11?"morning":h<17?"day":h<21?"evening":"night";var m=navigator.deviceMemory,c=navigator.hardwareConcurrency;if((m&&m<=2)||(c&&c<=2))d.dataset.lowfx="1";}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${nunito.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
