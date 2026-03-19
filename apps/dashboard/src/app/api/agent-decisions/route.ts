import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'

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
    const result = await db.execute({
      sql: `SELECT p.* FROM predictions p
            INNER JOIN (
              SELECT mint, MAX(created_at) as max_created
              FROM predictions
              WHERE created_at > ? AND prediction IN ('watching', 'will_graduate')
              GROUP BY mint
            ) latest ON p.mint = latest.mint AND p.created_at = latest.max_created
            ORDER BY p.score DESC
            LIMIT 20`,
      args: [Date.now() - 24 * 60 * 60 * 1000],
    })

    const decisions = result.rows.map((row: any) => ({
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
  } catch (error: any) {
    return NextResponse.json({ decisions: [], error: error.message }, { status: 200 })
  }
}
