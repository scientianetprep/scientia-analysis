import type { Metadata, Viewport } from "next";
import { Poppins, Lora } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Scientia Prep",
    template: "%s | Scientia Prep"
  },
  description: "Premium educational platform for academic excellence",
  // Next.js auto-discovers /src/app/icon.svg and /src/app/apple-icon.svg
  // via its file convention, so we only need to override when we want a
  // legacy `.ico` fallback for older browsers. A missing /favicon.ico
  // 404'd in prod logs before we shipped the SVG icons alongside.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.svg", type: "image/svg+xml" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0e10",
};

import Script from "next/script";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${lora.variable} dark`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased selection:bg-tertiary selection:text-white" suppressHydrationWarning>
        <div className="bg-orb" aria-hidden="true" />
        <Script 
          src="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js" 
          strategy="beforeInteractive"
        />
        <link 
          rel="stylesheet" 
          type="text/css" 
          href="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css" 
        />
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster 
          richColors 
          position="top-right" 
          closeButton
          toastOptions={{
            style: {
              fontFamily: 'var(--font-poppins)',
              borderRadius: '12px',
            }
          }}
        />
      </body>
    </html>
  );
}
