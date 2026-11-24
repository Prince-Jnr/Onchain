import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SettingsNav } from './SettingsNav'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your ONCHAIN settings.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <main className="flex-1 min-w-0 border-x border-border max-w-2xl mx-auto">
        <div className="border-b border-border px-4 pt-6">
          <div className="flex items-center gap-2">
            <Link
              href="/feed"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          </div>
          <SettingsNav />
        </div>
        {children}
      </main>
    </div>
  )
}
