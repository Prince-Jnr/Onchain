'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** If true, renders a back button that calls router.back() */
  showBack?: boolean
  /** Override the back navigation target (defaults to router.back()) */
  backHref?: string
  /** Rendered to the right of the title block */
  action?: ReactNode
  className?: string
  /** Passed to the inner container for extra layout control */
  innerClassName?: string
}

export function PageHeader({
  title,
  subtitle,
  showBack = false,
  backHref,
  action,
  className,
  innerClassName,
}: PageHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm',
        className
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center gap-3 px-4',
          innerClassName
        )}
      >
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Go back"
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-1 flex-col justify-center min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        )}
      </div>
    </header>
  )
}
