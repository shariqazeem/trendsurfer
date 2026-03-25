'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface LogEntry {
  id: number
  timestamp: number
  level: string
  message: string
  data?: string
}

export function AgentLog() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/agent')
        const data = await res.json()
        setLogs(data.logs || [])
      } catch {
        // API not ready
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
    const interval = setInterval(fetchLogs, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const displayLogs = expanded ? logs : logs.slice(0, 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Agent Log</h2>
        <span className="text-sm text-gray-500">{logs.length} entries</span>
      </div>

      <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl overflow-hidden shadow-sm">
        <div className={`${expanded ? '' : 'max-h-[500px]'} overflow-y-auto`}>
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No log entries yet. Start the agent to see activity.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100/50">
              {displayLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="px-4 py-3 hover:bg-surface-50/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <LevelBadge level={log.level} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{log.message}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{formatTime(log.timestamp)}</span>
                      </div>
                      {log.data && (
                        <pre className="text-xs text-gray-500 mt-1 font-mono overflow-x-auto bg-surface-50 rounded-lg p-2 mt-1.5">
                          {formatData(log.data)}
                        </pre>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {logs.length > 20 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-3 text-sm font-medium text-brand-600 hover:bg-surface-50 transition-colors border-t border-surface-100"
          >
            {expanded ? 'Show less' : `Show all ${logs.length} entries`}
          </button>
        )}
      </div>
    </div>
  )
}

function LevelBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    info: { bg: 'bg-brand-50', text: 'text-brand-600', label: 'INFO' },
    trade: { bg: 'bg-success/10', text: 'text-success', label: 'TRADE' },
    warn: { bg: 'bg-warning/10', text: 'text-warning', label: 'WARN' },
    error: { bg: 'bg-danger/10', text: 'text-danger', label: 'ERR' },
  }

  const c = config[level] || { bg: 'bg-gray-100', text: 'text-gray-500', label: level.toUpperCase() }

  return (
    <span className={`${c.bg} ${c.text} px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 uppercase tracking-wider`}>
      {c.label}
    </span>
  )
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatData(data: string): string {
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}
