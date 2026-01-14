/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable trailing slash redirects which cause 308 errors for webhooks
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;






