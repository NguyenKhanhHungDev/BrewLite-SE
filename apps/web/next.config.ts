import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Forward the existing Products API without changing the backend's CORS.
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
    return [
      { source: "/products", destination: `${apiOrigin}/products` },
      { source: "/products/:id", destination: `${apiOrigin}/products/:id` },
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
