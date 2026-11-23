'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { toast } from 'sonner'
import { Loader2, Trash2, AlertTriangle, ExternalLink } from 'lucide-react'
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
import { ONCHAIN_ENTRIES_ABI, CONTRACT_ADDRESSES, getTxUrl } from '@onchain/shared'

interface DeletePostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entryId: number
  onDeleted?: () => void
}

type Phase = 'confirm' | 'awaiting_wallet' | 'submitted' | 'confirmed' | 'failed'

export function DeletePostDialog({ open, onOpenChange, entryId, onDeleted }: DeletePostDialogProps) {
  const chainId = useChainId()
  const [phase, setPhase] = useState<Phase>('confirm')
  const [txHashState, setTxHashState] = useState<string | null>(null)

  const contractAddress = CONTRACT_ADDRESSES[chainId]?.entries

  const { writeContract, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHashState as `0x${string}` | undefined,
    query: { enabled: !!txHashState },
  })

  const isPending = isWritePending || isConfirming

  // Handle confirmed state
  if (isConfirmed && phase === 'submitted') {
    setPhase('confirmed')
    toast.success('Post deleted. The tombstone is recorded on-chain.')
    onDeleted?.()
    // Close after a tick
    setTimeout(() => onOpenChange(false), 300)
  }

  const handleDelete = () => {
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      toast.error('Contract not deployed on this network.')
      return
    }

    setPhase('awaiting_wallet')

    writeContract(
      {
        address: contractAddress,
        abi: ONCHAIN_ENTRIES_ABI,
        functionName: 'deleteEntry',
        args: [BigInt(entryId)],
      },
      {
        onSuccess: (hash) => {
          setTxHashState(hash)
          setPhase('submitted')
        },
        onError: (err) => {
          setPhase('failed')
          if (err.message.includes('User rejected')) {
            toast.error('Transaction rejected.')
          } else {
            toast.error(`Delete failed: ${err.message}`)
          }
          setPhase('confirm')
        },
      }
    )
  }

  const handleOpenChange = (val: boolean) => {
    if (!isPending) {
      onOpenChange(val)
      if (!val) {
        setTimeout(() => {
          setPhase('confirm')
          setTxHashState(null)
        }, 300)
      }
    }
  }

  const txExplorerUrl = txHashState ? getTxUrl(txHashState, chainId) : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete post?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This post will be marked as deleted on the blockchain. The content will no longer
                appear in the feed.
              </p>
              <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning-foreground dark:text-yellow-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning dark:text-yellow-400" />
                <p className="text-xs">
                  Blockchain records are permanent. Deleting creates a tombstone transaction — it
                  does not erase the original content from history.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Transaction status */}
        {phase === 'awaiting_wallet' && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for wallet approval…
          </div>
        )}
        {phase === 'submitted' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Broadcasting transaction…
            </div>
            {txExplorerUrl && (
              <a
                href={txExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View on explorer <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || phase === 'submitted'}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {phase === 'awaiting_wallet' ? 'Waiting for approval…' : 'Delete Post (requires wallet approval)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
