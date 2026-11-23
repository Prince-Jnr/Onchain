import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  maxLength?: number
  showCount?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, maxLength, showCount, onChange, value, defaultValue, ...props }, ref) => {
    const [count, setCount] = React.useState(() => {
      if (value !== undefined) return String(value).length
      if (defaultValue !== undefined) return String(defaultValue).length
      return 0
    })

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCount(e.target.value.length)
      onChange?.(e)
    }

    const isNearLimit = maxLength !== undefined && count >= maxLength * 0.8
    const isAtLimit = maxLength !== undefined && count >= maxLength

    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-none transition-colors',
            error && 'border-destructive focus-visible:ring-destructive',
            showCount && maxLength && 'pb-7',
            className
          )}
          ref={ref}
          maxLength={maxLength}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {showCount && maxLength !== undefined && (
          <span
            className={cn(
              'absolute bottom-2 right-3 text-xs tabular-nums',
              isAtLimit
                ? 'text-destructive'
                : isNearLimit
                ? 'text-[hsl(var(--warning))]'
                : 'text-muted-foreground'
            )}
          >
            {count}/{maxLength}
          </span>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
