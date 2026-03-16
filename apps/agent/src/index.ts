// ── TrendSurfer Agent ──
// Autonomous trading agent that uses the TrendSurfer Skill
// Scans → Analyzes → Decides → Trades → Monitors
// Runs in paper mode when no wallet is configured

import dotenv from 'dotenv'
import path from 'path'

// Load env vars from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
import { TrendSurferSkill } from '../../../packages/skill/src'
import { analyzeWithClaude } from './claude'
import { evaluateTrade, checkExitConditions, recordTradeTimestamp, getRiskConfig, updateRiskConfig, type RiskConfig } from './risk'
import {
  savePrediction,
  savePosition,
  getOpenPositions,
  logAgent,
  getAgentLogs,
  getTotalPnl,
  getPredictions,
  getAllPositions,
} from './db'
import { getTokenInfo } from '../../../lib/bitget'
import { hasWallet, getWalletAddress, signBitgetOrder } from '../../../lib/signer'
import type { TokenLaunch, Prediction, Position, AgentStatus } from '../../../lib/types'
import { randomUUID } from 'crypto'

// ── Agent State ──

let running = false
let startTime = 0
let tokensScanned = 0
let tokensAnalyzed = 0
let scanInterval: ReturnType<typeof setInterval> | null = null
let monitorInterval: ReturnType<typeof setInterval> | null = null
let paperMode = true

const skill = new TrendSurferSkill({
  heliusApiKey: process.env.HELIUS_API_KEY,
  heliusRpcUrl: process.env.HELIUS_RPC_URL,
})

// ── Main Loop ──

export async function startAgent(riskConfig?: Partial<RiskConfig>): Promise<void> {
  if (running) {
    console.log('Agent is already running')
    return
  }

  if (riskConfig) {
    updateRiskConfig(riskConfig)
  }

  // Determine mode
  paperMode = !hasWallet()
  const walletAddress = paperMode ? '(paper mode)' : getWalletAddress()

  running = true
  startTime = Date.now()

  logAgent('info', 'TrendSurfer Agent started', {
    mode: paperMode ? 'paper' : 'live',
    wallet: walletAddress,
    config: getRiskConfig(),
  })

  console.log(`Mode: ${paperMode ? 'PAPER (no wallet)' : 'LIVE TRADING'}`)
  if (!paperMode) console.log(`Wallet: ${walletAddress}`)
  console.log('Config:', JSON.stringify(getRiskConfig(), null, 2))

  // Check if Claude API is available
  const hasClaudeKey = !!process.env.COMMONSTACK_API_KEY
  if (!hasClaudeKey) {
    console.log('\nNote: No COMMONSTACK_API_KEY — using on-chain analysis only (no AI)')
    console.log('Set COMMONSTACK_API_KEY in .env.local to enable AI-powered analysis')
  }

  // Start scan loop (every 30 seconds — be gentle on RPC)
  console.log('\nStarting scan loop...')
  await runScanCycle()
  scanInterval = setInterval(runScanCycle, 30000)

  // Start position monitor loop (every 60 seconds)
  monitorInterval = setInterval(runMonitorCycle, 60000)

  console.log('Agent loops started. Press Ctrl+C to stop.\n')
}

export function stopAgent(): void {
  running = false
  if (scanInterval) clearInterval(scanInterval)
  if (monitorInterval) clearInterval(monitorInterval)
  skill.destroy()
  logAgent('info', 'TrendSurfer Agent stopped')
  console.log('Agent stopped.')
}

// ── Scan Cycle ──

async function runScanCycle(): Promise<void> {
  if (!running) return

  try {
    // 1. Scan for new launches
    const result = await skill.scanLaunches(10)
    tokensScanned += result.launches.length

    if (result.launches.length > 0) {
      logAgent('info', `Found ${result.launches.length} new launches`)
      console.log(`\n--- Scan at ${new Date().toLocaleTimeString()} ---`)
      console.log(`Found ${result.launches.length} new launches`)
    }

    // 2. Refresh existing launches to update curve progress
    const allLaunches = await skill.refreshLaunches()

    // 3. Analyze tokens with meaningful progress
    const candidates = allLaunches.filter(
      (l) => !l.graduated && l.curveProgress >= 5
    )

    if (candidates.length > 0) {
      console.log(`Analyzing ${candidates.length} active tokens...`)
    }

    for (const launch of candidates) {
      await analyzeLaunch(launch)
    }
  } catch (error) {
    logAgent('error', 'Scan cycle error', { error: String(error) })
    console.error('Scan cycle error:', error)
  }
}

// ── Analyze a Launch ──

async function analyzeLaunch(launch: TokenLaunch): Promise<void> {
  try {
    tokensAnalyzed++

    // 1. On-chain analysis (bonding curve, velocity)
    const onChainAnalysis = await skill.analyzeGraduation(launch)

    // 2. Security check
    const security = await skill.checkSecurity(launch.mint)

    // 3. AI analysis — use Claude if available, otherwise on-chain only
    let score: number
    let reasoning: string
    let prediction: 'will_graduate' | 'unlikely' | 'watching'

    if (process.env.COMMONSTACK_API_KEY) {
      const claudeResult = await analyzeWithClaude(launch, onChainAnalysis, security)
      score = claudeResult.score
      reasoning = claudeResult.reasoning
      prediction = claudeResult.prediction
    } else {
      // Fallback: on-chain score only
      score = onChainAnalysis.score
      reasoning = onChainAnalysis.reasoning
      prediction = score >= 75 ? 'will_graduate' : score >= 40 ? 'watching' : 'unlikely'
    }

    // 4. Save prediction
    const pred: Prediction = {
      id: randomUUID(),
      mint: launch.mint,
      symbol: launch.symbol,
      name: launch.name,
      score,
      curveProgress: onChainAnalysis.curveProgress,
      velocity: onChainAnalysis.velocity,
      reasoning,
      prediction,
      createdAt: Date.now(),
      outcome: 'pending',
      traded: false,
    }
    savePrediction(pred)

    const emoji = prediction === 'will_graduate' ? '🟢' : prediction === 'watching' ? '🟡' : '🔴'
    console.log(
      `${emoji} ${launch.symbol} | Score: ${score}/100 | Curve: ${onChainAnalysis.curveProgress.toFixed(1)}% | ${onChainAnalysis.velocity} | ${prediction}`
    )
    console.log(`  ${reasoning}`)

    // 5. Trade decision
    if (prediction === 'will_graduate' && security.safe) {
      const decision = evaluateTrade(onChainAnalysis, security.safe ? 80 : 20)

      if (decision.shouldTrade) {
        logAgent('trade', `Buy signal for ${launch.symbol}`, {
          positionSize: decision.positionSize,
          score,
          reasoning,
        })

        if (!paperMode) {
          await executeBuy(launch, decision.positionSize, { score, reasoning })
        } else {
          // Paper trade — log the signal
          console.log(`  PAPER BUY: ${decision.positionSize} SOL of ${launch.symbol}`)
          logAgent('info', `Paper buy signal: ${launch.symbol}`, {
            positionSize: decision.positionSize,
            score,
          })
        }
      } else {
        console.log(`  Skip: ${decision.reason}`)
      }
    }
  } catch (error) {
    logAgent('error', `Analysis error for ${launch.symbol}`, {
      error: String(error),
    })
    console.error(`Analysis error for ${launch.symbol}:`, error)
  }
}

// ── Execute Buy ──

async function executeBuy(
  launch: TokenLaunch,
  positionSizeSol: number,
  analysis: { score: number; reasoning: string }
): Promise<void> {
  try {
    const walletAddress = getWalletAddress()
    const trade = await skill.executeTrade({
      tokenMint: launch.mint,
      side: 'buy',
      amountSol: positionSizeSol.toString(),
      walletAddress,
      gasless: true,
      signTransaction: signBitgetOrder,
    })

    const position: Position = {
      id: trade.id,
      mint: launch.mint,
      symbol: launch.symbol,
      entryPrice: trade.price,
      entryAmount: positionSizeSol.toString(),
      entryTxHash: trade.txHash,
      entryTimestamp: Date.now(),
      status: 'open',
      graduationScore: analysis.score,
      reasoning: analysis.reasoning,
    }
    savePosition(position)
    recordTradeTimestamp()

    logAgent('trade', `Bought ${launch.symbol}`, {
      positionSize: positionSizeSol,
      price: trade.price,
      txHash: trade.txHash,
    })
    console.log(`  BUY executed: ${trade.txHash}`)
  } catch (error) {
    logAgent('error', `Trade execution failed for ${launch.symbol}`, {
      error: String(error),
    })
    console.error(`  Trade failed:`, error)
  }
}

// ── Monitor Positions ──

async function runMonitorCycle(): Promise<void> {
  if (!running) return

  const openPositions = getOpenPositions()
  if (openPositions.length === 0) return

  for (const position of openPositions) {
    try {
      const tokenInfo = await getTokenInfo(position.mint)
      const data = Array.isArray(tokenInfo?.list) ? tokenInfo.list[0] : tokenInfo
      const currentPrice = parseFloat(data?.price || data?.usdPrice || '0')

      if (currentPrice <= 0) continue

      position.currentPrice = currentPrice
      const unrealizedPnl = currentPrice - position.entryPrice
      const unrealizedPnlPercent =
        ((currentPrice - position.entryPrice) / position.entryPrice) * 100

      position.unrealizedPnl = unrealizedPnl
      position.unrealizedPnlPercent = unrealizedPnlPercent

      const { shouldExit, reason } = checkExitConditions(position, currentPrice)

      if (shouldExit) {
        console.log(`\nEXIT: ${position.symbol} | ${reason} | PnL: ${unrealizedPnlPercent.toFixed(1)}%`)
        logAgent('trade', `Exit signal for ${position.symbol}`, { reason, pnlPercent: unrealizedPnlPercent })

        if (!paperMode) {
          try {
            const walletAddress = getWalletAddress()
            await skill.executeTrade({
              tokenMint: position.mint,
              side: 'sell',
              amountToken: position.entryAmount,
              walletAddress,
              gasless: true,
              signTransaction: signBitgetOrder,
            })
          } catch (error) {
            console.error(`  Sell failed:`, error)
          }
        }

        position.exitPrice = currentPrice
        position.exitTimestamp = Date.now()
        position.realizedPnl = unrealizedPnl
        position.realizedPnlPercent = unrealizedPnlPercent
        position.status = 'closed'
      }

      savePosition(position)
    } catch {
      // Price fetch might fail for new tokens
    }
  }
}

// ── Status ──

export function getStatus(): AgentStatus {
  const { totalPnl, winRate, totalTrades } = getTotalPnl()
  const openPositions = getOpenPositions()

  return {
    running,
    uptime: running ? Date.now() - startTime : 0,
    tokensScanned,
    tokensAnalyzed,
    activePositions: openPositions.length,
    totalTrades,
    totalPnl,
    winRate,
    lastScan: Date.now(),
  }
}

// ── API for Dashboard ──

export { getPredictions, getAllPositions, getAgentLogs, getTotalPnl, getOpenPositions }
export { getRiskConfig, updateRiskConfig } from './risk'

// ── CLI Entry Point ──

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║       TrendSurfer Agent v0.1.0        ║
  ║  The intelligence skill for trends.fun ║
  ╚═══════════════════════════════════════╝
  `)

  startAgent().catch((err) => {
    console.error('Failed to start agent:', err)
    process.exit(1)
  })

  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    stopAgent()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    stopAgent()
    process.exit(0)
  })
}
