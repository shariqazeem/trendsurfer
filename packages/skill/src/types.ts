// ── Skill-specific types ──

// Re-export shared types
export type {
  BondingCurveState,
  GraduationAnalysis,
  SecurityCheck,
  SwapQuote,
  TradeExecution,
} from '../../../lib/types'

// Import TokenLaunch for use in this file
import type { TokenLaunch as _TokenLaunch } from '../../../lib/types'
export type TokenLaunch = _TokenLaunch

export interface SkillConfig {
  heliusApiKey?: string
  heliusRpcUrl?: string
  pollingIntervalMs?: number // default 10000 (10s)
  maxTokenAge?: number // max age in ms to consider a token "new" (default 24h)
  poolConfigAddress?: string // Meteora DBC PoolConfig address to filter by (e.g. trends.fun's config)
}

export interface ScanResult {
  launches: _TokenLaunch[]
  totalScanned: number
  timestamp: number
}

export interface VelocitySnapshot {
  mint: string
  curveProgress: number
  timestamp: number
}

export interface CreatorProfile {
  address: string
  walletAgeDays: number
  totalTokens: number
  totalValueUsd: number
  transactionCount: number
  riskScore: number          // 0-100 (0 = high risk, 100 = safe)
  riskLevel: 'low' | 'medium' | 'high'
  flags: string[]
  // Bitget creator intel
  devTokensCreated?: number  // total tokens this dev launched
  devRugCount?: number       // tokens flagged as rugs
}
