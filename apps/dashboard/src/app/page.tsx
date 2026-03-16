'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

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
  lastScan: number
  logs: LogEntry[]
}

interface LogEntry {
  id: number
  timestamp: number
  level: string
  message: string
  data: string | null
}

interface PnLData {
  totalPnl: number
  totalTrades: number
  winRate: number
}

type View = 'scanner' | 'trades' | 'log'
type Filter = 'all' | 'hot' | 'graduating' | 'graduated'

// ────────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────────

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
const MONO_STACK = "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace"
const FADE_IN = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }

// ────────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ────────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [pnl, setPnl] = useState<PnLData>({ totalPnl: 0, totalTrades: 0, winRate: 0 })
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [selected, setSelected] = useState<Prediction | null>(null)
  const [view, setView] = useState<View>('scanner')
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

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
    } catch {
      /* API not ready */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Deduplicate predictions by mint — latest first
  const uniqueTokens = useMemo(() => {
    const seen = new Set<string>()
    return predictions.filter((p) => {
      if (seen.has(p.mint)) return false
      seen.add(p.mint)
      return true
    })
  }, [predictions])

  // Category counts
  const hotTokens = useMemo(() => uniqueTokens.filter((p) => p.score >= 75 && p.outcome === 'pending'), [uniqueTokens])
  const graduatingTokens = useMemo(() => uniqueTokens.filter((p) => p.curveProgress >= 90 && p.outcome !== 'graduated'), [uniqueTokens])
  const graduatedTokens = useMemo(() => uniqueTokens.filter((p) => p.outcome === 'graduated'), [uniqueTokens])

  // Filtered list
  const filteredTokens = useMemo(() => {
    switch (filter) {
      case 'hot': return hotTokens
      case 'graduating': return graduatingTokens
      case 'graduated': return graduatedTokens
      default: return uniqueTokens
    }
  }, [filter, uniqueTokens, hotTokens, graduatingTokens, graduatedTokens])

  const filterCounts: Record<Filter, number> = {
    all: uniqueTokens.length,
    hot: hotTokens.length,
    graduating: graduatingTokens.length,
    graduated: graduatedTokens.length,
  }

  return (
    <div style={{ fontFamily: FONT_STACK }} className="min-h-screen bg-gray-50 text-gray-900">
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Sticky Navigation Bar                                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Logo + View Toggle */}
          <div className="flex items-center gap-6">
            <span className="text-[15px] font-semibold text-gray-900 tracking-tight">TrendSurfer</span>

            <nav className="flex bg-gray-100 rounded-lg p-0.5">
              {(['scanner', 'trades', 'log'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v === 'scanner' ? 'Scanner' : v === 'trades' ? 'Trades' : 'Log'}
                </button>
              ))}
            </nav>
          </div>

          {/* Right: Metrics + Status */}
          <div className="flex items-center gap-5">
            <NavMetric
              label="PnL"
              value={`${pnl.totalPnl >= 0 ? '+' : ''}${pnl.totalPnl.toFixed(4)}`}
              unit="SOL"
              color={pnl.totalPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <NavMetric label="Win Rate" value={`${pnl.winRate.toFixed(0)}`} unit="%" />
            <NavMetric label="Trades" value={`${pnl.totalTrades}`} />

            <Link
              href="/developers"
              className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              Developers
            </Link>

            <div className="flex items-center gap-1.5 pl-4 border-l border-gray-200">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  status?.running ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-xs text-gray-400">
                {status?.running ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Main Content Area                                                       */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <LoadingState />
        ) : (
          <AnimatePresence mode="wait">
            {view === 'scanner' && (
              <motion.div key="scanner" {...FADE_IN}>
                <ScannerView
                  tokens={filteredTokens}
                  positions={positions}
                  selected={selected}
                  setSelected={setSelected}
                  filter={filter}
                  setFilter={setFilter}
                  filterCounts={filterCounts}
                  graduated={graduatedTokens}
                  graduating={graduatingTokens}
                  hot={hotTokens}
                />
              </motion.div>
            )}
            {view === 'trades' && (
              <motion.div key="trades" {...FADE_IN}>
                <TradesView positions={positions} pnl={pnl} />
              </motion.div>
            )}
            {view === 'log' && (
              <motion.div key="log" {...FADE_IN}>
                <LogView logs={status?.logs || []} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Scanner View
// ────────────────────────────────────────────────────────────────────────────────

function ScannerView({
  tokens,
  positions,
  selected,
  setSelected,
  filter,
  setFilter,
  filterCounts,
  graduated,
  graduating,
  hot,
}: {
  tokens: Prediction[]
  positions: Position[]
  selected: Prediction | null
  setSelected: (t: Prediction | null) => void
  filter: Filter
  setFilter: (f: Filter) => void
  filterCounts: Record<Filter, number>
  graduated: Prediction[]
  graduating: Prediction[]
  hot: Prediction[]
}) {
  return (
    <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 96px)' }}>
      {/* Left: Token List */}
      <div className="flex-1 min-w-0">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-4">
          {(['all', 'hot', 'graduating', 'graduated'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {f === 'all' ? 'All' : f === 'hot' ? 'Hot' : f === 'graduating' ? 'Graduating' : 'Graduated'}
              <span
                className={`text-[10px] ${
                  filter === f ? 'text-gray-400' : 'text-gray-400'
                }`}
                style={{ fontFamily: MONO_STACK }}
              >
                {filterCounts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* Token Rows */}
        {tokens.length === 0 ? (
          <EmptyState
            message={filter === 'all' ? 'No tokens detected yet' : `No ${filter} tokens`}
            sub="The agent will populate this feed as it scans trends.fun launches."
          />
        ) : (
          <div className="space-y-1">
            {tokens.map((token, i) => (
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
        )}
      </div>

      {/* Right: Detail Panel (desktop) */}
      <div className="w-[380px] flex-shrink-0 hidden lg:block">
        <div className="sticky top-[72px]">
          {selected ? (
            <DetailPanel
              token={selected}
              position={positions.find((p) => p.mint === selected.mint)}
            />
          ) : (
            <EmptyDetailPanel
              graduated={graduated.length}
              graduating={graduating.length}
              hot={hot.length}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Token Row
// ────────────────────────────────────────────────────────────────────────────────

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
  const isGraduating = token.curveProgress >= 90 && token.outcome !== 'graduated'
  const isGraduated = token.outcome === 'graduated'

  const scoreColor =
    token.score >= 75
      ? 'text-emerald-600'
      : token.score >= 50
        ? 'text-amber-600'
        : 'text-gray-400'

  const curveColor =
    token.curveProgress >= 90
      ? 'bg-emerald-500'
      : token.curveProgress >= 60
        ? 'bg-blue-600'
        : token.curveProgress >= 30
          ? 'bg-amber-400'
          : 'bg-gray-300'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02, duration: 0.15 }}
      onClick={onClick}
      className={`bg-white rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-600 shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="px-4 py-3 flex items-center gap-4">
        {/* Score Circle */}
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${scoreColor}`}
          style={{
            fontFamily: MONO_STACK,
            fontSize: '13px',
            fontWeight: 700,
            border: '2px solid currentColor',
            opacity: 0.9,
          }}
        >
          {token.score}
        </div>

        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{token.name}</span>
            <span className="text-xs text-gray-400" style={{ fontFamily: MONO_STACK }}>
              ${token.symbol}
            </span>
            {isGraduating && <StatusDot color="bg-emerald-500" label="Graduating" pulse />}
            {isGraduated && <StatusDot color="bg-emerald-400" label="Graduated" />}
            {position && (
              <StatusDot
                color={position.status === 'open' ? 'bg-blue-600' : 'bg-gray-400'}
                label={
                  position.status === 'open'
                    ? 'Holding'
                    : position.realizedPnlPercent != null
                      ? `${position.realizedPnlPercent >= 0 ? '+' : ''}${position.realizedPnlPercent.toFixed(0)}%`
                      : 'Traded'
                }
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <VelocityLabel velocity={token.velocity} />
            <PredictionLabel prediction={token.prediction} />
            <span className="text-[11px] text-gray-400">{timeAgo(token.createdAt)}</span>
          </div>
        </div>

        {/* Bonding Curve Mini Bar */}
        <div className="w-28 flex-shrink-0 hidden sm:block">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">Curve</span>
            <span className="text-xs font-medium text-gray-700" style={{ fontFamily: MONO_STACK }}>
              {token.curveProgress.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${curveColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(token.curveProgress, 100)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Detail Panel
// ────────────────────────────────────────────────────────────────────────────────

function DetailPanel({ token, position }: { token: Prediction; position?: Position }) {
  const scoreColor = token.score >= 75 ? '#059669' : token.score >= 50 ? '#d97706' : '#9ca3af'
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const strokeDash = (token.score / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{token.name}</h3>
            <p className="text-sm text-gray-500" style={{ fontFamily: MONO_STACK }}>${token.symbol}</p>
          </div>

          {/* Score Ring */}
          <div className="relative flex-shrink-0 ml-4">
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle cx="38" cy="38" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <motion.circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${circumference}`}
                transform="rotate(-90 38 38)"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${strokeDash} ${circumference}` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-lg font-bold"
                style={{ color: scoreColor, fontFamily: MONO_STACK }}
              >
                {token.score}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-gray-400">Score</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 mt-3">
          <PredictionLabel prediction={token.prediction} />
          <VelocityLabel velocity={token.velocity} />
          {token.outcome !== 'pending' && (
            <span
              className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                token.outcome === 'graduated'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {token.outcome === 'graduated' ? 'Graduated' : 'Did not graduate'}
            </span>
          )}
        </div>
      </div>

      {/* Bonding Curve Visual */}
      <div className="p-5 border-b border-gray-200">
        <SectionLabel>Bonding Curve</SectionLabel>
        <CurveViz progress={token.curveProgress} />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-400">0%</span>
          <span className="text-xs font-medium text-gray-900" style={{ fontFamily: MONO_STACK }}>
            {token.curveProgress.toFixed(1)}% filled
          </span>
          <span className="text-[11px] text-gray-400">Graduate</span>
        </div>
      </div>

      {/* AI Reasoning */}
      <div className="p-5 border-b border-gray-200">
        <SectionLabel>AI Analysis</SectionLabel>
        <p className="text-sm text-gray-600 leading-relaxed">{token.reasoning}</p>
      </div>

      {/* Position Info */}
      {position && (
        <div className="p-5 border-b border-gray-200">
          <SectionLabel>Position</SectionLabel>
          <div className="grid grid-cols-2 gap-4 mt-1">
            <DetailField
              label="Status"
              value={position.status.charAt(0).toUpperCase() + position.status.slice(1)}
              color={position.status === 'open' ? 'text-blue-600' : undefined}
            />
            <DetailField label="Size" value={`${position.entryAmount} SOL`} />
            <DetailField label="Entry" value={position.entryPrice.toFixed(8)} mono />
            <DetailField
              label="PnL"
              value={
                position.realizedPnlPercent != null
                  ? `${position.realizedPnlPercent >= 0 ? '+' : ''}${position.realizedPnlPercent.toFixed(1)}%`
                  : '--'
              }
              color={
                position.realizedPnlPercent != null
                  ? position.realizedPnlPercent >= 0
                    ? 'text-emerald-600'
                    : 'text-red-500'
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Mint Address */}
      <div className="px-5 py-3 bg-gray-50">
        <p
          className="text-[11px] text-gray-400 truncate"
          style={{ fontFamily: MONO_STACK }}
        >
          {token.mint}
        </p>
      </div>
    </motion.div>
  )
}

function EmptyDetailPanel({
  graduated,
  graduating,
  hot,
}: {
  graduated: number
  graduating: number
  hot: number
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-gray-400">
          <path
            d="M2 9h4l2-5 4 10 2-5h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">Select a token</p>
      <p className="text-xs text-gray-500 mt-1">
        Click any row to view AI analysis and bonding curve details
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <MiniStat label="Graduated" value={graduated} color="text-emerald-600" />
        <MiniStat label="Graduating" value={graduating} color="text-blue-600" />
        <MiniStat label="Hot" value={hot} color="text-amber-600" />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Bonding Curve SVG Visualization
// ────────────────────────────────────────────────────────────────────────────────

function CurveViz({ progress }: { progress: number }) {
  const w = 320
  const h = 72
  const pad = 8

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
  const color =
    progress >= 90 ? '#059669' : progress >= 60 ? '#2563eb' : progress >= 30 ? '#d97706' : '#9ca3af'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="curveFillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Full curve (gray outline) */}
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="1.5"
      />

      {/* Filled area under curve */}
      {filledPoints.length > 1 && (
        <polygon
          points={`${pad},${h - pad} ${filledPoints.map((p) => p.join(',')).join(' ')} ${filledPoints[filledPoints.length - 1][0]},${h - pad}`}
          fill="url(#curveFillGrad)"
        />
      )}

      {/* Filled curve line */}
      {filledPoints.length > 1 && (
        <polyline
          points={filledPoints.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {/* Graduation threshold line */}
      <line
        x1={pad + 0.85 * (w - pad * 2)}
        y1={pad}
        x2={pad + 0.85 * (w - pad * 2)}
        y2={h - pad}
        stroke="#059669"
        strokeWidth="1"
        strokeDasharray="3,3"
        opacity="0.3"
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

// ────────────────────────────────────────────────────────────────────────────────
// Trades View
// ────────────────────────────────────────────────────────────────────────────────

function TradesView({ positions, pnl }: { positions: Position[]; pnl: PnLData }) {
  const closedPositions = useMemo(
    () => positions.filter((p) => p.status === 'closed').sort((a, b) => a.entryTimestamp - b.entryTimestamp),
    [positions]
  )
  const openPositions = useMemo(() => positions.filter((p) => p.status === 'open'), [positions])
  const wins = closedPositions.filter((p) => (p.realizedPnlPercent ?? 0) > 0)
  const losses = closedPositions.filter((p) => (p.realizedPnlPercent ?? 0) <= 0)

  // Cumulative PnL for sparkline
  let cumPnl = 0
  const pnlPoints = closedPositions.map((p) => {
    cumPnl += p.realizedPnl || 0
    return cumPnl
  })

  const bestTrade =
    closedPositions.length > 0
      ? Math.max(...closedPositions.map((p) => p.realizedPnlPercent || 0))
      : 0
  const bestTradeSymbol =
    wins.length > 0
      ? wins.sort((a, b) => (b.realizedPnlPercent || 0) - (a.realizedPnlPercent || 0))[0]?.symbol
      : undefined

  return (
    <div className="space-y-5 max-w-[960px]">
      {/* Strategy Explainer */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Strategy:</span>{' '}
          Buy tokens before bonding curve graduation. Sell after DEX migration for the price jump.
          Stop-loss triggers if the curve stalls.
        </p>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total PnL"
          value={`${pnl.totalPnl >= 0 ? '+' : ''}${pnl.totalPnl.toFixed(4)} SOL`}
          color={pnl.totalPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}
        />
        <MetricCard
          label="Win Rate"
          value={`${pnl.winRate.toFixed(0)}%`}
          sub={`${wins.length}W / ${losses.length}L`}
        />
        <MetricCard
          label="Best Trade"
          value={closedPositions.length > 0 ? `+${bestTrade.toFixed(1)}%` : '--'}
          color="text-emerald-600"
          sub={bestTradeSymbol ? `$${bestTradeSymbol}` : undefined}
        />
        <MetricCard
          label="Open Positions"
          value={`${openPositions.length}`}
          color="text-blue-600"
          sub="Awaiting graduation"
        />
      </div>

      {/* Cumulative PnL Chart */}
      {pnlPoints.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Cumulative PnL</SectionLabel>
            <span
              className={`text-sm font-semibold ${cumPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
              style={{ fontFamily: MONO_STACK }}
            >
              {cumPnl >= 0 ? '+' : ''}
              {cumPnl.toFixed(4)} SOL
            </span>
          </div>
          <PnLSparkline data={pnlPoints} />
        </div>
      )}

      {/* Open Positions */}
      {openPositions.length > 0 && (
        <div>
          <SectionLabel className="mb-3">Open Positions</SectionLabel>
          <div className="space-y-1">
            {openPositions.map((pos) => (
              <div key={pos.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center"
                      style={{ fontFamily: MONO_STACK }}
                    >
                      <span className="text-blue-600 font-bold text-xs">{pos.graduationScore}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">${pos.symbol}</span>
                        <StatusDot color="bg-blue-600" label="Holding" />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pos.entryAmount} SOL at score {pos.graduationScore}/100
                      </p>
                    </div>
                  </div>
                </div>
                {pos.reasoning && (
                  <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 leading-relaxed">
                    {pos.reasoning}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Trades */}
      <div>
        <SectionLabel className="mb-3">Completed Trades</SectionLabel>
        {closedPositions.length === 0 ? (
          <EmptyState message="No completed trades yet" sub="Trades will appear here once positions are closed." />
        ) : (
          <div className="space-y-1">
            {closedPositions
              .sort((a, b) => (b.exitTimestamp || 0) - (a.exitTimestamp || 0))
              .map((pos) => {
                const isWin = (pos.realizedPnlPercent ?? 0) > 0
                return (
                  <div
                    key={pos.id}
                    className="bg-white rounded-lg border border-gray-200 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isWin ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                          }`}
                          style={{ fontFamily: MONO_STACK, fontSize: '11px', fontWeight: 700 }}
                        >
                          {pos.realizedPnlPercent != null
                            ? `${pos.realizedPnlPercent >= 0 ? '+' : ''}${pos.realizedPnlPercent.toFixed(0)}%`
                            : '--'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">${pos.symbol}</span>
                            <span
                              className={`text-[10px] font-medium ${
                                isWin ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {isWin ? 'Graduated' : 'Stop-loss'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: MONO_STACK }}>
                            {pos.entryAmount} SOL @ {pos.entryPrice.toFixed(8)}
                            {pos.exitPrice ? ` \u2192 ${pos.exitPrice.toFixed(8)}` : ''}
                            {pos.realizedPnl != null
                              ? ` = ${isWin ? '+' : ''}${pos.realizedPnl.toFixed(4)} SOL`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {pos.exitTimestamp ? timeAgo(pos.exitTimestamp) : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// PnL Sparkline
// ────────────────────────────────────────────────────────────────────────────────

function PnLSparkline({ data }: { data: number[] }) {
  const w = 600
  const h = 96
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
  const color = isPositive ? '#059669' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '96px' }}>
      <defs>
        <linearGradient id="sparkFillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Zero line */}
      <line
        x1={pad}
        y1={zeroY}
        x2={w - pad}
        y2={zeroY}
        stroke="#e5e7eb"
        strokeWidth="1"
        strokeDasharray="4,4"
      />

      {/* Area fill */}
      <polygon
        points={`${points[0][0]},${zeroY} ${points.map((p) => p.join(',')).join(' ')} ${points[points.length - 1][0]},${zeroY}`}
        fill="url(#sparkFillGrad)"
      />

      {/* Line */}
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={color} />
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Log View
// ────────────────────────────────────────────────────────────────────────────────

function LogView({ logs }: { logs: LogEntry[] }) {
  const levelColors: Record<string, { dot: string; text: string }> = {
    INFO: { dot: 'bg-blue-600', text: 'text-blue-600' },
    TRADE: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
    WARN: { dot: 'bg-amber-500', text: 'text-amber-600' },
    ERROR: { dot: 'bg-red-500', text: 'text-red-500' },
    SCAN: { dot: 'bg-gray-400', text: 'text-gray-500' },
    ANALYZE: { dot: 'bg-violet-500', text: 'text-violet-600' },
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        message="No agent activity yet"
        sub="Log entries will appear here when the agent starts scanning."
      />
    )
  }

  return (
    <div className="max-w-[960px] space-y-1">
      {logs.map((entry, i) => {
        const level = (entry.level || 'INFO').toUpperCase()
        const colors = levelColors[level] || levelColors.INFO
        let parsedData: any = null
        if (entry.data) {
          try {
            parsedData = JSON.parse(entry.data)
          } catch {
            parsedData = entry.data
          }
        }

        return (
          <motion.div
            key={entry.id || i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.01, duration: 0.15 }}
            className="bg-white rounded-lg border border-gray-200 px-4 py-3"
          >
            <div className="flex items-start gap-3">
              {/* Level Dot */}
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${colors.dot}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>
                    {level}
                  </span>
                  <span className="text-[11px] text-gray-400" style={{ fontFamily: MONO_STACK }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{entry.message}</p>
                {parsedData && typeof parsedData === 'object' && (
                  <pre
                    className="text-[11px] text-gray-500 mt-1.5 bg-gray-50 rounded px-2 py-1.5 overflow-x-auto"
                    style={{ fontFamily: MONO_STACK }}
                  >
                    {JSON.stringify(parsedData, null, 2)}
                  </pre>
                )}
                {parsedData && typeof parsedData === 'string' && (
                  <p className="text-xs text-gray-500 mt-1">{parsedData}</p>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Shared UI Components
// ────────────────────────────────────────────────────────────────────────────────

function NavMetric({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: string
  unit?: string
  color?: string
}) {
  return (
    <div className="hidden sm:block">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${color || 'text-gray-900'}`} style={{ fontFamily: MONO_STACK }}>
        {value}
        {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: string
  color?: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p
        className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}
        style={{ fontFamily: MONO_STACK }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionLabel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={`text-[10px] font-medium uppercase tracking-wider text-gray-400 ${className}`}>
      {children}
    </p>
  )
}

function DetailField({
  label,
  value,
  color,
  mono,
}: {
  label: string
  value: string
  color?: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p
        className={`text-sm font-semibold mt-0.5 ${color || 'text-gray-900'}`}
        style={mono ? { fontFamily: MONO_STACK } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${color}`} style={{ fontFamily: MONO_STACK }}>
        {value}
      </p>
    </div>
  )
}

function StatusDot({
  color,
  label,
  pulse,
}: {
  color: string
  label: string
  pulse?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] text-gray-500">{label}</span>
    </span>
  )
}

function VelocityLabel({ velocity }: { velocity: string }) {
  const config: Record<string, string> = {
    accelerating: 'text-emerald-600',
    steady: 'text-blue-600',
    declining: 'text-amber-500',
    stagnant: 'text-gray-400',
  }
  return (
    <span className={`text-[10px] font-medium ${config[velocity] || config.stagnant}`}>
      {velocity}
    </span>
  )
}

function PredictionLabel({ prediction }: { prediction: string }) {
  const config: Record<string, string> = {
    will_graduate: 'bg-emerald-50 text-emerald-700',
    watching: 'bg-amber-50 text-amber-700',
    unlikely: 'bg-red-50 text-red-500',
  }
  const labels: Record<string, string> = {
    will_graduate: 'Will Graduate',
    watching: 'Watching',
    unlikely: 'Unlikely',
  }
  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
        config[prediction] || 'bg-gray-100 text-gray-500'
      }`}
    >
      {labels[prediction] || prediction}
    </span>
  )
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-gray-300">
          <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 9h6M9 6v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">{message}</p>
      <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">{sub}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 96px)' }}>
      <div className="text-center">
        <svg
          className="animate-spin mx-auto text-gray-400"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-sm text-gray-400 mt-3">Loading dashboard...</p>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
