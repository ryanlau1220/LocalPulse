/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the regression server's cache and lock separate from the user's dev server.
  ...(process.env.LOCALPULSE_TEST_SERVER === '1' ? { distDir: '.next-test' } : {}),
};
export default nextConfig;
