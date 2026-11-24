'use client'

import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PostComposer } from './PostComposer'
import { Entry, getTxUrl } from '@onchain/shared'
import { useChainId } from 'wagmi'

interface QuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: Entry
  onSuccess?: () => void
}

export function QuoteDialog({ open, onOpenChange, entry, onSuccess }: QuoteDialogProps) {
  const chainId = useChainId()
  const txUrl = entry.txHash ? getTxUrl(entry.txHash, chainId) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quote post</DialogTitle>
          <DialogDescription>
            Add your thoughts next to this post. Your quote is stored on-chain.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
          <PostComposer
            quotedEntry={entry}
            onSuccess={() => {
              onSuccess?.()
              onOpenChange(false)
            }}
            className="border-0"
          />
        </div>
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>You&apos;re quoting:</span>
            {txUrl && (
              <Link href={txUrl} target="_blank" rel="noopener noreferrer" onClick={() => onOpenChange(false)}>
                <Button variant="ghost" size="sm" className="rounded-full h-7 px-3 gap-1">
                  <ExternalLink className="h-3 w-3" />
                  View on-chain
                </Button>
              </Link>
            )}
          </div>
          <p className="mt-1 line-clamp-3 text-sm">
            {entry.content?.text?.slice(0, 200) ?? entry.contentRef}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
