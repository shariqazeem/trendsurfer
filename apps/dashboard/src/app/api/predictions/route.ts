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

    const result = await db.execute('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 50')

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

    // Deduplicate launches — keep only the latest prediction per mint
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
  } catch (error) {
    console.error('Predictions API error:', error)
    return NextResponse.json({ predictions: [], launches: [], error: String(error) })
  }
}
