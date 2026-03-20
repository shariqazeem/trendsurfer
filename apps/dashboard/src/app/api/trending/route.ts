import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'

function getDbClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
  if (tursoUrl) {
    return createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() })
  }
  const path = require('path')
  const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), '../../data/trendsurfer.db')
  return createClient({ url: `file:${dbPath}` })
}

export async function GET() {
  try {
    const db = getDbClient()

    // Get the most interesting recent tokens:
    // 1. Highest scoring tokens from last 24 hours (potential graduates)
    // 2. Tokens with highest curve progress (closest to graduation)
    const result = await db.execute({
      sql: `SELECT p.* FROM predictions p
            INNER JOIN (
              SELECT mint, MAX(created_at) as max_created
              FROM predictions
              WHERE created_at > ?
              GROUP BY mint
            ) latest ON p.mint = latest.mint AND p.created_at = latest.max_created
            ORDER BY p.curve_progress DESC, p.score DESC
            LIMIT 6`,
      args: [Date.now() - 24 * 60 * 60 * 1000],
    })

    const tokens = result.rows.map((row: any) => ({
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
