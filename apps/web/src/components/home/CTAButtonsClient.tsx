'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WalletButton } from '@/components/wallet/WalletButton'
import { useAuth } from '@/hooks/useAuth'

export function CTAButtonsClient() {
  const { isConnected } = useAccount()
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return (
      <Button asChild size="lg">
        <Link href="/feed" className="flex items-center gap-2">
          Go to your feed
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    )
  }

  if (isConnected) {
    return (
      <>
        <WalletButton className="h-11 px-6" />
        <Button asChild variant="outline" size="lg" className="h-11 px-6">
          <Link href="/feed">Browse anyway</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <WalletButton className="h-11 px-6 text-base" />
      <Button asChild variant="ghost" size="lg" className="h-11 px-6">
        <Link href="/feed" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          Browse without connecting
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </>
  )
}
