'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Position {
  id: string
  mint: string
  symbol: string
  entryPrice: number
  entryAmount: string
  entryTimestamp: number
  currentPrice?: number
  exitPrice?: number
  exitTimestamp?: number
  realizedPnl?: number
  realizedPnlPercent?: number
  status: string
  graduationScore: number
  reasoning: string
}

export function TradeHistory() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await fetch('/api/trades')
        const data = await res.json()
        setPositions(data.positions || [])
      } catch {
        // API not ready
      } finally {
        setLoading(false)
      }
    }

    fetchTrades()
    const interval = setInterval(fetchTrades, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-gray-400">$</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No trades yet</h3>
        <p className="text-gray-500 mt-2">Trades will appear here once the agent starts executing.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Trade History</h2>

      {/* Cards for mobile, table for desktop */}
      <div className="hidden md:block bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-50/50 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Token</th>
              <th className="px-4 py-3 text-right">Entry</th>
              <th className="px-4 py-3 text-right">Size</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">PnL</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {positions.map((pos, i) => (
              <motion.tr
                key={pos.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="hover:bg-surface-50/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="font-semibold text-gray-900">{pos.symbol}</span>
                  <p className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{pos.mint}</p>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 font-mono">
                  {pos.entryPrice?.toFixed(8)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">
                  {pos.entryAmount} SOL
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`text-sm font-bold ${
                      pos.graduationScore >= 75 ? 'text-success' : pos.graduationScore >= 50 ? 'text-warning' : 'text-gray-500'
                    }`}
                  >
                    {pos.graduationScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {pos.realizedPnlPercent != null ? (
                    <span className={`text-sm font-bold ${pos.realizedPnlPercent >= 0 ? 'text-success' : 'text-danger'}`}>
                      {pos.realizedPnlPercent >= 0 ? '+' : ''}{pos.realizedPnlPercent.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      pos.status === 'open' ? 'bg-brand-50 text-brand-600'
                        : pos.status === 'closed' ? 'bg-surface-100 text-gray-600'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {pos.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {positions.map((pos, i) => (
          <motion.div
            key={pos.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-semibold text-gray-900">{pos.symbol}</span>
                <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                  pos.status === 'open' ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-gray-600'
                }`}>{pos.status}</span>
              </div>
              {pos.realizedPnlPercent != null ? (
                <span className={`font-bold ${pos.realizedPnlPercent >= 0 ? 'text-success' : 'text-danger'}`}>
                  {pos.realizedPnlPercent >= 0 ? '+' : ''}{pos.realizedPnlPercent.toFixed(1)}%
                </span>
              ) : (
                <span className="text-gray-400">--</span>
              )}
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{pos.entryAmount} SOL @ {pos.entryPrice?.toFixed(8)}</span>
              <span>Score: {pos.graduationScore}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
