import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Product photos and uploaded logos come from the backend (/uploads/...) or
// from Vercel Blob storage.
const remotePatterns: RemotePattern[] = [
  { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
  { protocol: "https", hostname: "media.dollarandco.org" }, // S3 (SeaweedFS on Coolify)
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
  // The deploy this build belongs to (compared with /build-id by the POS).
  // Coolify gives the commit as SOURCE_COMMIT ("Include Source Commit in
  // Build" must be on for it to reach the build); without it this is "dev"
  // and the POS simply does not auto-reload, as before.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SOURCE_COMMIT || "dev" },
  output: "standalone",
  images: {
    remotePatterns,
    // Skip image optimisation in development for faster builds.
    unoptimized: process.env.NODE_ENV !== "production",
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Faster deploys: the type check runs on GitHub Actions
  // (.github/workflows/typecheck.yml), not in the Coolify build.
  typescript: {
    ignoreBuildErrors: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // POS offline app: the service worker must always be checked for updates.
  async headers() {
    // Files in public/ (logo, icons) keep their names when changed, so they
    // are not "immutable" like /_next/static; one day is enough to spare a
    // request per page load on the slow shop link (Next sends max-age=0).
    const publicFile = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/images/:path*", headers: publicFile },
      { source: "/icons/:path*", headers: publicFile },
      { source: "/favicon.ico", headers: publicFile },
      { source: "/apple-touch-icon.png", headers: publicFile },
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
