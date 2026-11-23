'use client'

import { useState, useRef, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ONCHAIN_SOCIAL_ABI, CONTRACT_ADDRESSES, REACTION_EMOJIS, REACTION_LABELS, ReactionType } from '@onchain/shared'

const REACTIONS: Array<{ type: ReactionType; emoji: string; label: string }> = [
  { type: ReactionType.LIKE, emoji: REACTION_EMOJIS[ReactionType.LIKE], label: REACTION_LABELS[ReactionType.LIKE] },
  { type: ReactionType.LOVE, emoji: REACTION_EMOJIS[ReactionType.LOVE], label: REACTION_LABELS[ReactionType.LOVE] },
  { type: ReactionType.LAUGH, emoji: REACTION_EMOJIS[ReactionType.LAUGH], label: REACTION_LABELS[ReactionType.LAUGH] },
  { type: ReactionType.WOW, emoji: REACTION_EMOJIS[ReactionType.WOW], label: REACTION_LABELS[ReactionType.WOW] },
  { type: ReactionType.SAD, emoji: REACTION_EMOJIS[ReactionType.SAD], label: REACTION_LABELS[ReactionType.SAD] },
  { type: ReactionType.ANGRY, emoji: REACTION_EMOJIS[ReactionType.ANGRY], label: REACTION_LABELS[ReactionType.ANGRY] },
]

interface ReactionButtonProps {
  entryId: number
  totalReactions: number
  reactionCounts: Record<ReactionType, number>
  viewerReaction: ReactionType | null
  onOptimisticUpdate: (reaction: ReactionType | null, delta: number) => void
}

export function ReactionButton({
  entryId,
  totalReactions,
  viewerReaction,
  onOptimisticUpdate,
}: ReactionButtonProps) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [showPicker, setShowPicker] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const contractAddress = CONTRACT_ADDRESSES[chainId]?.social

  const { writeContract: writeAdd, data: addHash, isPending: isAddPending } = useWriteContract()
  const { writeContract: writeRemove, data: removeHash, isPending: isRemovePending } = useWriteContract()
  const { writeContract: writeChange, data: changeHash, isPending: isChangePending } = useWriteContract()

  const { isLoading: isAddConfirming } = useWaitForTransactionReceipt({
    hash: addHash,
    query: { enabled: !!addHash },
  })
  const { isLoading: isRemoveConfirming } = useWaitForTransactionReceipt({
    hash: removeHash,
    query: { enabled: !!removeHash },
  })
  const { isLoading: isChangeConfirming } = useWaitForTransactionReceipt({
    hash: changeHash,
    query: { enabled: !!changeHash },
  })

  const isPending = isAddPending || isRemovePending || isChangePending || isAddConfirming || isRemoveConfirming || isChangeConfirming

  const handleReaction = useCallback(
    async (reactionType: ReactionType) => {
      if (!isConnected) {
        toast.error('Connect your wallet to react.')
        return
      }
      if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
        toast.error('Contract not deployed on this network.')
        return
      }

      setShowPicker(false)

      try {
        if (viewerReaction === null) {
          // No existing reaction — add
          onOptimisticUpdate(reactionType, 1)
          writeAdd(
            {
              address: contractAddress,
              abi: ONCHAIN_SOCIAL_ABI,
              functionName: 'addReaction',
              args: [BigInt(entryId), reactionType],
            },
            {
              onError: (err) => {
                onOptimisticUpdate(null, -1)
                toast.error(`Failed to react: ${err.message}`)
              },
            }
          )
        } else if (viewerReaction === reactionType) {
          // Same reaction — remove
          onOptimisticUpdate(null, -1)
          writeRemove(
            {
              address: contractAddress,
              abi: ONCHAIN_SOCIAL_ABI,
              functionName: 'removeReaction',
              args: [BigInt(entryId)],
            },
            {
              onError: (err) => {
                onOptimisticUpdate(viewerReaction, 1)
                toast.error(`Failed to remove reaction: ${err.message}`)
              },
            }
          )
        } else {
          // Different reaction — change
          onOptimisticUpdate(reactionType, 0)
          writeChange(
            {
              address: contractAddress,
              abi: ONCHAIN_SOCIAL_ABI,
              functionName: 'changeReaction',
              args: [BigInt(entryId), reactionType],
            },
            {
              onError: (err) => {
                onOptimisticUpdate(viewerReaction, 0)
                toast.error(`Failed to change reaction: ${err.message}`)
              },
            }
          )
        }
      } catch {
        // writeContract errors are handled in onError callbacks
      }
    },
    [isConnected, contractAddress, viewerReaction, entryId, onOptimisticUpdate, writeAdd, writeRemove, writeChange]
  )

  const handleDefaultClick = () => {
    if (isPending) return
    if (viewerReaction !== null) {
      handleReaction(viewerReaction)
    } else {
      handleReaction(ReactionType.LIKE)
    }
  }

  // Desktop: show picker on hover after 400ms delay
  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setShowPicker(true), 400)
  }
  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    // Small delay before hiding so user can move to picker
    setTimeout(() => {
      if (!pickerRef.current?.matches(':hover')) {
        setShowPicker(false)
      }
    }, 150)
  }

  // Mobile: long press
  const handleTouchStart = () => {
    longPressTimeout.current = setTimeout(() => setShowPicker(true), 500)
  }
  const handleTouchEnd = () => {
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current)
  }

  const currentEmoji = viewerReaction !== null ? REACTION_EMOJIS[viewerReaction] : REACTION_EMOJIS[ReactionType.LIKE]
  const isActive = viewerReaction !== null

  const displayCount = totalReactions > 0 ? totalReactions : ''

  return (
    <div className="relative flex items-center">
      <div
        className="relative group/reaction"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={handleDefaultClick}
          disabled={isPending || !isConnected}
          aria-label={isActive ? `Remove reaction` : 'React to post'}
          aria-pressed={isActive}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors',
            'hover:bg-primary/10 hover:text-primary',
            isActive && 'text-primary',
            !isActive && 'text-muted-foreground',
            isPending && 'opacity-70 cursor-wait'
          )}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="text-base leading-none select-none">{currentEmoji}</span>
          )}
          {displayCount !== '' && (
            <span className="tabular-nums text-xs">{displayCount}</span>
          )}
        </button>

        {/* Reaction picker */}
        {showPicker && (
          <div
            ref={pickerRef}
            onMouseEnter={() => {
              if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
            }}
            onMouseLeave={() => setShowPicker(false)}
            className={cn(
              'absolute bottom-full left-0 mb-1 z-50',
              'flex items-center gap-1 p-1.5 rounded-full',
              'bg-popover border border-border shadow-lg',
              'animate-in fade-in-0 zoom-in-95 duration-100'
            )}
          >
            {REACTIONS.map(({ type, emoji, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleReaction(type)}
                aria-label={label}
                title={label}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-xl',
                  'transition-transform hover:scale-125',
                  viewerReaction === type && 'bg-primary/15 ring-1 ring-primary/30'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
