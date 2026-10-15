import type { NextConfig } from "next";

// GitHub Pages のプロジェクトページ（https://<user>.github.io/<repo>/）で配信するため、
// デプロイ時は actions/configure-pages が出すパス（例: /menu）を basePath にする。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
