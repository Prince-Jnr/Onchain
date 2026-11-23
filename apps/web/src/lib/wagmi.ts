'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base, baseSepolia } from 'wagmi/chains'
import { defineChain } from 'viem'
import { CHAIN_IDS } from '@onchain/shared'

// Local Anvil chain for development
const anvil = defineChain({
  id: CHAIN_IDS.ANVIL,
  name: 'Local Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
})

const isDev = process.env.NODE_ENV === 'development'

export const wagmiConfig = getDefaultConfig({
  appName: 'ONCHAIN',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'onchain-dev-no-wc',
  chains: isDev ? [baseSepolia, base, anvil] : [base, baseSepolia],
  ssr: true,
})

export { base, baseSepolia, anvil }

export const SUPPORTED_CHAINS = isDev
  ? [baseSepolia, base, anvil]
  : [base, baseSepolia]

export const DEFAULT_CHAIN = isDev ? baseSepolia : base
