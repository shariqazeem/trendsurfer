import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const Database = (await import('better-sqlite3')).default
    const path = await import('path')
    const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), '../../data/trendsurfer.db')

    const db = new Database(dbPath, { readonly: true })

    const predictions = db.prepare(`
      SELECT * FROM predictions ORDER BY created_at DESC LIMIT 50
    `).all().map((row: any) => ({
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

    db.close()

    return NextResponse.json({ predictions, launches })
  } catch {
    return NextResponse.json({ predictions: [], launches: [] })
  }
}
