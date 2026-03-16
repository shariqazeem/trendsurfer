'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

interface Props {
  progress?: number
  animated?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
}

export function BondingCurve({
  progress = 0,
  animated = true,
  size = 'lg',
  showLabels = true,
}: Props) {
  const dims = size === 'lg' ? { w: 400, h: 200 } : size === 'md' ? { w: 280, h: 140 } : { w: 160, h: 80 }
  const padding = size === 'lg' ? 40 : size === 'md' ? 30 : 16

  const motionProgress = useMotionValue(0)
  const [displayProgress, setDisplayProgress] = useState(0)

  useEffect(() => {
    if (animated) {
      const controls = animate(motionProgress, progress, {
        duration: 2,
        ease: 'easeOut',
        onUpdate: (v) => setDisplayProgress(Math.round(v)),
      })
      return controls.stop
    } else {
      motionProgress.set(progress)
      setDisplayProgress(Math.round(progress))
    }
  }, [progress, animated])

  // Build curve path: y = sqrt(x) style bonding curve
  const curveW = dims.w - padding * 2
  const curveH = dims.h - padding * 2
  const points: string[] = []
  const fillPoints: string[] = []
  const steps = 50

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = padding + t * curveW
    const y = padding + curveH - Math.sqrt(t) * curveH
    points.push(`${x},${y}`)
    if (t <= progress / 100) {
      fillPoints.push(`${x},${y}`)
    }
  }

  // Close fill area
  const fillEndX = padding + (progress / 100) * curveW
  const fillEndY = padding + curveH - Math.sqrt(progress / 100) * curveH
  const fillPath = fillPoints.length > 0
    ? `M${padding},${padding + curveH} L${fillPoints.join(' L')} L${fillEndX},${padding + curveH} Z`
    : ''

  // Graduation threshold line at 85%
  const threshX = padding + 0.85 * curveW
  const threshY1 = padding
  const threshY2 = padding + curveH

  // Color based on progress
  const getColor = (p: number) => {
    if (p >= 80) return '#10b981'
    if (p >= 50) return '#0c8de9'
    if (p >= 25) return '#f59e0b'
    return '#94a3b8'
  }

  const color = getColor(progress)
  const graduated = progress >= 100

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="w-full h-auto"
        style={{ maxWidth: dims.w }}
      >
        <defs>
          <linearGradient id={`fill-${size}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padding}
            y1={padding + curveH * (1 - t)}
            x2={padding + curveW}
            y2={padding + curveH * (1 - t)}
            stroke="#e9ecef"
            strokeWidth="0.5"
          />
        ))}

        {/* Fill area */}
        {fillPath && (
          <motion.path
            d={fillPath}
            fill={`url(#fill-${size})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />
        )}

        {/* Curve line (full, gray) */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#e9ecef"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Curve line (filled portion) */}
        {fillPoints.length > 0 && (
          <motion.polyline
            points={fillPoints.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: 'easeOut' }}
          />
        )}

        {/* Graduation threshold line */}
        {showLabels && (
          <>
            <line
              x1={threshX}
              y1={threshY1}
              x2={threshX}
              y2={threshY2}
              stroke="#10b981"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
            />
            {size !== 'sm' && (
              <text
                x={threshX}
                y={threshY1 - 6}
                textAnchor="middle"
                fontSize="10"
                fill="#10b981"
                fontWeight="500"
              >
                Graduate
              </text>
            )}
          </>
        )}

        {/* Current position dot */}
        {progress > 0 && progress < 100 && (
          <motion.circle
            cx={fillEndX}
            cy={fillEndY}
            r={size === 'sm' ? 3 : 5}
            fill={color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.5, type: 'spring' }}
          >
            <animate
              attributeName="r"
              values={size === 'sm' ? '3;4;3' : '5;7;5'}
              dur="2s"
              repeatCount="indefinite"
            />
          </motion.circle>
        )}

        {/* Axes */}
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={padding + curveH}
          stroke="#dee2e6"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={padding + curveH}
          x2={padding + curveW}
          y2={padding + curveH}
          stroke="#dee2e6"
          strokeWidth="1"
        />

        {/* Labels */}
        {showLabels && size !== 'sm' && (
          <>
            <text x={padding + curveW / 2} y={dims.h - 4} textAnchor="middle" fontSize="11" fill="#9ca3af">
              Supply
            </text>
            <text x={8} y={padding + curveH / 2} textAnchor="middle" fontSize="11" fill="#9ca3af" transform={`rotate(-90, 8, ${padding + curveH / 2})`}>
              Price
            </text>
          </>
        )}
      </svg>

      {/* Graduated overlay */}
      {graduated && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5, type: 'spring', bounce: 0.4 }}
        >
          <div className="bg-success/90 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
            GRADUATED
          </div>
        </motion.div>
      )}
    </div>
  )
}
