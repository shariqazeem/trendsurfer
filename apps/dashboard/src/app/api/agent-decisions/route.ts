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
      const r = await fetch(`${VM_API}/api/agent-decisions`, { next: { revalidate: 0 } })
      return NextResponse.json(await r.json())
    } catch { return NextResponse.json({ decisions: [] }) }
  }
  try {
    const db = getDb()
    // Grab latest 100 predictions (fast with index), filter in JS
    const result = await withTimeout(
      db.execute('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 100'),
      5000, { rows: [] } as any
    )

    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const seen = new Set<string>()
    const decisions = result.rows
      .filter((row: any) => {
        if (row.created_at < cutoff) return false
        if (row.prediction !== 'watching' && row.prediction !== 'will_graduate') return false
        if (seen.has(row.mint)) return false
        seen.add(row.mint)
        return true
      })
      .slice(0, 20)
      .map((row: any) => ({
        mint: row.mint, symbol: row.symbol, name: row.name,
        score: row.score, curveProgress: row.curve_progress,
        prediction: row.prediction, reasoning: row.reasoning,
        lastUpdated: row.created_at,
        action: row.prediction === 'will_graduate' ? 'ready_to_buy' : 'monitoring',
      }))

    return NextResponse.json({ decisions })
  } catch {
    return NextResponse.json({ decisions: [] }, { status: 200 })
  }
}
