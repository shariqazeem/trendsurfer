'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

// ── Constants ──
const MONO = "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace"
const HISTORY_KEY = 'trendsurfer_analysis_history'
const MAX_HISTORY = 5

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
  tweetContent?: string
  tweetEngagement?: {
    estimatedViews: string
    tokenHolders: number
    socialSignal: 'viral' | 'trending' | 'moderate' | 'low'
  }
}

interface HistoryItem {
  mint: string
  symbol: string
  name: string
  score: number
  analyzedAt: number
}

type Phase = 'idle' | 'validating' | 'fetching' | 'analyzing' | 'done' | 'error'

const PHASE_LABELS: Record<Phase, string> = {
  idle: '',
  validating: 'Validating address...',
  fetching: 'Fetching on-chain data from Solana...',
  analyzing: 'Running graduation analysis...',
  done: 'Analysis complete',
  error: 'Analysis failed',
}

// Example tokens for quick testing
const EXAMPLES = [
  { label: 'Try: $Chhealth (88% curve)', mint: 'EK7NyRkRmstUZ49g9Z5a6Y3vFDywJu1cCph3SsRcvb8N' },
  { label: 'Try: $AGNT (37% curve)', mint: 'Bie3j6rvTK1t1vJ1qTo1YnvS1AjZfwg8f1XQ2Cq2BAGS' },
]

// ── History helpers ──
function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToHistory(item: HistoryItem) {
  const history = loadHistory().filter((h) => h.mint !== item.mint)
  history.unshift(item)
  if (history.length > MAX_HISTORY) history.pop()
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Wrapper with Suspense for useSearchParams ──
export default function SandboxPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    }>
      <SandboxContent />
    </Suspense>
  )
}

function SandboxContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [mint, setMint] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const autoAnalyzeRef = useRef(false)

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const handleAnalyze = useCallback(async (mintOverride?: string) => {
    const trimmed = (mintOverride || mint).trim()
    if (!trimmed) {
      inputRef.current?.focus()
      return
    }

    if (mintOverride) setMint(trimmed)

    setPhase('validating')
    setAnalysis(null)
    setError('')

    // Quick client-side format check
    if (trimmed.length < 32 || trimmed.length > 44) {
      setError('Invalid Solana address — must be 32-44 characters.')
      setPhase('error')
      return
    }

    setPhase('fetching')

    // Simulate a brief delay for the fetching phase to feel real
    await new Promise((r) => setTimeout(r, 400))
    setPhase('analyzing')

    try {
      const res = await fetch('/api/analyze-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: trimmed }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Analysis failed')
        setPhase('error')
        return
      }

      setAnalysis(data.analysis)
      setPhase('done')

      // Save to history
      const newHistory = saveToHistory({
        mint: data.analysis.mint,
        symbol: data.analysis.symbol,
        name: data.analysis.name,
        score: data.analysis.score,
        analyzedAt: Date.now(),
      })
      setHistory(newHistory)

      // Update URL to shareable form without triggering navigation
      router.replace(`/sandbox?mint=${trimmed}`, { scroll: false })
    } catch {
      setError('Network error — could not reach the analysis server.')
      setPhase('error')
    }
  }, [mint, router])

  // Auto-analyze if ?mint= is present on page load
  useEffect(() => {
    const mintParam = searchParams.get('mint')
    if (mintParam && !autoAnalyzeRef.current) {
      autoAnalyzeRef.current = true
      setMint(mintParam)
      handleAnalyze(mintParam)
    }
  }, [searchParams, handleAnalyze])

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install trendsurfer-skill')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareCopy = () => {
    const url = `${window.location.origin}/sandbox?mint=${analysis?.mint || mint.trim()}`
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const handleHistoryClick = (item: HistoryItem) => {
    setMint(item.mint)
    handleAnalyze(item.mint)
  }

  const isLoading = phase === 'validating' || phase === 'fetching' || phase === 'analyzing'

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[15px] font-semibold text-gray-900 tracking-tight">
              TrendSurfer
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-500">Intelligence Sandbox</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/developers"
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/"
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Intelligence Sandbox
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto">
            Paste any Solana token mint address. The TrendSurfer SDK will analyze it in real-time —
            bonding curve progress, holder distribution, security audit, graduation score.
          </p>
        </motion.div>

        {/* Input Area */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyze()}
                placeholder="Paste a Solana token mint address..."
                disabled={isLoading}
                className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50 placeholder:text-gray-400"
                style={{ fontFamily: MONO }}
              />
              {mint && !isLoading && (
                <button
                  onClick={() => { setMint(''); setPhase('idle'); setAnalysis(null); setError('') }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !mint.trim()}
              className="px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {isLoading ? (
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

          {/* Example tokens */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[11px] text-gray-400">Quick test:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.mint}
                onClick={() => setMint(ex.mint)}
                disabled={isLoading}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Phase Indicator */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-8"
            >
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full border-2 border-gray-200" />
                    <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{PHASE_LABELS[phase]}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5" style={{ fontFamily: MONO }}>
                      {phase === 'validating' && 'Checking address format...'}
                      {phase === 'fetching' && 'Reading Meteora DBC pool state via Helius RPC...'}
                      {phase === 'analyzing' && 'Computing score from curve progress + holders + security...'}
                    </p>
                  </div>
                </div>

                {/* Progress steps */}
                <div className="flex items-center gap-1 mt-4">
                  {['validating', 'fetching', 'analyzing'].map((step, i) => {
                    const stepPhases: Phase[] = ['validating', 'fetching', 'analyzing']
                    const currentIdx = stepPhases.indexOf(phase)
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

        {/* Error */}
        <AnimatePresence>
          {phase === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-8"
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
                    <p className="text-xs text-red-700 mt-0.5">{error}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {phase === 'done' && analysis && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Token Header */}
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900">{analysis.name}</h2>
                        <span className="text-sm text-gray-400" style={{ fontFamily: MONO }}>
                          ${analysis.symbol}
                        </span>
                        {analysis.graduated && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            GRADUATED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1" style={{ fontFamily: MONO }}>
                        {analysis.mint}
                      </p>
                    </div>
                    {/* Score Circle */}
                    <ScoreCircle score={analysis.score} />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-200">
                  <MetricCell
                    label="Curve Progress"
                    value={`${analysis.curveProgress.toFixed(1)}%`}
                    color={analysis.curveProgress >= 80 ? 'text-emerald-600' : analysis.curveProgress >= 40 ? 'text-blue-600' : 'text-gray-900'}
                  />
                  <MetricCell
                    label="Velocity"
                    value={analysis.velocity}
                    color={
                      analysis.velocity === 'accelerating' ? 'text-emerald-600'
                        : analysis.velocity === 'steady' ? 'text-blue-600'
                          : 'text-gray-400'
                    }
                  />
                  <MetricCell
                    label="Holders"
                    value={analysis.holderCount > 0 ? `${analysis.holderCount}` : '--'}
                    sub={analysis.topHolderConcentration > 0 ? `Top: ${analysis.topHolderConcentration}%` : undefined}
                  />
                  <MetricCell
                    label="Security"
                    value={analysis.safe ? 'Safe' : 'Warning'}
                    color={analysis.safe ? 'text-emerald-600' : 'text-red-500'}
                    sub={`Score: ${analysis.securityScore}/100`}
                  />
                </div>

                {/* Curve Progress Bar */}
                <div className="px-5 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                      Bonding Curve
                    </span>
                    <span className="text-xs font-medium text-gray-600" style={{ fontFamily: MONO }}>
                      {analysis.curveProgress.toFixed(1)}% / 100%
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(analysis.curveProgress, 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        analysis.curveProgress >= 90 ? 'bg-emerald-500'
                          : analysis.curveProgress >= 60 ? 'bg-blue-500'
                            : analysis.curveProgress >= 30 ? 'bg-amber-400'
                              : 'bg-gray-300'
                      }`}
                    />
                  </div>
                  {analysis.curveProgress >= 85 && !analysis.graduated && (
                    <p className="text-[11px] text-emerald-600 font-medium mt-1.5">
                      Near graduation threshold — bonding curve almost full
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
                      analysis.prediction === 'will_graduate' ? 'bg-emerald-50 text-emerald-700'
                        : analysis.prediction === 'watching' ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      {analysis.prediction === 'will_graduate' ? 'Likely Graduate'
                        : analysis.prediction === 'watching' ? 'Watching'
                          : 'Unlikely'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {analysis.reasoning}
                  </p>
                </div>

                {/* Tweet Analysis */}
                {(analysis.tweetContent || analysis.tweetAuthor) && (
                  <div className="px-5 py-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                        <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Tweet Analysis</span>
                      {analysis.tweetEngagement?.socialSignal && (
                        <span className={`ml-auto px-2 py-0.5 text-[10px] font-semibold rounded ${
                          analysis.tweetEngagement.socialSignal === 'viral' ? 'bg-emerald-50 text-emerald-700'
                            : analysis.tweetEngagement.socialSignal === 'trending' ? 'bg-blue-50 text-blue-700'
                              : analysis.tweetEngagement.socialSignal === 'moderate' ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                        }`}>
                          {analysis.tweetEngagement.socialSignal.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {analysis.tweetContent && (
                      <p className="text-sm text-gray-600 italic leading-relaxed mb-2">
                        &ldquo;{analysis.tweetContent.length > 200
                          ? analysis.tweetContent.substring(0, 200) + '...'
                          : analysis.tweetContent}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {analysis.tweetAuthor && (
                        <span>Author: <span className="font-medium text-gray-700">@{analysis.tweetAuthor}</span></span>
                      )}
                      {analysis.tweetEngagement && (
                        <>
                          <span>Est. Views: <span className="font-medium text-gray-700">{analysis.tweetEngagement.estimatedViews}</span></span>
                          <span>Holders: <span className="font-medium text-gray-700">{analysis.tweetEngagement.tokenHolders}</span></span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Links + Share */}
                <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <a
                      href={`https://solscan.io/token/${analysis.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      Solscan
                    </a>
                    {analysis.poolAddress && (
                      <a
                        href={`https://solscan.io/account/${analysis.poolAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Pool
                      </a>
                    )}
                    {analysis.tweetUrl && (
                      <a
                        href={analysis.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Tweet
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-400" style={{ fontFamily: MONO }}>
                      {analysis.poolAddress ? `${analysis.poolAddress.substring(0, 12)}...` : analysis.mint.substring(0, 12) + '...'}
                    </span>
                    <button
                      onClick={handleShareCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      {shareCopied ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-gray-500">
                          <path d="M4 12v1a2 2 0 002 2h6a2 2 0 002-2V6a2 2 0 00-2-2h-1M2 10h6a2 2 0 002-2V3a2 2 0 00-2-2H2a1 1 0 00-1 1v7a1 1 0 001 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <span className="text-[11px] font-medium text-gray-600">
                        {shareCopied ? 'Link copied!' : 'Share'}
                      </span>
                    </button>
                  </div>
                </div>
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
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <Link href="/developers" className="text-[11px] text-blue-600 hover:underline">
                    Read the docs
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link href="/developers#x402-api" className="text-[11px] text-blue-600 hover:underline">
                    x402 API — $0.001/call
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Idle State — How it works */}
        {phase === 'idle' && !analysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StepCard
                number={1}
                title="Paste a token mint"
                desc="Any Solana SPL token on a Meteora Dynamic Bonding Curve"
              />
              <StepCard
                number={2}
                title="SDK analyzes on-chain"
                desc="Reads pool state, holder distribution, security audit via Helius + Bitget"
              />
              <StepCard
                number={3}
                title="Get graduation score"
                desc="0-100 score with velocity analysis, reasoning, and prediction"
              />
            </div>

            <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 text-center">
                This sandbox runs the exact same code as{' '}
                <code style={{ fontFamily: MONO }} className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                  trendsurfer-skill
                </code>{' '}
                on npm. Every analysis you see here can be replicated in your own agent with 3 lines of code.
              </p>
            </div>
          </motion.div>
        )}

        {/* Recent Analyses */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: phase === 'done' ? 0.4 : 0.3 }}
            className="mt-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 font-medium">
                Recent Analyses
              </h3>
              <span className="text-[10px] text-gray-300">{history.length}/{MAX_HISTORY}</span>
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {history.map((item) => {
                const scoreColor = item.score >= 75 ? 'text-emerald-600' : item.score >= 40 ? 'text-amber-600' : 'text-gray-400'
                const isActive = analysis?.mint === item.mint && phase === 'done'
                return (
                  <button
                    key={item.mint}
                    onClick={() => handleHistoryClick(item)}
                    disabled={isLoading}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-3 ${
                      isActive ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className={`text-sm font-bold ${scoreColor}`} style={{ fontFamily: MONO }}>
                        {item.score}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{item.name}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0" style={{ fontFamily: MONO }}>
                          ${item.symbol}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate" style={{ fontFamily: MONO }}>
                        {item.mint.substring(0, 16)}...{item.mint.substring(item.mint.length - 6)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-gray-400">{formatTimeAgo(item.analyzedAt)}</p>
                      {isActive && (
                        <span className="text-[9px] text-blue-500 font-medium">viewing</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}

// ── Sub-components ──

function ScoreCircle({ score }: { score: number }) {
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

function MetricCell({
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

function StepCard({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold mb-3">
        {number}
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
    </div>
  )
}
