// ── Risk Manager ──
// Controls position sizing, exposure limits, and stop-loss logic

import { getOpenPositions, getTotalPnl } from './db'
import type { Position, GraduationAnalysis } from '../../../lib/types'

export interface RiskConfig {
  maxPositionSizeSol: number // Max SOL per trade (default: 0.25)
  maxTotalExposureSol: number // Max total open positions in SOL (default: 1.0)
  maxOpenPositions: number // Max concurrent positions (default: 5)
  minGraduationScore: number // Min score to enter (default: 70)
  stopLossPercent: number // Fixed stop loss from entry % (default: -30)
  trailingStopPercent: number // Trailing stop from peak % (default: -15)
  takeProfitPercent: number // Take profit % (default: 100)
  graduationPartialExitPercent: number // % of position to sell on graduation (default: 50)
  minSecurityScore: number // Min security score (default: 60)
  cooldownMs: number // Min time between trades (default: 60000)
}

const DEFAULT_CONFIG: RiskConfig = {
  maxPositionSizeSol: 0.25,
  maxTotalExposureSol: 1.0,
  maxOpenPositions: 5,
  minGraduationScore: 70,
  stopLossPercent: -30,
  trailingStopPercent: -15,
  takeProfitPercent: 100,
  graduationPartialExitPercent: 50,
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

export async function evaluateTrade(
  analysis: GraduationAnalysis,
  securityScore: number
): Promise<TradeDecision> {
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
  const openPositions = await getOpenPositions()
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

  // Dynamic position sizing based on AI score tiers
  // Score 95+  → max position (0.25 SOL) — extremely high conviction
  // Score 85-94 → medium position (0.10 SOL) — high conviction
  // Score 75-84 → small position (0.05 SOL) — moderate conviction
  // Score 70-74 → minimum position (0.03 SOL) — threshold conviction
  let baseSize: number
  if (analysis.score >= 95) {
    baseSize = config.maxPositionSizeSol // 0.25 SOL
  } else if (analysis.score >= 85) {
    baseSize = 0.10
  } else if (analysis.score >= 75) {
    baseSize = 0.05
  } else {
    baseSize = 0.03
  }

  // Velocity bonus: accelerating tokens get 50% more
  if (analysis.velocity === 'accelerating') {
    baseSize *= 1.5
  }

  // Cap to remaining exposure headroom
  const positionSize = Math.min(baseSize, config.maxTotalExposureSol - totalExposure)

  return {
    shouldTrade: true,
    reason: `Score ${analysis.score}/100 → ${positionSize.toFixed(3)} SOL, velocity ${analysis.velocity}, security ${securityScore}/100`,
    positionSize: Math.round(positionSize * 1000) / 1000,
  }
}

export interface ExitDecision {
  shouldExit: boolean
  exitType: 'none' | 'stop_loss' | 'trailing_stop' | 'take_profit' | 'graduation_partial'
  reason: string
  sellPercent: number // 100 = full exit, 50 = partial
}

// Check if any open positions need to be closed
export function checkExitConditions(
  position: Position,
  currentPrice: number,
  graduated?: boolean
): ExitDecision {
  if (!position.entryPrice || currentPrice <= 0) {
    return { shouldExit: false, exitType: 'none', reason: 'No price data', sellPercent: 0 }
  }

  const pnlPercent =
    ((currentPrice - position.entryPrice) / position.entryPrice) * 100

  // 1. Fixed stop loss from entry (always active, full exit)
  if (pnlPercent <= config.stopLossPercent) {
    return {
      shouldExit: true,
      exitType: 'stop_loss',
      reason: `Stop loss: ${pnlPercent.toFixed(1)}% (threshold: ${config.stopLossPercent}%)`,
      sellPercent: 100,
    }
  }

  // 2. Trailing stop from peak (only when in profit)
  const highestPrice = position.highestPrice || position.entryPrice
  if (currentPrice < highestPrice && highestPrice > position.entryPrice) {
    const drawdownFromPeak = ((currentPrice - highestPrice) / highestPrice) * 100
    if (drawdownFromPeak <= config.trailingStopPercent) {
      const peakPnl = ((highestPrice - position.entryPrice) / position.entryPrice) * 100
      return {
        shouldExit: true,
        exitType: 'trailing_stop',
        reason: `Trailing stop: ${drawdownFromPeak.toFixed(1)}% from peak (peak was +${peakPnl.toFixed(1)}%, now ${pnlPercent.toFixed(1)}%)`,
        sellPercent: 100,
      }
    }
  }

  // 3. Take profit (full exit at extreme profit)
  if (pnlPercent >= config.takeProfitPercent) {
    return {
      shouldExit: true,
      exitType: 'take_profit',
      reason: `Take profit: ${pnlPercent.toFixed(1)}% (threshold: ${config.takeProfitPercent}%)`,
      sellPercent: 100,
    }
  }

  // 4. Graduation partial exit (sell 50% when token graduates)
  if (graduated && !position.partialExitDone) {
    return {
      shouldExit: true,
      exitType: 'graduation_partial',
      reason: `Graduation detected! Selling ${config.graduationPartialExitPercent}% — let the rest ride`,
      sellPercent: config.graduationPartialExitPercent,
    }
  }

  return { shouldExit: false, exitType: 'none', reason: `PnL: ${pnlPercent.toFixed(1)}%, peak: ${((highestPrice - position.entryPrice) / position.entryPrice * 100).toFixed(1)}%`, sellPercent: 0 }
}

export function recordTradeTimestamp(): void {
  lastTradeTimestamp = Date.now()
}
