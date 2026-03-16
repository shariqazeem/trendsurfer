import { NextResponse } from 'next/server'

// In production, this would connect to the running agent process
// For now, return mock status — agent runs as separate process and shares SQLite DB

export async function GET() {
  try {
    // Try to read from shared SQLite database
    // The agent and dashboard share the same DB file
    const Database = (await import('better-sqlite3')).default
    const path = await import('path')
    const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), '../../data/trendsurfer.db')

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
      const db = new Database(dbPath, { readonly: true })

      logs = db.prepare('SELECT * FROM agent_log ORDER BY timestamp DESC LIMIT 100').all()

      const pnl = db.prepare(`
        SELECT
          COALESCE(SUM(realized_pnl), 0) as total_pnl,
          COUNT(*) as total_trades,
          COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
        FROM positions WHERE status = 'closed'
      `).get() as any

      const openCount = db.prepare('SELECT COUNT(*) as c FROM positions WHERE status = ?').get('open') as any
      const predictions = db.prepare('SELECT COUNT(*) as c FROM predictions').get() as any

      const lastLog = logs[0]

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

      db.close()
    } catch {
      // DB might not exist yet
    }

    return NextResponse.json({ ...status, logs })
  } catch (error) {
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
