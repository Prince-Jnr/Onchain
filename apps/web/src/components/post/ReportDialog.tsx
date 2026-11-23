'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { toast } from 'sonner'
import { Loader2, Flag, ExternalLink } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ONCHAIN_MODERATION_ABI, CONTRACT_ADDRESSES, ReportCategory, REPORT_CATEGORY_LABELS, getTxUrl } from '@onchain/shared'

const CATEGORIES = Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => ({
  value: Number(value) as ReportCategory,
  label: label as string,
}))

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entryId: number
}

type Phase = 'form' | 'awaiting_wallet' | 'submitted' | 'confirmed' | 'failed'

export function ReportDialog({ open, onOpenChange, entryId }: ReportDialogProps) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null)
  const [description, setDescription] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [txHashState, setTxHashState] = useState<string | null>(null)
  const [useOffchain, setUseOffchain] = useState(false)
  const [isSubmittingOffchain, setIsSubmittingOffchain] = useState(false)

  const contractAddress = CONTRACT_ADDRESSES[chainId]?.moderation

  const { writeContract, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHashState as `0x${string}` | undefined,
    query: { enabled: !!txHashState },
  })

  const isPending = isWritePending || isConfirming || isSubmittingOffchain

  if (isConfirmed && phase === 'submitted') {
    setPhase('confirmed')
    toast.success('Report submitted on-chain. Our moderation team will review it.')
    setTimeout(() => onOpenChange(false), 300)
  }

  const handleOnchainReport = () => {
    if (selectedCategory === null) return
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      toast.error('Contract not deployed on this network. Use off-chain report instead.')
      return
    }

    setPhase('awaiting_wallet')

    writeContract(
      {
        address: contractAddress,
        abi: ONCHAIN_MODERATION_ABI,
        functionName: 'reportEntry',
        args: [BigInt(entryId), selectedCategory],
      },
      {
        onSuccess: (hash) => {
          setTxHashState(hash)
          setPhase('submitted')
        },
        onError: (err) => {
          setPhase('form')
          if (err.message.includes('User rejected')) {
            toast.error('Transaction rejected.')
          } else {
            toast.error(`Report failed: ${err.message}`)
          }
        },
      }
    )
  }

  const handleOffchainReport = async () => {
    if (selectedCategory === null) return
    setIsSubmittingOffchain(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId,
          category: selectedCategory,
          description: description.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Report submission failed')
      }
      toast.success('Report submitted to the moderation team.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report.')
    } finally {
      setIsSubmittingOffchain(false)
    }
  }

  const handleOpenChange = (val: boolean) => {
    if (!isPending) {
      onOpenChange(val)
      if (!val) {
        setTimeout(() => {
          setPhase('form')
          setSelectedCategory(null)
          setDescription('')
          setTxHashState(null)
          setUseOffchain(false)
        }, 300)
      }
    }
  }

  const txExplorerUrl = txHashState ? getTxUrl(txHashState, chainId) : null
  const canSubmit = selectedCategory !== null && !isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Report content
          </DialogTitle>
          <DialogDescription>
            Help keep the community safe by reporting content that violates our guidelines.
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <div className="space-y-4">
            {/* Category selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedCategory(value)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      selectedCategory === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional description */}
            <div className="space-y-2">
              <Label htmlFor="report-description" className="text-sm font-medium">
                Additional context{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in more detail…"
                rows={3}
                maxLength={500}
                className="resize-none text-sm"
              />
              <p className="text-right text-xs text-muted-foreground">{description.length}/500</p>
            </div>

            {/* Report method toggle */}
            <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground text-sm">Report method</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUseOffchain(false)}
                  className={cn(
                    'rounded px-2 py-1 transition-colors',
                    !useOffchain ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  On-chain
                </button>
                <button
                  type="button"
                  onClick={() => setUseOffchain(true)}
                  className={cn(
                    'rounded px-2 py-1 transition-colors',
                    useOffchain ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  Off-chain (app layer only)
                </button>
              </div>
              <p>
                {useOffchain
                  ? 'Submits directly to the moderation team. No wallet required.'
                  : 'Creates a verifiable, permanent record on Base blockchain. Requires wallet approval.'}
              </p>
            </div>
          </div>
        )}

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
            onClick={useOffchain ? handleOffchainReport : handleOnchainReport}
            disabled={!canSubmit}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {useOffchain ? 'Submit Report' : 'Submit Report (requires wallet)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
