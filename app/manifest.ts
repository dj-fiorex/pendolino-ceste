import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pendolino Ceste",
    short_name: "Pendolino",
    description: "Le Ceste del frantoio: chi le ha e dove sono.",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#4a6741",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
