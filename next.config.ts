import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["openai", "@anthropic-ai/sdk"],
};

export default nextConfig;
