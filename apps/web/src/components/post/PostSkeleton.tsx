import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PostSkeletonProps {
  compact?: boolean
  className?: string
}

export function PostSkeleton({ compact, className }: PostSkeletonProps) {
  return (
    <article
      className={cn(
        'border-b border-border px-4 py-4',
        compact && 'py-3',
        className
      )}
      aria-hidden="true"
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header row */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14 ml-auto" />
          </div>

          {/* Content lines */}
          {!compact && (
            <>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </>
          )}
          {compact && <Skeleton className="h-4 w-full" />}

          {/* Action bar */}
          <div className="flex items-center gap-6 pt-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-8 ml-auto" />
          </div>
        </div>
      </div>
    </article>
  )
}

export function PostSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </>
  )
}
