// ── Turso/libSQL Database ──
// Works with both local SQLite files (dev) and remote Turso (production)
// Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN for remote, or falls back to local file

import { createClient, type Client } from '@libsql/client'
import path from 'path'
import type { Position, Prediction } from '../../../lib/types'

let client: Client | null = null

export function getDb(): Client {
  if (!client) {
    const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
    const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim()

    if (tursoUrl) {
      // Remote Turso database
      client = createClient({
        url: tursoUrl,
        authToken: tursoToken,
      })
    } else {
      // Local SQLite file for development
      const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'trendsurfer.db')
      client = createClient({
        url: `file:${dbPath}`,
      })
    }
  }
  return client
}

export async function initDb(): Promise<void> {
  const d = getDb()

  await d.executeMultiple(`
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      mint TEXT NOT NULL,
      symbol TEXT,
      name TEXT,
      score INTEGER NOT NULL,
      curve_progress REAL NOT NULL,
      velocity TEXT,
      reasoning TEXT,
      prediction TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      outcome TEXT DEFAULT 'pending',
      traded INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      mint TEXT NOT NULL,
      symbol TEXT,
      entry_price REAL NOT NULL,
      entry_amount TEXT NOT NULL,
      entry_tx_hash TEXT,
      entry_timestamp INTEGER NOT NULL,
      current_price REAL,
      highest_price REAL,
      partial_exit_done INTEGER DEFAULT 0,
      exit_price REAL,
      exit_amount TEXT,
      exit_tx_hash TEXT,
      exit_timestamp INTEGER,
      realized_pnl REAL,
      realized_pnl_percent REAL,
      status TEXT NOT NULL DEFAULT 'open',
      graduation_score INTEGER,
      reasoning TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_predictions_mint ON predictions(mint);
    CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
    CREATE INDEX IF NOT EXISTS idx_agent_log_timestamp ON agent_log(timestamp);
  `)

  // Migrate existing positions table — add new columns if missing
  try {
    await d.execute('ALTER TABLE positions ADD COLUMN highest_price REAL')
  } catch { /* column already exists */ }
  try {
    await d.execute('ALTER TABLE positions ADD COLUMN partial_exit_done INTEGER DEFAULT 0')
  } catch { /* column already exists */ }
}

// ── Predictions ──

export async function savePrediction(prediction: Prediction): Promise<void> {
  const d = getDb()
  await d.execute({
    sql: `INSERT OR REPLACE INTO predictions (id, mint, symbol, name, score, curve_progress, velocity, reasoning, prediction, created_at, resolved_at, outcome, traded)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      prediction.id,
      prediction.mint,
      prediction.symbol,
      prediction.name,
      prediction.score,
      prediction.curveProgress,
      prediction.velocity,
      prediction.reasoning,
      prediction.prediction,
      prediction.createdAt,
      prediction.resolvedAt || null,
      prediction.outcome || 'pending',
      prediction.traded ? 1 : 0,
    ],
  })
}

export async function getPredictions(limit: number = 50): Promise<Prediction[]> {
  const d = getDb()
  const result = await d.execute({
    sql: 'SELECT * FROM predictions ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  })
  return result.rows.map(rowToPrediction)
}

export async function getActivePredictions(): Promise<Prediction[]> {
  const d = getDb()
  const result = await d.execute(
    "SELECT * FROM predictions WHERE outcome = 'pending' ORDER BY score DESC"
  )
  return result.rows.map(rowToPrediction)
}

export async function getLastPrediction(mint: string): Promise<Prediction | null> {
  const d = getDb()
  const result = await d.execute({
    sql: 'SELECT * FROM predictions WHERE mint = ? ORDER BY created_at DESC LIMIT 1',
    args: [mint],
  })
  return result.rows.length > 0 ? rowToPrediction(result.rows[0]) : null
}

function rowToPrediction(row: any): Prediction {
  return {
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
    resolvedAt: row.resolved_at,
    outcome: row.outcome,
    traded: row.traded === 1,
  }
}

// ── Positions ──

export async function savePosition(position: Position): Promise<void> {
  const d = getDb()
  await d.execute({
    sql: `INSERT OR REPLACE INTO positions (id, mint, symbol, entry_price, entry_amount, entry_tx_hash, entry_timestamp, current_price, highest_price, partial_exit_done, exit_price, exit_amount, exit_tx_hash, exit_timestamp, realized_pnl, realized_pnl_percent, status, graduation_score, reasoning)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      position.id,
      position.mint,
      position.symbol,
      position.entryPrice,
      position.entryAmount,
      position.entryTxHash,
      position.entryTimestamp,
      position.currentPrice || null,
      position.highestPrice || null,
      position.partialExitDone ? 1 : 0,
      position.exitPrice || null,
      position.exitAmount || null,
      position.exitTxHash || null,
      position.exitTimestamp || null,
      position.realizedPnl || null,
      position.realizedPnlPercent || null,
      position.status,
      position.graduationScore,
      position.reasoning,
    ],
  })
}

export async function getOpenPositions(): Promise<Position[]> {
  const d = getDb()
  const result = await d.execute(
    "SELECT * FROM positions WHERE status = 'open' ORDER BY entry_timestamp DESC"
  )
  return result.rows.map(rowToPosition)
}

export async function getAllPositions(limit: number = 100): Promise<Position[]> {
  const d = getDb()
  const result = await d.execute({
    sql: 'SELECT * FROM positions ORDER BY entry_timestamp DESC LIMIT ?',
    args: [limit],
  })
  return result.rows.map(rowToPosition)
}

export async function getTotalPnl(): Promise<{ totalPnl: number; winRate: number; totalTrades: number }> {
  const d = getDb()
  const result = await d.execute(
    `SELECT
      COALESCE(SUM(realized_pnl), 0) as total_pnl,
      COUNT(*) as total_trades,
      COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
    FROM positions WHERE status = 'closed'`
  )
  const row = result.rows[0] as any

  return {
    totalPnl: row?.total_pnl || 0,
    totalTrades: row?.total_trades || 0,
    winRate: row?.total_trades > 0 ? (row.wins / row.total_trades) * 100 : 0,
  }
}

function rowToPosition(row: any): Position {
  return {
    id: row.id,
    mint: row.mint,
    symbol: row.symbol,
    entryPrice: row.entry_price,
    entryAmount: row.entry_amount,
    entryTxHash: row.entry_tx_hash,
    entryTimestamp: row.entry_timestamp,
    currentPrice: row.current_price,
    highestPrice: row.highest_price,
    partialExitDone: row.partial_exit_done === 1,
    exitPrice: row.exit_price,
    exitAmount: row.exit_amount,
    exitTxHash: row.exit_tx_hash,
    exitTimestamp: row.exit_timestamp,
    realizedPnl: row.realized_pnl,
    realizedPnlPercent: row.realized_pnl_percent,
    status: row.status,
    graduationScore: row.graduation_score,
    reasoning: row.reasoning,
  }
}

// ── Agent Log ──

export async function logAgent(level: string, message: string, data?: any): Promise<void> {
  const d = getDb()
  await d.execute({
    sql: 'INSERT INTO agent_log (timestamp, level, message, data) VALUES (?, ?, ?, ?)',
    args: [Date.now(), level, message, data ? JSON.stringify(data) : null],
  })
}

export async function getAgentLogs(limit: number = 100): Promise<any[]> {
  const d = getDb()
  const result = await d.execute({
    sql: 'SELECT * FROM agent_log ORDER BY timestamp DESC LIMIT ?',
    args: [limit],
  })
  return result.rows as any[]
}
