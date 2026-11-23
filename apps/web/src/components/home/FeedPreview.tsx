import Link from 'next/link'
import { formatRelativeTime, shortenAddress } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface PreviewPost {
  id: string
  content: string
  authorAddress: string
  createdAt: string
  reactionCount?: number
  replyCount?: number
}

interface FeedPreviewProps {
  posts: PreviewPost[]
}

export function FeedPreview({ posts }: FeedPreviewProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-border px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No posts yet.{' '}
          <Link href="/feed" className="text-primary hover:underline underline-offset-4">
            Be the first
          </Link>{' '}
          to leave something behind.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {posts.map((post) => (
        <article key={post.id} className="group px-5 py-4 hover:bg-muted/30 transition-colors">
          <Link href={`/post/${post.id}`} className="flex gap-3">
            <Avatar size="sm" className="mt-0.5 shrink-0">
              <AvatarFallback className="text-xs">
                {post.authorAddress.slice(2, 4).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="font-mono text-xs font-medium text-foreground">
                  {shortenAddress(post.authorAddress)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(post.createdAt)}
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                {post.content}
              </p>
              {(post.reactionCount !== undefined || post.replyCount !== undefined) && (
                <div className="mt-2 flex gap-4">
                  {post.replyCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                  )}
                  {post.reactionCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {post.reactionCount} {post.reactionCount === 1 ? 'reaction' : 'reactions'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
        </article>
      ))}
    </div>
  )
}
