'use client'

import { useChainId, useSwitchChain } from 'wagmi'
import { base, baseSepolia, anvil } from '@/lib/wagmi'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CHAIN_CONFIG: Record<
  number,
  { label: string; className: string }
> = {
  [base.id]: {
    label: 'Base',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  [baseSepolia.id]: {
    label: 'Base Sepolia',
    className:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  [anvil.id]: {
    label: 'Anvil',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
}

const SUPPORTED_IDS = new Set(Object.keys(CHAIN_CONFIG).map(Number))

interface NetworkBadgeProps {
  className?: string
}

export function NetworkBadge({ className }: NetworkBadgeProps) {
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  const config = CHAIN_CONFIG[chainId]

  if (!config) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          'bg-destructive/10 text-destructive',
          className
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        <span>Wrong network</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-auto px-1.5 py-0 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={isPending}
          onClick={() => switchChain({ chainId: baseSepolia.id })}
        >
          {isPending ? 'Switching…' : 'Switch'}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        config.className,
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          chainId === anvil.id ? 'bg-zinc-500' : 'bg-current opacity-70'
        )}
      />
      {config.label}
    </div>
  )
}
