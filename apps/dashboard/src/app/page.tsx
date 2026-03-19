'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, useInView, useMotionValue, useTransform, animate, AnimatePresence, type MotionValue } from 'framer-motion'
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

interface Analysis {
  mint: string
  name: string
  symbol: string
  poolAddress: string
  score: number
  curveProgress: number
  velocity: string
  velocityScore: number
  holderCount: number
  topHolderConcentration: number
  securityScore: number
  safe: boolean
  reasoning: string
  prediction: string
  graduated: boolean
  tweetUrl?: string
  tweetAuthor?: string
}

type Filter = 'all' | 'hot' | 'graduating' | 'graduated'
type SandboxPhase = 'idle' | 'validating' | 'fetching' | 'analyzing' | 'done' | 'error'

// ────────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────────

const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace"

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const SANDBOX_PHASE_LABELS: Record<SandboxPhase, string> = {
  idle: '',
  validating: 'Validating address...',
  fetching: 'Fetching on-chain data from Solana...',
  analyzing: 'Running graduation analysis...',
  done: 'Analysis complete',
  error: 'Analysis failed',
}

const EXAMPLE_TOKENS = [
  { label: 'Try: $Chhealth (88% curve)', mint: 'EK7NyRkRmstUZ49g9Z5a6Y3vFDywJu1cCph3SsRcvb8N' },
  { label: 'Try: $AGNT (37% curve)', mint: 'Bie3j6rvTK1t1vJ1qTo1YnvS1AjZfwg8f1XQ2Cq2BAGS' },
]

// ────────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ────────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [pnl, setPnl] = useState<PnLData>({ totalPnl: 0, totalTrades: 0, winRate: 0 })
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [logExpanded, setLogExpanded] = useState(false)

  // Sandbox state (hero)
  const [sandboxMint, setSandboxMint] = useState('')
  const [sandboxPhase, setSandboxPhase] = useState<SandboxPhase>('idle')
  const [sandboxAnalysis, setSandboxAnalysis] = useState<Analysis | null>(null)
  const [sandboxError, setSandboxError] = useState('')
  const [sdkCopied, setSdkCopied] = useState(false)
  const sandboxInputRef = useRef<HTMLInputElement>(null)

  const sandboxIsLoading = sandboxPhase === 'validating' || sandboxPhase === 'fetching' || sandboxPhase === 'analyzing'

  const handleSandboxAnalyze = useCallback(async () => {
    const trimmed = sandboxMint.trim()
    if (!trimmed) {
      sandboxInputRef.current?.focus()
      return
    }

    setSandboxPhase('validating')
    setSandboxAnalysis(null)
    setSandboxError('')

    if (trimmed.length < 32 || trimmed.length > 44) {
      setSandboxError('Invalid Solana address -- must be 32-44 characters.')
      setSandboxPhase('error')
      return
    }

    setSandboxPhase('fetching')
    await new Promise((r) => setTimeout(r, 400))
    setSandboxPhase('analyzing')

    try {
      const res = await fetch('/api/analyze-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: trimmed }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setSandboxError(data.error || 'Analysis failed')
        setSandboxPhase('error')
        return
      }

      setSandboxAnalysis(data.analysis)
      setSandboxPhase('done')
    } catch {
      setSandboxError('Network error -- could not reach the analysis server.')
      setSandboxPhase('error')
    }
  }, [sandboxMint])

  const handleSdkCopy = useCallback(() => {
    navigator.clipboard.writeText('npm install trendsurfer-skill')
    setSdkCopied(true)
    setTimeout(() => setSdkCopied(false), 2000)
  }, [])

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

  // Deduplicate predictions by mint
  const uniqueTokens = useMemo(() => {
    const seen = new Set<string>()
    return predictions.filter((p) => {
      if (seen.has(p.mint)) return false
      seen.add(p.mint)
      return true
    })
  }, [predictions])

  const hotTokens = useMemo(() => uniqueTokens.filter((p) => p.score >= 75 && p.outcome === 'pending'), [uniqueTokens])
  const graduatingTokens = useMemo(() => uniqueTokens.filter((p) => p.curveProgress >= 90 && p.outcome !== 'graduated'), [uniqueTokens])
  const graduatedTokens = useMemo(() => uniqueTokens.filter((p) => p.outcome === 'graduated'), [uniqueTokens])

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

  const closedPositions = useMemo(
    () => positions.filter((p) => p.status === 'closed').sort((a, b) => (b.exitTimestamp || 0) - (a.exitTimestamp || 0)),
    [positions]
  )
  const openPositions = useMemo(() => positions.filter((p) => p.status === 'open'), [positions])
  const wins = closedPositions.filter((p) => (p.realizedPnlPercent ?? 0) > 0)
  const bestTrade = closedPositions.length > 0 ? Math.max(...closedPositions.map((p) => p.realizedPnlPercent || 0)) : 0
  const bestTradeSymbol = wins.length > 0
    ? wins.sort((a, b) => (b.realizedPnlPercent || 0) - (a.realizedPnlPercent || 0))[0]?.symbol
    : undefined

  // Copy npm install command
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText('npm install trendsurfer-skill')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin mx-auto text-gray-400" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-gray-400 mt-3">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ================================================================== */}
      {/* SECTION 1: HERO = SANDBOX                                          */}
      {/* ================================================================== */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-16 sm:pb-20">
          {/* Top row: logo + status + links */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12L6 4l4 8 4-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight">TrendSurfer</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/developers"
                className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
              >
                Developers
              </Link>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
                <div className={`w-2 h-2 rounded-full ${status?.running ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium text-gray-600">
                  {status?.running ? 'Agent Live' : 'Agent Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Title + tagline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900">
              The Intelligence Skill for{' '}
              <span className="text-blue-600">trends.fun</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-500 mt-3 max-w-2xl mx-auto">
              Paste any token mint address &rarr; instant graduation analysis
            </p>
          </motion.div>

          {/* ── Sandbox Input Area ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="max-w-2xl mx-auto mb-6"
          >
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={sandboxInputRef}
                  type="text"
                  value={sandboxMint}
                  onChange={(e) => setSandboxMint(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !sandboxIsLoading && handleSandboxAnalyze()}
                  placeholder="Paste a Solana token mint address..."
                  disabled={sandboxIsLoading}
                  className="w-full px-4 py-3.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50 placeholder:text-gray-400"
                  style={{ fontFamily: MONO }}
                />
                {sandboxMint && !sandboxIsLoading && (
                  <button
                    onClick={() => { setSandboxMint(''); setSandboxPhase('idle'); setSandboxAnalysis(null); setSandboxError('') }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={handleSandboxAnalyze}
                disabled={sandboxIsLoading || !sandboxMint.trim()}
                className="px-6 py-3.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {sandboxIsLoading ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>

            {/* Quick test buttons */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[11px] text-gray-400">Quick test:</span>
              {EXAMPLE_TOKENS.map((ex) => (
                <button
                  key={ex.mint}
                  onClick={() => setSandboxMint(ex.mint)}
                  disabled={sandboxIsLoading}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── Sandbox Phase Indicator ── */}
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              {sandboxIsLoading && (
                <motion.div
                  key="sandbox-loading"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mb-6"
                >
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full border-2 border-gray-200" />
                        <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{SANDBOX_PHASE_LABELS[sandboxPhase]}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5" style={{ fontFamily: MONO }}>
                          {sandboxPhase === 'validating' && 'Checking address format...'}
                          {sandboxPhase === 'fetching' && 'Reading Meteora DBC pool state via Helius RPC...'}
                          {sandboxPhase === 'analyzing' && 'Computing score from curve progress + holders + security...'}
                        </p>
                      </div>
                    </div>

                    {/* Progress steps */}
                    <div className="flex items-center gap-1 mt-4">
                      {(['validating', 'fetching', 'analyzing'] as SandboxPhase[]).map((step, i) => {
                        const stepPhases: SandboxPhase[] = ['validating', 'fetching', 'analyzing']
                        const currentIdx = stepPhases.indexOf(sandboxPhase)
                        const done = i < currentIdx
                        const active = i === currentIdx
                        return (
                          <div
                            key={step}
                            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                              done ? 'bg-gray-900' : active ? 'bg-gray-400' : 'bg-gray-200'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Sandbox Error ── */}
            <AnimatePresence>
              {sandboxPhase === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-6"
                >
                  <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-900">Analysis failed</p>
                        <p className="text-xs text-red-700 mt-0.5">{sandboxError}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Sandbox Results ── */}
            <AnimatePresence>
              {sandboxPhase === 'done' && sandboxAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mb-6"
                >
                  {/* Token Header */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                    <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900">{sandboxAnalysis.name}</h2>
                            <span className="text-sm text-gray-400" style={{ fontFamily: MONO }}>
                              ${sandboxAnalysis.symbol}
                            </span>
                            {sandboxAnalysis.graduated && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                GRADUATED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1" style={{ fontFamily: MONO }}>
                            {sandboxAnalysis.mint}
                          </p>
                        </div>
                        {/* Score Circle */}
                        <HeroScoreCircle score={sandboxAnalysis.score} />
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-200">
                      <HeroMetricCell
                        label="Curve Progress"
                        value={`${sandboxAnalysis.curveProgress.toFixed(1)}%`}
                        color={sandboxAnalysis.curveProgress >= 80 ? 'text-emerald-600' : sandboxAnalysis.curveProgress >= 40 ? 'text-blue-600' : 'text-gray-900'}
                      />
                      <HeroMetricCell
                        label="Velocity"
                        value={sandboxAnalysis.velocity}
                        color={
                          sandboxAnalysis.velocity === 'accelerating' ? 'text-emerald-600'
                            : sandboxAnalysis.velocity === 'steady' ? 'text-blue-600'
                              : 'text-gray-400'
                        }
                      />
                      <HeroMetricCell
                        label="Holders"
                        value={sandboxAnalysis.holderCount > 0 ? `${sandboxAnalysis.holderCount}` : '--'}
                        sub={sandboxAnalysis.topHolderConcentration > 0 ? `Top: ${sandboxAnalysis.topHolderConcentration}%` : undefined}
                      />
                      <HeroMetricCell
                        label="Security"
                        value={sandboxAnalysis.safe ? 'Safe' : 'Warning'}
                        color={sandboxAnalysis.safe ? 'text-emerald-600' : 'text-red-500'}
                        sub={`Score: ${sandboxAnalysis.securityScore}/100`}
                      />
                    </div>

                    {/* Curve Progress Bar */}
                    <div className="px-5 py-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                          Bonding Curve
                        </span>
                        <span className="text-xs font-medium text-gray-600" style={{ fontFamily: MONO }}>
                          {sandboxAnalysis.curveProgress.toFixed(1)}% / 100%
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(sandboxAnalysis.curveProgress, 100)}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            sandboxAnalysis.curveProgress >= 90 ? 'bg-emerald-500'
                              : sandboxAnalysis.curveProgress >= 60 ? 'bg-blue-500'
                                : sandboxAnalysis.curveProgress >= 30 ? 'bg-amber-400'
                                  : 'bg-gray-300'
                          }`}
                        />
                      </div>
                      {sandboxAnalysis.curveProgress >= 85 && !sandboxAnalysis.graduated && (
                        <p className="text-[11px] text-emerald-600 font-medium mt-1.5">
                          Near graduation threshold -- bonding curve almost full
                        </p>
                      )}
                    </div>

                    {/* AI Reasoning */}
                    <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <circle cx="5" cy="5" r="2" fill="white" />
                            <circle cx="5" cy="5" r="4" stroke="white" strokeWidth="0.8" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                          AI Analysis
                        </span>
                        <span className={`ml-auto px-2 py-0.5 text-[10px] font-semibold rounded ${
                          sandboxAnalysis.prediction === 'will_graduate' ? 'bg-emerald-50 text-emerald-700'
                            : sandboxAnalysis.prediction === 'watching' ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sandboxAnalysis.prediction === 'will_graduate' ? 'Likely Graduate'
                            : sandboxAnalysis.prediction === 'watching' ? 'Watching'
                              : 'Unlikely'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {sandboxAnalysis.reasoning}
                      </p>
                    </div>

                    {/* Pool info */}
                    {sandboxAnalysis.poolAddress && (
                      <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-[11px] text-gray-400">
                          Pool: <span style={{ fontFamily: MONO }}>{sandboxAnalysis.poolAddress.substring(0, 16)}...</span>
                        </span>
                        {sandboxAnalysis.tweetUrl && (
                          <a
                            href={sandboxAnalysis.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline"
                          >
                            View original tweet
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SDK Attribution */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-center"
                  >
                    <p className="text-xs text-gray-500">
                      Powered by the <span className="font-semibold text-gray-900">TrendSurfer SDK</span>.
                      Run this same analysis in your own agent:
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <code
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-700"
                        style={{ fontFamily: MONO }}
                      >
                        npm install trendsurfer-skill
                      </code>
                      <button
                        onClick={handleSdkCopy}
                        className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800 transition-colors"
                      >
                        {sdkCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <Link href="/developers" className="text-[11px] text-blue-600 hover:underline">
                        Read the docs
                      </Link>
                      <span className="text-gray-300">|</span>
                      <Link href="/developers#x402-api" className="text-[11px] text-blue-600 hover:underline">
                        x402 API -- $0.001/call
                      </Link>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Animated Bonding Curve (accent, smaller) ── */}
          <AnimatePresence>
            {sandboxPhase === 'idle' && !sandboxAnalysis && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="max-w-md mx-auto mb-10"
              >
                <HeroBondingCurve />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stat counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-10">
            <AnimatedStatCard
              label="Tokens Scanned"
              value={status?.tokensScanned || 0}
              format="int"
              delay={0.5}
            />
            <AnimatedStatCard
              label="Predictions Made"
              value={predictions.length}
              format="int"
              delay={0.6}
            />
            <AnimatedStatCard
              label="Win Rate"
              value={pnl.winRate}
              format="percent"
              delay={0.7}
            />
            <AnimatedStatCard
              label="Total PnL"
              value={pnl.totalPnl}
              format="sol"
              delay={0.8}
            />
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#scanner"
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              View Scanner
            </a>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <span style={{ fontFamily: MONO }} className="text-xs">
                npm install trendsurfer-skill
              </span>
              <span className="text-gray-400 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 2: HOW IT WORKS                                             */}
      {/* ================================================================== */}
      <HowItWorksSection />

      {/* ================================================================== */}
      {/* SECTION 3: LIVE TOKEN SCANNER                                       */}
      {/* ================================================================== */}
      <section id="scanner" className="bg-white border-b border-gray-200 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionInView>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Live Scanner</h2>
                <p className="text-sm text-gray-500 mt-1">Real-time monitoring of trends.fun token launches</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'hot', 'graduating', 'graduated'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      filter === f
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'hot' ? 'Hot' : f === 'graduating' ? 'Graduating' : 'Graduated'}
                    <span
                      className={`text-[10px] ${filter === f ? 'text-gray-400' : 'text-gray-400'}`}
                      style={{ fontFamily: MONO }}
                    >
                      {filterCounts[f]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {filteredTokens.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-400">
                    <path d="M2 10h4l2-6 4 12 2-6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">Agent is scanning trends.fun for new token launches...</p>
                <p className="text-xs text-gray-500 mt-1">
                  Run <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs" style={{ fontFamily: MONO }}>npm run agent</code> to start the scanner
                </p>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {filteredTokens.slice(0, 20).map((token, i) => (
                  <ScannerTokenRow
                    key={token.id}
                    token={token}
                    position={positions.find((p) => p.mint === token.mint)}
                    index={i}
                  />
                ))}
              </motion.div>
            )}
          </SectionInView>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 4: RECENT PREDICTIONS                                       */}
      {/* ================================================================== */}
      <section className="bg-gray-50 border-b border-gray-200 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionInView>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Predictions</h2>
              <p className="text-sm text-gray-500 mt-1">AI-powered graduation scoring with full reasoning</p>
            </div>

            {predictions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-sm font-medium text-gray-900">No predictions yet</p>
                <p className="text-xs text-gray-500 mt-1">Predictions appear when the agent analyzes tokens</p>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {predictions.slice(0, 12).map((pred) => (
                  <PredictionCard key={pred.id} prediction={pred} />
                ))}
              </motion.div>
            )}
          </SectionInView>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 5: TRADING PERFORMANCE                                      */}
      {/* ================================================================== */}
      <section className="bg-white border-b border-gray-200 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionInView>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Trading Performance</h2>
              <p className="text-sm text-gray-500 mt-1">
                Strategy: Buy pre-graduation, sell after DEX migration
              </p>
            </div>

            {/* Performance Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total PnL"
                value={`${pnl.totalPnl >= 0 ? '+' : ''}${pnl.totalPnl.toFixed(4)} SOL`}
                color={pnl.totalPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}
              />
              <StatCard
                label="Win Rate"
                value={`${pnl.winRate.toFixed(0)}%`}
                sub={`${wins.length}W / ${closedPositions.length - wins.length}L`}
              />
              <StatCard
                label="Best Trade"
                value={closedPositions.length > 0 ? `+${bestTrade.toFixed(1)}%` : '--'}
                color="text-emerald-600"
                sub={bestTradeSymbol ? `$${bestTradeSymbol}` : undefined}
              />
              <StatCard
                label="Total Trades"
                value={`${pnl.totalTrades}`}
                sub={`${openPositions.length} open`}
              />
            </div>

            {/* PnL Chart */}
            {closedPositions.length > 1 && <PnLChart positions={closedPositions} />}

            {/* Open Positions */}
            {openPositions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Open Positions</h3>
                <div className="space-y-2">
                  {openPositions.map((pos) => (
                    <div key={pos.id} className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center"
                            style={{ fontFamily: MONO }}
                          >
                            <span className="text-blue-600 font-bold text-xs">{pos.graduationScore}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">${pos.symbol}</span>
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                <span className="text-[10px] text-gray-500">Holding</span>
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: MONO }}>
                              {pos.entryAmount} SOL @ score {pos.graduationScore}/100
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Trades */}
            {closedPositions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Completed Trades</h3>
                <div className="space-y-2">
                  {closedPositions.slice(0, 8).map((pos) => {
                    const isWin = (pos.realizedPnlPercent ?? 0) > 0
                    return (
                      <div key={pos.id} className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                isWin ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-500 border border-red-200'
                              }`}
                              style={{ fontFamily: MONO }}
                            >
                              {pos.realizedPnlPercent != null
                                ? `${pos.realizedPnlPercent >= 0 ? '+' : ''}${pos.realizedPnlPercent.toFixed(0)}%`
                                : '--'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">${pos.symbol}</span>
                                <span className={`text-[10px] font-medium ${isWin ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {isWin ? 'Graduated' : 'Stop-loss'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: MONO }}>
                                {pos.entryAmount} SOL @ {pos.entryPrice.toFixed(8)}
                                {pos.exitPrice ? ` \u2192 ${pos.exitPrice.toFixed(8)}` : ''}
                                {pos.realizedPnl != null ? ` = ${isWin ? '+' : ''}${pos.realizedPnl.toFixed(4)} SOL` : ''}
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
              </div>
            )}

            {/* Empty state */}
            {positions.length === 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-sm font-medium text-gray-900">No trades yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  The agent opens positions when a token scores above the threshold
                </p>
              </div>
            )}
          </SectionInView>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 6: FOR DEVELOPERS                                           */}
      {/* ================================================================== */}
      <section className="bg-gray-50 border-b border-gray-200 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionInView>
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-900">Use TrendSurfer in Your Agent</h2>
              <p className="text-sm text-gray-500 mt-1">
                Reusable SDK + MCP server for any AI agent framework
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* SDK Panel */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-md bg-gray-900 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">TS</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">TypeScript SDK</h3>
                </div>
                <div
                  className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs leading-relaxed overflow-x-auto"
                  style={{ fontFamily: MONO }}
                >
                  <div className="text-gray-500">{'// Install the skill'}</div>
                  <div><span className="text-blue-600">npm install</span> trendsurfer-skill</div>
                  <div className="mt-3 text-gray-500">{'// Use in your agent'}</div>
                  <div><span className="text-violet-600">import</span> {'{ TrendSurferSkill }'} <span className="text-violet-600">from</span> <span className="text-emerald-600">{`'trendsurfer-skill'`}</span></div>
                  <div className="mt-2"><span className="text-violet-600">const</span> ts = <span className="text-violet-600">new</span> <span className="text-blue-600">TrendSurferSkill</span>()</div>
                  <div className="mt-2"><span className="text-violet-600">const</span> tokens = <span className="text-violet-600">await</span> ts.<span className="text-blue-600">scanLaunches</span>()</div>
                  <div><span className="text-violet-600">const</span> score = <span className="text-violet-600">await</span> ts.<span className="text-blue-600">analyzeGraduation</span>(mint)</div>
                  <div><span className="text-violet-600">const</span> safe = <span className="text-violet-600">await</span> ts.<span className="text-blue-600">checkSecurity</span>(mint)</div>
                  <div><span className="text-violet-600">const</span> tx = <span className="text-violet-600">await</span> ts.<span className="text-blue-600">executeTrade</span>(params)</div>
                </div>
                <button
                  onClick={handleCopy}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <span style={{ fontFamily: MONO }}>npm install trendsurfer-skill</span>
                  <span className="text-gray-400">{copied ? 'Copied!' : ''}</span>
                </button>
              </div>

              {/* MCP Panel */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">M</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">MCP Server</h3>
                </div>
                <div
                  className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs leading-relaxed"
                  style={{ fontFamily: MONO }}
                >
                  <div className="text-gray-500">{'// 6 tools, any agent framework'}</div>
                  <div><span className="text-blue-600">npx</span> trendsurfer-mcp</div>
                  <div className="mt-3 text-gray-500">{'// Available tools:'}</div>
                  <div className="text-gray-700">scan_launches</div>
                  <div className="text-gray-700">analyze_graduation</div>
                  <div className="text-gray-700">check_security</div>
                  <div className="text-gray-700">score_dev_wallet</div>
                  <div className="text-gray-700">get_swap_quote</div>
                  <div className="text-gray-700">execute_trade</div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Link
                    href="/developers"
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-white text-gray-700 text-xs font-medium rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    View full SDK docs
                  </Link>
                  <span className="px-3 py-2 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-lg border border-blue-100">
                    x402 API: $0.001/call
                  </span>
                </div>
              </div>
            </div>
          </SectionInView>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 7: AGENT LOG                                                */}
      {/* ================================================================== */}
      <section className="bg-white py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionInView>
            <button
              onClick={() => setLogExpanded(!logExpanded)}
              className="flex items-center justify-between w-full text-left mb-4"
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Agent Log</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {status?.logs?.length || 0} entries
                </p>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className={`text-gray-400 transition-transform ${logExpanded ? 'rotate-180' : ''}`}
              >
                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <AnimatePresence>
              {logExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  {(!status?.logs || status.logs.length === 0) ? (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
                      <p className="text-sm text-gray-500">No agent activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[500px] overflow-y-auto">
                      {status.logs.map((entry, i) => (
                        <LogRow key={entry.id || i} entry={entry} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </SectionInView>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            TrendSurfer -- The Intelligence Skill for trends.fun
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">Built for Agent Talent Show 2026</span>
            <Link href="/developers" className="text-xs text-blue-600 hover:text-blue-700">
              SDK Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Hero Score Circle (for sandbox results)
// ────────────────────────────────────────────────────────────────────────────────

function HeroScoreCircle({ score }: { score: number }) {
  const color = score >= 75 ? '#059669' : score >= 40 ? '#d97706' : '#9ca3af'
  const r = 32
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="relative flex-shrink-0">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
        <motion.circle
          cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 38 38)"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color, fontFamily: MONO }}>{score}</span>
        <span className="text-[9px] text-gray-400">/100</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Hero Metric Cell (for sandbox results)
// ────────────────────────────────────────────────────────────────────────────────

function HeroMetricCell({
  label,
  value,
  color = 'text-gray-900',
  sub,
}: {
  label: string
  value: string
  color?: string
  sub?: string
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`} style={{ fontFamily: MONO }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Hero Bonding Curve SVG - THE SIGNATURE VISUAL
// ────────────────────────────────────────────────────────────────────────────────

function HeroBondingCurve() {
  const ref = useRef<SVGSVGElement>(null)
  const progress = useMotionValue(0)
  const [phase, setPhase] = useState<'early' | 'building' | 'accelerating' | 'graduating' | 'graduated'>('early')
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    const controls = animate(progress, 88, {
      duration: 3,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (v) => {
        if (v < 30) setPhase('early')
        else if (v < 60) setPhase('building')
        else if (v < 85) setPhase('accelerating')
        else setPhase('graduating')
      },
      onComplete: () => {
        setTimeout(() => {
          setPhase('graduated')
          setShowBadge(true)
        }, 300)
      },
    })
    return controls.stop
  }, [progress])

  const fillColor = useTransform(progress, [0, 30, 60, 85, 100], [
    '#9ca3af', '#d97706', '#d97706', '#2563eb', '#059669',
  ])

  const phaseLabel: Record<string, string> = {
    early: 'Early',
    building: 'Building Momentum',
    accelerating: 'Accelerating',
    graduating: 'Near Graduation!',
    graduated: 'GRADUATED',
  }

  const phaseColor: Record<string, string> = {
    early: 'text-gray-400',
    building: 'text-amber-500',
    accelerating: 'text-blue-600',
    graduating: 'text-blue-600',
    graduated: 'text-emerald-600',
  }

  // Build curve points
  const W = 480
  const H = 140
  const PAD = 24
  const STEPS = 60
  const curvePoints: [number, number][] = []
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const x = PAD + t * (W - PAD * 2)
    const y = H - PAD - Math.sqrt(t) * (H - PAD * 2)
    curvePoints.push([x, y])
  }

  // Graduation threshold line x position (at 90% fill)
  const threshX = PAD + 0.9 * (W - PAD * 2)

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: '160px' }}
      >
        {/* Background grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={PAD}
            y1={H - PAD - frac * (H - PAD * 2)}
            x2={W - PAD}
            y2={H - PAD - frac * (H - PAD * 2)}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
        ))}

        {/* Full curve outline (gray) */}
        <polyline
          points={curvePoints.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="2"
        />

        {/* Animated filled area */}
        <AnimatedCurveFill
          progress={progress}
          fillColor={fillColor}
          curvePoints={curvePoints}
          steps={STEPS}
          w={W}
          h={H}
          pad={PAD}
        />

        {/* Graduation threshold dotted line */}
        <line
          x1={threshX}
          y1={PAD - 4}
          x2={threshX}
          y2={H - PAD}
          stroke="#059669"
          strokeWidth="1.5"
          strokeDasharray="4,4"
          opacity="0.4"
        />
        <text
          x={threshX}
          y={PAD - 8}
          textAnchor="middle"
          fill="#059669"
          fontSize="9"
          fontWeight="500"
          opacity="0.6"
        >
          Graduation
        </text>

        {/* Axis labels */}
        <text x={PAD} y={H - 6} fill="#9ca3af" fontSize="9">0%</text>
        <text x={W - PAD} y={H - 6} fill="#9ca3af" fontSize="9" textAnchor="end">100%</text>
        <text x={PAD - 4} y={H - PAD + 4} fill="#9ca3af" fontSize="8" textAnchor="end">Price</text>
        <text x={W / 2} y={H - 4} fill="#9ca3af" fontSize="9" textAnchor="middle">Bonding Curve Fill</text>
      </svg>

      {/* Phase indicator */}
      <div className="flex items-center justify-center gap-3 mt-2">
        <motion.div
          className={`text-xs font-semibold ${phaseColor[phase]}`}
          key={phase}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {phaseLabel[phase]}
        </motion.div>
        {showBadge && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, type: 'spring' }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full border border-emerald-200"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            GRADUATED
          </motion.span>
        )}
      </div>
    </div>
  )
}

// Animated fill under the curve, driven by motion value
function AnimatedCurveFill({
  progress,
  fillColor,
  curvePoints,
  steps,
  w,
  h,
  pad,
}: {
  progress: MotionValue<number>
  fillColor: MotionValue<string>
  curvePoints: [number, number][]
  steps: number
  w: number
  h: number
  pad: number
}) {
  const [fillIdx, setFillIdx] = useState(0)
  const [color, setColor] = useState('#9ca3af')

  useEffect(() => {
    const unsubProgress = progress.on('change', (v: number) => {
      setFillIdx(Math.round((v / 100) * steps))
    })
    const unsubColor = fillColor.on('change', (v: string) => {
      setColor(v)
    })
    return () => {
      unsubProgress()
      unsubColor()
    }
  }, [progress, fillColor, steps])

  const filledPoints = curvePoints.slice(0, fillIdx + 1)
  if (filledPoints.length < 2) return null

  const lastPt = filledPoints[filledPoints.length - 1]

  return (
    <>
      {/* Fill area */}
      <polygon
        points={`${pad},${h - pad} ${filledPoints.map((p) => p.join(',')).join(' ')} ${lastPt[0]},${h - pad}`}
        fill={color}
        opacity="0.08"
      />
      {/* Colored curve line */}
      <polyline
        points={filledPoints.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Current position dot */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill={color} />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="7" fill={color} opacity="0.2" />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Animated Stat Card (counts up from 0)
// ────────────────────────────────────────────────────────────────────────────────

function AnimatedStatCard({
  label,
  value,
  format,
  delay = 0,
}: {
  label: string
  value: number
  format: 'int' | 'percent' | 'sol'
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const motionVal = useMotionValue(0)
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (!inView) return
    const controls = animate(motionVal, value, {
      duration: 1.5,
      delay,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (format === 'int') setDisplay(Math.round(v).toLocaleString())
        else if (format === 'percent') setDisplay(`${v.toFixed(1)}%`)
        else setDisplay(`${v >= 0 ? '+' : ''}${v.toFixed(4)}`)
      },
    })
    return controls.stop
  }, [inView, value, format, delay, motionVal])

  const valueColor =
    format === 'sol' ? (value >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-900'

  return (
    <div ref={ref} className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold ${valueColor}`} style={{ fontFamily: MONO }}>
        {display}
        {format === 'sol' && <span className="text-sm font-normal text-gray-400 ml-1">SOL</span>}
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// How It Works Section
// ────────────────────────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const steps = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 3a10.9 10.9 0 01-3.14 1.53A4.48 4.48 0 0016 3a4.48 4.48 0 00-4.47 4.48c0 .35.04.7.11 1.03C7.69 8.3 4.07 6.58 1.64 3.86a4.48 4.48 0 001.39 5.98A4.46 4.46 0 01.96 9.2v.06a4.48 4.48 0 003.59 4.39c-.37.1-.77.16-1.18.16-.29 0-.57-.03-.84-.08a4.49 4.49 0 004.18 3.12A8.98 8.98 0 010 18.58 12.72 12.72 0 006.92 20c8.29 0 12.84-6.87 12.84-12.84 0-.2 0-.39-.01-.59A9.22 9.22 0 0023 3z" />
        </svg>
      ),
      title: 'Tweet Goes Viral',
      desc: 'Someone posts a hot take on X',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
      title: 'Token Created',
      desc: 'trends.fun tokenizes the tweet',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20L7 10l5 7 4-12 6 15" />
        </svg>
      ),
      title: 'Curve Fills Up',
      desc: 'Buy pressure fills the bonding curve',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M16.36 7.64l1.42-1.42" />
        </svg>
      ),
      title: 'TrendSurfer Predicts',
      desc: 'AI scores graduation probability',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      title: 'Graduation = Profit',
      desc: 'DEX migration causes price jump',
    },
  ]

  return (
    <section ref={ref} className="bg-gray-50 border-b border-gray-200 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-xl font-semibold text-gray-900">How It Works</h2>
          <p className="text-sm text-gray-500 mt-1">From viral tweet to trading profit in 5 steps</p>
        </div>

        <div className="relative">
          {/* Connection line (desktop) */}
          <div className="hidden sm:block absolute top-8 left-[10%] right-[10%] h-px bg-gray-200" />

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="flex flex-col items-center text-center relative"
              >
                <div className="w-16 h-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 mb-3 relative z-10">
                  {step.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-[140px]">{step.desc}</p>

                {/* Arrow between steps (mobile) */}
                {i < steps.length - 1 && (
                  <div className="sm:hidden w-px h-6 bg-gray-200 my-2" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Scanner Token Row
// ────────────────────────────────────────────────────────────────────────────────

function ScannerTokenRow({
  token,
  position,
  index,
}: {
  token: Prediction
  position?: Position
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const isGraduating = token.curveProgress >= 90 && token.outcome !== 'graduated'
  const isGraduated = token.outcome === 'graduated'

  const scoreColor =
    token.score >= 75 ? 'text-emerald-600 border-emerald-300 bg-emerald-50'
      : token.score >= 50 ? 'text-amber-600 border-amber-300 bg-amber-50'
        : 'text-gray-400 border-gray-200 bg-gray-50'

  const curveColor =
    token.curveProgress >= 90 ? 'bg-emerald-500'
      : token.curveProgress >= 60 ? 'bg-blue-600'
        : token.curveProgress >= 30 ? 'bg-amber-400'
          : 'bg-gray-300'

  const velocityConfig: Record<string, string> = {
    accelerating: 'text-emerald-600',
    steady: 'text-blue-600',
    declining: 'text-amber-500',
    stagnant: 'text-gray-400',
  }

  // suppress unused variable warning
  void index

  return (
    <motion.div variants={staggerItem}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`bg-white rounded-lg border cursor-pointer transition-all ${
          expanded ? 'border-gray-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="px-4 py-3 flex items-center gap-4">
          {/* Score */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border ${scoreColor}`}
            style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 700 }}
          >
            {token.score}
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 truncate">{token.name}</span>
              <span className="text-xs text-gray-400" style={{ fontFamily: MONO }}>${token.symbol}</span>
              {isGraduating && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-600 font-medium">Graduating</span>
                </span>
              )}
              {isGraduated && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                  Graduated
                </span>
              )}
              {position && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {position.status === 'open' ? 'Holding' : `${(position.realizedPnlPercent ?? 0) >= 0 ? '+' : ''}${(position.realizedPnlPercent ?? 0).toFixed(0)}%`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-[10px] font-medium ${velocityConfig[token.velocity] || 'text-gray-400'}`}>
                {token.velocity}
              </span>
              <span className="text-[11px] text-gray-400">{timeAgo(token.createdAt)}</span>
            </div>
          </div>

          {/* Bonding Curve Mini Bar */}
          <div className="w-28 flex-shrink-0 hidden sm:block">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Curve</span>
              <span className="text-xs font-medium text-gray-700" style={{ fontFamily: MONO }}>
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

          {/* Expand chevron */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`text-gray-300 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Expanded Detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                {/* AI Reasoning */}
                <div className="mb-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">AI Analysis</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{token.reasoning}</p>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-gray-400">Prediction: </span>
                    <span className={`font-medium ${
                      token.prediction === 'will_graduate' ? 'text-emerald-600'
                        : token.prediction === 'watching' ? 'text-amber-600'
                          : 'text-gray-500'
                    }`}>
                      {token.prediction === 'will_graduate' ? 'Will Graduate'
                        : token.prediction === 'watching' ? 'Watching'
                          : 'Unlikely'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Outcome: </span>
                    <span className={`font-medium ${
                      token.outcome === 'graduated' ? 'text-emerald-600'
                        : token.outcome === 'pending' ? 'text-blue-600'
                          : 'text-gray-500'
                    }`}>
                      {token.outcome === 'graduated' ? 'Graduated'
                        : token.outcome === 'pending' ? 'Pending'
                          : 'Did not graduate'}
                    </span>
                  </div>
                  <div style={{ fontFamily: MONO }} className="text-[11px] text-gray-400 truncate max-w-[200px]">
                    {token.mint}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Prediction Card
// ────────────────────────────────────────────────────────────────────────────────

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const [expanded, setExpanded] = useState(false)
  const scoreColor = prediction.score >= 75 ? '#059669' : prediction.score >= 50 ? '#d97706' : '#9ca3af'
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeDash = (prediction.score / 100) * circumference

  const outcomeConfig: Record<string, { bg: string; text: string; label: string }> = {
    graduated: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Graduated' },
    pending: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Pending' },
    not_graduated: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Did not graduate' },
  }
  const outcome = outcomeConfig[prediction.outcome] || outcomeConfig.pending

  const curveColor =
    prediction.curveProgress >= 90 ? 'bg-emerald-500'
      : prediction.curveProgress >= 60 ? 'bg-blue-500'
        : prediction.curveProgress >= 30 ? 'bg-amber-400'
          : 'bg-gray-300'

  return (
    <motion.div variants={staggerItem} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      {/* Header: Score ring + name */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{prediction.name}</h3>
          <p className="text-xs text-gray-400" style={{ fontFamily: MONO }}>${prediction.symbol}</p>
        </div>
        <div className="relative flex-shrink-0 ml-3">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="3" />
            <motion.circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke={scoreColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              transform="rotate(-90 32 32)"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              whileInView={{ strokeDasharray: `${strokeDash} ${circumference}` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold" style={{ color: scoreColor, fontFamily: MONO }}>
              {prediction.score}
            </span>
          </div>
        </div>
      </div>

      {/* Mini curve progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-gray-400">Curve</span>
          <span className="text-[11px] font-medium text-gray-600" style={{ fontFamily: MONO }}>
            {prediction.curveProgress.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${curveColor}`} style={{ width: `${Math.min(prediction.curveProgress, 100)}%` }} />
        </div>
      </div>

      {/* AI reasoning -- click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-left w-full mb-3 group"
      >
        <p className={`text-xs text-gray-500 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
          {prediction.reasoning}
        </p>
        {prediction.reasoning && prediction.reasoning.length > 120 && (
          <span className="text-[10px] text-blue-600 group-hover:text-blue-700 mt-1 inline-block">
            {expanded ? 'Show less' : 'Read full analysis'}
          </span>
        )}
      </button>

      {/* Footer: outcome badge + velocity */}
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${outcome.bg} ${outcome.text}`}>
          {outcome.label}
        </span>
        <span className={`text-[10px] font-medium ${
          prediction.velocity === 'accelerating' ? 'text-emerald-600'
            : prediction.velocity === 'steady' ? 'text-blue-600'
              : prediction.velocity === 'declining' ? 'text-amber-500'
                : 'text-gray-400'
        }`}>
          {prediction.velocity}
        </span>
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// PnL Chart
// ────────────────────────────────────────────────────────────────────────────────

function PnLChart({ positions }: { positions: Position[] }) {
  const sorted = useMemo(
    () => [...positions].sort((a, b) => a.entryTimestamp - b.entryTimestamp),
    [positions]
  )

  let cumPnl = 0
  const pnlPoints = sorted.map((p) => {
    cumPnl += p.realizedPnl || 0
    return cumPnl
  })

  const w = 600
  const h = 120
  const pad = 8

  const min = Math.min(0, ...pnlPoints)
  const max = Math.max(0, ...pnlPoints)
  const range = max - min || 1

  const points = pnlPoints.map((v, i) => {
    const x = pad + (i / Math.max(pnlPoints.length - 1, 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y] as [number, number]
  })

  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2)
  const isPositive = pnlPoints[pnlPoints.length - 1] >= 0
  const color = isPositive ? '#059669' : '#ef4444'

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Cumulative PnL</p>
        <span
          className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}
          style={{ fontFamily: MONO }}
        >
          {cumPnl >= 0 ? '+' : ''}{cumPnl.toFixed(4)} SOL
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '120px' }}>
        <defs>
          <linearGradient id="pnlFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Zero line */}
        <line
          x1={pad} y1={zeroY} x2={w - pad} y2={zeroY}
          stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4"
        />

        {/* Area fill */}
        {points.length > 1 && (
          <polygon
            points={`${points[0][0]},${zeroY} ${points.map((p) => p.join(',')).join(' ')} ${points[points.length - 1][0]},${zeroY}`}
            fill="url(#pnlFillGrad)"
          />
        )}

        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={points.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* End dot */}
        {points.length > 0 && (
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={color} />
        )}
      </svg>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Stat Card (static)
// ────────────────────────────────────────────────────────────────────────────────

function StatCard({
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
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p
        className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}
        style={{ fontFamily: MONO }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Log Row
// ────────────────────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const levelColors: Record<string, { dot: string; text: string }> = {
    INFO: { dot: 'bg-gray-400', text: 'text-gray-500' },
    TRADE: { dot: 'bg-blue-500', text: 'text-blue-600' },
    WARN: { dot: 'bg-amber-500', text: 'text-amber-600' },
    ERROR: { dot: 'bg-red-500', text: 'text-red-500' },
    SCAN: { dot: 'bg-gray-400', text: 'text-gray-500' },
    ANALYZE: { dot: 'bg-violet-500', text: 'text-violet-600' },
  }

  const level = (entry.level || 'INFO').toUpperCase()
  const colors = levelColors[level] || levelColors.INFO
  let parsedData: Record<string, unknown> | string | null = null
  if (entry.data) {
    try {
      parsedData = JSON.parse(entry.data)
    } catch {
      parsedData = entry.data
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-2.5">
      <div className="flex items-start gap-3">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${colors.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>
              {level}
            </span>
            <span className="text-[11px] text-gray-400" style={{ fontFamily: MONO }}>
              {formatTimestamp(entry.timestamp)}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-0.5" style={{ fontFamily: MONO, fontSize: '12px' }}>
            {entry.message}
          </p>
          {parsedData && typeof parsedData === 'object' && (
            <pre
              className="text-[11px] text-gray-500 mt-1.5 bg-white rounded px-2 py-1.5 overflow-x-auto border border-gray-100"
              style={{ fontFamily: MONO }}
            >
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Section In View Wrapper
// ────────────────────────────────────────────────────────────────────────────────

function SectionInView({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      variants={sectionVariants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
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
