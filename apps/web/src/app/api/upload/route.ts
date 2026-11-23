import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/session'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const jwt = process.env.PINATA_JWT
  if (!jwt) return NextResponse.json({ error: 'Image uploads are unavailable until IPFS storage is configured' }, { status: 503 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload form' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Use a JPEG, PNG, WebP, or GIF image' }, { status: 415 })
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image must be smaller than 10 MB' }, { status: 413 })
  }

  const payload = new FormData()
  payload.set('file', file, file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120))
  payload.set('pinataMetadata', JSON.stringify({ name: `onchain-${session.walletAddress.slice(2, 10)}` }))
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: payload,
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      console.error('[upload] Pinning provider returned status', response.status)
      return NextResponse.json({ error: 'Image storage provider rejected the upload' }, { status: 502 })
    }
    const result = await response.json() as { IpfsHash?: unknown }
    if (typeof result.IpfsHash !== 'string' || !/^bafy[a-z2-7]{20,}$/.test(result.IpfsHash)) {
      return NextResponse.json({ error: 'Image storage provider returned an invalid content identifier' }, { status: 502 })
    }
    return NextResponse.json({
      url: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      ipfsCid: result.IpfsHash,
      mimeType: file.type,
      sizeBytes: file.size,
    }, { status: 201 })
  } catch (error) {
    console.error('[upload] Image upload failed:', error)
    return NextResponse.json({ error: 'Image upload failed. Try again.' }, { status: 502 })
  }
}
