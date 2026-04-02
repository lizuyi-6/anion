import type { NextConfig } from "next";
import { runtimeEnv } from "@anion/config";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@anion/application",
    "@anion/config",
    "@anion/contracts",
    "@anion/infrastructure",
    "@anion/shared",
  ],
  serverExternalPackages: ["openai", "@anthropic-ai/sdk"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${runtimeEnv.serviceOrigins.api}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
