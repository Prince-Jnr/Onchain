'use client'

import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'
import { wagmiConfig } from '@/lib/wagmi'

import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
    },
  },
})

function RainbowKitWithTheme({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()

  return (
    <RainbowKitProvider
      theme={
        resolvedTheme === 'dark'
          ? darkTheme({
              accentColor: '#4D7CFF',
              accentColorForeground: 'white',
              borderRadius: 'medium',
              fontStack: 'system',
            })
          : lightTheme({
              accentColor: '#2563EB',
              accentColorForeground: 'white',
              borderRadius: 'medium',
              fontStack: 'system',
            })
      }
      coolMode={false}
    >
      {children}
    </RainbowKitProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitWithTheme>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              toastOptions={{
                duration: 4000,
              }}
            />
          </RainbowKitWithTheme>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}
