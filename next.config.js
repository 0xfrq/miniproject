/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: __dirname,
  async rewrites() {
    // Keep old homepage links working while rendering the merged React page.
    return { beforeFiles: [{ source: '/index.html', destination: '/' }] };
  },
};

module.exports = nextConfig;
