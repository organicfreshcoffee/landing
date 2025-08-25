/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.SERVER_URL || process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_AUTH_SERVER_URL: process.env.AUTH_SERVER_URL || process.env.NEXT_PUBLIC_AUTH_SERVER_URL,
  },
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
    esmExternals: 'loose',
  },
  transpilePackages: ['@strudel/core', '@strudel/mini', '@strudel/tonal', '@strudel/web'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.js', '.ts', '.tsx'],
    };
    return config;
  },
}

module.exports = nextConfig
