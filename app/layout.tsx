import type { Metadata, Viewport } from "next";
import "./globals.css";

const TAGLINE = "Tick it or pay for it.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cticks.vercel.app"),
  title: `cTicks · ${TAGLINE}`,
  description: "Pick daily tasks with friends. Tick them off before midnight or pay up. Free, for 2 to 6 people.",
  appleWebApp: { capable: true, title: "cTicks", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "cTicks",
    title: `cTicks · ${TAGLINE}`,
    description: "Daily tasks, friends watching, money on the line. Miss a day, pay your friend.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `Tik the mascot and the cTicks logo. ${TAGLINE}` }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0f0f0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The landing page's inline script sets data-* flags on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
