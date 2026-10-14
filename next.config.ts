import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output dibutuhkan Dockerfile (COPY .next/standalone)
  output: "standalone",
};

export default nextConfig;
