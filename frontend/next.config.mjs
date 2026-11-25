/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  reactStrictMode: true,
  experimental: {
    // Rebuild route discovery on startup instead of restoring a stale dev graph.
    turbopackFileSystemCacheForDev: false,
  },
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    '172.16.58.33',
    'http://172.16.176.231:3000',
    'http://172.16.176.231:4000',
    '172.16.176.231'
  ],
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          // HTTPS reads support user-initiated brand palette imports; CORS still applies.
          value: "frame-src 'self' https://challenges.cloudflare.com https://*.challenges.cloudflare.com blob: data:; connect-src 'self' http://localhost:4000 http://127.0.0.1:4000 https: data:; object-src 'none'; base-uri 'self';"
        }
      ]
    }];
  }
};

export default nextConfig;
