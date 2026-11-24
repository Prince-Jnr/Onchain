'use client'

import { useAccount, useDisconnect, useSwitchChain, useConfig } from 'wagmi'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ExternalLink, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NetworkBadge } from '@/components/wallet/NetworkBadge'
import { getAddressUrl, shortenAddress } from '@onchain/shared'

export function SettingsWalletPage() {
  const router = useRouter()
  const { address, chainId, isConnected } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { chains } = useConfig()

  const handleSwitchChain = async (nextChainId: number) => {
    try {
      await switchChainAsync({ chainId: nextChainId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to switch network.')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectAsync()
      toast.success('Wallet disconnected.')
    } catch {
      toast.error('Failed to disconnect wallet.')
    }
    void router.refresh()
  }

  if (!isConnected || !address) {
    return (
      <div className="space-y-6 px-4 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Wallet</h2>
        </div>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
          <p className="mt-3 text-sm text-muted-foreground">No wallet connected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Wallet className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Wallet</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold">Connected wallet</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4">
          <div className="min-w-0">
            <div className="font-mono text-sm text-foreground">{shortenAddress(address, 6)}</div>
            <a
              href={chainId ? getAddressUrl(address, chainId) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline mt-0.5"
            >
              <ExternalLink className="h-3 w-3" />
              View on explorer
            </a>
          </div>
          <NetworkBadge />
        </div>
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Networks</h4>
          <div className="space-y-1">
            {chains.map((chain) => (
              <div
                key={chain.id}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${chain.id === chainId ? 'bg-accent' : ''}`}
              >
                <span className={chain.id === chainId ? 'font-medium' : ''}>{chain.name}</span>
                {chain.id !== chainId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleSwitchChain(chain.id)}
                  >
                    Switch
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Disconnect</h3>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3 rounded-full"
          onClick={handleDisconnect}
        >
          Disconnect wallet
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Disconnecting signs you out of the ONCHAIN web app. Your on-chain data is
          unaffected.
        </p>
      </div>
    </div>
  )
}
