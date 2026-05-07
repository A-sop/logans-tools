import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Ensure PRD markdown files are available at runtime on Vercel.
    // The /gabc route reads these files using fs from the deployed bundle.
    '/gabc': ['src/docs/prd/**'],
  },
};

export default nextConfig;
