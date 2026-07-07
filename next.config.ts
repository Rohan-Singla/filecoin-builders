import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@lighthouse-web3/sdk", "groq-sdk"],
};

export default nextConfig;
