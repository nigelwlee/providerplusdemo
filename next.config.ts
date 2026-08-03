import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (and its @napi-rs/canvas dependency) must be excluded from the
  // serverless bundle on Vercel — bundling them breaks worker/native-binary
  // resolution at runtime. See node_modules/pdf-parse's troubleshooting docs.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
