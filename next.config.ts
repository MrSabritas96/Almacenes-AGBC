import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { webpackMemoryOptimizations: true },
  serverExternalPackages: ["pg", "nodemailer", "xlsx"],
};

export default nextConfig;
