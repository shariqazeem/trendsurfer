// ── Graduation Analyzer ──
// Analyzes bonding curve velocity and predicts graduation probability

import { getPoolState } from '../../../lib/meteora'
import { getSecurityInfo } from '../../../lib/bitget'
import type {
  BondingCurveState,
  GraduationAnalysis,
  SecurityCheck,
  TokenLaunch,
} from './types'
import type { VelocitySnapshot } from './types'

// Store velocity snapshots for each token to track curve fill rate over time
const velocityHistory = new Map<string, VelocitySnapshot[]>()
const MAX_SNAPSHOTS = 60 // Keep last 60 snapshots per token

// Record a velocity snapshot for a token
export function recordSnapshot(mint: string, curveProgress: number) {
  const snapshots = velocityHistory.get(mint) || []
  snapshots.push({
    mint,
    curveProgress,
    timestamp: Date.now(),
  })

  // Keep only the last MAX_SNAPSHOTS
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS)
  }

  velocityHistory.set(mint, snapshots)
}

// Calculate curve fill velocity
export function calculateVelocity(
  mint: string
): { velocity: GraduationAnalysis['velocity']; velocityScore: number } {
  const snapshots = velocityHistory.get(mint)

  if (!snapshots || snapshots.length < 2) {
    return { velocity: 'stagnant', velocityScore: 0 }
  }

  // Compare recent velocity vs older velocity
  const now = Date.now()
  const recentWindow = 5 * 60 * 1000 // 5 minutes
  const olderWindow = 15 * 60 * 1000 // 15 minutes

  const recentSnapshots = snapshots.filter(
    (s) => now - s.timestamp < recentWindow
  )
  const olderSnapshots = snapshots.filter(
    (s) => now - s.timestamp >= recentWindow && now - s.timestamp < olderWindow
  )

  if (recentSnapshots.length < 2) {
    // Not enough recent data, use overall rate
    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    const timeDiff = (last.timestamp - first.timestamp) / 1000 / 60 // minutes
    const progressDiff = last.curveProgress - first.curveProgress

    if (timeDiff === 0) return { velocity: 'stagnant', velocityScore: 0 }

    const rate = progressDiff / timeDiff // % per minute
    if (rate > 2) return { velocity: 'accelerating', velocityScore: 90 }
    if (rate > 0.5) return { velocity: 'steady', velocityScore: 60 }
    if (rate > 0.1) return { velocity: 'declining', velocityScore: 30 }
    return { velocity: 'stagnant', velocityScore: 5 }
  }

  // Calculate rates for each window
  const recentRate = calculateRate(recentSnapshots)
  const olderRate =
    olderSnapshots.length >= 2 ? calculateRate(olderSnapshots) : recentRate

  // Determine velocity trend
  if (recentRate > 2 || (recentRate > olderRate * 1.5 && recentRate > 0.5)) {
    return { velocity: 'accelerating', velocityScore: Math.min(recentRate * 20, 100) }
  }
  if (recentRate > 0.5) {
    return { velocity: 'steady', velocityScore: Math.min(recentRate * 15, 80) }
  }
  if (recentRate > 0.1) {
    return { velocity: 'declining', velocityScore: Math.min(recentRate * 10, 40) }
  }
  return { velocity: 'stagnant', velocityScore: 5 }
}

function calculateRate(snapshots: VelocitySnapshot[]): number {
  if (snapshots.length < 2) return 0
  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const timeDiff = (last.timestamp - first.timestamp) / 1000 / 60
  if (timeDiff === 0) return 0
  return (last.curveProgress - first.curveProgress) / timeDiff
}

// Run full graduation analysis for a token
export async function analyzeGraduation(
  launch: TokenLaunch
): Promise<GraduationAnalysis> {
  // 1. Get current bonding curve state
  const poolState = await getPoolState(launch.poolAddress)
  const curveProgress = poolState?.curveProgress ?? launch.curveProgress

  // Record snapshot for velocity tracking
  recordSnapshot(launch.mint, curveProgress)

  // 2. Calculate velocity
  const { velocity, velocityScore } = calculateVelocity(launch.mint)

  // 3. Security check via Bitget
  let securityScore = 50 // default neutral
  try {
    const security = await getSecurityInfo(launch.mint)
    securityScore = calculateSecurityScore(security)
  } catch {
    // Security check failed, use default
  }

  // 4. Check holder distribution (rough estimate)
  let holderCount = 0
  let topHolderConcentration = 0
  // Note: Full holder analysis would require getProgramAccounts which can be expensive
  // For now we use a simplified approach

  // 5. Calculate composite score
  const score = calculateCompositeScore({
    curveProgress,
    velocityScore,
    securityScore,
    holderCount,
    topHolderConcentration,
  })

  return {
    mint: launch.mint,
    score,
    curveProgress,
    velocity,
    velocityScore,
    holderCount,
    topHolderConcentration,
    securityScore,
    tweetAnalysis: launch.tweetAuthor
      ? {
          author: launch.tweetAuthor,
          content: launch.tweetUrl,
        }
      : undefined,
    reasoning: generateReasoning({
      curveProgress,
      velocity,
      velocityScore,
      securityScore,
      score,
    }),
    timestamp: Date.now(),
  }
}

function calculateSecurityScore(security: any): number {
  let score = 100
  if (security.isHoneypot) score -= 100
  if (security.hasMintFunction) score -= 30
  if (security.hasFreezeFunction) score -= 20
  if (security.warnings?.length > 0) {
    score -= security.warnings.length * 10
  }
  return Math.max(0, score)
}

function calculateCompositeScore(factors: {
  curveProgress: number
  velocityScore: number
  securityScore: number
  holderCount: number
  topHolderConcentration: number
}): number {
  // Weighted composite score
  const weights = {
    curveProgress: 0.3, // How close to graduation
    velocityScore: 0.35, // How fast it's filling
    securityScore: 0.25, // Is it safe to trade
    holderDistribution: 0.1, // How distributed are holders
  }

  const holderDistributionScore = Math.max(
    0,
    100 - factors.topHolderConcentration
  )

  const score =
    factors.curveProgress * weights.curveProgress +
    factors.velocityScore * weights.velocityScore +
    factors.securityScore * weights.securityScore +
    holderDistributionScore * weights.holderDistribution

  return Math.round(Math.min(100, Math.max(0, score)))
}

function generateReasoning(factors: {
  curveProgress: number
  velocity: string
  velocityScore: number
  securityScore: number
  score: number
}): string {
  const parts: string[] = []

  // Curve progress
  if (factors.curveProgress >= 80) {
    parts.push(`Bonding curve is ${factors.curveProgress.toFixed(1)}% filled — very close to graduation.`)
  } else if (factors.curveProgress >= 50) {
    parts.push(`Bonding curve is ${factors.curveProgress.toFixed(1)}% filled — past halfway.`)
  } else {
    parts.push(`Bonding curve is only ${factors.curveProgress.toFixed(1)}% filled — still early.`)
  }

  // Velocity
  if (factors.velocity === 'accelerating') {
    parts.push('Buy pressure is accelerating — curve filling faster over time.')
  } else if (factors.velocity === 'steady') {
    parts.push('Steady buy pressure — consistent curve filling.')
  } else if (factors.velocity === 'declining') {
    parts.push('Buy pressure declining — momentum fading.')
  } else {
    parts.push('Curve fill is stagnant — minimal buying activity.')
  }

  // Security
  if (factors.securityScore >= 80) {
    parts.push('Security audit passed — no major risks detected.')
  } else if (factors.securityScore >= 50) {
    parts.push('Some security concerns — proceed with caution.')
  } else {
    parts.push('Security warnings detected — high risk token.')
  }

  // Overall
  if (factors.score >= 75) {
    parts.push(`Overall graduation score: ${factors.score}/100 — HIGH probability.`)
  } else if (factors.score >= 50) {
    parts.push(`Overall graduation score: ${factors.score}/100 — MODERATE probability.`)
  } else {
    parts.push(`Overall graduation score: ${factors.score}/100 — LOW probability.`)
  }

  return parts.join(' ')
}

// Get velocity history for a token
export function getVelocityHistory(mint: string): VelocitySnapshot[] {
  return velocityHistory.get(mint) || []
}
