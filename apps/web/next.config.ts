import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Keep production builds within the memory budget of small CI runners.
    cpus: 2,
    // Use the installed TypeScript compiler API. The CLI runner relies on
    // child-process output capture, which is unavailable in this build runtime.
    useTypeScriptCli: false,
    webpackBuildWorker: false,
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  // The build script runs `tsc --noEmit` first; avoid a second memory-heavy
  // typecheck inside Next's worker after Webpack has already compiled sources.
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    resolveAlias: {
      '@x402/core/client': false,
      '@x402/evm': false,
      '@x402/evm/exact/client': false,
      '@x402/evm/upto/client': false,
      '@x402/svm/exact/client': false,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    },
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/core/client': false,
      '@x402/evm': false,
      '@x402/evm/exact/client': false,
      '@x402/evm/upto/client': false,
      '@x402/svm/exact/client': false,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    }
    return config
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
