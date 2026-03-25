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
import { evaluateTrade, checkExitConditions, recordTradeTimestamp, getRiskConfig, updateRiskConfig, type RiskConfig, type ExitDecision } from './risk'
import {
  initDb,
  getDb,
  savePrediction,
  savePosition,
  getOpenPositions,
  logAgent,
  getAgentLogs,
  getTotalPnl,
  getPredictions,
  getAllPositions,
  getLastPrediction,
  saveGraduationEvent,
  getGraduationEvents,
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

  // Initialize database (creates tables if needed)
  await initDb()

  // Determine mode
  paperMode = !hasWallet()
  const walletAddress = paperMode ? '(paper mode)' : getWalletAddress()

  running = true
  startTime = Date.now()

  await logAgent('info', 'TrendSurfer Agent started', {
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

  // Start scan loop (every 5 minutes — protect Helius 1M credits/month)
  console.log('\nStarting scan loop (5min interval)...')
  await runScanCycle()
  scanInterval = setInterval(runScanCycle, 5 * 60 * 1000)

  // Start position monitor loop (every 5 minutes)
  monitorInterval = setInterval(runMonitorCycle, 5 * 60 * 1000)

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

  // Heartbeat — keeps the dashboard "Agent Live" indicator green
  await logAgent('info', `Scan cycle — ${skill.getLaunches().length} tokens tracked`)

  try {
    // 1. Scan for new launches
    const result = await skill.scanLaunches(5)
    tokensScanned += result.launches.length

    if (result.launches.length > 0) {
      await logAgent('info', `Found ${result.launches.length} new launches`)
      console.log(`\n--- Scan at ${new Date().toLocaleTimeString()} ---`)
      console.log(`Found ${result.launches.length} new launches`)
    }

    // 2. Refresh existing launches to update curve progress
    const allLaunches = await skill.refreshLaunches()

    // Check for newly graduated tokens
    for (const launch of allLaunches) {
      if (launch.graduated) {
        const lastPred = await getLastPrediction(launch.mint)
        if (lastPred && lastPred.outcome !== 'graduated') {
          // This token just graduated! Record the event
          await saveGraduationEvent({
            id: randomUUID(),
            mint: launch.mint,
            symbol: launch.symbol,
            name: launch.name,
            predictedScore: lastPred.score,
            curveProgressAtPrediction: lastPred.curveProgress,
            graduatedAt: Date.now(),
            predictedAt: lastPred.createdAt,
            timeToGraduate: Date.now() - lastPred.createdAt,
            wasPredicted: lastPred.prediction === 'will_graduate',
          })

          // Update the prediction outcome
          const d = getDb()
          await d.execute({
            sql: "UPDATE predictions SET outcome = 'graduated', resolved_at = ? WHERE mint = ? AND outcome = 'pending'",
            args: [Date.now(), launch.mint],
          })

          await logAgent('info', `GRADUATION: ${launch.symbol} graduated! Predicted score was ${lastPred.score}/100`, {
            mint: launch.mint,
            predictedScore: lastPred.score,
            wasPredicted: lastPred.prediction === 'will_graduate',
          })

          console.log(`\n🎓 GRADUATION: ${launch.symbol} graduated! Score was ${lastPred.score}/100 — ${lastPred.prediction === 'will_graduate' ? 'CORRECTLY PREDICTED' : 'missed'}`)
        }
      }
    }

    // 3. Analyze tokens with meaningful progress
    // Only analyze tokens above 10% curve to save API credits
    const candidates = allLaunches.filter(
      (l) => !l.graduated && l.curveProgress >= 10
    )

    if (candidates.length > 0) {
      console.log(`Analyzing ${candidates.length} active tokens...`)
    }

    for (const launch of candidates) {
      // Skip re-analysis if curve hasn't changed significantly since last prediction
      const lastPred = await getLastPrediction(launch.mint)
      if (lastPred) {
        const curveChange = Math.abs(launch.curveProgress - (lastPred.curveProgress || 0))
        const timeSince = Date.now() - (lastPred.createdAt || 0)
        // Only re-analyze if curve moved >3% or it's been >5 minutes
        if (curveChange < 3 && timeSince < 5 * 60 * 1000) {
          continue
        }
      }
      await analyzeLaunch(launch)
    }
  } catch (error) {
    await logAgent('error', 'Scan cycle error', { error: String(error) })
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

    // 3. AI analysis — only for promising tokens (>60% curve) to save credits
    // Tokens below 60% get on-chain analysis only (free, still accurate)
    let score: number
    let reasoning: string
    let prediction: 'will_graduate' | 'unlikely' | 'watching'

    const useAI = process.env.COMMONSTACK_API_KEY && onChainAnalysis.curveProgress >= 60

    if (useAI) {
      // Brief pause to avoid rate limiting (CommonStack 429s)
      await new Promise(r => setTimeout(r, 2000))
      const claudeResult = await analyzeWithClaude(launch, onChainAnalysis, security)
      score = claudeResult.score
      reasoning = claudeResult.reasoning
      prediction = claudeResult.prediction
    } else {
      // On-chain score only (no AI cost)
      score = onChainAnalysis.score
      reasoning = onChainAnalysis.reasoning
      prediction = score >= 65 ? 'will_graduate' : score >= 35 ? 'watching' : 'unlikely'
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
    await savePrediction(pred)

    const emoji = prediction === 'will_graduate' ? '🟢' : prediction === 'watching' ? '🟡' : '🔴'
    console.log(
      `${emoji} ${launch.symbol} | Score: ${score}/100 | Curve: ${onChainAnalysis.curveProgress.toFixed(1)}% | ${onChainAnalysis.velocity} | ${prediction}`
    )
    console.log(`  ${reasoning}`)

    // 5. Trade decision
    if (prediction === 'will_graduate' && security.safe) {
      const decision = await evaluateTrade(onChainAnalysis, security.safe ? 80 : 20)

      if (decision.shouldTrade) {
        await logAgent('trade', `Buy signal for ${launch.symbol}`, {
          positionSize: decision.positionSize,
          score,
          reasoning,
        })

        if (!paperMode) {
          await executeBuy(launch, decision.positionSize, { score, reasoning })
        } else {
          // Paper trade — log the signal
          console.log(`  PAPER BUY: ${decision.positionSize} SOL of ${launch.symbol}`)
          await logAgent('info', `Paper buy signal: ${launch.symbol}`, {
            positionSize: decision.positionSize,
            score,
          })
        }
      } else {
        console.log(`  Skip: ${decision.reason}`)
      }
    }
  } catch (error) {
    await logAgent('error', `Analysis error for ${launch.symbol}`, {
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
      highestPrice: trade.price,
      partialExitDone: false,
      status: 'open',
      graduationScore: analysis.score,
      reasoning: analysis.reasoning,
    }
    await savePosition(position)
    recordTradeTimestamp()

    await logAgent('trade', `Bought ${launch.symbol}`, {
      positionSize: positionSizeSol,
      price: trade.price,
      txHash: trade.txHash,
    })
    console.log(`  BUY executed: ${trade.txHash}`)
  } catch (error) {
    await logAgent('error', `Trade execution failed for ${launch.symbol}`, {
      error: String(error),
    })
    console.error(`  Trade failed:`, error)
  }
}

// ── Monitor Positions ──

async function runMonitorCycle(): Promise<void> {
  if (!running) return

  const openPositions = await getOpenPositions()
  if (openPositions.length === 0) return

  for (const position of openPositions) {
    try {
      // 1. Get current price
      const tokenInfo = await getTokenInfo(position.mint)
      const data = Array.isArray(tokenInfo?.list) ? tokenInfo.list[0] : tokenInfo
      const currentPrice = parseFloat(data?.price || data?.usdPrice || '0')

      if (currentPrice <= 0) continue

      // 2. Update tracking prices
      position.currentPrice = currentPrice
      position.highestPrice = Math.max(currentPrice, position.highestPrice || position.entryPrice)

      const unrealizedPnl = currentPrice - position.entryPrice
      const unrealizedPnlPercent =
        ((currentPrice - position.entryPrice) / position.entryPrice) * 100
      position.unrealizedPnl = unrealizedPnl
      position.unrealizedPnlPercent = unrealizedPnlPercent

      // 3. Check if token has graduated (bonding curve filled)
      let graduated = false
      try {
        const launches = await skill.refreshLaunches()
        const thisToken = launches.find(l => l.mint === position.mint)
        graduated = thisToken?.graduated || false
      } catch {
        // Graduation check might fail — not critical
      }

      // 4. Evaluate exit conditions (trailing stop, graduation partial, etc.)
      const decision: ExitDecision = checkExitConditions(position, currentPrice, graduated)

      if (decision.shouldExit) {
        const isPartial = decision.sellPercent < 100

        if (isPartial) {
          // ── Partial Exit (e.g., 50% on graduation) ──
          console.log(`\nPARTIAL EXIT: ${position.symbol} | ${decision.reason}`)
          await logAgent('trade', `Partial exit for ${position.symbol}`, {
            exitType: decision.exitType,
            reason: decision.reason,
            sellPercent: decision.sellPercent,
            pnlPercent: unrealizedPnlPercent,
          })

          if (!paperMode) {
            try {
              const walletAddress = getWalletAddress()
              const sellAmount = (parseFloat(position.entryAmount) * decision.sellPercent / 100).toFixed(6)
              await skill.executeTrade({
                tokenMint: position.mint,
                side: 'sell',
                amountToken: sellAmount,
                walletAddress,
                gasless: true,
                signTransaction: signBitgetOrder,
              })
            } catch (error) {
              console.error(`  Partial sell failed:`, error)
            }
          } else {
            console.log(`  PAPER PARTIAL SELL: ${decision.sellPercent}% of ${position.symbol}`)
          }

          // Update position — reduce entry amount, mark partial exit done
          const remainingAmount = (parseFloat(position.entryAmount) * (100 - decision.sellPercent) / 100).toFixed(6)
          position.entryAmount = remainingAmount
          position.partialExitDone = true
          // Position stays OPEN — let the remaining ride with trailing stop

        } else {
          // ── Full Exit (stop loss, trailing stop, take profit) ──
          console.log(`\nEXIT: ${position.symbol} | ${decision.reason} | PnL: ${unrealizedPnlPercent.toFixed(1)}%`)
          await logAgent('trade', `Exit ${position.symbol}`, {
            exitType: decision.exitType,
            reason: decision.reason,
            pnlPercent: unrealizedPnlPercent,
          })

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
          } else {
            console.log(`  PAPER SELL: 100% of ${position.symbol} (${decision.exitType})`)
          }

          position.exitPrice = currentPrice
          position.exitTimestamp = Date.now()
          position.realizedPnl = unrealizedPnl
          position.realizedPnlPercent = unrealizedPnlPercent
          position.status = 'closed'
        }
      }

      await savePosition(position)
    } catch {
      // Price fetch might fail for new tokens
    }
  }
}

// ── Status ──

export async function getStatus(): Promise<AgentStatus> {
  const { totalPnl, winRate, totalTrades } = await getTotalPnl()
  const openPositions = await getOpenPositions()

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

export { getPredictions, getAllPositions, getAgentLogs, getTotalPnl, getOpenPositions, getGraduationEvents }
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
