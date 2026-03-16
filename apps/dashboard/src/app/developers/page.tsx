'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

// ─── Animation Variants ───
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
}

// ─── MCP Tools Data ───
const mcpTools = [
  {
    name: 'scan_launches',
    description: 'Scan trends.fun for new token launches. Returns recently created tokens with their bonding curve progress.',
    params: '{ limit?: number }',
    returns: 'ScanResult',
    color: 'bg-blue-500',
  },
  {
    name: 'analyze_graduation',
    description: 'Analyze graduation probability for a trends.fun token. Returns a 0-100 score, velocity analysis, and reasoning.',
    params: '{ mint, poolAddress, name?, symbol? }',
    returns: 'GraduationAnalysis',
    color: 'bg-emerald-500',
  },
  {
    name: 'check_security',
    description: 'Check token security via Bitget Wallet API. Returns honeypot detection, mint/freeze authority, and warnings.',
    params: '{ mint }',
    returns: 'SecurityCheck',
    color: 'bg-amber-500',
  },
  {
    name: 'get_quote',
    description: 'Get a swap quote for buying or selling a token via Bitget Wallet (gasless).',
    params: '{ tokenMint, side, amount, walletAddress?, slippage? }',
    returns: 'SwapQuote',
    color: 'bg-violet-500',
  },
  {
    name: 'get_launches',
    description: 'Get all currently tracked/cached token launches with latest curve data.',
    params: '{ }',
    returns: 'TokenLaunch[]',
    color: 'bg-cyan-500',
  },
  {
    name: 'refresh_launches',
    description: 'Refresh bonding curve progress for all tracked launches from on-chain state.',
    params: '{ }',
    returns: 'TokenLaunch[]',
    color: 'bg-rose-500',
  },
]

// ─── Stats Data ───
const stats = [
  { label: 'MCP Tools', value: '6', description: 'Plug into any AI agent' },
  { label: 'TypeScript', value: '100%', description: 'Typed SDK, publishable to npm' },
  { label: 'On-Chain Analysis', value: 'Real-time', description: 'Meteora DBC curve reading' },
  { label: 'Gasless Trading', value: 'Bitget', description: 'Zero SOL gas needed' },
  { label: 'Lines of Code', value: '3,800+', description: 'Production-ready skill' },
  { label: 'Frameworks', value: 'Any', description: 'MCP is agent-agnostic' },
]

// ─── Architecture Nodes ───
const archNodes = [
  { id: 'agent', label: 'Your Agent', sub: 'Claude, GPT, any LLM', icon: 'A', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { id: 'mcp', label: 'TrendSurfer MCP', sub: '6 tools via stdio', icon: 'TS', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'data', label: 'Helius RPC + Bitget', sub: 'On-chain data + execution', icon: 'D', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'chain', label: 'Solana + trends.fun', sub: 'Meteora DBC pools', icon: 'S', color: 'bg-amber-100 text-amber-700 border-amber-200' },
]

// ─── Page ───
export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<'sdk' | 'mcp'>('sdk')
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)

  const handleCopyInstall = () => {
    navigator.clipboard.writeText('npm install trendsurfer-skill')
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-gray-900">
      {/* ─── Navigation ─── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-[11px]">TS</span>
              </div>
              <span className="font-bold text-gray-900">TrendSurfer</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-all"
              >
                Dashboard
              </Link>
              <span className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-gray-100 rounded-md">
                Developers
              </span>
            </nav>
          </div>
          <a
            href="https://github.com/trendsurfer/skill"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4">
        {/* ─── Hero Section ─── */}
        <motion.section
          className="pt-16 pb-12 text-center"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700 mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Open Source SDK + MCP Server
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight max-w-3xl mx-auto"
          >
            TrendSurfer SDK & MCP Server
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">
              The Intelligence Layer for trends.fun
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-base sm:text-lg text-gray-500 mt-5 max-w-2xl mx-auto leading-relaxed"
          >
            Give any AI agent the ability to scan token launches, predict bonding curve
            graduations, check security, and execute gasless trades on trends.fun.
          </motion.p>

          {/* ─── Install Block ─── */}
          <motion.div variants={fadeUp} custom={3} className="mt-8 flex justify-center">
            <button
              onClick={handleCopyInstall}
              className="group relative flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-white pl-5 pr-4 py-3 rounded-xl font-mono text-sm transition-all shadow-lg shadow-gray-900/10 hover:shadow-gray-900/20"
            >
              <span className="text-gray-500 select-none">$</span>
              <span className="text-emerald-400">npm install</span>
              <span className="text-white">trendsurfer-skill</span>
              <span className="ml-2 pl-3 border-l border-gray-700 text-gray-400 group-hover:text-gray-200 transition-colors">
                {copiedInstall ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </span>
            </button>
          </motion.div>
        </motion.section>

        {/* ─── Architecture Diagram ─── */}
        <motion.section
          className="pb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-8">
            Architecture
          </motion.h2>

          {/* Desktop pipeline */}
          <motion.div variants={fadeUp} custom={1} className="hidden md:flex items-center justify-center gap-0">
            {archNodes.map((node, i) => (
              <div key={node.id} className="flex items-center">
                <motion.div
                  className={`relative border rounded-2xl px-6 py-5 min-w-[200px] text-center backdrop-blur-sm bg-white/70 ${node.color}`}
                  whileHover={{ y: -4, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center text-sm font-bold ${node.color}`}>
                    {node.icon}
                  </div>
                  <p className="font-semibold text-sm">{node.label}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">{node.sub}</p>
                </motion.div>
                {i < archNodes.length - 1 && (
                  <div className="flex items-center mx-1">
                    <motion.div
                      className="w-12 h-[2px] bg-gradient-to-r from-gray-300 to-gray-200"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                    />
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="text-gray-300 -ml-0.5">
                      <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </motion.div>

          {/* Mobile pipeline (vertical) */}
          <motion.div variants={fadeUp} custom={1} className="flex md:hidden flex-col items-center gap-0">
            {archNodes.map((node, i) => (
              <div key={node.id} className="flex flex-col items-center">
                <div className={`relative border rounded-2xl px-6 py-4 w-full max-w-[280px] text-center backdrop-blur-sm bg-white/70 ${node.color}`}>
                  <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center text-sm font-bold ${node.color}`}>
                    {node.icon}
                  </div>
                  <p className="font-semibold text-sm">{node.label}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">{node.sub}</p>
                </div>
                {i < archNodes.length - 1 && (
                  <div className="flex flex-col items-center my-1">
                    <div className="w-[2px] h-8 bg-gradient-to-b from-gray-300 to-gray-200" />
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="text-gray-300 -mt-0.5">
                      <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </motion.section>

        {/* ─── Code Snippets (Tabbed) ─── */}
        <motion.section
          className="pb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-2">
            Quick Start
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-center text-gray-600 text-sm mb-8">
            Import the SDK directly or connect via MCP -- your choice.
          </motion.p>

          <motion.div variants={fadeUp} custom={2} className="max-w-3xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-0 w-fit">
              <button
                onClick={() => setActiveTab('sdk')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'sdk'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                TypeScript SDK
              </button>
              <button
                onClick={() => setActiveTab('mcp')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'mcp'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                MCP Server
              </button>
            </div>

            {/* Code panel */}
            <div className="bg-gray-900 rounded-2xl rounded-tl-none overflow-hidden shadow-xl shadow-gray-900/10">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-[11px] text-gray-500 font-mono">
                  {activeTab === 'sdk' ? 'agent.ts' : 'mcp-config.json'}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'sdk' ? (
                  <motion.div
                    key="sdk"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto">
                      <code>
                        <Line><Kw>import</Kw> {'{'} <Ty>TrendSurferSkill</Ty> {'}'} <Kw>from</Kw> <St>{`'trendsurfer-skill'`}</St></Line>
                        <Line />
                        <Line><Cm>{'// Initialize with your Helius API key'}</Cm></Line>
                        <Line><Kw>const</Kw> <Vr>skill</Vr> = <Kw>new</Kw> <Fn>TrendSurferSkill</Fn>({'{'}
                        </Line>
                        <Line>  <Pr>heliusApiKey</Pr>: process.env.<Vr>HELIUS_API_KEY</Vr>,</Line>
                        <Line>{'}'})</Line>
                        <Line />
                        <Line><Cm>{'// Scan for new trends.fun token launches'}</Cm></Line>
                        <Line><Kw>const</Kw> {'{'} <Vr>launches</Vr> {'}'} = <Kw>await</Kw> <Vr>skill</Vr>.<Fn>scanLaunches</Fn>()</Line>
                        <Line />
                        <Line><Cm>{'// Analyze graduation probability for each token'}</Cm></Line>
                        <Line><Kw>for</Kw> (<Kw>const</Kw> <Vr>token</Vr> <Kw>of</Kw> <Vr>launches</Vr>) {'{'}</Line>
                        <Line>  <Kw>const</Kw> <Vr>analysis</Vr> = <Kw>await</Kw> <Vr>skill</Vr>.<Fn>analyzeGraduation</Fn>(<Vr>token</Vr>)</Line>
                        <Line />
                        <Line>  <Cm>{'// Score 0-100 with velocity and reasoning'}</Cm></Line>
                        <Line>  console.<Fn>log</Fn>(<Vr>analysis</Vr>.<Pr>score</Pr>, <Vr>analysis</Vr>.<Pr>velocity</Pr>)</Line>
                        <Line />
                        <Line>  <Cm>{'// Check token safety before trading'}</Cm></Line>
                        <Line>  <Kw>const</Kw> <Vr>security</Vr> = <Kw>await</Kw> <Vr>skill</Vr>.<Fn>checkSecurity</Fn>(<Vr>token</Vr>.<Pr>mint</Pr>)</Line>
                        <Line />
                        <Line>  <Kw>if</Kw> (<Vr>analysis</Vr>.<Pr>score</Pr> {'>'} <Nu>75</Nu> && <Vr>security</Vr>.<Pr>safe</Pr>) {'{'}</Line>
                        <Line>    <Cm>{'// Execute gasless trade via Bitget Wallet'}</Cm></Line>
                        <Line>    <Kw>const</Kw> <Vr>trade</Vr> = <Kw>await</Kw> <Vr>skill</Vr>.<Fn>executeTrade</Fn>({'{'}
                        </Line>
                        <Line>      <Pr>tokenMint</Pr>: <Vr>token</Vr>.<Pr>mint</Pr>,</Line>
                        <Line>      <Pr>side</Pr>: <St>{`'buy'`}</St>,</Line>
                        <Line>      <Pr>amountSol</Pr>: <St>{`'0.1'`}</St>,</Line>
                        <Line>      <Pr>walletAddress</Pr>: <Vr>myWallet</Vr>,</Line>
                        <Line>      <Pr>signTransaction</Pr>: <Vr>mySigner</Vr>,</Line>
                        <Line>    {'}'})</Line>
                        <Line>  {'}'}</Line>
                        <Line>{'}'}</Line>
                      </code>
                    </pre>
                  </motion.div>
                ) : (
                  <motion.div
                    key="mcp"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto">
                      <code>
                        <Line><Cm>{'// claude_desktop_config.json'}</Cm></Line>
                        <Line>{'{'}</Line>
                        <Line>  <Pr>{`"mcpServers"`}</Pr>: {'{'}</Line>
                        <Line>    <Pr>{`"trendsurfer"`}</Pr>: {'{'}</Line>
                        <Line>      <Pr>{`"command"`}</Pr>: <St>{`"npx"`}</St>,</Line>
                        <Line>      <Pr>{`"args"`}</Pr>: [<St>{`"trendsurfer-mcp"`}</St>],</Line>
                        <Line>      <Pr>{`"env"`}</Pr>: {'{'}</Line>
                        <Line>        <Pr>{`"HELIUS_API_KEY"`}</Pr>: <St>{`"your-key-here"`}</St></Line>
                        <Line>      {'}'}</Line>
                        <Line>    {'}'}</Line>
                        <Line>  {'}'}</Line>
                        <Line>{'}'}</Line>
                        <Line />
                        <Line><Cm>{'// Now any LLM can call these tools:'}</Cm></Line>
                        <Line><Cm>{'// - scan_launches      Discover new tokens'}</Cm></Line>
                        <Line><Cm>{'// - analyze_graduation  Predict if a token will graduate'}</Cm></Line>
                        <Line><Cm>{'// - check_security      Verify token safety'}</Cm></Line>
                        <Line><Cm>{'// - get_quote           Get swap pricing'}</Cm></Line>
                        <Line><Cm>{'// - get_launches        List tracked tokens'}</Cm></Line>
                        <Line><Cm>{'// - refresh_launches    Update curve data'}</Cm></Line>
                        <Line />
                        <Line><Cm>{'// Example: Claude Desktop can now say'}</Cm></Line>
                        <Line><Cm>{`// "Scan trends.fun for new launches and analyze`}</Cm></Line>
                        <Line><Cm>{`//  which ones are likely to graduate"`}</Cm></Line>
                      </code>
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.section>

        {/* ─── MCP Tools List ─── */}
        <motion.section
          className="pb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-2">
            MCP Tools
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-center text-gray-600 text-sm mb-8">
            Six tools exposed via the Model Context Protocol. Plug into Claude, GPT, or any MCP-compatible agent.
          </motion.p>

          <motion.div variants={fadeUp} custom={2} className="max-w-3xl mx-auto space-y-2">
            {mcpTools.map((tool, i) => (
              <motion.div
                key={tool.name}
                variants={fadeUp}
                custom={3 + i}
                onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
                className="group bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${tool.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-gray-900">{tool.name}</span>
                      <span className="text-[10px] font-mono text-gray-400 hidden sm:inline">{tool.params}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{tool.description}</p>

                    <AnimatePresence>
                      {expandedTool === tool.name && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs">
                            <span className="text-gray-400">Parameters:</span>
                            <code className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{tool.params}</code>
                            <span className="text-gray-400">Returns:</span>
                            <code className="font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{tool.returns}</code>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-gray-300 group-hover:text-gray-500 transition-all mt-1.5 flex-shrink-0 ${expandedTool === tool.name ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ─── Stats / Features Grid ─── */}
        <motion.section
          className="pb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-8">
            Why TrendSurfer
          </motion.h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                custom={1 + i}
                className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                whileHover={{ y: -2 }}
              >
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">{stat.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ─── SDK Class Reference ─── */}
        <motion.section
          className="pb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-2">
            SDK Reference
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-center text-gray-600 text-sm mb-8">
            The <code className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">TrendSurferSkill</code> class -- every method at a glance.
          </motion.p>

          <motion.div variants={fadeUp} custom={2} className="max-w-3xl mx-auto bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              <MethodRow
                category="Scanning"
                name="scanLaunches(limit?)"
                returnType="Promise<ScanResult>"
                desc="Scan for new trends.fun token launches"
              />
              <MethodRow
                category="Scanning"
                name="getLaunches()"
                returnType="TokenLaunch[]"
                desc="Get all cached/known launches"
              />
              <MethodRow
                category="Scanning"
                name="refreshLaunches()"
                returnType="Promise<TokenLaunch[]>"
                desc="Refresh curve progress for all tracked launches"
              />
              <MethodRow
                category="Scanning"
                name="startPolling(callback)"
                returnType="void"
                desc="Start continuous polling for new launches"
              />
              <MethodRow
                category="Analysis"
                name="analyzeGraduation(launch)"
                returnType="Promise<GraduationAnalysis>"
                desc="Analyze graduation probability (0-100 score)"
              />
              <MethodRow
                category="Analysis"
                name="getVelocity(mint)"
                returnType="VelocityData"
                desc="Get bonding curve velocity data"
              />
              <MethodRow
                category="Security"
                name="checkSecurity(mint)"
                returnType="Promise<SecurityCheck>"
                desc="Check token safety via Bitget Wallet API"
              />
              <MethodRow
                category="Trading"
                name="getQuote(params)"
                returnType="Promise<SwapQuote>"
                desc="Get a gasless swap quote via Bitget"
              />
              <MethodRow
                category="Trading"
                name="executeTrade(params)"
                returnType="Promise<TradeExecution>"
                desc="Execute a gasless trade via Bitget Wallet"
              />
              <MethodRow
                category="Trading"
                name="getTradeStatus(orderId)"
                returnType="Promise<OrderStatus>"
                desc="Check trade execution status"
              />
            </div>
          </motion.div>
        </motion.section>

        {/* ─── CTA / How It Works ─── */}
        <motion.section
          className="pb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            className="max-w-3xl mx-auto bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl p-8 sm:p-12 text-center text-white relative overflow-hidden"
          >
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />

            <div className="relative">
              <h3 className="text-2xl sm:text-3xl font-bold">
                The first intelligence skill for trends.fun
              </h3>
              <p className="text-white/80 mt-3 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                Not a bot. A reusable skill. Any AI agent can predict token graduations,
                analyze bonding curves, and trade via Bitget -- all through one SDK or MCP server.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                <a
                  href="https://github.com/trendsurfer/skill"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-all shadow-lg"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  View on GitHub
                </a>
                <Link
                  href="/"
                  className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/30 transition-all border border-white/30"
                >
                  View Live Dashboard
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-[1200px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-[8px]">TS</span>
            </div>
            <span>TrendSurfer -- The Intelligence Skill for trends.fun</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built for the Solana Agent Economy Hackathon</span>
            <span className="text-gray-300">|</span>
            <span>Powered by Helius + Bitget Wallet + Meteora DBC</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Syntax Highlighting Helper Components ───
// Manual coloring via spans -- no external library needed

function Line({ children }: { children?: React.ReactNode }) {
  return <span className="block">{children || '\u00A0'}</span>
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-purple-400">{children}</span>
}

function Ty({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-300">{children}</span>
}

function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-400">{children}</span>
}

function St({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-400">{children}</span>
}

function Vr({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-200">{children}</span>
}

function Pr({ children }: { children: React.ReactNode }) {
  return <span className="text-sky-300">{children}</span>
}

function Cm({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-500 italic">{children}</span>
}

function Nu({ children }: { children: React.ReactNode }) {
  return <span className="text-orange-400">{children}</span>
}

// ─── Method Row for SDK Reference ───
function MethodRow({
  category,
  name,
  returnType,
  desc,
}: {
  category: string
  name: string
  returnType: string
  desc: string
}) {
  const categoryColors: Record<string, string> = {
    Scanning: 'bg-blue-50 text-blue-600',
    Analysis: 'bg-emerald-50 text-emerald-600',
    Security: 'bg-amber-50 text-amber-600',
    Trading: 'bg-violet-50 text-violet-600',
  }

  return (
    <div className="px-5 py-3.5 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded mt-0.5 flex-shrink-0 ${categoryColors[category] || 'bg-gray-100 text-gray-500'}`}>
        {category}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <code className="font-mono text-sm font-semibold text-gray-900">{name}</code>
          <code className="font-mono text-xs text-gray-400">{'->'} {returnType}</code>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
