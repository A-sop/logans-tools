import type { NextConfig } from 'next';

const dabosHost = [{ type: 'host' as const, value: 'dabos.logans.tools' }];
const apexHosts = [
  { type: 'host' as const, value: 'logans.tools' },
  { type: 'host' as const, value: 'www.logans.tools' },
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Ensure PRD markdown files are available at runtime on Vercel.
    // The /gabc route reads these files using fs from the deployed bundle.
    '/gabc': ['src/docs/prd/**'],
  },
  async redirects() {
    return [
      {
        source: '/dabos',
        has: apexHosts,
        destination: 'https://dabos.logans.tools',
        permanent: true,
      },
      {
        source: '/dabos/:path*',
        has: apexHosts,
        destination: 'https://dabos.logans.tools/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          has: dabosHost,
          destination: '/dabos',
        },
        {
          source: '/:path((?!dabos|api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
          has: dabosHost,
          destination: '/dabos/:path',
        },
      ],
    };
  },
};

export default nextConfig;
