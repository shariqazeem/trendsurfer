import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

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

    const posResult = await db.execute('SELECT * FROM positions ORDER BY entry_timestamp DESC LIMIT 100')
    console.log('Trades API: posResult.rows.length =', posResult.rows.length)

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

    const pnlResult = await db.execute(`
      SELECT
        COALESCE(SUM(realized_pnl), 0) as totalPnl,
        COUNT(*) as totalTrades,
        COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
      FROM positions WHERE status = 'closed'
    `)
    const pnl = pnlResult.rows[0] as any

    return NextResponse.json({
      positions,
      pnl: {
        totalPnl: pnl?.totalPnl || 0,
        totalTrades: pnl?.totalTrades || 0,
        winRate: pnl?.totalTrades > 0 ? (pnl.wins / pnl.totalTrades) * 100 : 0,
      },
    })
  } catch (error) {
    console.error('Trades API error:', error)
    return NextResponse.json({
      positions: [],
      pnl: { totalPnl: 0, totalTrades: 0, winRate: 0 },
      error: String(error),
    })
  }
}
