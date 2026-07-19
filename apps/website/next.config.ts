// dropicture/apps/website/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;