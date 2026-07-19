// dropicture/apps/saas/frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  output: "standalone",
  devIndicators: false,
};

export default nextConfig;