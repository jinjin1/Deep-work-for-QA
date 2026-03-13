import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Enable transpiling of shared package
  transpilePackages: ['@deep-work/shared'],
  // Fix workspace root detection
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
};

export default nextConfig;
