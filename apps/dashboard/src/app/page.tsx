'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───
interface Prediction {
  id: string
  mint: string
  symbol: string
  name: string
  score: number
  curveProgress: number
  velocity: string
  reasoning: string
  prediction: string
  createdAt: number
  outcome: string
  traded: boolean
}

interface Position {
  id: string
  mint: string
  symbol: string
  entryPrice: number
  entryAmount: string
  entryTimestamp: number
  exitPrice?: number
  exitTimestamp?: number
  realizedPnl?: number
  realizedPnlPercent?: number
  status: string
  graduationScore: number
  reasoning: string
}

interface AgentStatus {
  running: boolean
  tokensScanned: number
  tokensAnalyzed: number
  activePositions: number
  totalTrades: number
  totalPnl: number
  winRate: number
  logs: any[]
}

interface PnLData {
  totalPnl: number
  totalTrades: number
  winRate: number
}

// ─── Main Dashboard ───
export default function Dashboard() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [pnl, setPnl] = useState<PnLData>({ totalPnl: 0, totalTrades: 0, winRate: 0 })
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [selected, setSelected] = useState<Prediction | null>(null)
  const [view, setView] = useState<'scanner' | 'trades'>('scanner')

  const fetchAll = useCallback(async () => {
    try {
      const [predsRes, tradesRes, agentRes] = await Promise.all([
        fetch('/api/predictions'),
        fetch('/api/trades'),
        fetch('/api/agent'),
      ])
      const predsData = await predsRes.json()
      const tradesData = await tradesRes.json()
      const agentData = await agentRes.json()
      setPredictions(predsData.predictions || [])
      setPositions(tradesData.positions || [])
      setPnl(tradesData.pnl || { totalPnl: 0, totalTrades: 0, winRate: 0 })
      setStatus(agentData)
    } catch { /* API not ready */ }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Deduplicate predictions by mint — latest first
  const seen = new Set<string>()
  const uniqueTokens = predictions.filter((p) => {
    if (seen.has(p.mint)) return false
    seen.add(p.mint)
    return true
  })

  // Separate by category
  const hot = uniqueTokens.filter((p) => p.score >= 75 && p.outcome === 'pending')
  const graduating = uniqueTokens.filter((p) => p.curveProgress >= 90 && p.outcome !== 'graduated')
  const graduated = uniqueTokens.filter((p) => p.outcome === 'graduated')

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-gray-900">
      {/* ─── Top Bar ─── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-[11px]">TS</span>
              </div>
              <span className="font-bold text-gray-900">TrendSurfer</span>
            </div>

            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setView('scanner')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  view === 'scanner' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Scanner
              </button>
              <button
                onClick={() => setView('trades')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  view === 'trades' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Trades
              </button>
            </div>
          </div>

          {/* Key metrics */}
          <div className="flex items-center gap-5">
            <Metric label="PnL" value={`${pnl.totalPnl >= 0 ? '+' : ''}${pnl.totalPnl.toFixed(4)}`} unit="SOL" color={pnl.totalPnl >= 0 ? 'text-emerald-600' : 'text-red-500'} />
            <Metric label="Win Rate" value={`${pnl.winRate.toFixed(0)}`} unit="%" />
            <Metric label="Trades" value={`${pnl.totalTrades}`} />
            <Metric label="Scanned" value={`${status?.tokensScanned ?? 0}`} />

            <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200">
              <div className={`w-2 h-2 rounded-full ${status?.running ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-500">{status?.running ? 'Live' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {view === 'scanner' ? (
            <motion.div
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-4"
              style={{ minHeight: 'calc(100vh - 80px)' }}
            >
              {/* ─── Left: Token List ─── */}
              <div className="flex-1 min-w-0">
                {/* Hot tokens banner */}
                {hot.length > 0 && (
                  <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-700">
                      {hot.length} token{hot.length > 1 ? 's' : ''} with high graduation probability
                    </span>
                  </div>
                )}

                {/* Token cards grid */}
                <div className="space-y-2">
                  {uniqueTokens.map((token, i) => (
                    <TokenRow
                      key={token.id}
                      token={token}
                      isSelected={selected?.mint === token.mint}
                      onClick={() => setSelected(selected?.mint === token.mint ? null : token)}
                      position={positions.find((p) => p.mint === token.mint)}
                      index={i}
                    />
                  ))}
                </div>
              </div>

              {/* ─── Right: Detail Panel ─── */}
              <div className="w-[380px] flex-shrink-0 hidden lg:block">
                <div className="sticky top-[72px]">
                  {selected ? (
                    <DetailPanel
                      token={selected}
                      position={positions.find((p) => p.mint === selected.mint)}
                    />
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <span className="text-lg text-gray-400">{'<'}-</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">Select a token</p>
                      <p className="text-xs text-gray-500 mt-1">Click any token to see AI analysis and bonding curve details</p>

                      {/* Summary stats */}
                      <div className="mt-6 grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Graduated</p>
                          <p className="text-lg font-bold text-emerald-600">{graduated.length}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Graduating</p>
                          <p className="text-lg font-bold text-blue-600">{graduating.length}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Hot</p>
                          <p className="text-lg font-bold text-amber-600">{hot.length}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="trades"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TradesView positions={positions} pnl={pnl} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Token Row ───
function TokenRow({
  token,
  isSelected,
  onClick,
  position,
  index,
}: {
  token: Prediction
  isSelected: boolean
  onClick: () => void
  position?: Position
  index: number
}) {
  const scoreColor = token.score >= 75 ? 'text-emerald-600 bg-emerald-50' : token.score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-gray-500 bg-gray-100'
  const isGraduating = token.curveProgress >= 90 && token.outcome !== 'graduated'
  const isGraduated = token.outcome === 'graduated'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className={`bg-white rounded-xl border cursor-pointer transition-all ${
        isSelected ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="px-4 py-3 flex items-center gap-4">
        {/* Score */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${scoreColor}`}>
          {token.score}
        </div>

        {/* Token info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">{token.name}</span>
            <span className="text-xs text-gray-400">${token.symbol}</span>
            {isGraduating && (
              <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded animate-pulse">
                GRADUATING
              </span>
            )}
            {isGraduated && (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded">
                GRADUATED
              </span>
            )}
            {position && (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded">
                {position.status === 'open' ? 'HOLDING' : position.realizedPnlPercent != null ? `${position.realizedPnlPercent >= 0 ? '+' : ''}${position.realizedPnlPercent.toFixed(0)}%` : 'TRADED'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <VelocityTag velocity={token.velocity} />
            <PredictionTag prediction={token.prediction} />
            <span className="text-[10px] text-gray-400">{timeAgo(token.createdAt)}</span>
          </div>
        </div>

        {/* Bonding curve mini bar */}
        <div className="w-32 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400">Curve</span>
            <span className="text-xs font-bold text-gray-700">{token.curveProgress.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                token.curveProgress >= 90 ? 'bg-emerald-500' : token.curveProgress >= 60 ? 'bg-blue-500' : token.curveProgress >= 30 ? 'bg-amber-400' : 'bg-gray-300'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(token.curveProgress, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Detail Panel ───
function DetailPanel({ token, position }: { token: Prediction; position?: Position }) {
  const scoreColor = token.score >= 75 ? '#10b981' : token.score >= 50 ? '#f59e0b' : '#94a3b8'
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDash = (token.score / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{token.name}</h3>
            <p className="text-sm text-gray-500">${token.symbol}</p>
          </div>

          {/* Score ring */}
          <div className="relative">
            <svg width="82" height="82" viewBox="0 0 82 82">
              <circle cx="41" cy="41" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="4" />
              <motion.circle
                cx="41" cy="41" r={radius} fill="none"
                stroke={scoreColor} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${circumference}`}
                transform="rotate(-90 41 41)"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${strokeDash} ${circumference}` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold" style={{ color: scoreColor }}>{token.score}</span>
              <span className="text-[8px] text-gray-400 uppercase">Score</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 mt-3">
          <PredictionTag prediction={token.prediction} />
          <VelocityTag velocity={token.velocity} />
          {token.outcome !== 'pending' && (
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
              token.outcome === 'graduated' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {token.outcome === 'graduated' ? 'Graduated' : 'Did not graduate'}
            </span>
          )}
        </div>
      </div>

      {/* Bonding Curve Visual */}
      <div className="p-5 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Bonding Curve Progress</p>
        <CurveViz progress={token.curveProgress} />
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>0%</span>
          <span className="font-bold text-gray-900">{token.curveProgress.toFixed(1)}% filled</span>
          <span>Graduate</span>
        </div>
      </div>

      {/* AI Reasoning */}
      <div className="p-5 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">AI Analysis</p>
        <p className="text-sm text-gray-700 leading-relaxed">{token.reasoning}</p>
      </div>

      {/* Position info */}
      {position && (
        <div className="p-5 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Position</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-400">Status</p>
              <p className={`text-sm font-bold ${position.status === 'open' ? 'text-blue-600' : 'text-gray-700'}`}>
                {position.status.charAt(0).toUpperCase() + position.status.slice(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Size</p>
              <p className="text-sm font-bold text-gray-700">{position.entryAmount} SOL</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Entry</p>
              <p className="text-sm font-mono text-gray-700">{position.entryPrice.toFixed(8)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">PnL</p>
              {position.realizedPnlPercent != null ? (
                <p className={`text-sm font-bold ${position.realizedPnlPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {position.realizedPnlPercent >= 0 ? '+' : ''}{position.realizedPnlPercent.toFixed(1)}%
                </p>
              ) : (
                <p className="text-sm text-gray-400">--</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mint */}
      <div className="px-5 py-3 bg-gray-50">
        <p className="text-[10px] text-gray-400 font-mono truncate">{token.mint}</p>
      </div>
    </motion.div>
  )
}

// ─── Bonding Curve Visualization ───
function CurveViz({ progress }: { progress: number }) {
  const w = 320
  const h = 80
  const pad = 8

  // Build curve points
  const points: [number, number][] = []
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = pad + t * (w - pad * 2)
    const y = h - pad - Math.sqrt(t) * (h - pad * 2)
    points.push([x, y])
  }

  const fillIdx = Math.round((progress / 100) * steps)
  const filledPoints = points.slice(0, fillIdx + 1)
  const color = progress >= 90 ? '#10b981' : progress >= 60 ? '#3b82f6' : progress >= 30 ? '#f59e0b' : '#94a3b8'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Full curve (gray) */}
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="1.5"
      />

      {/* Filled area */}
      {filledPoints.length > 1 && (
        <polygon
          points={`${pad},${h - pad} ${filledPoints.map((p) => p.join(',')).join(' ')} ${filledPoints[filledPoints.length - 1][0]},${h - pad}`}
          fill="url(#curveFill)"
        />
      )}

      {/* Filled curve */}
      {filledPoints.length > 1 && (
        <polyline
          points={filledPoints.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {/* Graduation threshold */}
      <line
        x1={pad + 0.85 * (w - pad * 2)}
        y1={pad}
        x2={pad + 0.85 * (w - pad * 2)}
        y2={h - pad}
        stroke="#10b981"
        strokeWidth="1"
        strokeDasharray="3,3"
        opacity="0.4"
      />

      {/* Current position dot */}
      {filledPoints.length > 0 && progress < 100 && (
        <circle
          cx={filledPoints[filledPoints.length - 1][0]}
          cy={filledPoints[filledPoints.length - 1][1]}
          r="3"
          fill={color}
        />
      )}
    </svg>
  )
}

// ─── Trades View ───
function TradesView({ positions, pnl }: { positions: Position[]; pnl: PnLData }) {
  const closedPositions = positions.filter((p) => p.status === 'closed').sort((a, b) => a.entryTimestamp - b.entryTimestamp)
  const openPositions = positions.filter((p) => p.status === 'open')
  const wins = closedPositions.filter((p) => (p.realizedPnlPercent ?? 0) > 0)
  const losses = closedPositions.filter((p) => (p.realizedPnlPercent ?? 0) <= 0)

  // Cumulative PnL for sparkline
  let cumPnl = 0
  const pnlPoints = closedPositions.map((p) => {
    cumPnl += p.realizedPnl || 0
    return cumPnl
  })

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">How it works:</span> The agent buys tokens before their bonding curve graduates. When a token graduates to a full DEX pool, the price jumps — the agent sells for profit. Losses happen when tokens stall and hit stop-loss.
        </p>
      </div>

      {/* Performance cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total PnL" value={`${pnl.totalPnl >= 0 ? '+' : ''}${pnl.totalPnl.toFixed(4)} SOL`} color={pnl.totalPnl >= 0 ? 'text-emerald-600' : 'text-red-500'} />
        <StatCard label="Win Rate" value={`${pnl.winRate.toFixed(0)}%`} subtitle={`${wins.length}W / ${losses.length}L`} />
        <StatCard label="Best Trade" value={closedPositions.length > 0 ? `+${Math.max(...closedPositions.map(p => p.realizedPnlPercent || 0)).toFixed(1)}%` : '--'} color="text-emerald-600" subtitle={wins.length > 0 ? `$${wins.sort((a,b) => (b.realizedPnlPercent||0) - (a.realizedPnlPercent||0))[0].symbol}` : undefined} />
        <StatCard label="Open Positions" value={`${openPositions.length}`} color="text-blue-600" subtitle="Waiting for graduation" />
      </div>

      {/* PnL chart */}
      {pnlPoints.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cumulative PnL Over Time</p>
            <p className={`text-sm font-bold ${cumPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {cumPnl >= 0 ? '+' : ''}{cumPnl.toFixed(4)} SOL
            </p>
          </div>
          <PnLSparkline data={pnlPoints} />
        </div>
      )}

      {/* Open positions */}
      {openPositions.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-2">Open Positions — Waiting for Graduation</p>
          <div className="space-y-2">
            {openPositions.map((pos) => (
              <div key={pos.id} className="bg-white rounded-xl border border-blue-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-xs">{pos.graduationScore}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">${pos.symbol}</span>
                      <p className="text-xs text-gray-500">Bought {pos.entryAmount} SOL — score {pos.graduationScore}/100</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded">HOLDING</span>
                </div>
                {pos.reasoning && (
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed border-t border-gray-100 pt-2">{pos.reasoning}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closed trade cards */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Completed Trades</p>
        <div className="space-y-2">
          {closedPositions.sort((a, b) => (b.exitTimestamp || 0) - (a.exitTimestamp || 0)).map((pos) => {
            const isWin = (pos.realizedPnlPercent ?? 0) > 0
            return (
              <div key={pos.id} className={`bg-white rounded-xl border px-4 py-3 ${isWin ? 'border-emerald-200' : 'border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isWin ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <span className={`font-bold text-xs ${isWin ? 'text-emerald-600' : 'text-red-500'}`}>
                        {pos.realizedPnlPercent != null ? `${pos.realizedPnlPercent >= 0 ? '+' : ''}${pos.realizedPnlPercent.toFixed(0)}%` : '--'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">${pos.symbol}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${isWin ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {isWin ? 'Graduated — sold for profit' : 'Stop-loss hit'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Bought {pos.entryAmount} SOL @ {pos.entryPrice.toFixed(8)}
                        {pos.exitPrice ? ` — Sold @ ${pos.exitPrice.toFixed(8)}` : ''}
                        {pos.realizedPnl != null ? ` — ${isWin ? '+' : ''}${pos.realizedPnl.toFixed(4)} SOL` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{pos.exitTimestamp ? timeAgo(pos.exitTimestamp) : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── PnL Sparkline ───
function PnLSparkline({ data }: { data: number[] }) {
  const w = 600
  const h = 100
  const pad = 4

  const min = Math.min(0, ...data)
  const max = Math.max(0, ...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y] as [number, number]
  })

  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2)
  const isPositive = data[data.length - 1] >= 0
  const color = isPositive ? '#10b981' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Zero line */}
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />

      {/* Area */}
      <polygon
        points={`${points[0][0]},${zeroY} ${points.map((p) => p.join(',')).join(' ')} ${points[points.length - 1][0]},${zeroY}`}
        fill="url(#sparkFill)"
      />

      {/* Line */}
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={color} />
    </svg>
  )
}

// ─── Small Components ───
function Metric({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="hidden sm:block">
      <p className="text-[10px] text-gray-400 uppercase">{label}</p>
      <p className={`text-sm font-bold ${color || 'text-gray-900'}`}>
        {value}{unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function StatCard({ label, value, color, subtitle }: { label: string; value: string; color?: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function VelocityTag({ velocity }: { velocity: string }) {
  const config: Record<string, { color: string; icon: string }> = {
    accelerating: { color: 'text-emerald-600', icon: '^' },
    steady: { color: 'text-blue-500', icon: '>' },
    declining: { color: 'text-amber-500', icon: 'v' },
    stagnant: { color: 'text-gray-400', icon: '-' },
  }
  const c = config[velocity] || config.stagnant
  return <span className={`text-[10px] font-medium ${c.color}`}>{c.icon} {velocity}</span>
}

function PredictionTag({ prediction }: { prediction: string }) {
  const config: Record<string, string> = {
    will_graduate: 'bg-emerald-50 text-emerald-700',
    watching: 'bg-amber-50 text-amber-700',
    unlikely: 'bg-red-50 text-red-600',
  }
  const labels: Record<string, string> = {
    will_graduate: 'Will Graduate',
    watching: 'Watching',
    unlikely: 'Unlikely',
  }
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${config[prediction] || 'bg-gray-100 text-gray-500'}`}>
      {labels[prediction] || prediction}
    </span>
  )
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
