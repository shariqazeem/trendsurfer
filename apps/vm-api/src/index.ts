import express from 'express'
import cors from 'cors'
import path from 'path'
import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../../../.env.local') })

const app = express()
const PORT = process.env.VM_API_PORT || 3001

app.use(cors())
app.use(express.json())

function getDb() {
  const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../../data/trendsurfer.db')
  const url = dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`
  return createClient({ url })
}

// ── /api/agent ──────────────────────────────────────────────────────────────

app.get('/api/agent', async (req, res) => {
  try {
    const db = getDb()
    const [logsResult, statsResult] = await Promise.all([
      db.execute('SELECT * FROM agent_log ORDER BY timestamp DESC LIMIT 100'),
      db.execute(`SELECT
        (SELECT COUNT(*) FROM predictions) as pred_count,
        (SELECT COUNT(*) FROM positions WHERE status = 'open') as open_count,
        (SELECT COUNT(*) FROM positions WHERE status = 'closed') as closed_count,
        (SELECT COALESCE(SUM(realized_pnl), 0) FROM positions WHERE status = 'closed') as total_pnl,
        (SELECT COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) FROM positions WHERE status = 'closed') as wins
      `),
    ])

    const logs = logsResult.rows as any[]
    const stats = (statsResult.rows[0] || {}) as any
    const lastLog = logs[0] as any
    const running = lastLog ? (Date.now() - Number(lastLog.timestamp) < 10 * 60 * 1000) : false

    res.json({
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
  } catch (e) {
    console.error('/api/agent error:', e)
    res.json({ running: false, uptime: 0, tokensScanned: 0, tokensAnalyzed: 0, activePositions: 0, totalTrades: 0, totalPnl: 0, winRate: 0, lastScan: 0, logs: [] })
  }
})

// ── /api/predictions ────────────────────────────────────────────────────────

app.get('/api/predictions', async (req, res) => {
  try {
    const db = getDb()
    const result = await db.execute('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 50')

    const predictions = result.rows.map((row: any) => ({
      id: row.id, mint: row.mint, symbol: row.symbol, name: row.name,
      score: row.score, curveProgress: row.curve_progress, velocity: row.velocity,
      reasoning: row.reasoning, prediction: row.prediction, createdAt: row.created_at,
      outcome: row.outcome, traded: row.traded === 1,
    }))

    const seen = new Set<string>()
    const launches = predictions
      .filter((p: any) => { if (seen.has(p.mint)) return false; seen.add(p.mint); return true })
      .map((p: any) => ({
        mint: p.mint, poolAddress: '', name: p.name, symbol: p.symbol,
        createdAt: p.createdAt, curveProgress: p.curveProgress,
        graduated: p.outcome === 'graduated', score: p.score,
        velocity: p.velocity, prediction: p.prediction,
      }))

    res.json({ predictions, launches })
  } catch (e) {
    console.error('/api/predictions error:', e)
    res.json({ predictions: [], launches: [] })
  }
})

// ── /api/trades ─────────────────────────────────────────────────────────────

app.get('/api/trades', async (req, res) => {
  try {
    const db = getDb()
    const [posResult, pnlResult] = await Promise.all([
      db.execute('SELECT * FROM positions ORDER BY entry_timestamp DESC LIMIT 100'),
      db.execute(`SELECT
        COALESCE(SUM(realized_pnl), 0) as totalPnl,
        COUNT(*) as totalTrades,
        COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
        FROM positions WHERE status = 'closed'`),
    ])

    const positions = posResult.rows.map((row: any) => ({
      id: row.id, mint: row.mint, symbol: row.symbol,
      entryPrice: row.entry_price, entryAmount: row.entry_amount,
      entryTimestamp: row.entry_timestamp, currentPrice: row.current_price,
      exitPrice: row.exit_price, exitTimestamp: row.exit_timestamp,
      realizedPnl: row.realized_pnl, realizedPnlPercent: row.realized_pnl_percent,
      status: row.status, graduationScore: row.graduation_score, reasoning: row.reasoning,
    }))

    const pnl = (pnlResult.rows[0] || {}) as any
    res.json({
      positions,
      pnl: {
        totalPnl: Number(pnl.totalPnl) || 0,
        totalTrades: Number(pnl.totalTrades) || 0,
        winRate: pnl.totalTrades > 0 ? (Number(pnl.wins) / Number(pnl.totalTrades)) * 100 : 0,
      },
    })
  } catch (e) {
    console.error('/api/trades error:', e)
    res.json({ positions: [], pnl: { totalPnl: 0, totalTrades: 0, winRate: 0 } })
  }
})

// ── /api/graduations ────────────────────────────────────────────────────────

app.get('/api/graduations', async (req, res) => {
  try {
    const db = getDb()
    let events: any[] = []

    try {
      const result = await db.execute('SELECT * FROM graduation_events ORDER BY graduated_at DESC LIMIT 20')
      events = result.rows.map((row: any) => ({
        id: row.id, mint: row.mint, symbol: row.symbol, name: row.name,
        predictedScore: row.predicted_score,
        curveProgressAtPrediction: row.curve_progress_at_prediction,
        graduatedAt: row.graduated_at, predictedAt: row.predicted_at,
        timeToGraduate: row.time_to_graduate, wasPredicted: row.was_predicted === 1,
      }))
    } catch {}

    if (events.length === 0) {
      const predResult = await db.execute(
        "SELECT * FROM predictions WHERE outcome = 'graduated' ORDER BY created_at DESC LIMIT 20"
      )
      events = predResult.rows.map((row: any) => ({
        id: row.id, mint: row.mint, symbol: row.symbol, name: row.name,
        predictedScore: row.score, curveProgressAtPrediction: row.curve_progress,
        graduatedAt: row.created_at, predictedAt: row.created_at,
        timeToGraduate: 0, wasPredicted: row.prediction === 'will_graduate',
      }))
    }

    const stats = {
      total: events.length,
      correctlyPredicted: events.filter((e: any) => e.wasPredicted).length,
      accuracy: events.length > 0
        ? Math.round((events.filter((e: any) => e.wasPredicted).length / events.length) * 100)
        : 0,
    }

    res.json({ events, stats })
  } catch (e) {
    console.error('/api/graduations error:', e)
    res.json({ events: [], stats: { total: 0, correctlyPredicted: 0, accuracy: 0 } })
  }
})

// ── /api/agent-decisions ────────────────────────────────────────────────────

app.get('/api/agent-decisions', async (req, res) => {
  try {
    const db = getDb()
    const result = await db.execute('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 100')

    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const seen = new Set<string>()
    const decisions = result.rows
      .filter((row: any) => {
        if (row.created_at < cutoff) return false
        if (row.prediction !== 'watching' && row.prediction !== 'will_graduate') return false
        if (seen.has(row.mint)) return false
        seen.add(row.mint)
        return true
      })
      .slice(0, 20)
      .map((row: any) => ({
        mint: row.mint, symbol: row.symbol, name: row.name,
        score: row.score, curveProgress: row.curve_progress,
        prediction: row.prediction, reasoning: row.reasoning,
        lastUpdated: row.created_at,
        action: row.prediction === 'will_graduate' ? 'ready_to_buy' : 'monitoring',
      }))

    res.json({ decisions })
  } catch (e) {
    console.error('/api/agent-decisions error:', e)
    res.json({ decisions: [] })
  }
})

// ── /api/trending ───────────────────────────────────────────────────────────

app.get('/api/trending', async (req, res) => {
  try {
    const db = getDb()
    const result = await db.execute('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 100')

    const seen = new Set<string>()
    const tokens = result.rows
      .filter((row: any) => {
        if (seen.has(row.mint)) return false
        seen.add(row.mint)
        return (row.curve_progress || 0) < 99
      })
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, 6)
      .map((row: any) => ({
        mint: row.mint, symbol: row.symbol, name: row.name,
        score: row.score, curveProgress: row.curve_progress, prediction: row.prediction,
      }))

    res.json({ tokens })
  } catch (e) {
    console.error('/api/trending error:', e)
    res.json({ tokens: [] })
  }
})

// ── Health check ────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }))

app.listen(PORT, () => {
  console.log(`TrendSurfer VM API running on port ${PORT}`)
})
