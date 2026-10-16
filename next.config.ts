import type { NextConfig } from 'next';

const imageHosts: Array<{ protocol: 'https'; hostname: string; pathname: string; port?: string }> = [
  { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
];

const graphqlAddress = process.env.WORDPRESS_GRAPHQL_URL;
if (graphqlAddress) {
  const cms = new URL(graphqlAddress);
  if (cms.protocol !== 'https:') {
    throw new Error('WORDPRESS_GRAPHQL_URL must use HTTPS.');
  }
  imageHosts.push({ protocol: 'https', hostname: cms.hostname, port: cms.port, pathname: '/**' });
}

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { remotePatterns: imageHosts },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
      {
        source: '/preview/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default config;
