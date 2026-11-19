import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, so the Docker image needs no node_modules
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
