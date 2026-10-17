import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'other-levels.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'www.carlogos.org',
      },
    ],
    // Disable image optimization in development for faster builds
    unoptimized: process.env.NODE_ENV !== 'production',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    // This helps ensure styles are consistent
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
