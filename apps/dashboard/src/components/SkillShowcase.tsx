'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const sdkCode = `import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({
  heliusApiKey: process.env.HELIUS_API_KEY,
})

// Scan for new trends.fun launches
const launches = await skill.scanLaunches()

// Predict graduation probability
const analysis = await skill.analyzeGraduation(launch)
// → { score: 87, curveProgress: 72.3,
//     velocity: 'accelerating', ... }

// Check token security via Bitget
const security = await skill.checkSecurity(mint)
// → { safe: true, honeypot: false }

// Execute a gasless trade via Bitget Wallet
const trade = await skill.executeTrade({
  tokenIn: 'SOL',
  tokenOut: tokenMint,
  amount: 0.1,
})`

const mcpTools = [
  { name: 'scan_launches', desc: 'Discover new trends.fun token launches in real-time' },
  { name: 'analyze_graduation', desc: 'Get graduation probability score (0-100) with AI reasoning' },
  { name: 'check_security', desc: 'Token safety audit — honeypot, freeze, mint authority' },
  { name: 'get_quote', desc: 'Get swap quote via Bitget Wallet (110+ DEX routes)' },
  { name: 'get_launches', desc: 'List all currently tracked token launches' },
  { name: 'refresh_launches', desc: 'Force rescan for new launches' },
]

export function SkillShowcase() {
  const [tab, setTab] = useState<'sdk' | 'mcp'>('sdk')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install trendsurfer-skill')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h2 className="text-3xl font-bold text-gray-900">Use TrendSurfer in Your Agent</h2>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          A reusable intelligence skill — not locked to our agent. Install the SDK or connect via MCP.
        </p>

        {/* npm install CTA */}
        <motion.button
          onClick={handleCopy}
          className="mt-6 inline-flex items-center gap-3 bg-gray-900 text-gray-100 px-6 py-3 rounded-xl font-mono text-sm hover:bg-gray-800 transition-colors cursor-pointer"
          whileTap={{ scale: 0.97 }}
        >
          <span className="text-gray-500">$</span>
          <span>npm install trendsurfer-skill</span>
          <span className="text-gray-500 text-xs ml-2">
            {copied ? 'Copied!' : 'Click to copy'}
          </span>
        </motion.button>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex justify-center mb-6">
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          <button
            onClick={() => setTab('sdk')}
            className={`relative px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'sdk' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'sdk' && (
              <motion.div
                layoutId="skillTab"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">TypeScript SDK</span>
          </button>
          <button
            onClick={() => setTab('mcp')}
            className={`relative px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'mcp' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'mcp' && (
              <motion.div
                layoutId="skillTab"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">MCP Server</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {tab === 'sdk' ? (
          <>
            {/* Code panel */}
            <motion.div
              key="sdk-code"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900 rounded-2xl p-6 overflow-x-auto"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-gray-500 ml-2 font-mono">your-agent.ts</span>
              </div>
              <pre className="text-sm font-mono text-gray-300 leading-relaxed whitespace-pre">
                {sdkCode.split('\n').map((line, i) => (
                  <div key={i}>
                    {line.startsWith('//') ? (
                      <span className="text-gray-600">{line}</span>
                    ) : line.startsWith('import') ? (
                      <span>
                        <span className="text-purple-400">import</span>
                        {line.slice(6)}
                      </span>
                    ) : line.startsWith('const') ? (
                      <span>
                        <span className="text-blue-400">const</span>
                        {line.slice(5)}
                      </span>
                    ) : line.startsWith('await') ? (
                      <span>
                        <span className="text-purple-400">await</span>
                        {line.slice(5)}
                      </span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))}
              </pre>
            </motion.div>

            {/* Features panel */}
            <motion.div
              key="sdk-features"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              {[
                { title: 'Graduation Prediction', desc: 'On-chain bonding curve velocity analysis with AI-powered scoring. Know which tokens will graduate before they do.', badge: 'Core' },
                { title: 'Security Audits', desc: 'Automatic honeypot detection, mint/freeze authority checks, and holder concentration analysis via Bitget.', badge: 'Safety' },
                { title: 'Gasless Trading', desc: 'Execute trades via Bitget Wallet with zero gas fees. 110+ DEX routes for best price execution.', badge: 'Trade' },
                { title: 'Real-time Scanner', desc: 'Monitor all new trends.fun launches on Solana. Detects new Meteora DBC pools within seconds.', badge: 'Live' },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-xs font-medium rounded-full">{feature.badge}</span>
                    <h3 className="font-semibold text-gray-900 text-sm">{feature.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </>
        ) : (
          <>
            {/* MCP tools list */}
            <motion.div
              key="mcp-tools"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3"
            >
              <div className="bg-gray-900 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-500 ml-2 font-mono">terminal</span>
                </div>
                <pre className="text-sm font-mono text-gray-300">
                  <span className="text-gray-500">$</span> npx trendsurfer-mcp
                </pre>
                <p className="text-xs text-gray-600 mt-2 font-mono">MCP server running on stdio...</p>
              </div>

              {mcpTools.map((tool, i) => (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl p-3 shadow-sm"
                >
                  <code className="text-sm font-mono text-brand-600 font-medium">{tool.name}</code>
                  <p className="text-xs text-gray-500 mt-0.5">{tool.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Architecture diagram */}
            <motion.div
              key="mcp-arch"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-sm"
            >
              <h3 className="font-semibold text-gray-900 mb-4">Architecture</h3>
              <div className="space-y-3 text-sm">
                {/* Skill layer */}
                <div className="border-2 border-brand-200 rounded-xl p-4 bg-brand-50/30">
                  <p className="font-bold text-brand-700 text-xs uppercase tracking-wider mb-2">TrendSurfer Skill (npm package)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['Scanner', 'Analyzer', 'Security', 'Trader', 'Meteora', 'Bitget'].map(m => (
                      <div key={m} className="bg-white rounded-lg px-2 py-1 text-xs text-center text-gray-600 font-mono">{m}</div>
                    ))}
                  </div>
                </div>

                {/* Arrow down */}
                <div className="flex justify-center text-surface-300">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Consumers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-surface-200 rounded-xl p-3 bg-white">
                    <p className="font-semibold text-xs text-gray-700">MCP Server</p>
                    <p className="text-xs text-gray-400 mt-1">Any AI agent framework</p>
                  </div>
                  <div className="border border-surface-200 rounded-xl p-3 bg-white">
                    <p className="font-semibold text-xs text-gray-700">Trading Agent</p>
                    <p className="text-xs text-gray-400 mt-1">Autonomous trader demo</p>
                  </div>
                </div>

                {/* Arrow down */}
                <div className="flex justify-center text-surface-300">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Infra */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Solana', sub: 'On-chain data' },
                    { name: 'Bitget', sub: 'Gasless trading' },
                    { name: 'CommonStack', sub: 'AI analysis' },
                  ].map(s => (
                    <div key={s.name} className="border border-surface-200 rounded-lg p-2 bg-surface-50 text-center">
                      <p className="text-xs font-semibold text-gray-700">{s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </section>
  )
}
