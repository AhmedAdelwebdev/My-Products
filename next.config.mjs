/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: [
    'localhost',
    '*.replit.dev',
    '*.spock.replit.dev',
  ],
};

export default nextConfig;