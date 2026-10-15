import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "こんだて帖",
    short_name: "こんだて帖",
    description: "1週間の献立・買い物・在庫をひと目で",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f6f1e9",
    theme_color: "#f6f1e9",
    icons: [
      { src: `${basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" },
      { src: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  };
}
