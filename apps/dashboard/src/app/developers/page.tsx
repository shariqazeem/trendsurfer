'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────────

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
const MONO_STACK = "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace"
const FADE_IN = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3 },
}

// ────────────────────────────────────────────────────────────────────────────────
// MCP Tools Data
// ────────────────────────────────────────────────────────────────────────────────

const mcpTools = [
  {
    name: 'scan_launches',
    description: 'Scan trends.fun for new token launches. Returns recently created tokens with bonding curve progress.',
    returnType: 'ScanResult',
  },
  {
    name: 'analyze_graduation',
    description: 'Analyze graduation probability for a trends.fun token. Returns 0-100 score, velocity, and reasoning.',
    returnType: 'GraduationAnalysis',
  },
  {
    name: 'check_security',
    description: 'Check token security via Bitget Wallet API. Honeypot detection, mint/freeze authority, warnings.',
    returnType: 'SecurityCheck',
  },
  {
    name: 'get_quote',
    description: 'Get a gasless swap quote for buying or selling a token via Bitget Wallet.',
    returnType: 'SwapQuote',
  },
  {
    name: 'get_launches',
    description: 'Get all currently tracked and cached token launches with latest curve data.',
    returnType: 'TokenLaunch[]',
  },
  {
    name: 'refresh_launches',
    description: 'Refresh bonding curve progress for all tracked launches from on-chain state.',
    returnType: 'TokenLaunch[]',
  },
]

// ────────────────────────────────────────────────────────────────────────────────
// SDK Methods Data
// ────────────────────────────────────────────────────────────────────────────────

const sdkMethods: { category: string; methods: { name: string; returnType: string; desc: string }[] }[] = [
  {
    category: 'Scanning',
    methods: [
      { name: 'scanLaunches(limit?)', returnType: 'Promise<ScanResult>', desc: 'Scan for new trends.fun token launches' },
      { name: 'getLaunches()', returnType: 'TokenLaunch[]', desc: 'Get all cached/known launches' },
      { name: 'refreshLaunches()', returnType: 'Promise<TokenLaunch[]>', desc: 'Refresh curve progress for all tracked launches' },
      { name: 'startPolling(callback)', returnType: 'void', desc: 'Start continuous polling for new launches' },
      { name: 'stopPolling()', returnType: 'void', desc: 'Stop continuous polling' },
    ],
  },
  {
    category: 'Analysis',
    methods: [
      { name: 'analyzeGraduation(launch)', returnType: 'Promise<GraduationAnalysis>', desc: 'Analyze graduation probability (0-100 score)' },
      { name: 'recordSnapshot(mint, progress)', returnType: 'void', desc: 'Record a velocity snapshot for accurate tracking' },
      { name: 'getVelocity(mint)', returnType: 'VelocityData', desc: 'Get bonding curve velocity data' },
      { name: 'getVelocityHistory(mint)', returnType: 'VelocitySnapshot[]', desc: 'Get full velocity history for a token' },
    ],
  },
  {
    category: 'Security',
    methods: [
      { name: 'checkSecurity(mint)', returnType: 'Promise<SecurityCheck>', desc: 'Check token safety via Bitget Wallet API' },
    ],
  },
  {
    category: 'Trading',
    methods: [
      { name: 'getQuote(params)', returnType: 'Promise<SwapQuote>', desc: 'Get a gasless swap quote via Bitget' },
      { name: 'executeTrade(params)', returnType: 'Promise<TradeExecution>', desc: 'Execute a gasless trade via Bitget Wallet' },
      { name: 'getTradeStatus(orderId)', returnType: 'Promise<OrderStatus>', desc: 'Check trade execution status' },
    ],
  },
  {
    category: 'Utility',
    methods: [
      { name: 'addPool(launch)', returnType: 'void', desc: 'Add a known pool to track' },
      { name: 'clearCache()', returnType: 'void', desc: 'Clear all cached data' },
      { name: 'destroy()', returnType: 'void', desc: 'Destroy the skill (stop polling, clean up)' },
    ],
  },
]

// ────────────────────────────────────────────────────────────────────────────────
// Stats Data
// ────────────────────────────────────────────────────────────────────────────────

const stats = [
  { value: '6', label: 'MCP Tools', desc: 'Plug into any AI agent' },
  { value: '100%', label: 'TypeScript', desc: 'Typed SDK, publishable to npm' },
  { value: 'Real-time', label: 'Analysis', desc: 'Meteora DBC curve reading' },
  { value: 'Gasless', label: 'Trading', desc: 'Zero SOL gas via Bitget' },
  { value: '3,800+', label: 'Lines of Code', desc: 'Production-ready skill' },
  { value: 'Any', label: 'Framework', desc: 'MCP is agent-agnostic' },
]

// ────────────────────────────────────────────────────────────────────────────────
// Architecture Pipeline Nodes
// ────────────────────────────────────────────────────────────────────────────────

const archNodes = [
  { label: 'Your Agent', sub: 'Claude, GPT, any LLM' },
  { label: 'TrendSurfer SDK / MCP', sub: '6 tools, TypeScript' },
  { label: 'Helius + Bitget', sub: 'On-chain data + execution' },
  { label: 'Solana', sub: 'Meteora DBC, trends.fun' },
]

// ────────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────────

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<'sdk' | 'mcp'>('sdk')
  const [copiedInstall, setCopiedInstall] = useState(false)

  const handleCopyInstall = () => {
    navigator.clipboard.writeText('npm install trendsurfer-skill')
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  return (
    <div style={{ fontFamily: FONT_STACK }} className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Navigation                                                              */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[15px] font-semibold text-gray-900 tracking-tight">
              TrendSurfer
            </Link>
            <nav className="flex bg-gray-100 rounded-lg p-0.5">
              <Link
                href="/"
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-md transition-colors"
              >
                Dashboard
              </Link>
              <span className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-white rounded-md shadow-sm">
                Developers
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span
              style={{ fontFamily: MONO_STACK }}
              className="hidden sm:inline text-[11px] text-gray-400"
            >
              npm trendsurfer-skill
            </span>
            <a
              href="https://github.com/trendsurfer/skill"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* 1. Hero Section                                                         */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <motion.section className="pt-16 pb-14" {...FADE_IN}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium text-center mb-4">
            Open Source SDK + MCP Server
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-gray-900 leading-tight text-center max-w-2xl mx-auto">
            The Intelligence Layer
            <br />
            for trends.fun
          </h1>
          <p className="text-base text-gray-500 mt-4 max-w-xl mx-auto text-center leading-relaxed">
            Give any AI agent the ability to scan token launches, predict bonding curve
            graduations, check security, and execute gasless trades.
          </p>

          {/* Install block */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleCopyInstall}
              className="group flex items-center gap-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 pl-5 pr-4 py-3 rounded-lg transition-colors"
              style={{ fontFamily: MONO_STACK }}
            >
              <span className="text-gray-400 text-sm select-none">$</span>
              <span className="text-blue-600 text-sm">npm install</span>
              <span className="text-gray-900 text-sm">trendsurfer-skill</span>
              <span className="ml-2 pl-3 border-l border-gray-300 text-gray-400 group-hover:text-gray-600 transition-colors">
                {copiedInstall ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </span>
            </button>
          </div>
        </motion.section>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* 2. Architecture Pipeline                                                */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <motion.section className="pb-16" {...FADE_IN}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium text-center mb-8">
            Architecture
          </p>

          {/* Desktop: horizontal */}
          <div className="hidden md:flex items-center justify-center">
            {archNodes.map((node, i) => (
              <div key={node.label} className="flex items-center">
                <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 min-w-[180px] text-center">
                  <p className="text-sm font-semibold text-gray-900">{node.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{node.sub}</p>
                </div>
                {i < archNodes.length - 1 && (
                  <div className="w-10 h-px bg-gray-200 mx-1 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Mobile: vertical */}
          <div className="flex md:hidden flex-col items-center">
            {archNodes.map((node, i) => (
              <div key={node.label} className="flex flex-col items-center">
                <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 w-full max-w-[260px] text-center">
                  <p className="text-sm font-semibold text-gray-900">{node.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{node.sub}</p>
                </div>
                {i < archNodes.length - 1 && (
                  <div className="w-px h-8 bg-gray-200 my-1" />
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* 3. Code Examples                                                        */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <motion.section className="pb-16" {...FADE_IN}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium text-center mb-2">
            Quick Start
          </p>
          <p className="text-center text-sm text-gray-500 mb-8">
            Import the SDK directly or connect via MCP.
          </p>

          <div className="max-w-3xl mx-auto">
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit mb-3">
              <button
                onClick={() => setActiveTab('sdk')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'sdk'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                TypeScript SDK
              </button>
              <button
                onClick={() => setActiveTab('mcp')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'mcp'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                MCP Config
              </button>
            </div>

            {/* Code block */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
                <span style={{ fontFamily: MONO_STACK }} className="text-[11px] text-gray-400">
                  {activeTab === 'sdk' ? 'agent.ts' : 'claude_desktop_config.json'}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'sdk' ? (
                  <motion.div key="sdk" {...FADE_IN}>
                    <pre
                      className="p-5 text-[13px] leading-relaxed overflow-x-auto bg-gray-50"
                      style={{ fontFamily: MONO_STACK }}
                    >
                      <code>
                        <Line><Kw>import</Kw>{' { '}<Ty>TrendSurferSkill</Ty>{' } '}<Kw>from</Kw> <St>{`'trendsurfer-skill'`}</St></Line>
                        <Line />
                        <Line><Cm>{'// Initialize with your Helius API key'}</Cm></Line>
                        <Line><Kw>const</Kw> skill = <Kw>new</Kw> <Fn>TrendSurferSkill</Fn>{'({'}</Line>
                        <Line>{'  '}<Pr>heliusApiKey</Pr>: process.env.HELIUS_API_KEY,</Line>
                        <Line>{'})'}</Line>
                        <Line />
                        <Line><Cm>{'// Scan for new trends.fun token launches'}</Cm></Line>
                        <Line><Kw>const</Kw> {'{ '}<Pr>launches</Pr>{' }'} = <Kw>await</Kw> skill.<Fn>scanLaunches</Fn>()</Line>
                        <Line />
                        <Line><Cm>{'// Analyze graduation probability for each token'}</Cm></Line>
                        <Line><Kw>for</Kw> (<Kw>const</Kw> token <Kw>of</Kw> launches) {'{'}</Line>
                        <Line>{'  '}<Kw>const</Kw> analysis = <Kw>await</Kw> skill.<Fn>analyzeGraduation</Fn>(token)</Line>
                        <Line />
                        <Line>{'  '}<Cm>{'// Score 0-100 with velocity and reasoning'}</Cm></Line>
                        <Line>{'  '}console.<Fn>log</Fn>(analysis.<Pr>score</Pr>, analysis.<Pr>velocity</Pr>)</Line>
                        <Line />
                        <Line>{'  '}<Cm>{'// Check token safety before trading'}</Cm></Line>
                        <Line>{'  '}<Kw>const</Kw> security = <Kw>await</Kw> skill.<Fn>checkSecurity</Fn>(token.<Pr>mint</Pr>)</Line>
                        <Line />
                        <Line>{'  '}<Kw>if</Kw> (analysis.<Pr>score</Pr> {'>'} <Nu>75</Nu> && security.<Pr>safe</Pr>) {'{'}</Line>
                        <Line>{'    '}<Cm>{'// Execute gasless trade via Bitget Wallet'}</Cm></Line>
                        <Line>{'    '}<Kw>const</Kw> trade = <Kw>await</Kw> skill.<Fn>executeTrade</Fn>{'({'}</Line>
                        <Line>{'      '}<Pr>tokenMint</Pr>: token.<Pr>mint</Pr>,</Line>
                        <Line>{'      '}<Pr>side</Pr>: <St>{`'buy'`}</St>,</Line>
                        <Line>{'      '}<Pr>amountSol</Pr>: <St>{`'0.1'`}</St>,</Line>
                        <Line>{'      '}<Pr>walletAddress</Pr>: myWallet,</Line>
                        <Line>{'      '}<Pr>signTransaction</Pr>: mySigner,</Line>
                        <Line>{'    '}{'}'}{')'}{'  '}</Line>
                        <Line>{'  }'}</Line>
                        <Line>{'}'}</Line>
                      </code>
                    </pre>
                  </motion.div>
                ) : (
                  <motion.div key="mcp" {...FADE_IN}>
                    <pre
                      className="p-5 text-[13px] leading-relaxed overflow-x-auto bg-gray-50"
                      style={{ fontFamily: MONO_STACK }}
                    >
                      <code>
                        <Line><Cm>{'// claude_desktop_config.json'}</Cm></Line>
                        <Line>{'{'}</Line>
                        <Line>{'  '}<Pr>{`"mcpServers"`}</Pr>: {'{'}</Line>
                        <Line>{'    '}<Pr>{`"trendsurfer"`}</Pr>: {'{'}</Line>
                        <Line>{'      '}<Pr>{`"command"`}</Pr>: <St>{`"npx"`}</St>,</Line>
                        <Line>{'      '}<Pr>{`"args"`}</Pr>: [<St>{`"trendsurfer-mcp"`}</St>],</Line>
                        <Line>{'      '}<Pr>{`"env"`}</Pr>: {'{'}</Line>
                        <Line>{'        '}<Pr>{`"HELIUS_API_KEY"`}</Pr>: <St>{`"your-key-here"`}</St></Line>
                        <Line>{'      }'}</Line>
                        <Line>{'    }'}</Line>
                        <Line>{'  }'}</Line>
                        <Line>{'}'}</Line>
                        <Line />
                        <Line><Cm>{'// Now any LLM can call these tools:'}</Cm></Line>
                        <Line><Cm>{'// scan_launches, analyze_graduation,'}</Cm></Line>
                        <Line><Cm>{'// check_security, get_quote,'}</Cm></Line>
                        <Line><Cm>{'// get_launches, refresh_launches'}</Cm></Line>
                      </code>
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* 4. MCP Tools Table                                                      */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <motion.section className="pb-16" {...FADE_IN}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium text-center mb-2">
            MCP Tools
          </p>
          <p className="text-center text-sm text-gray-500 mb-8">
            Six tools exposed via the Model Context Protocol. Plug into Claude, GPT, or any MCP-compatible agent.
          </p>

          <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[200px_1fr_120px] px-5 py-2.5 border-b border-gray-200 bg-gray-50">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Tool</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Description</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium text-right">Returns</span>
            </div>
            <div className="divide-y divide-gray-100">
              {mcpTools.map((tool) => (
                <div
                  key={tool.name}
                  className="sm:grid sm:grid-cols-[200px_1fr_120px] px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <span style={{ fontFamily: MONO_STACK }} className="text-sm font-medium text-gray-900 block sm:inline">
                    {tool.name}
                  </span>
                  <p className="text-sm text-gray-500 mt-1 sm:mt-0">{tool.description}</p>
                  <span
                    style={{ fontFamily: MONO_STACK }}
                    className="text-xs text-gray-400 mt-1 sm:mt-0 block sm:text-right"
                  >
                    {tool.returnType}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* 5. SDK Reference                                                        */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <motion.section className="pb-16" {...FADE_IN}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium text-center mb-2">
            SDK Reference
          </p>
          <p className="text-center text-sm text-gray-500 mb-8">
            The{' '}
            <code
              style={{ fontFamily: MONO_STACK }}
              className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs"
            >
              TrendSurferSkill
            </code>{' '}
            class -- every method at a glance.
          </p>

          <div className="max-w-3xl mx-auto space-y-4">
            {sdkMethods.map((group) => (
              <div key={group.category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-5 py-2.5 border-b border-gray-200 bg-gray-50">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                    {group.category}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {group.methods.map((method) => (
                    <div
                      key={method.name}
                      className="px-5 py-3 hover:bg-gray-50 transition-colors sm:flex sm:items-start sm:gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <code
                            style={{ fontFamily: MONO_STACK }}
                            className="text-sm font-medium text-gray-900"
                          >
                            {method.name}
                          </code>
                          <code
                            style={{ fontFamily: MONO_STACK }}
                            className="text-xs text-gray-400"
                          >
                            {'->'} {method.returnType}
                          </code>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{method.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* 6. Stats Grid                                                           */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <motion.section className="pb-16" {...FADE_IN}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium text-center mb-8">
            Why TrendSurfer
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
              >
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{stat.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* 7. CTA                                                                  */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <motion.section className="pb-20" {...FADE_IN}>
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
              The first intelligence skill for trends.fun
            </h3>
            <p className="text-sm text-gray-500 mt-3 max-w-md mx-auto leading-relaxed">
              Not a bot. A reusable skill. Any AI agent can predict token graduations,
              analyze bonding curves, and trade via Bitget -- all through one SDK or MCP server.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <a
                href="https://github.com/trendsurfer/skill"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View on GitHub
              </a>
              <Link
                href="/"
                className="flex items-center gap-2 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                View Live Dashboard
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </motion.section>
      </main>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Footer                                                                  */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>TrendSurfer -- The Intelligence Skill for trends.fun</span>
          <span>Built for the Solana Agent Economy Hackathon</span>
        </div>
      </footer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Syntax Highlighting Helpers (light theme)
// ────────────────────────────────────────────────────────────────────────────────

function Line({ children }: { children?: React.ReactNode }) {
  return <span className="block">{children || '\u00A0'}</span>
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-600">{children}</span>
}

function Ty({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-600 font-medium">{children}</span>
}

function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-600">{children}</span>
}

function St({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-600">{children}</span>
}

function Pr({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-700">{children}</span>
}

function Cm({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-400 italic">{children}</span>
}

function Nu({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-600">{children}</span>
}
