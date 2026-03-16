'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    icon: 'X',
    title: 'Tweet Tokenized',
    desc: 'A viral tweet is minted as a tradeable token on trends.fun',
    color: 'bg-gray-900 text-white',
  },
  {
    icon: '~',
    title: 'Bonding Curve',
    desc: 'Token enters a Meteora bonding curve — price rises with demand',
    color: 'bg-warning/10 text-warning',
  },
  {
    icon: 'AI',
    title: 'TrendSurfer Scans',
    desc: 'Our skill analyzes curve velocity, security, and social signals',
    color: 'bg-brand-50 text-brand-600',
  },
  {
    icon: '%',
    title: 'AI Predicts',
    desc: 'Graduation score 0-100 with transparent reasoning for every token',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: '$',
    title: 'Graduation Profit',
    desc: 'Buy pre-graduation, sell after DEX migration for the price jump',
    color: 'bg-success/10 text-success',
  },
]

export function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold text-gray-900">How Graduation Prediction Works</h2>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          trends.fun tokens use Meteora bonding curves. When enough buy pressure fills the curve,
          the token graduates to a full DEX pool — causing a price jump. TrendSurfer predicts which tokens will graduate.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="relative"
          >
            <div className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-5 shadow-sm h-full text-center hover:shadow-md transition-shadow">
              {/* Step number */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-surface-200 text-gray-500 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </div>

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center mx-auto mb-3 font-bold text-sm`}>
                {step.icon}
              </div>

              <h3 className="font-semibold text-gray-900 text-sm">{step.title}</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{step.desc}</p>
            </div>

            {/* Connector arrow (hidden on mobile, shown between items on desktop) */}
            {i < steps.length - 1 && (
              <div className="hidden sm:block absolute top-1/2 -right-3 text-surface-300 z-10">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M2 1l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  )
}
