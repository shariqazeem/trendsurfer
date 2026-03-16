import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const Database = (await import('better-sqlite3')).default
    const path = await import('path')
    const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), '../../data/trendsurfer.db')

    const db = new Database(dbPath, { readonly: true })

    const positions = db.prepare(`
      SELECT * FROM positions ORDER BY entry_timestamp DESC LIMIT 100
    `).all().map((row: any) => ({
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

    const pnl = db.prepare(`
      SELECT
        COALESCE(SUM(realized_pnl), 0) as totalPnl,
        COUNT(*) as totalTrades,
        COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
      FROM positions WHERE status = 'closed'
    `).get() as any

    db.close()

    return NextResponse.json({
      positions,
      pnl: {
        totalPnl: pnl?.totalPnl || 0,
        totalTrades: pnl?.totalTrades || 0,
        winRate: pnl?.totalTrades > 0 ? (pnl.wins / pnl.totalTrades) * 100 : 0,
      },
    })
  } catch {
    return NextResponse.json({
      positions: [],
      pnl: { totalPnl: 0, totalTrades: 0, winRate: 0 },
    })
  }
}
