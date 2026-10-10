import type { NextConfig } from "next";

// Cache Components is turned off so every page and API route simply runs
// fresh on each request. This keeps the app easy to reason about.
const nextConfig: NextConfig = {
  cacheComponents: false,
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
