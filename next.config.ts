import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Product photos and uploaded logos come from the backend (/uploads/...) or
// from Vercel Blob storage.
const remotePatterns: RemotePattern[] = [
  { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
  { protocol: "http", hostname: "localhost", port: "3001", pathname: "/uploads/**" },
  { protocol: "http", hostname: "localhost", port: "4000", pathname: "/uploads/**" },
  { protocol: "http", hostname: "localhost", port: "5000", pathname: "/uploads/**" },
];

// Also allow the configured backend host (e.g. the deployed API).
try {
  const backend = new URL(process.env.NEXT_PUBLIC_BACKEND_URL || "");
  if (backend.hostname !== "localhost") {
    remotePatterns.push({
      protocol: backend.protocol === "http:" ? "http" : "https",
      hostname: backend.hostname,
      port: backend.port,
      pathname: "/uploads/**",
    });
  }
} catch {
  // No backend URL set — the defaults above are enough for local work.
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns,
    // Skip image optimisation in development for faster builds.
    unoptimized: process.env.NODE_ENV !== "production",
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // POS offline app: the service worker must always be checked for updates.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default nextConfig;
