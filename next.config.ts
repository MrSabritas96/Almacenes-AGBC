import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg", "nodemailer", "xlsx"],
};

export default nextConfig;
