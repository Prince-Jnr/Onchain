'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { toast } from 'sonner'
import { Repeat2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ONCHAIN_SOCIAL_ABI, CONTRACT_ADDRESSES } from '@onchain/shared'

interface RepostButtonProps {
  entryId: number
  repostCount: number
  viewerHasReposted: boolean
  onOptimisticUpdate: (reposted: boolean) => void
}

type TxPhase = 'idle' | 'awaiting_wallet' | 'submitted' | 'confirmed' | 'failed'

export function RepostButton({
  entryId,
  repostCount,
  viewerHasReposted,
  onOptimisticUpdate,
}: RepostButtonProps) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [phase, setPhase] = useState<TxPhase>('idle')

  const contractAddress = CONTRACT_ADDRESSES[chainId]?.social

  const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  const isPending = isWritePending || isConfirming

  const handleButtonClick = () => {
    if (!isConnected) {
      toast.error('Connect your wallet to repost.')
      return
    }
    setDialogOpen(true)
  }

  const handleConfirm = () => {
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      toast.error('Contract not deployed on this network.')
      return
    }

    setPhase('awaiting_wallet')

    const functionName = viewerHasReposted ? 'unrepost' : 'repost'

    // Optimistic update
    onOptimisticUpdate(!viewerHasReposted)

    writeContract(
      {
        address: contractAddress,
        abi: ONCHAIN_SOCIAL_ABI,
        functionName,
        args: [BigInt(entryId)],
      },
      {
        onSuccess: (hash) => {
          setPhase('submitted')
          toast.info('Transaction submitted, waiting for confirmation...')
        },
        onError: (err) => {
          // Revert optimistic update
          onOptimisticUpdate(viewerHasReposted)
          setPhase('failed')
          if (err.message.includes('User rejected')) {
            toast.error('Transaction rejected.')
          } else {
            toast.error(`Repost failed: ${err.message}`)
          }
          setDialogOpen(false)
        },
      }
    )
  }

  // Close dialog once confirmed
  if (isConfirmed && phase === 'submitted') {
    setPhase('confirmed')
    setDialogOpen(false)
    toast.success(viewerHasReposted ? 'Repost removed.' : 'Reposted successfully.')
  }

  const displayCount = repostCount > 0 ? repostCount : ''

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isPending}
        aria-label={viewerHasReposted ? 'Unrepost' : 'Repost'}
        aria-pressed={viewerHasReposted}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors',
          'hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400',
          viewerHasReposted && 'text-green-600 dark:text-green-400',
          !viewerHasReposted && 'text-muted-foreground',
          isPending && 'opacity-70 cursor-wait'
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Repeat2 className="h-4 w-4" />
        )}
        {displayCount !== '' && (
          <span className="tabular-nums text-xs">{displayCount}</span>
        )}
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {viewerHasReposted ? 'Remove repost?' : 'Repost this post?'}
            </DialogTitle>
            <DialogDescription>
              {viewerHasReposted
                ? 'This will submit a transaction to remove your repost. The original post will remain.'
                : 'This will submit a blockchain transaction to share this post with your followers.'}
            </DialogDescription>
          </DialogHeader>

          {phase === 'awaiting_wallet' && (
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for wallet approval…
            </div>
          )}
          {phase === 'submitted' && (
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Broadcasting transaction…
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              variant={viewerHasReposted ? 'destructive' : 'default'}
              className={cn(!viewerHasReposted && 'bg-green-600 hover:bg-green-700 text-white')}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {viewerHasReposted ? 'Remove Repost' : 'Repost'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
