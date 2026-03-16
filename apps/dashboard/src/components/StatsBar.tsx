'use client'

import { motion } from 'framer-motion'

interface Props {
  status: any | null
}

export function StatsBar({ status }: Props) {
  const stats = [
    {
      label: 'Tokens Scanned',
      value: status?.tokensScanned ?? 0,
      format: 'number',
    },
    {
      label: 'Analyzed',
      value: status?.tokensAnalyzed ?? 0,
      format: 'number',
    },
    {
      label: 'Active Positions',
      value: status?.activePositions ?? 0,
      format: 'number',
    },
    {
      label: 'Total Trades',
      value: status?.totalTrades ?? 0,
      format: 'number',
    },
    {
      label: 'Win Rate',
      value: status?.winRate ?? 0,
      format: 'percent',
    },
    {
      label: 'Total PnL',
      value: status?.totalPnl ?? 0,
      format: 'sol',
    },
  ]

  return (
    <div className="bg-white border-b border-surface-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="text-center"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {stat.label}
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  stat.format === 'sol'
                    ? stat.value >= 0
                      ? 'text-success'
                      : 'text-danger'
                    : 'text-gray-900'
                }`}
              >
                {stat.format === 'percent'
                  ? `${stat.value.toFixed(1)}%`
                  : stat.format === 'sol'
                    ? `${stat.value >= 0 ? '+' : ''}${stat.value.toFixed(4)} SOL`
                    : stat.value.toLocaleString()}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
