import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

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
        return true
      })
      .sort((a: any, b: any) => (b.curve_progress || 0) - (a.curve_progress || 0))
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
