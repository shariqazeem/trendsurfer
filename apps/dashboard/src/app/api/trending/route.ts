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

export async function GET() {
  try {
    const db = getDb()

    // Simple query — get recent high-curve tokens, deduplicate in JS
    const result = await db.execute({
      sql: `SELECT * FROM predictions
            WHERE created_at > ?
            ORDER BY curve_progress DESC, score DESC
            LIMIT 30`,
      args: [Date.now() - 24 * 60 * 60 * 1000],
    })

    // Deduplicate by mint in JS (faster than SQL subquery on Turso)
    const seen = new Set<string>()
    const tokens = result.rows
      .filter((row: any) => {
        if (seen.has(row.mint)) return false
        seen.add(row.mint)
        return true
      })
      .slice(0, 6)
      .map((row: any) => ({
        mint: row.mint,
        symbol: row.symbol,
        name: row.name,
        score: row.score,
        curveProgress: row.curve_progress,
        prediction: row.prediction,
      }))

    return NextResponse.json({ tokens })
  } catch (error: any) {
    return NextResponse.json({ tokens: [] }, { status: 200 })
  }
}
