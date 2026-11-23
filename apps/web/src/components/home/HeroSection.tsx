'use client'

import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WalletButton } from '@/components/wallet/WalletButton'
import { useAuth } from '@/hooks/useAuth'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay },
  }),
}

export function HeroSection() {
  const { isConnected } = useAccount()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  // Redirect authenticated users straight to the feed
  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.replace('/feed')
    }
  }, [mounted, isAuthenticated, router])

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pt-28 md:pt-36">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(var(--color-foreground) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative mx-auto max-w-2xl">
        {/* Eyebrow */}
        <motion.div
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Built on Base
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          custom={0.08}
          className="mt-6 text-5xl font-black tracking-tight text-foreground sm:text-6xl md:text-7xl"
        >
          Leave something
          <br />
          <span className="text-primary">behind.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          custom={0.16}
          className="mt-6 max-w-md text-lg text-muted-foreground leading-relaxed"
        >
          ONCHAIN is a social platform where your posts are recorded on the
          Base blockchain. No intermediary. No deletion. Your words, permanently.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          custom={0.24}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          {mounted && !isConnected ? (
            <WalletButton className="h-10 px-5 text-sm" />
          ) : mounted && isConnected && !isAuthenticated ? (
            <WalletButton className="h-10 px-5 text-sm" />
          ) : null}

          <Button asChild variant="outline" size="lg" className="h-10 px-5 text-sm">
            <Link href="/feed" className="flex items-center gap-2">
              Browse the feed
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        {/* Stat strip */}
        <motion.div
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          custom={0.32}
          className="mt-14 flex gap-8 border-t border-border pt-8"
        >
          {[
            { label: 'On-chain posts', value: 'Permanent' },
            { label: 'Ownership', value: 'Yours' },
            { label: 'Network', value: 'Base' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-lg font-bold text-foreground">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
