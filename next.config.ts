import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Home directory also has a lockfile; pin Turbopack to this app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
