import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

function getDbClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  if (tursoUrl) {
    return createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
  }
  const path = require('path')
  const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), '../../data/trendsurfer.db')
  return createClient({ url: `file:${dbPath}` })
}

export async function GET() {
  try {
    const db = getDbClient()

    let logs: any[] = []
    let status = {
      running: false,
      uptime: 0,
      tokensScanned: 0,
      tokensAnalyzed: 0,
      activePositions: 0,
      totalTrades: 0,
      totalPnl: 0,
      winRate: 0,
      lastScan: 0,
    }

    try {
      const logsResult = await db.execute('SELECT * FROM agent_log ORDER BY timestamp DESC LIMIT 100')
      logs = logsResult.rows as any[]

      const pnlResult = await db.execute(`
        SELECT
          COALESCE(SUM(realized_pnl), 0) as total_pnl,
          COUNT(*) as total_trades,
          COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
        FROM positions WHERE status = 'closed'
      `)
      const pnl = pnlResult.rows[0] as any

      const openResult = await db.execute("SELECT COUNT(*) as c FROM positions WHERE status = 'open'")
      const openCount = openResult.rows[0] as any

      const predResult = await db.execute('SELECT COUNT(*) as c FROM predictions')
      const predictions = predResult.rows[0] as any

      const lastLog = logs[0] as any

      status = {
        running: lastLog ? (Date.now() - lastLog.timestamp < 60000) : false,
        uptime: 0,
        tokensScanned: predictions?.c || 0,
        tokensAnalyzed: predictions?.c || 0,
        activePositions: openCount?.c || 0,
        totalTrades: pnl?.total_trades || 0,
        totalPnl: pnl?.total_pnl || 0,
        winRate: pnl?.total_trades > 0 ? (pnl.wins / pnl.total_trades) * 100 : 0,
        lastScan: lastLog?.timestamp || 0,
      }
    } catch {
      // DB might not exist yet
    }

    return NextResponse.json({ ...status, logs })
  } catch {
    return NextResponse.json({
      running: false,
      uptime: 0,
      tokensScanned: 0,
      tokensAnalyzed: 0,
      activePositions: 0,
      totalTrades: 0,
      totalPnl: 0,
      winRate: 0,
      lastScan: 0,
      logs: [],
    })
  }
}
