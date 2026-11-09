import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
    return [
      {
        source: "/ingredients/:path*",
        destination: `${apiOrigin}/ingredients/:path*`,
      },
      { source: "/recipes/:path*", destination: `${apiOrigin}/recipes/:path*` },
      { source: "/api/admin/orders", destination: `${apiOrigin}/admin/orders` },
      {
        source: "/api/admin/orders/:id/status",
        destination: `${apiOrigin}/admin/orders/:id/status`,
      },
      {
        source: "/api/admin/orders/:id",
        destination: `${apiOrigin}/admin/orders/:id`,
      },
      { source: "/products", destination: `${apiOrigin}/products` },
      { source: "/api/products/:id", destination: `${apiOrigin}/products/:id` },
      { source: "/orders/:path*", destination: `${apiOrigin}/orders/:path*` },
      {
        source: "/payments/:path*",
        destination: `${apiOrigin}/payments/:path*`,
      },
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
