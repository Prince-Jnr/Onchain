'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Primitive re-exports ────────────────────────────────────────────────────

const ToastProvider = ToastPrimitive.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4',
      'sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const toastVariants = cva(
  [
    'group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden',
    'rounded-md border border-border p-4 pr-6 shadow-lg transition-all',
    'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
    'data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'destructive group border-destructive bg-destructive text-destructive-foreground',
        success:
          'border-[hsl(var(--success))] bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
))
Toast.displayName = ToastPrimitive.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3',
      'text-sm font-medium transition-colors',
      'hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30',
      'group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground',
      'group-[.destructive]:focus:ring-destructive',
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitive.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      'absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity',
      'hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring',
      'group-hover:opacity-100',
      'group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50',
      'group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
))
ToastClose.displayName = ToastPrimitive.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold [&+div]:text-xs', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

// ─── useToast hook ────────────────────────────────────────────────────────────

type ToastVariant = VariantProps<typeof toastVariants>['variant']

export interface ToastOptions {
  id?: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: ToastVariant
  duration?: number
}

interface ToastState extends Required<Pick<ToastOptions, 'id'>> {
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: ToastVariant
  duration?: number
  open: boolean
}

type ToastAction2 =
  | { type: 'ADD'; toast: ToastState }
  | { type: 'UPDATE'; id: string; toast: Partial<ToastState> }
  | { type: 'DISMISS'; id: string }
  | { type: 'REMOVE'; id: string }

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function addToRemoveQueue(id: string, dispatch: React.Dispatch<ToastAction2>) {
  if (toastTimeouts.has(id)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(id)
    dispatch({ type: 'REMOVE', id })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(id, timeout)
}

function toastReducer(state: ToastState[], action: ToastAction2): ToastState[] {
  switch (action.type) {
    case 'ADD':
      return [action.toast, ...state].slice(0, TOAST_LIMIT)
    case 'UPDATE':
      return state.map((t) =>
        t.id === action.id ? { ...t, ...action.toast } : t
      )
    case 'DISMISS':
      return state.map((t) =>
        t.id === action.id ? { ...t, open: false } : t
      )
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id)
  }
}

// Global listener pattern so toasts work outside React tree
type Listener = (state: ToastState[]) => void
let memoryState: ToastState[] = []
const listeners: Set<Listener> = new Set()

function dispatch(action: ToastAction2) {
  memoryState = toastReducer(memoryState, action)
  listeners.forEach((l) => l(memoryState))
}

export function toast(options: ToastOptions) {
  const id = options.id ?? genId()

  const existing = memoryState.find((t) => t.id === id)
  if (existing) {
    dispatch({ type: 'UPDATE', id, toast: { ...options, open: true } })
    return { id, dismiss: () => dispatch({ type: 'DISMISS', id }) }
  }

  dispatch({
    type: 'ADD',
    toast: { ...options, id, open: true },
  })

  return { id, dismiss: () => dispatch({ type: 'DISMISS', id }) }
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastState[]>(memoryState)

  React.useEffect(() => {
    listeners.add(setToasts)
    return () => {
      listeners.delete(setToasts)
    }
  }, [])

  return {
    toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: 'DISMISS', id }),
  }
}

// ─── Toaster ─────────────────────────────────────────────────────────────────

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, duration, open }) => (
        <Toast
          key={id}
          open={open}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              dispatch({ type: 'DISMISS', id })
              addToRemoveQueue(id, dispatch)
            }
          }}
          variant={variant}
          duration={duration}
        >
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose onClick={() => dismiss(id)} />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
}
