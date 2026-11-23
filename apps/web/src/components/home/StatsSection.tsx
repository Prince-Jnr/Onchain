import { formatCount } from '@/lib/utils'

interface Stats {
  totalPosts: number
  totalUsers: number
  totalTransactions: number
}

interface StatsSectionProps {
  stats: Stats | null
}

const FALLBACK_STATS: Stats = {
  totalPosts: 0,
  totalUsers: 0,
  totalTransactions: 0,
}

export function StatsSection({ stats }: StatsSectionProps) {
  const data = stats ?? FALLBACK_STATS
  const isLive = stats !== null

  const items = [
    { label: 'Posts', value: formatCount(data.totalPosts) },
    { label: 'Unique authors', value: formatCount(data.totalUsers) },
    { label: 'Transactions', value: formatCount(data.totalTransactions) },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          By the numbers
        </h2>
        {isLive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="h-1 w-1 rounded-full bg-current" />
            Live
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 sm:gap-8">
        {items.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {value}
            </span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
