import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["openai", "@anthropic-ai/sdk", "ws"],
};

export default nextConfig;
