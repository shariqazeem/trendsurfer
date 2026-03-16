'use client'

import { useEffect, useState } from 'react'
import { motion, animate } from 'framer-motion'
import { BondingCurve } from './BondingCurve'

interface Props {
  status: any | null
}

function AnimatedCounter({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 2,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return controls.stop
  }, [value])

  return (
    <span>
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}
      {suffix}
    </span>
  )
}

export function HeroSection({ status }: Props) {
  const [curveProgress, setCurveProgress] = useState(0)

  // Animate the hero bonding curve from 0 to ~78%
  useEffect(() => {
    const timer = setTimeout(() => setCurveProgress(78), 500)
    return () => clearTimeout(timer)
  }, [])

  const stats = [
    { label: 'Tokens Scanned', value: status?.tokensScanned ?? 0 },
    { label: 'Predictions Made', value: status?.tokensAnalyzed ?? 0 },
    { label: 'Win Rate', value: status?.winRate ?? 0, decimals: 1, suffix: '%' },
    { label: 'Total PnL', value: status?.totalPnl ?? 0, decimals: 4, suffix: ' SOL', isPnl: true },
  ]

  return (
    <section className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 via-white to-surface-50" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-100/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text content */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Agent status */}
              <div className="flex items-center gap-2 mb-6">
                <div
                  className={`w-2 h-2 rounded-full ${
                    status?.running ? 'bg-success animate-pulse' : 'bg-gray-300'
                  }`}
                />
                <span className="text-sm font-medium text-gray-500">
                  {status?.running ? 'Agent Running' : 'Agent Offline'}
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
                Trend
                <span className="text-brand-500">Surfer</span>
              </h1>
              <p className="mt-4 text-xl text-gray-600 leading-relaxed max-w-lg">
                The intelligence skill for{' '}
                <span className="font-semibold text-gray-900">trends.fun</span>.
                Graduation prediction, bonding curve analysis, and trade execution
                for any AI agent.
              </p>

              {/* npm install */}
              <motion.div
                className="mt-6 inline-flex items-center gap-3 bg-gray-900 text-gray-100 px-5 py-3 rounded-xl font-mono text-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="text-gray-500">$</span>
                <span>npm install trendsurfer-skill</span>
              </motion.div>
            </motion.div>

            {/* Live stat counters */}
            <motion.div
              className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {stats.map((stat) => (
                <div key={stat.label} className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p
                    className={`text-2xl font-bold mt-1 tracking-tight ${
                      stat.isPnl
                        ? (stat.value ?? 0) >= 0 ? 'text-success' : 'text-danger'
                        : 'text-gray-900'
                    }`}
                  >
                    {stat.isPnl && (stat.value ?? 0) >= 0 ? '+' : ''}
                    <AnimatedCounter value={stat.value ?? 0} decimals={stat.decimals} suffix={stat.suffix} />
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Animated bonding curve */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-sm w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Bonding Curve</h3>
                  <p className="text-xs text-gray-500">Live graduation tracking</p>
                </div>
                <div className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-sm font-bold">
                  {curveProgress}%
                </div>
              </div>
              <BondingCurve progress={curveProgress} animated={true} size="lg" />
              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <span>Meteora Dynamic Bonding Curve</span>
                <span className="font-mono">trends.fun</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
