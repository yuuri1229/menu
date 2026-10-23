import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MEGURU",
    short_name: "MEGURU",
    description: "献立がめぐる、暮らしが整う",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f4f3f1",
    theme_color: "#f4f3f1",
    icons: [
      { src: `${basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" },
      { src: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  };
}
