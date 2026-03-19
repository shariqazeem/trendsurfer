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

    // Try to get graduation events - table may not exist yet
    try {
      const result = await db.execute({
        sql: 'SELECT * FROM graduation_events ORDER BY graduated_at DESC LIMIT 20',
        args: [],
      })

      const events = result.rows.map((row: any) => ({
        id: row.id,
        mint: row.mint,
        symbol: row.symbol,
        name: row.name,
        predictedScore: row.predicted_score,
        curveProgressAtPrediction: row.curve_progress_at_prediction,
        graduatedAt: row.graduated_at,
        predictedAt: row.predicted_at,
        timeToGraduate: row.time_to_graduate,
        wasPredicted: row.was_predicted === 1,
      }))

      const stats = {
        total: events.length,
        correctlyPredicted: events.filter((e: any) => e.wasPredicted).length,
        accuracy: events.length > 0
          ? Math.round((events.filter((e: any) => e.wasPredicted).length / events.length) * 100)
          : 0,
      }

      return NextResponse.json({ events, stats })
    } catch {
      // Table doesn't exist yet
      return NextResponse.json({ events: [], stats: { total: 0, correctlyPredicted: 0, accuracy: 0 } })
    }
  } catch (error: any) {
    return NextResponse.json({ events: [], stats: { total: 0, correctlyPredicted: 0, accuracy: 0 } }, { status: 200 })
  }
}
