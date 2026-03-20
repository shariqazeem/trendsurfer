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

    const [posResult, pnlResult] = await Promise.all([
      withTimeout(
        db.execute('SELECT * FROM positions ORDER BY entry_timestamp DESC LIMIT 100'),
        5000,
        { rows: [] } as any
      ),
      withTimeout(
        db.execute(`SELECT
          COALESCE(SUM(realized_pnl), 0) as totalPnl,
          COUNT(*) as totalTrades,
          COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
        FROM positions WHERE status = 'closed'`),
        5000,
        { rows: [{}] } as any
      ),
    ])

    const positions = posResult.rows.map((row: any) => ({
      id: row.id,
      mint: row.mint,
      symbol: row.symbol,
      entryPrice: row.entry_price,
      entryAmount: row.entry_amount,
      entryTimestamp: row.entry_timestamp,
      currentPrice: row.current_price,
      exitPrice: row.exit_price,
      exitTimestamp: row.exit_timestamp,
      realizedPnl: row.realized_pnl,
      realizedPnlPercent: row.realized_pnl_percent,
      status: row.status,
      graduationScore: row.graduation_score,
      reasoning: row.reasoning,
    }))

    const pnl = (pnlResult.rows[0] || {}) as any

    return NextResponse.json({
      positions,
      pnl: {
        totalPnl: Number(pnl.totalPnl) || 0,
        totalTrades: Number(pnl.totalTrades) || 0,
        winRate: pnl.totalTrades > 0 ? (Number(pnl.wins) / Number(pnl.totalTrades)) * 100 : 0,
      },
    })
  } catch {
    return NextResponse.json({
      positions: [],
      pnl: { totalPnl: 0, totalTrades: 0, winRate: 0 },
    })
  }
}
