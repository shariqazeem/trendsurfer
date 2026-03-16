// ── Risk Manager ──
// Controls position sizing, exposure limits, and stop-loss logic

import { getOpenPositions, getTotalPnl } from './db'
import type { Position, GraduationAnalysis } from '../../../lib/types'

export interface RiskConfig {
  maxPositionSizeSol: number // Max SOL per trade (default: 0.1)
  maxTotalExposureSol: number // Max total open positions in SOL (default: 1.0)
  maxOpenPositions: number // Max concurrent positions (default: 5)
  minGraduationScore: number // Min score to enter (default: 70)
  stopLossPercent: number // Stop loss % (default: -30)
  takeProfitPercent: number // Take profit % (default: 50)
  minSecurityScore: number // Min security score (default: 60)
  cooldownMs: number // Min time between trades (default: 60000)
}

const DEFAULT_CONFIG: RiskConfig = {
  maxPositionSizeSol: 0.1,
  maxTotalExposureSol: 1.0,
  maxOpenPositions: 5,
  minGraduationScore: 70,
  stopLossPercent: -30,
  takeProfitPercent: 50,
  minSecurityScore: 60,
  cooldownMs: 60000,
}

let config: RiskConfig = { ...DEFAULT_CONFIG }
let lastTradeTimestamp = 0

export function getRiskConfig(): RiskConfig {
  return { ...config }
}

export function updateRiskConfig(updates: Partial<RiskConfig>): void {
  config = { ...config, ...updates }
}

export interface TradeDecision {
  shouldTrade: boolean
  reason: string
  positionSize: number // in SOL
}

export function evaluateTrade(
  analysis: GraduationAnalysis,
  securityScore: number
): TradeDecision {
  // Check cooldown
  if (Date.now() - lastTradeTimestamp < config.cooldownMs) {
    return {
      shouldTrade: false,
      reason: `Cooldown active — last trade ${Math.round((Date.now() - lastTradeTimestamp) / 1000)}s ago`,
      positionSize: 0,
    }
  }

  // Check graduation score
  if (analysis.score < config.minGraduationScore) {
    return {
      shouldTrade: false,
      reason: `Score ${analysis.score} below threshold ${config.minGraduationScore}`,
      positionSize: 0,
    }
  }

  // Check security
  if (securityScore < config.minSecurityScore) {
    return {
      shouldTrade: false,
      reason: `Security score ${securityScore} below threshold ${config.minSecurityScore}`,
      positionSize: 0,
    }
  }

  // Check velocity — don't buy stagnant tokens
  if (analysis.velocity === 'stagnant') {
    return {
      shouldTrade: false,
      reason: 'Curve fill is stagnant — no buying momentum',
      positionSize: 0,
    }
  }

  // Check open positions
  const openPositions = getOpenPositions()
  if (openPositions.length >= config.maxOpenPositions) {
    return {
      shouldTrade: false,
      reason: `Max open positions reached (${openPositions.length}/${config.maxOpenPositions})`,
      positionSize: 0,
    }
  }

  // Check total exposure
  const totalExposure = openPositions.reduce(
    (sum, p) => sum + parseFloat(p.entryAmount),
    0
  )
  if (totalExposure >= config.maxTotalExposureSol) {
    return {
      shouldTrade: false,
      reason: `Max exposure reached (${totalExposure.toFixed(3)}/${config.maxTotalExposureSol} SOL)`,
      positionSize: 0,
    }
  }

  // Check if already holding this token
  const alreadyHolding = openPositions.find(
    (p) => p.mint === analysis.mint
  )
  if (alreadyHolding) {
    return {
      shouldTrade: false,
      reason: `Already holding position in ${analysis.mint}`,
      positionSize: 0,
    }
  }

  // Calculate position size based on score (higher score = larger position)
  const scoreMultiplier = analysis.score / 100
  const positionSize = Math.min(
    config.maxPositionSizeSol * scoreMultiplier,
    config.maxTotalExposureSol - totalExposure
  )

  return {
    shouldTrade: true,
    reason: `Score ${analysis.score}/100, velocity ${analysis.velocity}, security ${securityScore}/100`,
    positionSize: Math.round(positionSize * 1000) / 1000, // Round to 3 decimals
  }
}

// Check if any open positions need to be closed
export function checkExitConditions(
  position: Position,
  currentPrice: number
): { shouldExit: boolean; reason: string } {
  if (!position.entryPrice || currentPrice <= 0) {
    return { shouldExit: false, reason: 'No price data' }
  }

  const pnlPercent =
    ((currentPrice - position.entryPrice) / position.entryPrice) * 100

  // Stop loss
  if (pnlPercent <= config.stopLossPercent) {
    return {
      shouldExit: true,
      reason: `Stop loss triggered: ${pnlPercent.toFixed(1)}% (threshold: ${config.stopLossPercent}%)`,
    }
  }

  // Take profit
  if (pnlPercent >= config.takeProfitPercent) {
    return {
      shouldExit: true,
      reason: `Take profit triggered: ${pnlPercent.toFixed(1)}% (threshold: ${config.takeProfitPercent}%)`,
    }
  }

  return { shouldExit: false, reason: `PnL: ${pnlPercent.toFixed(1)}%` }
}

export function recordTradeTimestamp(): void {
  lastTradeTimestamp = Date.now()
}
