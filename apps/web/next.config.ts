import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Forward the existing Products API without changing the backend's CORS.
  async rewrites() {
    return [
      { source: "/products", destination: "http://localhost:3001/products" },
    ];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
