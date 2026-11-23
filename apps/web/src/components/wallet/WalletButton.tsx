'use client'

import { useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Wallet, Copy, ExternalLink, LogOut, Check, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { NetworkBadge } from './NetworkBadge'
import { useAuth } from '@/hooks/useAuth'
import { shortenAddress, getAddressUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { base, baseSepolia } from '@/lib/wagmi'
import { useChainId } from 'wagmi'

interface WalletButtonProps {
  className?: string
  /** Compact variant for sidebar footer */
  compact?: boolean
}

export function WalletButton({ className, compact = false }: WalletButtonProps) {
  const { openConnectModal } = useConnectModal()
  const { address, isConnected } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const chainId = useChainId()
  const { isAuthenticated, isSigningIn, signIn, signOut } = useAuth()
  const [copied, setCopied] = useState(false)

  const isWrongNetwork = isConnected && chainId !== base.id && chainId !== baseSepolia.id

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnect = async () => {
    if (isAuthenticated) {
      await signOut()
    } else {
      await disconnectAsync()
    }
  }

  const explorerUrl = address
    ? getAddressUrl(address, chainId)
    : null

  if (!isConnected || !address) {
    return (
      <Button
        onClick={openConnectModal}
        className={cn('gap-2', className)}
        variant="default"
        size={compact ? 'sm' : 'default'}
      >
        <Wallet className="h-4 w-4" />
        {!compact && 'Connect Wallet'}
      </Button>
    )
  }

  const initials = address.slice(2, 4).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2',
            'text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isWrongNetwork && 'border-destructive/40',
            className
          )}
        >
          <Avatar size="sm">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start leading-tight min-w-0">
            <span className="font-mono text-xs font-medium truncate max-w-[120px]">
              {shortenAddress(address)}
            </span>
            {isWrongNetwork && (
              <span className="text-[10px] text-destructive flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                Wrong network
              </span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="pb-1">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-xs font-medium text-foreground truncate">
                {shortenAddress(address)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {isAuthenticated ? 'Signed in' : 'Wallet connected'}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <div className="px-2 pb-1">
          <NetworkBadge />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Copy address'}
        </DropdownMenuItem>

        {explorerUrl && (
          <DropdownMenuItem asChild>
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
              <ExternalLink className="h-4 w-4" />
              View on explorer
            </a>
          </DropdownMenuItem>
        )}

        {!isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signIn()}
              disabled={isSigningIn}
              className="cursor-pointer"
            >
              {isSigningIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {isSigningIn ? 'Signing in…' : 'Sign in with wallet'}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleDisconnect}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          {isAuthenticated ? 'Sign out & disconnect' : 'Disconnect'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
