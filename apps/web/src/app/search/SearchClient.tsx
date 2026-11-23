'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Hash, Users, FileText, Layers, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { PostCard } from '@/components/post/PostCard'
import { PostSkeleton } from '@/components/post/PostSkeleton'
import { FollowButton } from '@/components/profile/FollowButton'
import {
  SearchResults,
  Profile,
  Entry,
  HashtagResult as HashtagSearchResult,
  shortenAddress,
  formatCount,
  ipfsToHttp,
} from '@onchain/shared'
import { cn } from '@/lib/utils'

type SearchTab = 'all' | 'people' | 'posts' | 'hashtags'

const TABS: { value: SearchTab; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Layers className="h-4 w-4" /> },
  { value: 'people', label: 'People', icon: <Users className="h-4 w-4" /> },
  { value: 'posts', label: 'Posts', icon: <FileText className="h-4 w-4" /> },
  { value: 'hashtags', label: 'Hashtags', icon: <Hash className="h-4 w-4" /> },
]

async function searchAll(q: string, tab: SearchTab): Promise<SearchResults> {
  if (!q.trim()) return { entries: [], profiles: [], hashtags: [], total: 0 }
  const params = new URLSearchParams({ q, tab })
  const res = await fetch(`/api/search?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Search failed')
  return res.json() as Promise<SearchResults>
}

function ProfileSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-4 border-b border-border">
      <Skeleton className="h-11 w-11 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Skeleton className="h-9 w-20 rounded-full shrink-0" />
    </div>
  )
}

function HashtagSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

function PeopleResult({ profile }: { profile: Profile }) {
  const displayName = profile.displayName ?? shortenAddress(profile.wallet, 4)
  const avatarUrl = profile.avatarUrl ? ipfsToHttp(profile.avatarUrl) : undefined

  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b border-border hover:bg-accent/40 transition-colors">
      <Link href={`/profile/${profile.wallet}`} className="shrink-0">
        <Avatar className="h-11 w-11 ring-1 ring-border hover:ring-primary transition-all">
          <AvatarFallback className="text-sm font-medium bg-muted">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/profile/${profile.wallet}`}
              className="block font-semibold text-sm text-foreground hover:underline truncate"
            >
              {displayName}
            </Link>
            <span className="text-xs text-muted-foreground font-mono">
              @{shortenAddress(profile.wallet, 4)}
            </span>
          </div>
          <FollowButton
            targetAddress={profile.wallet}
            initialIsFollowing={false}
            size="sm"
            className="shrink-0"
          />
        </div>

        {profile.bio && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {profile.bio}
          </p>
        )}

        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground font-medium">{formatCount(profile.followerCount)}</strong> followers
          </span>
          <span>
            <strong className="text-foreground font-medium">{formatCount(profile.postCount)}</strong> posts
          </span>
        </div>
      </div>
    </div>
  )
}

function HashtagResult({ hashtag }: { hashtag: HashtagSearchResult }) {
  return (
    <Link
      href={`/hashtag/${hashtag.tag}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-accent/40 transition-colors"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Hash className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">#{hashtag.tag}</p>
        <p className="text-xs text-muted-foreground">
          {formatCount(hashtag.count)} {hashtag.count === 1 ? 'post' : 'posts'}
        </p>
      </div>
    </Link>
  )
}

function EmptyState({ tab, query }: { tab: SearchTab; query: string }) {
  const messages: Record<SearchTab, string> = {
    all: `No results for "${query}"`,
    people: `No people matching "${query}"`,
    posts: `No posts matching "${query}"`,
    hashtags: `No hashtags matching "${query}"`,
  }

  return (
    <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
      <Search className="h-12 w-12 text-muted-foreground" />
      <p className="font-medium text-foreground">{messages[tab]}</p>
      <p className="text-sm text-muted-foreground">Try different keywords or check your spelling.</p>
    </div>
  )
}

interface SearchClientProps {
  initialQuery: string
  initialTab: SearchTab
}

export function SearchClient({ initialQuery, initialTab }: SearchClientProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  // Sync URL params
  useEffect(() => {
    if (!debouncedQuery) return
    const url = new URL(window.location.href)
    url.searchParams.set('q', debouncedQuery)
    url.searchParams.set('tab', activeTab)
    router.replace(url.pathname + url.search, { scroll: false })
  }, [debouncedQuery, activeTab, router])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['search', debouncedQuery, activeTab],
    queryFn: () => searchAll(debouncedQuery, activeTab),
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
  })

  const hasResults = data && (
    data.profiles.length > 0 || data.entries.length > 0 || data.hashtags.length > 0
  )

  const renderResults = () => {
    if (!debouncedQuery.trim()) {
      return (
        <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
          <Search className="h-12 w-12 text-muted-foreground" />
          <p className="font-medium text-foreground">Search ONCHAIN</p>
          <p className="text-sm text-muted-foreground">
            Find people, posts, and hashtags.
          </p>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div>
          {(activeTab === 'all' || activeTab === 'people') &&
            Array.from({ length: 3 }).map((_, i) => <ProfileSkeleton key={`pskel-${i}`} />)}
          {(activeTab === 'all' || activeTab === 'posts') &&
            Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={`eskel-${i}`} />)}
          {(activeTab === 'all' || activeTab === 'hashtags') &&
            Array.from({ length: 4 }).map((_, i) => <HashtagSkeleton key={`hskel-${i}`} />)}
        </div>
      )
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Search failed</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        </div>
      )
    }

    if (!hasResults) {
      return <EmptyState tab={activeTab} query={debouncedQuery} />
    }

    return (
      <div>
        {/* People */}
        {(activeTab === 'all' || activeTab === 'people') && data.profiles.length > 0 && (
          <section>
            {activeTab === 'all' && (
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  People
                </h2>
                {data.profiles.length >= 5 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('people')}
                    className="text-xs text-primary hover:underline"
                  >
                    See all →
                  </button>
                )}
              </div>
            )}
            {(activeTab === 'all' ? data.profiles.slice(0, 3) : data.profiles).map((p) => (
              <PeopleResult key={p.wallet} profile={p} />
            ))}
          </section>
        )}

        {/* Posts */}
        {(activeTab === 'all' || activeTab === 'posts') && data.entries.length > 0 && (
          <section>
            {activeTab === 'all' && (
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Posts
                </h2>
                {data.entries.length >= 5 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('posts')}
                    className="text-xs text-primary hover:underline"
                  >
                    See all →
                  </button>
                )}
              </div>
            )}
            {(activeTab === 'all' ? data.entries.slice(0, 3) : data.entries).map((e: Entry) => (
              <PostCard key={e.id} entry={e} />
            ))}
          </section>
        )}

        {/* Hashtags */}
        {(activeTab === 'all' || activeTab === 'hashtags') && data.hashtags.length > 0 && (
          <section>
            {activeTab === 'all' && (
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Hashtags
                </h2>
                {data.hashtags.length >= 5 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('hashtags')}
                    className="text-xs text-primary hover:underline"
                  >
                    See all →
                  </button>
                )}
              </div>
            )}
            {(activeTab === 'all' ? data.hashtags.slice(0, 5) : data.hashtags).map((h) => (
              <HashtagResult key={h.tag} hashtag={h} />
            ))}
          </section>
        )}

        {/* Empty per-tab */}
        {!hasResults && debouncedQuery.trim() && (
          <EmptyState tab={activeTab} query={debouncedQuery} />
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Search" />

      {/* Search input */}
      <div className="sticky top-14 z-20 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search people, posts, hashtags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9 h-10 bg-muted border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary"
            autoFocus={!initialQuery}
            aria-label="Search"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setDebouncedQuery('')
                inputRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs (only shown when there's a query) */}
      {debouncedQuery.trim() && (
        <div className="sticky top-[calc(3.5rem+3.25rem)] z-20 border-b border-border bg-background/80 backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SearchTab)}>
            <TabsList className="h-10 w-full rounded-none border-0 bg-transparent p-0 justify-start overflow-x-auto">
              {TABS.map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    'relative h-10 rounded-none border-0 px-4 text-sm font-medium',
                    'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                    'data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground',
                    'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                    'after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100',
                    'after:transition-transform after:duration-200'
                  )}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Results */}
      {renderResults()}
    </div>
  )
}
