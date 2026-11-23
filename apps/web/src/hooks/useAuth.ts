'use client'

import { useState, useCallback } from 'react'
import { useAccount, useSignMessage, useChainId, useDisconnect } from 'wagmi'
import { SiweMessage } from 'siwe'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from './useSession'

export function useAuth() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()
  const { disconnectAsync } = useDisconnect()
  const queryClient = useQueryClient()
  const { session, isLoading: isSessionLoading } = useSession()

  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  const isAuthenticated =
    session.authenticated === true &&
    // Ensure the session matches the currently connected wallet
    !!address &&
    session.address.toLowerCase() === address.toLowerCase()

  const signIn = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error('No wallet connected. Please connect your wallet first.')
    }

    setIsSigningIn(true)
    setSignInError(null)

    try {
      // 1. Fetch a one-time nonce from the server
      const nonceRes = await fetch('/api/auth/nonce', { credentials: 'include' })
      if (!nonceRes.ok) {
        const body = await nonceRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to fetch nonce')
      }
      const { nonce } = (await nonceRes.json()) as { nonce: string }

      // 2. Build the SIWE message
      const domain = window.location.host
      const origin = window.location.origin

      const siweMessage = new SiweMessage({
        domain,
        address,
        statement: 'Sign in to ONCHAIN — Leave something behind.',
        uri: origin,
        version: '1',
        chainId,
        nonce,
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      })

      const messageToSign = siweMessage.prepareMessage()

      // 3. Request an off-chain wallet signature (no gas)
      const signature = await signMessageAsync({ message: messageToSign })

      // 4. Send to the server for verification
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSign, signature }),
      })

      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Verification failed')
      }

      // 5. Invalidate the cached session so useSession refetches
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      setSignInError(message)
      throw err
    } finally {
      setIsSigningIn(false)
    }
  }, [isConnected, address, chainId, signMessageAsync, queryClient])

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Best-effort: even if the network call fails, clear local state
    }

    await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })

    // Optionally disconnect the wallet
    try {
      await disconnectAsync()
    } catch {
      // Ignore disconnect errors
    }
  }, [disconnectAsync, queryClient])

  return {
    // Auth actions
    signIn,
    signOut,

    // State
    isAuthenticated,
    isSigningIn,
    isSessionLoading,
    signInError,

    // Wallet identity
    address: isAuthenticated ? address : undefined,
    chainId: isAuthenticated ? chainId : undefined,
  }
}
