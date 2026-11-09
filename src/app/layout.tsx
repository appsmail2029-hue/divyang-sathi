import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaSetup from "@/components/PwaSetup";

export const metadata: Metadata = {
  title: {
    default: "Metro Assist — Divyangjan Assistance & Station Coordination",
    template: "%s · Metro Assist",
  },
  description:
    "Station coordination prototype for Delhi Metro Pink Line Divyangjan assistance, train tracking and station information broadcasts.",
  applicationName: "Metro Assist",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Metro Assist",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b2447",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
