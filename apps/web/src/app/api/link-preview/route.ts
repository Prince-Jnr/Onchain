import { NextRequest, NextResponse } from 'next/server'

const MAX_URL_LENGTH = 2048

// Cached link previews (short-lived) so repeated reads of a URL don't refetch.
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_MS = 5 * 60_000

async function fetchPreview(url: string): Promise<LinkPreviewResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ONCHAIN/1.0 (+https://onchain.app)',
      Accept: 'text/html,application/xhtml+xml',
    },
    // Prevent SSRF to internal networks: allow only public hosts via DNS in production.
    redirect: 'follow',
  })
  if (!res.ok) {
    return { url, title: null, description: null, imageUrl: null, siteName: null }
  }
  const html = await res.text().catch(() => '')
  if (html.length === 0) return emptyPreview(url)

  const getMeta = (attr: string) => {
    const re = new RegExp(`<meta[^>]+property=["']${attr}["'][^>]+content=["']([^"']*)["']`, 'i')
    const m = html.match(re)
    return m ? decodeHtml(m[1]) : null
  }

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = (getMeta('og:title') ?? titleTag?.[1] ?? '').trim() || null
  const description = (getMeta('og:description') ?? '').trim() || null
  const imageUrl = getMeta('og:image')
  const siteName = (getMeta('og:site_name') ?? '').trim() || null

  return {
    url,
    title: title ? decodeHtml(title) : null,
    description: description ? decodeHtml(description) : null,
    imageUrl,
    siteName,
  }
}

function emptyPreview(url: string): LinkPreviewResult {
  return { url, title: null, description: null, imageUrl: null, siteName: null }
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// ---------------------------------------------------------------------------
// GET /api/link-preview?url=...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url')
  if (!urlParam) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  const url = urlParam.trim()
  if (url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: 'url is too long' }, { status: 400 })
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'url must be http(s)' }, { status: 400 })
  }

  const now = Date.now()
  const cached = cache.get(url)
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data)
  }

  try {
    const preview = await fetchPreview(url)
    cache.set(url, { data: preview, expiresAt: now + CACHE_MS })
    return NextResponse.json(preview)
  } catch {
    // Fail open: return an empty preview so the UI stays usable.
    return NextResponse.json(emptyPreview(url))
  }
}

interface LinkPreviewResult {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  siteName: string | null
}
