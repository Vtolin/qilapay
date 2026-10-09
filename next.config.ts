import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    // Audit L2: surface type errors at build instead of shipping them.
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
