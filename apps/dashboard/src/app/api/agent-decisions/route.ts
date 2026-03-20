import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

function getDb() {
  const url = process.env.TURSO_DATABASE_URL?.trim()
  const token = process.env.TURSO_AUTH_TOKEN?.trim()
  if (url) {
    return createClient({ url, authToken: token })
  }
  return createClient({ url: 'file:./data/trendsurfer.db' })
}

// Timeout wrapper — return empty on timeout instead of hanging
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function GET() {
  try {
    const db = getDb()

    const result = await withTimeout(
      db.execute({
        sql: `SELECT * FROM predictions
              WHERE created_at > ? AND prediction IN ('watching', 'will_graduate')
              ORDER BY created_at DESC
              LIMIT 50`,
        args: [Date.now() - 24 * 60 * 60 * 1000],
      }),
      5000,
      { rows: [] } as any
    )

    const seen = new Set<string>()
    const decisions = result.rows
      .filter((row: any) => {
        if (seen.has(row.mint)) return false
        seen.add(row.mint)
        return true
      })
      .slice(0, 20)
      .map((row: any) => ({
        mint: row.mint,
        symbol: row.symbol,
        name: row.name,
        score: row.score,
        curveProgress: row.curve_progress,
        prediction: row.prediction,
        reasoning: row.reasoning,
        lastUpdated: row.created_at,
        action: row.prediction === 'will_graduate' ? 'ready_to_buy' : 'monitoring',
      }))

    return NextResponse.json({ decisions })
  } catch {
    return NextResponse.json({ decisions: [] }, { status: 200 })
  }
}
