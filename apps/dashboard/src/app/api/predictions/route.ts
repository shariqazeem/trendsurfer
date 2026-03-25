import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const VM_API = process.env.VM_API_URL?.trim()

function getDb() {
  const url = process.env.TURSO_DATABASE_URL?.trim()
  const token = process.env.TURSO_AUTH_TOKEN?.trim()
  if (url) {
    return createClient({ url, authToken: token })
  }
  return createClient({ url: 'file:./data/trendsurfer.db' })
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function GET() {
  if (VM_API) {
    try {
      const r = await fetch(`${VM_API}/api/predictions`, { next: { revalidate: 0 } })
      return NextResponse.json(await r.json())
    } catch { return NextResponse.json({ predictions: [], launches: [] }) }
  }
  try {
    const db = getDb()

    const result = await withTimeout(
      db.execute('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 50'),
      8000,
      { rows: [] } as any
    )

    const predictions = result.rows.map((row: any) => ({
      id: row.id,
      mint: row.mint,
      symbol: row.symbol,
      name: row.name,
      score: row.score,
      curveProgress: row.curve_progress,
      velocity: row.velocity,
      reasoning: row.reasoning,
      prediction: row.prediction,
      createdAt: row.created_at,
      outcome: row.outcome,
      traded: row.traded === 1,
    }))

    const seen = new Set<string>()
    const launches = predictions
      .filter((p: any) => {
        if (seen.has(p.mint)) return false
        seen.add(p.mint)
        return true
      })
      .map((p: any) => ({
        mint: p.mint,
        poolAddress: '',
        name: p.name,
        symbol: p.symbol,
        createdAt: p.createdAt,
        curveProgress: p.curveProgress,
        graduated: p.outcome === 'graduated',
        score: p.score,
        velocity: p.velocity,
        prediction: p.prediction,
      }))

    return NextResponse.json({ predictions, launches })
  } catch {
    return NextResponse.json({ predictions: [], launches: [] })
  }
}
