'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { toast } from 'sonner'
import {
  Image as ImageIcon,
  X,
  Loader2,
  ExternalLink,
  Send,
  Smile,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, shortenAddress, ipfsToHttp } from '@/lib/utils'
import {
  Entry,
  EntryType,
  ONCHAIN_ENTRIES_ABI,
  CONTRACT_ADDRESSES,
  MAX_POST_LENGTH,
  getTxUrl,
} from '@onchain/shared'
import { useAuth } from '@/hooks/useAuth'

// Common emoji sets for the picker
const EMOJI_GROUPS = [
  ['😀', '😂', '🥹', '😍', '🤔', '😎', '🫡', '🤯'],
  ['👍', '👎', '❤️', '🔥', '🎉', '👀', '🙌', '💯'],
  ['🌐', '⛓️', '🧱', '💎', '🚀', '🌙', '⚡', '🛡️'],
]

type TxPhase =
  | 'idle'
  | 'uploading'
  | 'preparing'
  | 'awaiting_wallet'
  | 'submitted'
  | 'confirmed'
  | 'failed'

interface MediaPreview {
  file: File
  url: string
  uploading?: boolean
  ipfsCid?: string
  serverUrl?: string
}

interface PostComposerProps {
  onSuccess?: (entryId: number) => void
  placeholder?: string
  replyTo?: Entry
  quotedEntry?: Entry
  className?: string
}

function highlightText(text: string): React.ReactNode[] {
  const parts = text.split(/(#[a-zA-Z][a-zA-Z0-9_]*|@0x[0-9a-fA-F]{40})/g)
  return parts.map((part, i) => {
    if (part.startsWith('#') || part.startsWith('@')) {
      return (
        <span key={i} className="text-primary">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function PostComposer({
  onSuccess,
  placeholder,
  replyTo,
  quotedEntry,
  className,
}: PostComposerProps) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { isAuthenticated } = useAuth()

  const [text, setText] = useState('')
  const [mediaFiles, setMediaFiles] = useState<MediaPreview[]>([])
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [preparedEntry, setPreparedEntry] = useState<{
    text: string
    mediaUrls: string[]
    entryType: 'POST' | 'COMMENT' | 'QUOTE'
    parentId: number | null
    referenceId: number | null
    media: { url: string; ipfsCid: string; mimeType: string; sizeBytes: number }[]
  } | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [charWarning, setCharWarning] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const verifiedTxRef = useRef<string | null>(null)

  const contractAddress = CONTRACT_ADDRESSES[chainId]?.entries

  const { writeContract, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
    query: { enabled: !!txHash },
  })

  const isPending = isWritePending || isConfirming || phase === 'uploading'

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  // A mined transaction is not shown in the feed until the server verifies its receipt and event.
  useEffect(() => {
    if (!isConfirmed || phase !== 'submitted' || !txHash || !preparedEntry) return
    if (verifiedTxRef.current === txHash) return
    verifiedTxRef.current = txHash
    void (async () => {
      try {
        const response = await fetch('/api/entries/confirm', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash, ...preparedEntry }),
        })
        const data = await response.json() as { id?: number; error?: string }
        if (!response.ok || typeof data.id !== 'number') {
          throw new Error(data.error ?? 'Transaction confirmed, but entry verification is still pending. Retry by refreshing the feed.')
        }
        toast.success('Post published on-chain and verified.')
        onSuccess?.(data.id)
        setPhase('idle')
        setText('')
        setMediaFiles([])
        setTxHash(null)
        setPreparedEntry(null)
      } catch (error) {
        verifiedTxRef.current = null
        setPhase('failed')
        toast.error(error instanceof Error ? error.message : 'Could not verify the confirmed transaction.')
      }
    })()
  }, [isConfirmed, phase, txHash, preparedEntry, onSuccess])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    setCharWarning(val.length > MAX_POST_LENGTH - 50)
  }

  const handleEmojiClick = (emoji: string) => {
    const el = textareaRef.current
    if (!el) {
      setText((t) => t + emoji)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newText = text.slice(0, start) + emoji + text.slice(end)
    setText(newText)
    setShowEmojiPicker(false)
    // Restore cursor after state update
    requestAnimationFrame(() => {
      el.selectionStart = start + emoji.length
      el.selectionEnd = start + emoji.length
      el.focus()
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = 4 - mediaFiles.length
    const toAdd = files.slice(0, remaining)

    if (files.length > remaining) {
      toast.warning(`Maximum ${MAX_POST_LENGTH} images. Only first ${remaining} added.`)
    }

    const previews: MediaPreview[] = toAdd.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))
    setMediaFiles((prev) => [...prev, ...previews])
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].url)
      updated.splice(index, 1)
      return updated
    })
  }

  const uploadMedia = async (previews: MediaPreview[]) => {
    const uploaded: { url: string; ipfsCid: string; mimeType: string; sizeBytes: number }[] = []
    for (const preview of previews) {
      const formData = new FormData()
      formData.append('file', preview.file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Upload failed')
      }

      const data = (await res.json()) as { url: string; ipfsCid: string; mimeType: string; sizeBytes: number }
      uploaded.push(data)
    }
    return uploaded
  }

  const handleSubmit = async () => {
    if (!isConnected || !isAuthenticated) {
      toast.error('Sign in to post.')
      return
    }
    if (!text.trim() && mediaFiles.length === 0) return
    if (text.length > MAX_POST_LENGTH) {
      toast.error(`Post is too long. Max ${MAX_POST_LENGTH} characters.`)
      return
    }
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      toast.error('Contract not deployed on this network.')
      return
    }

    try {
      // 1. Upload media if any
      let uploadedMedia: Awaited<ReturnType<typeof uploadMedia>> = []
      if (mediaFiles.length > 0) {
        setPhase('uploading')
        uploadedMedia = await uploadMedia(mediaFiles)
      }
      const mediaUrls = uploadedMedia.map((item) => item.url)

      // 2. Upload content to IPFS via API
      setPhase('preparing')
      const isComment = !!replyTo
      const isQuote = !!quotedEntry
      const entryType = isComment ? 'COMMENT' : isQuote ? 'QUOTE' : 'POST'
      const parentId = replyTo?.chainEntryId ?? null
      const referenceId = quotedEntry?.chainEntryId ?? null
      if ((replyTo && !parentId) || (quotedEntry && !referenceId)) {
        throw new Error('This entry is not synchronized with the blockchain yet. Refresh and try again.')
      }

      const uploadRes = await fetch('/api/entries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), mediaUrls }),
      })

      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to prepare post')
      }

      const { contentRef } = (await uploadRes.json()) as {
        contentRef: string
      }
      setPreparedEntry({ text: text.trim(), mediaUrls, entryType, parentId, referenceId, media: uploadedMedia })

      // 3. Submit transaction
      setPhase('awaiting_wallet')

      if (isComment) {
        writeContract(
          {
            address: contractAddress,
            abi: ONCHAIN_ENTRIES_ABI,
            functionName: 'createComment',
            args: [BigInt(parentId!), contentRef],
          },
          {
            onSuccess: (hash) => {
              setTxHash(hash)
              setPhase('submitted')
              toast.info('Transaction submitted, confirming…')
            },
            onError: handleWriteError,
          }
        )
      } else if (isQuote) {
        writeContract(
          {
            address: contractAddress,
            abi: ONCHAIN_ENTRIES_ABI,
            functionName: 'createQuote',
            args: [BigInt(referenceId!), contentRef],
          },
          {
            onSuccess: (hash) => {
              setTxHash(hash)
              setPhase('submitted')
              toast.info('Transaction submitted, confirming…')
            },
            onError: handleWriteError,
          }
        )
      } else {
        writeContract(
          {
            address: contractAddress,
            abi: ONCHAIN_ENTRIES_ABI,
            functionName: 'createPost',
            args: [contentRef],
          },
          {
            onSuccess: (hash) => {
              setTxHash(hash)
              setPhase('submitted')
              toast.info('Transaction submitted, confirming…')
            },
            onError: handleWriteError,
          }
        )
      }
    } catch (err) {
      setPhase('failed')
      toast.error(err instanceof Error ? err.message : 'Post failed.')
      setTimeout(() => setPhase('idle'), 3000)
    }
  }

  const handleWriteError = (err: Error) => {
    setPhase('failed')
    if (err.message.includes('User rejected')) {
      toast.error('Transaction rejected.')
    } else {
      toast.error(`Failed to post: ${err.message}`)
    }
    setTimeout(() => setPhase('idle'), 3000)
  }

  const charsLeft = MAX_POST_LENGTH - text.length
  const isOverLimit = charsLeft < 0
  const isTextEmpty = !text.trim() && mediaFiles.length === 0
  const canSubmit = !isTextEmpty && !isOverLimit && !isPending && isConnected && isAuthenticated

  const avatarUrl = undefined // Would come from profile data
  const displayName = address ? shortenAddress(address, 4) : ''

  const txExplorerUrl = txHash ? getTxUrl(txHash, chainId) : null

  if (!isConnected) {
    return (
      <div
        className={cn(
          'border-b border-border px-4 py-5 flex flex-col items-center gap-3 text-center',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">Connect your wallet to post on ONCHAIN.</p>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div className={cn('border-b border-border px-4 py-4', className)}>
      {/* Reply context */}
      {replyTo && (
        <div className="mb-3 rounded-lg border border-border p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Replying to{' '}
            {replyTo.authorProfile?.displayName ?? shortenAddress(replyTo.author, 4)}
          </span>
        </div>
      )}

      {/* Quote context */}
      {quotedEntry && (
        <div className="mb-3 rounded-lg border border-border p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Quoting{' '}
            {quotedEntry.authorProfile?.displayName ?? shortenAddress(quotedEntry.author, 4)}
          </span>
          <p className="mt-1 line-clamp-2">{quotedEntry.content?.text}</p>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="text-xs font-medium bg-muted">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Overlay highlight layer + textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder={
                placeholder ??
                (replyTo
                  ? 'Write your reply…'
                  : quotedEntry
                  ? 'Add a comment\u2026'
                  : "What\u2019s on your mind? (stored on-chain)")
              }
              disabled={isPending}
              rows={1}
              maxLength={MAX_POST_LENGTH + 50} // Allow slight over to show error
              className={cn(
                'w-full resize-none bg-transparent text-sm leading-relaxed text-foreground',
                'placeholder:text-muted-foreground',
                'focus:outline-none',
                'min-h-[42px] max-h-64 overflow-auto',
                isPending && 'opacity-70 cursor-not-allowed'
              )}
              aria-label="Post content"
            />
          </div>

          {/* Media previews */}
          {mediaFiles.length > 0 && (
            <div
              className={cn(
                'mt-3 gap-2',
                mediaFiles.length === 1 && 'grid grid-cols-1',
                mediaFiles.length >= 2 && 'grid grid-cols-2'
              )}
            >
              {mediaFiles.map((m, i) => (
                <div key={i} className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={m.url}
                    alt={`Attachment ${i + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Transaction status */}
          {phase !== 'idle' && phase !== 'failed' && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {phase === 'uploading' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading media…
                  </>
                )}
                {phase === 'preparing' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                  Preparing content reference…
                  </>
                )}
                {phase === 'awaiting_wallet' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Waiting for wallet approval…
                  </>
                )}
                {phase === 'submitted' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Broadcasting to Base…
                  </>
                )}
                {phase === 'confirmed' && (
                  <span className="text-onchain font-medium">Published on-chain ✓</span>
                )}
              </div>
              {txExplorerUrl && phase === 'submitted' && (
                <a
                  href={txExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View transaction <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          {phase === 'failed' && txHash && preparedEntry && isConfirmed && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <span>The transaction is confirmed; entry indexing needs another attempt.</span>
              <Button size="sm" variant="outline" onClick={() => setPhase('submitted')}>
                Retry verification
              </Button>
            </div>
          )}

          {/* Toolbar */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-1">
              {/* Media attach */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={mediaFiles.length >= 4 || isPending}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaFiles.length >= 4 || isPending}
                aria-label="Attach image"
                className={cn(
                  'rounded-full p-2 text-muted-foreground transition-colors',
                  'hover:bg-primary/10 hover:text-primary',
                  (mediaFiles.length >= 4 || isPending) && 'opacity-40 cursor-not-allowed'
                )}
              >
                <ImageIcon className="h-4 w-4" />
              </button>

              {/* Emoji picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  disabled={isPending}
                  aria-label="Insert emoji"
                  className={cn(
                    'rounded-full p-2 text-muted-foreground transition-colors',
                    'hover:bg-primary/10 hover:text-primary',
                    isPending && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <Smile className="h-4 w-4" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-xl border border-border bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
                    {EMOJI_GROUPS.map((group, gi) => (
                      <div key={gi} className="flex flex-wrap gap-0.5 mb-1">
                        {group.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            className="h-8 w-8 rounded-md text-lg hover:bg-muted transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Character counter */}
              {text.length > 0 && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isOverLimit
                      ? 'text-destructive font-semibold'
                      : charWarning
                      ? 'text-warning dark:text-yellow-300'
                      : 'text-muted-foreground'
                  )}
                >
                  {charsLeft}
                </span>
              )}

              {/* Submit */}
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-full px-5"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {replyTo ? 'Reply' : quotedEntry ? 'Quote' : 'Post'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
