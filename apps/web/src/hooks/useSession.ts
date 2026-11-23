'use client'

import { useQuery } from '@tanstack/react-query'

interface SessionResponse {
  authenticated: false
}

interface AuthenticatedSessionResponse {
  authenticated: true
  address: string
  chainId: number
}

export type SessionState = SessionResponse | AuthenticatedSessionResponse

async function fetchSession(): Promise<SessionState> {
  const res = await fetch('/api/auth/session', { credentials: 'include' })
  if (!res.ok) {
    return { authenticated: false }
  }
  return res.json() as Promise<SessionState>
}

export function useSession() {
  const {
    data: session,
    isLoading,
    isError,
    refetch,
  } = useQuery<SessionState>({
    queryKey: ['auth', 'session'],
    queryFn: fetchSession,
    staleTime: 60_000,       // treat as fresh for 1 minute
    refetchOnWindowFocus: true,
  })

  return {
    session: session ?? ({ authenticated: false } as SessionState),
    isLoading,
    isError,
    refetch,
  }
}
