import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const VM_API = process.env.VM_API_URL?.trim()

function getDb() {
  const url = process.env.TURSO_DATABASE_URL?.trim()
  const token = process.env.TURSO_AUTH_TOKEN?.trim()
  if (url) return createClient({ url, authToken: token })
  return createClient({ url: 'file:./data/trendsurfer.db' })
}

function withTimeout<T>(p: Promise<T>, ms: number, fb: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fb), ms))])
}

export async function GET() {
  if (VM_API) {
    try {
      const r = await fetch(`${VM_API}/api/trending`, { next: { revalidate: 0 } })
      return NextResponse.json(await r.json())
    } catch { return NextResponse.json({ tokens: [] }) }
  }
  try {
    const db = getDb()
    // Grab latest 100 predictions (fast with index), sort/filter in JS
    const result = await withTimeout(
      db.execute('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 100'),
      5000, { rows: [] } as any
    )

    const seen = new Set<string>()
    const tokens = result.rows
      .filter((row: any) => {
        if (seen.has(row.mint)) return false
        seen.add(row.mint)
        // Prefer tokens still in progress (not 100% graduated) for more interesting demo
        return (row.curve_progress || 0) < 99
      })
      // Sort by score (most interesting first), not by curve progress
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, 6)
      .map((row: any) => ({
        mint: row.mint, symbol: row.symbol, name: row.name,
        score: row.score, curveProgress: row.curve_progress,
        prediction: row.prediction,
      }))

    return NextResponse.json({ tokens })
  } catch {
    return NextResponse.json({ tokens: [] }, { status: 200 })
  }
}
