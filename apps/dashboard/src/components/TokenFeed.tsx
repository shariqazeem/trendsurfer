'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface TokenLaunch {
  mint: string
  name: string
  symbol: string
  createdAt: number
  curveProgress: number
  graduated: boolean
  score?: number
  velocity?: string
  prediction?: string
}

export function TokenFeed() {
  const [launches, setLaunches] = useState<TokenLaunch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLaunches = async () => {
      try {
        const res = await fetch('/api/predictions')
        const data = await res.json()
        setLaunches(data.launches || [])
      } catch {
        // API might not be ready
      } finally {
        setLoading(false)
      }
    }

    fetchLaunches()
    const interval = setInterval(fetchLaunches, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (launches.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-brand-400">~</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No launches detected yet</h3>
        <p className="text-gray-500 mt-2">Start the agent to begin scanning trends.fun for new token launches.</p>
        <code className="mt-4 inline-block bg-gray-900 text-gray-300 px-4 py-2 rounded-lg text-sm font-mono">
          npm run agent
        </code>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Live Scanner</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-gray-500">{launches.length} tokens tracked</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {launches.map((launch, i) => (
          <motion.div
            key={launch.mint}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <span className="font-bold text-brand-600 text-sm">
                    {launch.symbol?.slice(0, 2) || '??'}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{launch.name}</h3>
                  <p className="text-xs text-gray-500">{launch.symbol}</p>
                </div>
              </div>

              {/* Score badge */}
              {launch.score != null && (
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    launch.score >= 75
                      ? 'bg-success/10 text-success'
                      : launch.score >= 50
                        ? 'bg-warning/10 text-warning'
                        : 'bg-surface-100 text-gray-500'
                  }`}
                >
                  {launch.score}
                </div>
              )}
            </div>

            {/* Bonding curve progress */}
            <div className="mb-2">
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    launch.curveProgress >= 90
                      ? 'bg-success'
                      : launch.curveProgress >= 60
                        ? 'bg-brand-400'
                        : launch.curveProgress >= 30
                          ? 'bg-warning'
                          : 'bg-surface-300'
                  }`}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.min(launch.curveProgress, 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {launch.curveProgress >= 90 && !launch.graduated && (
                  <span className="px-2 py-0.5 bg-success/10 text-success text-[10px] font-bold rounded-full animate-pulse">
                    GRADUATING
                  </span>
                )}
                {launch.graduated && (
                  <span className="px-2 py-0.5 bg-success/10 text-success text-[10px] font-bold rounded-full">
                    GRADUATED
                  </span>
                )}
                {launch.velocity && (
                  <span
                    className={`text-[10px] font-medium ${
                      launch.velocity === 'accelerating' ? 'text-success'
                        : launch.velocity === 'steady' ? 'text-brand-500'
                        : launch.velocity === 'declining' ? 'text-warning'
                        : 'text-gray-400'
                    }`}
                  >
                    {launch.velocity === 'accelerating' ? '^ ' : launch.velocity === 'steady' ? '> ' : launch.velocity === 'declining' ? 'v ' : '  '}
                    {launch.velocity}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-gray-900">
                {launch.curveProgress.toFixed(1)}%
              </span>
            </div>

            <p className="text-[10px] font-mono text-gray-400 mt-2 truncate">{launch.mint}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{formatTimeAgo(launch.createdAt)}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
