import type { NextConfig } from 'next';

const dabosHost = [{ type: 'host' as const, value: 'dabos.logans.tools' }];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Ensure PRD markdown files are available at runtime on Vercel.
    // The /gabc route reads these files using fs from the deployed bundle.
    '/gabc': ['src/docs/prd/**'],
  },
  async redirects() {
    const apexRedirect = (source: string, destination: string) =>
      (['logans.tools', 'www.logans.tools'] as const).map((value) => ({
        source,
        has: [{ type: 'host' as const, value }],
        destination,
        permanent: true,
      }));

    return [
      ...apexRedirect('/dabos', 'https://dabos.logans.tools'),
      ...apexRedirect('/dabos/:path*', 'https://dabos.logans.tools/:path*'),
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
