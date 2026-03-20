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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function GET() {
  try {
    const db = getDb()

    // First check if the table exists
    let events: any[] = []
    try {
      const result = await withTimeout(
        db.execute({
          sql: 'SELECT * FROM graduation_events ORDER BY graduated_at DESC LIMIT 20',
          args: [],
        }),
        5000,
        { rows: [] } as any
      )
      events = result.rows.map((row: any) => ({
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
    } catch {
      // Table doesn't exist yet — that's OK
    }

    // Also check predictions for graduated outcomes (fallback)
    if (events.length === 0) {
      try {
        const predResult = await db.execute(
          "SELECT * FROM predictions WHERE outcome = 'graduated' ORDER BY created_at DESC LIMIT 20"
        )
        events = predResult.rows.map((row: any) => ({
          id: row.id,
          mint: row.mint,
          symbol: row.symbol,
          name: row.name,
          predictedScore: row.score,
          curveProgressAtPrediction: row.curve_progress,
          graduatedAt: row.created_at,
          predictedAt: row.created_at,
          timeToGraduate: 0,
          wasPredicted: row.prediction === 'will_graduate',
        }))
      } catch {
        // predictions table might not have graduated entries
      }
    }

    const stats = {
      total: events.length,
      correctlyPredicted: events.filter((e: any) => e.wasPredicted).length,
      accuracy: events.length > 0
        ? Math.round((events.filter((e: any) => e.wasPredicted).length / events.length) * 100)
        : 0,
    }

    return NextResponse.json({ events, stats })
  } catch (error: any) {
    return NextResponse.json({ events: [], stats: { total: 0, correctlyPredicted: 0, accuracy: 0 } }, { status: 200 })
  }
}
