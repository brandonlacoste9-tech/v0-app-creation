/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["bcryptjs", "drizzle-orm"],
  reactStrictMode: false,
  // Force cache invalidation
  generateBuildId: async () => Date.now().toString(),
}

export default nextConfig
