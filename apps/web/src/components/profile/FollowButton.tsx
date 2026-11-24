'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { toast } from 'sonner'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CONTRACT_ADDRESSES, ONCHAIN_SOCIAL_ABI } from '@onchain/shared'
import { useAuth } from '@/hooks/useAuth'

interface FollowButtonProps {
  targetAddress: string
  initialIsFollowing: boolean
  onFollowChange?: (isFollowing: boolean) => void
  size?: 'sm' | 'default'
  className?: string
}

export function FollowButton({
  targetAddress,
  initialIsFollowing,
  onFollowChange,
  size = 'default',
  className,
}: FollowButtonProps) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { isAuthenticated } = useAuth()

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isHovering, setIsHovering] = useState(false)
  const [apiPending, setApiPending] = useState(false)

  const contractAddress = CONTRACT_ADDRESSES[chainId]?.social as `0x${string}` | undefined

  const { writeContractAsync, data: txHash } = useWriteContract()

  const { isLoading: isTxConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  const isPending = apiPending || isTxConfirming

  const handleFollow = useCallback(async () => {
    if (!isConnected || !address) {
      toast.error('Connect your wallet to follow people.')
      return
    }
    if (!isAuthenticated) {
      toast.error('Sign in with your wallet to follow people.')
      return
    }
    if (isPending) return

    const nextFollowing = !isFollowing

    // Optimistic update
    setIsFollowing(nextFollowing)
    onFollowChange?.(nextFollowing)
    setApiPending(true)

    try {
      // 1. Off-chain record first (immediate)
      const res = await fetch(`/api/follows`, {
        method: nextFollowing ? 'POST' : 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAddress }),
      })
      if (!res.ok) throw new Error('Follow request failed')

      // 2. On-chain transaction (non-blocking toast)
      if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
        writeContractAsync({
          address: contractAddress,
          abi: ONCHAIN_SOCIAL_ABI,
          functionName: nextFollowing ? 'follow' : 'unfollow',
          args: [targetAddress as `0x${string}`],
        })
          .then(() => {
            toast.success(nextFollowing ? 'Followed on-chain.' : 'Unfollowed on-chain.')
          })
          .catch(() => {
            // On-chain tx failure is non-fatal; off-chain already recorded
            toast.warning('Off-chain updated. On-chain transaction failed.')
          })
      }
    } catch {
      // Revert optimistic update
      setIsFollowing(!nextFollowing)
      onFollowChange?.(!nextFollowing)
      toast.error('Failed to update follow status.')
    } finally {
      setApiPending(false)
    }
  }, [
    isConnected,
    address,
    isAuthenticated,
    isPending,
    isFollowing,
    targetAddress,
    contractAddress,
    writeContractAsync,
    onFollowChange,
  ])

  if (!isConnected || address?.toLowerCase() === targetAddress.toLowerCase()) {
    return null
  }

  return (
    <Button
      variant={isFollowing ? 'outline' : 'default'}
      size={size}
      onClick={handleFollow}
      disabled={isPending}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        'min-w-[90px] rounded-full font-semibold transition-all',
        isFollowing && isHovering && 'border-destructive text-destructive hover:bg-destructive/10',
        className
      )}
      aria-label={isFollowing ? 'Unfollow' : 'Follow'}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ml-1.5">...</span>
        </>
      ) : isFollowing ? (
        <span title="Followed (application layer; on-chain record pending)">{isHovering ? 'Unfollow' : 'Following'}</span>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          <span className="ml-1.5" title="Follows record off-chain first; on-chain via wallet">Follow</span>
        </>
      )}
    </Button>
  )
}
