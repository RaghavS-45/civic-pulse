import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf is only used by the extraction CLI, never by the web app
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
