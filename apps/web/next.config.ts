import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Use the installed TypeScript compiler API. The CLI runner relies on
    // child-process output capture, which is unavailable in this build runtime.
    useTypeScriptCli: false,
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  turbopack: {
    resolveAlias: {
      '@x402/core/client': false,
      '@x402/evm': false,
      '@x402/evm/exact/client': false,
      '@x402/evm/upto/client': false,
      '@x402/svm/exact/client': false,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
      {
        protocol: 'https',
        hostname: '*.ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  transpilePackages: ['@onchain/shared'],
}

export default nextConfig
