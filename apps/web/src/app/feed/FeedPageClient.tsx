'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Feed } from '@/components/feed/Feed'
import { PostComposer } from '@/components/post/PostComposer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useQueryClient } from '@tanstack/react-query'
import { ConnectButton } from '@rainbow-me/rainbowkit'

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — rendered by layout, referenced here via portal/slot if needed */}
      <main className="flex-1 min-w-0 border-x border-border max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  )
}

export function FeedPageClient() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const queryClient = useQueryClient()
  const [composeOpen, setComposeOpen] = useState(false)

  // We allow viewing feed without connection, but show a CTA
  // No hard redirect — users can browse without signing in

  const handlePostSuccess = () => {
    setComposeOpen(false)
    // Invalidate feed to show new post
    queryClient.invalidateQueries({ queryKey: ['feed'] })
  }

  return (
    <AppShell>
      <PageHeader
        title="Home"
        action={
          isConnected ? (
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => setComposeOpen(true)}
              aria-label="Create new post"
            >
              <PenLine className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Post</span>
            </Button>
          ) : (
            <ConnectButton chainStatus="none" showBalance={false} />
          )
        }
      />

      {/* Inline composer at the top of the feed */}
      <PostComposer
        onSuccess={handlePostSuccess}
        placeholder="What's on your mind? (stored on-chain)"
      />

      {/* Feed */}
      <Feed initialType="latest" />

      {/* Compose dialog (triggered from header button) */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-base font-semibold">New Post</DialogTitle>
          </DialogHeader>
          <PostComposer
            onSuccess={handlePostSuccess}
            className="border-0"
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
