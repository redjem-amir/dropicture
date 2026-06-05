// dropicture/app/frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.NODE_ENV === 'production' ? "/api/:path*" : "http://localhost:3001/api/:path*",
      },
    ];
  }
};

export default nextConfig;