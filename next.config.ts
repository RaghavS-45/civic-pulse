import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf"],
  // The Q&A route reads each scheme's source text at runtime
  outputFileTracingIncludes: {
    "/api/ask": ["./data/text/**/*"],
  },
};

export default nextConfig;
