import type { Metadata, Viewport } from 'next'
import { Providers } from '@/providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'ONCHAIN — Leave something behind.',
    template: '%s | ONCHAIN',
  },
  description:
    'A decentralized social guestbook built on Base. Connect your wallet, create posts, interact with the community, and leave something behind.',
  keywords: [
    'blockchain',
    'social',
    'web3',
    'Base',
    'decentralized',
    'guestbook',
    'community',
    'ONCHAIN',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://onchain.app',
    siteName: 'ONCHAIN',
    title: 'ONCHAIN — Leave something behind.',
    description:
      'A decentralized social guestbook built on Base. Connect your wallet and leave something behind.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ONCHAIN — Leave something behind.',
    description: 'A decentralized social guestbook built on Base.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0f14' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
