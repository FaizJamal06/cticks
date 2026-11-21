import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // id stays "/" (what older installs got from start_url "/"), so Chrome keeps treating them as the same app.
    id: "/",
    name: "cTicks",
    short_name: "cTicks",
    description: "Tick it or pay for it.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0f0d",
    theme_color: "#0f0f0d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
