'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

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

export function PredictionCard() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const res = await fetch('/api/predictions')
        const data = await res.json()
        setPredictions(data.predictions || [])
      } catch {
        // API might not be ready
      } finally {
        setLoading(false)
      }
    }

    fetchPredictions()
    const interval = setInterval(fetchPredictions, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-brand-400">?</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No predictions yet</h3>
        <p className="text-gray-500 mt-2">The agent will analyze tokens and show predictions here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">AI Predictions</h2>
        <span className="text-sm text-gray-500">{predictions.length} analyses</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {predictions.map((pred, i) => (
          <motion.div
            key={pred.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.03 }}
            className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
          >
            {/* Header with score ring */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{pred.name}</h3>
                  {pred.traded && (
                    <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full flex-shrink-0">
                      TRADED
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{pred.symbol}</p>
              </div>

              {/* Score ring */}
              <ScoreRing score={pred.score} />
            </div>

            {/* Prediction + velocity badges */}
            <div className="flex items-center gap-2 mb-3">
              <PredictionBadge prediction={pred.prediction} />
              <VelocityBadge velocity={pred.velocity} />
              {pred.outcome !== 'pending' && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  pred.outcome === 'graduated'
                    ? 'bg-success/10 text-success'
                    : 'bg-surface-100 text-gray-500'
                }`}>
                  {pred.outcome === 'graduated' ? 'Graduated' : 'Did not graduate'}
                </span>
              )}
            </div>

            {/* Curve progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Curve Progress</span>
                <span className="font-semibold">{pred.curveProgress.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pred.curveProgress >= 80 ? 'bg-success' : pred.curveProgress >= 50 ? 'bg-brand-400' : 'bg-warning'
                  }`}
                  style={{ width: `${Math.min(pred.curveProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* AI reasoning */}
            <div className="bg-surface-50 rounded-xl p-3 border-l-3 border-brand-300">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">AI Analysis</p>
              <p className="text-sm text-gray-700 leading-relaxed">{pred.reasoning}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
              <span className="font-mono truncate max-w-[200px]">{pred.mint}</span>
              <span>{formatTimeAgo(pred.createdAt)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const radius = 22
  const stroke = 3
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#94a3b8'

  return (
    <div className="relative flex-shrink-0">
      <svg width="54" height="54" viewBox="0 0 54 54">
        <circle cx="27" cy="27" r={radius} fill="none" stroke="#f4f5f7" strokeWidth={stroke} />
        <circle
          cx="27"
          cy="27"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 27 27)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

function PredictionBadge({ prediction }: { prediction: string }) {
  const styles: Record<string, string> = {
    will_graduate: 'bg-success/10 text-success',
    watching: 'bg-warning/10 text-warning',
    unlikely: 'bg-danger/10 text-danger',
  }
  const labels: Record<string, string> = {
    will_graduate: 'Will Graduate',
    watching: 'Watching',
    unlikely: 'Unlikely',
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[prediction] || 'bg-gray-100 text-gray-500'}`}>
      {labels[prediction] || prediction}
    </span>
  )
}

function VelocityBadge({ velocity }: { velocity: string }) {
  const styles: Record<string, string> = {
    accelerating: 'text-success',
    steady: 'text-brand-500',
    declining: 'text-warning',
    stagnant: 'text-gray-400',
  }
  const icons: Record<string, string> = {
    accelerating: '^',
    steady: '>',
    declining: 'v',
    stagnant: '-',
  }

  return (
    <span className={`text-xs font-medium ${styles[velocity] || 'text-gray-400'}`}>
      {icons[velocity]} {velocity}
    </span>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
