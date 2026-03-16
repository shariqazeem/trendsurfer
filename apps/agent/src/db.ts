// ── SQLite Database ──
// Stores predictions, trades, and PnL history

import Database from 'better-sqlite3'
import path from 'path'
import type { Position, Prediction, AgentStatus } from '../../../lib/types'

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'trendsurfer.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    initTables()
  }
  return db
}

function initTables() {
  const d = getDb()

  d.exec(`
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
    d.exec(`ALTER TABLE positions ADD COLUMN highest_price REAL`)
  } catch { /* column already exists */ }
  try {
    d.exec(`ALTER TABLE positions ADD COLUMN partial_exit_done INTEGER DEFAULT 0`)
  } catch { /* column already exists */ }
}

// ── Predictions ──

export function savePrediction(prediction: Prediction): void {
  const d = getDb()
  d.prepare(`
    INSERT OR REPLACE INTO predictions (id, mint, symbol, name, score, curve_progress, velocity, reasoning, prediction, created_at, resolved_at, outcome, traded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    prediction.traded ? 1 : 0
  )
}

export function getPredictions(limit: number = 50): Prediction[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT * FROM predictions ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[]

  return rows.map(rowToPrediction)
}

export function getActivePredictions(): Prediction[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT * FROM predictions WHERE outcome = 'pending' ORDER BY score DESC
  `).all() as any[]

  return rows.map(rowToPrediction)
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

export function savePosition(position: Position): void {
  const d = getDb()
  d.prepare(`
    INSERT OR REPLACE INTO positions (id, mint, symbol, entry_price, entry_amount, entry_tx_hash, entry_timestamp, current_price, highest_price, partial_exit_done, exit_price, exit_amount, exit_tx_hash, exit_timestamp, realized_pnl, realized_pnl_percent, status, graduation_score, reasoning)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    position.reasoning
  )
}

export function getOpenPositions(): Position[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT * FROM positions WHERE status = 'open' ORDER BY entry_timestamp DESC
  `).all() as any[]

  return rows.map(rowToPosition)
}

export function getAllPositions(limit: number = 100): Position[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT * FROM positions ORDER BY entry_timestamp DESC LIMIT ?
  `).all(limit) as any[]

  return rows.map(rowToPosition)
}

export function getTotalPnl(): { totalPnl: number; winRate: number; totalTrades: number } {
  const d = getDb()
  const result = d.prepare(`
    SELECT
      COALESCE(SUM(realized_pnl), 0) as total_pnl,
      COUNT(*) as total_trades,
      COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as wins
    FROM positions WHERE status = 'closed'
  `).get() as any

  return {
    totalPnl: result.total_pnl,
    totalTrades: result.total_trades,
    winRate: result.total_trades > 0 ? (result.wins / result.total_trades) * 100 : 0,
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

export function logAgent(level: string, message: string, data?: any): void {
  const d = getDb()
  d.prepare(`
    INSERT INTO agent_log (timestamp, level, message, data) VALUES (?, ?, ?, ?)
  `).run(Date.now(), level, message, data ? JSON.stringify(data) : null)
}

export function getAgentLogs(limit: number = 100): any[] {
  const d = getDb()
  return d.prepare(`
    SELECT * FROM agent_log ORDER BY timestamp DESC LIMIT ?
  `).all(limit) as any[]
}
