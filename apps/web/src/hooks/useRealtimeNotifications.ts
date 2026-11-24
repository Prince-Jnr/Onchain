'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const NOTIFICATION_QUERY_KEYS = ['notifications']

/**
 * Realtime notifications via Server-Sent Events. Falls back to a short polling
 * loop when the EventSource connection cannot be established.
 */
export function useRealtimeNotifications() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let eventSource: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let disposed = false

    const invalidateNotifications = () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS, type: 'all' })
    }

    const startPolling = () => {
      pollTimer = setInterval(() => invalidateNotifications(), 30_000)
    }

    const connect = () => {
      if (disposed) return

      try {
        eventSource = new EventSource('/api/notifications/events')
        eventSource.addEventListener('open', () => {
          if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
          }
        })
        eventSource.onmessage = () => invalidateNotifications()
        eventSource.addEventListener('error', () => {
          // EventSource is not available or the stream broke — retry on next tick.
          if (eventSource) {
            eventSource.close()
            eventSource = null
          }
          if (!pollTimer) startPolling()
          setTimeout(connect, 5000)
        })
      } catch {
        if (!pollTimer) startPolling()
        setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      disposed = true
      if (eventSource) eventSource.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [queryClient])
}
