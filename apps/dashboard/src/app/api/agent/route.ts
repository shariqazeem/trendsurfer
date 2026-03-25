import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const VM_API = process.env.VM_API_URL?.trim()

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

const EMPTY_STATUS = {
  running: false,
  uptime: 0,
  tokensScanned: 0,
  tokensAnalyzed: 0,
  activePositions: 0,
  totalTrades: 0,
  totalPnl: 0,
  winRate: 0,
  lastScan: 0,
  logs: [] as any[],
}

export async function GET() {
  if (VM_API) {
    try {
      const r = await fetch(`${VM_API}/api/agent`, { next: { revalidate: 0 } })
      const data = await r.json()
      return NextResponse.json(data)
    } catch { return NextResponse.json(EMPTY_STATUS) }
  }
  try {
    const db = getDb()

    // Single query to get everything we need — much faster than 4 separate queries
    const [logsResult, statsResult] = await Promise.all([
      withTimeout(
        db.execute('SELECT * FROM agent_log ORDER BY timestamp DESC LIMIT 100'),
        5000,
        { rows: [] } as any
      ),
      withTimeout(
        db.execute(`SELECT
          (SELECT COUNT(*) FROM predictions) as pred_count,
          (SELECT COUNT(*) FROM positions WHERE status = 'open') as open_count,
          (SELECT COUNT(*) FROM positions WHERE status = 'closed') as closed_count,
          (SELECT COALESCE(SUM(realized_pnl), 0) FROM positions WHERE status = 'closed') as total_pnl,
          (SELECT COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) FROM positions WHERE status = 'closed') as wins
        `),
        5000,
        { rows: [{}] } as any
      ),
    ])

    const logs = logsResult.rows as any[]
    const stats = (statsResult.rows[0] || {}) as any
    const lastLog = logs[0] as any

    // Agent is "running" if last heartbeat was within 10 minutes
    const running = lastLog ? (Date.now() - Number(lastLog.timestamp) < 10 * 60 * 1000) : false

    return NextResponse.json({
      running,
      uptime: 0,
      tokensScanned: Number(stats.pred_count) || 0,
      tokensAnalyzed: Number(stats.pred_count) || 0,
      activePositions: Number(stats.open_count) || 0,
      totalTrades: Number(stats.closed_count) || 0,
      totalPnl: Number(stats.total_pnl) || 0,
      winRate: stats.closed_count > 0 ? (Number(stats.wins) / Number(stats.closed_count)) * 100 : 0,
      lastScan: lastLog ? Number(lastLog.timestamp) : 0,
      logs,
    })
  } catch {
    return NextResponse.json(EMPTY_STATUS)
  }
}
