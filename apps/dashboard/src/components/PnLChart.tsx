'use client'

import { useState, useEffect } from 'react'
import { motion, animate } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface PnLData {
  totalPnl: number
  winRate: number
  totalTrades: number
}

interface Position {
  id: string
  mint: string
  symbol: string
  entryTimestamp: number
  realizedPnl?: number
  realizedPnlPercent?: number
  status: string
}

function AnimatedValue({ value, decimals = 2, prefix = '' }: { value: number; decimals?: number; prefix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return controls.stop
  }, [value])
  return <span>{prefix}{display.toFixed(decimals)}</span>
}

export function PnLChart() {
  const [data, setData] = useState<PnLData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/trades')
        const json = await res.json()
        setData(json.pnl)
        setPositions(json.positions || [])
      } catch {
        // API not ready
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  // Build cumulative PnL data for line chart
  const closedPositions = positions
    .filter((p) => p.status === 'closed' && p.realizedPnl != null)
    .sort((a, b) => a.entryTimestamp - b.entryTimestamp)

  let cumPnl = 0
  const chartData = closedPositions.map((p) => {
    cumPnl += p.realizedPnl || 0
    return {
      time: new Date(p.entryTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: parseFloat(cumPnl.toFixed(4)),
      symbol: p.symbol,
    }
  })

  // Add starting zero point
  if (chartData.length > 0) {
    chartData.unshift({ time: 'Start', pnl: 0, symbol: '' })
  }

  const totalPnl = data?.totalPnl ?? 0
  const winRate = data?.winRate ?? 0
  const totalTrades = data?.totalTrades ?? 0

  // Best trade
  const bestTrade = closedPositions.reduce((best, p) => {
    return (p.realizedPnlPercent || 0) > (best?.realizedPnlPercent || 0) ? p : best
  }, null as Position | null)

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Portfolio Performance</h2>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total PnL</p>
          <p className={`text-3xl font-bold mt-1 tracking-tight ${totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
            <AnimatedValue value={totalPnl} decimals={4} prefix={totalPnl >= 0 ? '+' : ''} />
            <span className="text-sm font-normal text-gray-400 ml-1">SOL</span>
          </p>
        </div>

        <div className="bg-surface-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</p>
          <p className="text-3xl font-bold mt-1 tracking-tight text-gray-900">
            <AnimatedValue value={winRate} decimals={1} />
            <span className="text-sm font-normal text-gray-400 ml-1">%</span>
          </p>
        </div>

        <div className="bg-surface-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Trades</p>
          <p className="text-3xl font-bold mt-1 tracking-tight text-gray-900">
            <AnimatedValue value={totalTrades} decimals={0} />
          </p>
        </div>

        <div className="bg-surface-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Best Trade</p>
          <p className="text-3xl font-bold mt-1 tracking-tight text-success">
            {bestTrade ? (
              <>
                +<AnimatedValue value={bestTrade.realizedPnlPercent || 0} decimals={1} />
                <span className="text-sm font-normal text-gray-400 ml-1">%</span>
              </>
            ) : (
              <span className="text-gray-300">--</span>
            )}
          </p>
          {bestTrade && (
            <p className="text-xs text-gray-400 mt-0.5">{bestTrade.symbol}</p>
          )}
        </div>
      </div>

      {/* PnL line chart */}
      {chartData.length > 1 ? (
        <motion.div
          className="h-56"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={totalPnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={totalPnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '13px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(4)} SOL`, 'Cumulative PnL']}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={totalPnl >= 0 ? '#10b981' : '#ef4444'}
                strokeWidth={2.5}
                fill="url(#pnlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      ) : (
        <div className="h-56 bg-surface-50 rounded-xl flex items-center justify-center">
          <p className="text-sm text-gray-400">PnL chart will render with closed trade data</p>
        </div>
      )}
    </div>
  )
}
