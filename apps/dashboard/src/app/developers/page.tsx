'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────────

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif"
const MONO_STACK = "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Roboto Mono', monospace"
const SECTION_FADE = {
  initial: { opacity: 0, y: 8 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.35, ease: 'easeOut' },
}

// ────────────────────────────────────────────────────────────────────────────────
// Sidebar Navigation Data
// ────────────────────────────────────────────────────────────────────────────────

interface NavItem {
  id: string
  label: string
  children?: { id: string; label: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'installation', label: 'Installation' },
  {
    id: 'sdk-reference',
    label: 'SDK Reference',
    children: [
      { id: 'sdk-scanning', label: 'Scanning' },
      { id: 'sdk-analysis', label: 'Analysis' },
      { id: 'sdk-security', label: 'Security' },
      { id: 'sdk-trading', label: 'Trading' },
      { id: 'sdk-utility', label: 'Utility' },
    ],
  },
  { id: 'mcp-server', label: 'MCP Server' },
  { id: 'x402-api', label: 'x402 API' },
  { id: 'architecture', label: 'Architecture' },
]

// ────────────────────────────────────────────────────────────────────────────────
// MCP Tools Data
// ────────────────────────────────────────────────────────────────────────────────

const mcpTools = [
  {
    name: 'analyze_by_mint',
    description: 'Analyze any token by mint address. Finds pool, checks graduation + security. The main tool.',
    returnType: '{ graduation, security, token }',
  },
  {
    name: 'scan_launches',
    description: 'Scan trends.fun for new token launches with bonding curve progress.',
    returnType: 'ScanResult',
  },
  {
    name: 'analyze_graduation',
    description: 'Full graduation analysis (requires poolAddress). Use analyze_by_mint if you only have a mint.',
    returnType: 'GraduationAnalysis',
  },
  {
    name: 'check_security',
    description: 'Check token security (honeypot, mint/freeze authority).',
    returnType: 'SecurityCheck',
  },
  {
    name: 'get_quote',
    description: 'Get a swap quote for a token on Meteora DBC.',
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

interface SDKMethod {
  name: string
  signature: string
  returnType: string
  desc: string
  example: string
}

interface SDKCategory {
  id: string
  category: string
  methods: SDKMethod[]
}

const sdkCategories: SDKCategory[] = [
  {
    id: 'sdk-scanning',
    category: 'Scanning',
    methods: [
      {
        name: 'scanLaunches',
        signature: 'scanLaunches(limit?: number)',
        returnType: 'Promise<ScanResult>',
        desc: 'Scan for new trends.fun token launches. Returns recently created tokens with bonding curve progress.',
        example: `const { launches } = await skill.scanLaunches(10)`,
      },
      {
        name: 'getLaunches',
        signature: 'getLaunches()',
        returnType: 'TokenLaunch[]',
        desc: 'Get all cached/known launches from memory. No network call.',
        example: `const launches = skill.getLaunches()`,
      },
      {
        name: 'refreshLaunches',
        signature: 'refreshLaunches()',
        returnType: 'Promise<TokenLaunch[]>',
        desc: 'Refresh bonding curve progress for all tracked launches from on-chain state.',
        example: `const updated = await skill.refreshLaunches()`,
      },
      {
        name: 'startPolling',
        signature: 'startPolling(callback: (launches: TokenLaunch[]) => void)',
        returnType: 'void',
        desc: 'Start continuous polling for new launches. Calls your callback whenever new tokens are detected.',
        example: `skill.startPolling((launches) => {
  console.log('New launches:', launches.length)
})`,
      },
      {
        name: 'stopPolling',
        signature: 'stopPolling()',
        returnType: 'void',
        desc: 'Stop the continuous polling loop.',
        example: `skill.stopPolling()`,
      },
    ],
  },
  {
    id: 'sdk-analysis',
    category: 'Analysis',
    methods: [
      {
        name: 'analyzeByMint',
        signature: 'analyzeByMint(mint: string)',
        returnType: 'Promise<{ graduation, security, token }>',
        desc: 'One-shot analysis from just a mint address. Finds the Meteora DBC pool, gets metadata, runs graduation + security analysis. The easiest way to analyze any token.',
        example: `const { graduation, security, token } = await skill.analyzeByMint(mint)
// graduation.score → 87, security.safe → true`,
      },
      {
        name: 'analyzeGraduation',
        signature: 'analyzeGraduation(launch: TokenLaunch)',
        returnType: 'Promise<GraduationAnalysis>',
        desc: 'Full graduation analysis for a token launch object. Use analyzeByMint() if you only have a mint address.',
        example: `const analysis = await skill.analyzeGraduation(token)
// { score: 87, velocity: 'accelerating', reasoning: '...' }`,
      },
      {
        name: 'recordSnapshot',
        signature: 'recordSnapshot(mint: string, progress: number)',
        returnType: 'void',
        desc: 'Record a velocity snapshot for more accurate tracking over time.',
        example: `skill.recordSnapshot(token.mint, 45.2)`,
      },
      {
        name: 'getVelocity',
        signature: 'getVelocity(mint: string)',
        returnType: 'VelocityData',
        desc: 'Get current bonding curve velocity data for a specific token.',
        example: `const velocity = skill.getVelocity(mint)`,
      },
      {
        name: 'getVelocityHistory',
        signature: 'getVelocityHistory(mint: string)',
        returnType: 'VelocitySnapshot[]',
        desc: 'Get the full velocity history for a token. Useful for charting curve progression.',
        example: `const history = skill.getVelocityHistory(mint)`,
      },
    ],
  },
  {
    id: 'sdk-security',
    category: 'Security',
    methods: [
      {
        name: 'checkSecurity',
        signature: 'checkSecurity(mint: string)',
        returnType: 'Promise<SecurityCheck>',
        desc: 'Check token safety on-chain. Detects honeypots, mint/freeze authority, and other warnings.',
        example: `const security = await skill.checkSecurity(mint)
if (security.safe) { /* proceed */ }`,
      },
    ],
  },
  {
    id: 'sdk-trading',
    category: 'Trading',
    methods: [
      {
        name: 'getQuote',
        signature: 'getQuote(params: QuoteParams)',
        returnType: 'Promise<SwapQuote>',
        desc: 'Get a swap quote for buying or selling a token on Meteora DBC.',
        example: `const quote = await skill.getQuote({
  tokenMint: mint,
  side: 'buy',
  amountSol: '0.1',
})`,
      },
      {
        name: 'executeTrade',
        signature: 'executeTrade(params: TradeParams)',
        returnType: 'Promise<TradeExecution>',
        desc: 'Execute a trade on Meteora DBC. Handles quote, confirm, sign, and send.',
        example: `const trade = await skill.executeTrade({
  tokenMint: mint,
  side: 'buy',
  amountSol: '0.1',
  walletAddress: myWallet,
  signTransaction: mySigner,
})`,
      },
      {
        name: 'getTradeStatus',
        signature: 'getTradeStatus(orderId: string)',
        returnType: 'Promise<OrderStatus>',
        desc: 'Check the execution status of a previously submitted trade.',
        example: `const status = await skill.getTradeStatus(trade.orderId)`,
      },
    ],
  },
  {
    id: 'sdk-utility',
    category: 'Utility',
    methods: [
      {
        name: 'addPool',
        signature: 'addPool(launch: TokenLaunch)',
        returnType: 'void',
        desc: 'Manually add a known pool to the tracking list.',
        example: `skill.addPool({ mint: '...', pool: '...' })`,
      },
      {
        name: 'clearCache',
        signature: 'clearCache()',
        returnType: 'void',
        desc: 'Clear all cached launch and velocity data.',
        example: `skill.clearCache()`,
      },
      {
        name: 'destroy',
        signature: 'destroy()',
        returnType: 'void',
        desc: 'Destroy the skill instance. Stops polling and cleans up all resources.',
        example: `skill.destroy()`,
      },
    ],
  },
]

// ────────────────────────────────────────────────────────────────────────────────
// Copy Button Component
// ────────────────────────────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-gray-400 hover:text-gray-600 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Code Block Component
// ────────────────────────────────────────────────────────────────────────────────

function CodeBlock({
  code,
  filename,
  badge,
}: {
  code: string
  filename?: string
  badge?: string
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
          <span style={{ fontFamily: MONO_STACK }} className="text-[11px] text-gray-400">
            {filename}
          </span>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                {badge}
              </span>
            )}
            <CopyButton text={code} />
          </div>
        </div>
      )}
      <pre
        className="p-4 text-[13px] leading-relaxed overflow-x-auto bg-gray-50"
        style={{ fontFamily: MONO_STACK }}
      >
        <code className="text-gray-800">{code}</code>
      </pre>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Inline Code Component
// ────────────────────────────────────────────────────────────────────────────────

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{ fontFamily: MONO_STACK }}
      className="text-[13px] text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200"
    >
      {children}
    </code>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Method Card Component
// ────────────────────────────────────────────────────────────────────────────────

function MethodCard({ method }: { method: SDKMethod }) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <code
            style={{ fontFamily: MONO_STACK }}
            className="text-[13px] font-semibold text-gray-900"
          >
            {method.signature}
          </code>
          <code
            style={{ fontFamily: MONO_STACK }}
            className="text-[12px] text-gray-400"
          >
            {'->'} {method.returnType}
          </code>
        </div>
        <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">{method.desc}</p>
      </div>
      <pre
        className="px-4 py-3 text-[12px] leading-relaxed overflow-x-auto bg-gray-50"
        style={{ fontFamily: MONO_STACK }}
      >
        <code className="text-gray-700">{method.example}</code>
      </pre>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────────

export default function DevelopersPage() {
  const [activeSection, setActiveSection] = useState('getting-started')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isClickScrolling = useRef(false)

  // Intersection observer to track which section is in view
  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    if (isClickScrolling.current) return
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setActiveSection(entry.target.id)
        break
      }
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    })

    const allIds = NAV_ITEMS.flatMap((item) =>
      item.children ? [item.id, ...item.children.map((c) => c.id)] : [item.id]
    )

    allIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [observerCallback])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      isClickScrolling.current = true
      setActiveSection(id)
      setMobileNavOpen(false)
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Release lock after scroll completes
      setTimeout(() => {
        isClickScrolling.current = false
      }, 800)
    }
  }

  const isActive = (id: string) => activeSection === id

  const isParentActive = (item: NavItem) => {
    if (activeSection === item.id) return true
    if (item.children) return item.children.some((c) => activeSection === c.id)
    return false
  }

  return (
    <div style={{ fontFamily: FONT_STACK }} className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* ──── Header ──── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-[15px] font-semibold text-gray-900 tracking-tight">
              TrendSurfer
            </Link>
            <span className="text-gray-300 text-sm">/</span>
            <span className="text-[14px] text-gray-500 font-medium">Docs</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </Link>
            <a
              href="https://github.com/shariqazeem/trendsurfer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>
            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-50 text-gray-500"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileNavOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex">
        {/* ──── Sidebar (desktop) ──── */}
        <aside className="hidden md:block w-[220px] flex-shrink-0 border-r border-gray-100">
          <nav className="sticky top-14 pt-8 pb-12 pl-6 pr-4 max-h-[calc(100vh-56px)] overflow-y-auto">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => scrollTo(item.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                      isParentActive(item)
                        ? 'text-gray-900 font-medium bg-gray-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                  {item.children && (
                    <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2.5">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <button
                            onClick={() => scrollTo(child.id)}
                            className={`w-full text-left px-2 py-1 rounded text-[12px] transition-colors ${
                              isActive(child.id)
                                ? 'text-gray-900 font-medium'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            {child.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* ──── Mobile Nav Dropdown ──── */}
        {mobileNavOpen && (
          <div className="md:hidden fixed inset-x-0 top-14 z-40 bg-white border-b border-gray-200 shadow-sm">
            <nav className="px-4 py-3 max-h-[60vh] overflow-y-auto">
              <ul className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => scrollTo(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors ${
                        isParentActive(item)
                          ? 'text-gray-900 font-medium bg-gray-50'
                          : 'text-gray-500'
                      }`}
                    >
                      {item.label}
                    </button>
                    {item.children && (
                      <ul className="ml-4 space-y-0.5">
                        {item.children.map((child) => (
                          <li key={child.id}>
                            <button
                              onClick={() => scrollTo(child.id)}
                              className={`w-full text-left px-3 py-1.5 rounded text-[12px] transition-colors ${
                                isActive(child.id) ? 'text-gray-900 font-medium' : 'text-gray-400'
                              }`}
                            >
                              {child.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}

        {/* ──── Content Area ──── */}
        <main className="flex-1 min-w-0 px-6 sm:px-10 lg:px-16 pt-10 pb-24 max-w-[900px]">

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 1. Getting Started                                                  */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          <motion.section id="getting-started" className="scroll-mt-20" {...SECTION_FADE}>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Getting Started</h1>
            <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
              Add trends.fun intelligence to any AI agent in 2 minutes. Scan token launches,
              predict bonding curve graduations, check security, and execute trades on Meteora DBC.
            </p>

            <div className="mt-6">
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <span style={{ fontFamily: MONO_STACK }} className="text-gray-400 text-sm select-none">$</span>
                <code style={{ fontFamily: MONO_STACK }} className="text-sm text-gray-800 flex-1">
                  npm install trendsurfer-skill
                </code>
                <CopyButton text="npm install trendsurfer-skill" />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[13px] font-medium text-gray-700 mb-2">Analyze any token in one call</p>
              <CodeBlock
                filename="agent.ts"
                code={`import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({
  heliusApiKey: process.env.HELIUS_API_KEY,
})

// One-shot analysis — just pass a mint address
const { graduation, security, token } = await skill.analyzeByMint(
  'EK7NyRkRmstUZ49g9Z5a6Y3vFDywJu1cCph3SsRcvb8N'
)

console.log(token.name)              // "CHILD HEALTH"
console.log(graduation.score)        // 58
console.log(graduation.curveProgress) // 100.0
console.log(graduation.velocity)     // "stagnant"
console.log(security.safe)           // true
console.log(graduation.reasoning)    // "Bonding curve is 100.0% filled..."`}
              />
            </div>

            <div className="mt-6">
              <p className="text-[13px] font-medium text-gray-700 mb-2">Or scan + analyze + trade in a loop</p>
              <CodeBlock
                filename="trading-agent.ts"
                code={`// Scan for new launches, analyze each, trade the best ones
const { launches } = await skill.scanLaunches()

for (const token of launches) {
  const analysis = await skill.analyzeGraduation(token)
  const security = await skill.checkSecurity(token.mint)

  if (analysis.score > 75 && security.safe) {
    await skill.executeTrade({
      tokenMint: token.mint,
      side: 'buy',
      amountSol: '0.1',
      walletAddress: myWallet,
      signTransaction: mySigner,
    })
  }
}`}
              />
            </div>
          </motion.section>

          <hr className="my-12 border-gray-100" />

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 2. Installation                                                     */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          <motion.section id="installation" className="scroll-mt-20" {...SECTION_FADE}>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Installation</h2>
            <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
              Install the SDK from npm and configure it with your Helius API key.
            </p>

            <div className="mt-6 space-y-4">
              <CodeBlock
                filename="terminal"
                code="npm install trendsurfer-skill"
              />

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-[13px] font-medium text-gray-700 mb-2">Requirements</p>
                <ul className="text-[13px] text-gray-500 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">--</span>
                    Node.js 18 or later
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">--</span>
                    <span>
                      Helius API key (get one at{' '}
                      <a href="https://helius.dev" target="_blank" rel="noopener noreferrer" className="text-gray-700 underline underline-offset-2 decoration-gray-300 hover:decoration-gray-500">
                        helius.dev
                      </a>
                      )
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">--</span>
                    Solana private key (only for trade execution)
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-700 mb-2">Configuration</p>
                <CodeBlock
                  filename="config.ts"
                  code={`import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({
  heliusApiKey: 'your-helius-api-key',
  poolConfigAddress: 'optional-trends-fun-config', // filter for trends.fun only
})`}
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-[13px] font-medium text-gray-700 mb-1">Parameters</p>
                <div className="space-y-2 mt-3">
                  <div className="flex items-baseline gap-3">
                    <InlineCode>heliusApiKey</InlineCode>
                    <span className="text-[12px] text-gray-400">string, required</span>
                  </div>
                  <p className="text-[13px] text-gray-500 ml-0">Your Helius RPC API key for reading on-chain Meteora DBC state.</p>

                  <div className="flex items-baseline gap-3 mt-3">
                    <InlineCode>poolConfigAddress</InlineCode>
                    <span className="text-[12px] text-gray-400">string, optional</span>
                  </div>
                  <p className="text-[13px] text-gray-500 ml-0">Filter launches to a specific pool config. Use the trends.fun config address to only track trends.fun tokens.</p>
                </div>
              </div>
            </div>
          </motion.section>

          <hr className="my-12 border-gray-100" />

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 3. SDK Reference                                                    */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          <motion.section id="sdk-reference" className="scroll-mt-20" {...SECTION_FADE}>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">SDK Reference</h2>
            <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
              All methods available on the <InlineCode>TrendSurferSkill</InlineCode> class, organized by category.
            </p>
          </motion.section>

          {sdkCategories.map((group) => (
            <motion.section
              key={group.id}
              id={group.id}
              className="scroll-mt-20 mt-10"
              {...SECTION_FADE}
            >
              <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                {group.category}
              </h3>
              <div className="space-y-3">
                {group.methods.map((method) => (
                  <MethodCard key={method.name} method={method} />
                ))}
              </div>
            </motion.section>
          ))}

          <hr className="my-12 border-gray-100" />

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 4. MCP Server                                                       */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          <motion.section id="mcp-server" className="scroll-mt-20" {...SECTION_FADE}>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">MCP Server</h2>
            <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
              Use TrendSurfer as a Model Context Protocol server. Works with Claude Desktop,
              GPT, or any MCP-compatible agent framework.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-gray-700 mb-2">Run the server</p>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <span style={{ fontFamily: MONO_STACK }} className="text-gray-400 text-sm select-none">$</span>
                  <code style={{ fontFamily: MONO_STACK }} className="text-sm text-gray-800 flex-1">
                    npx trendsurfer-mcp
                  </code>
                  <CopyButton text="npx trendsurfer-mcp" />
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-700 mb-2">Claude Desktop configuration</p>
                <CodeBlock
                  filename="claude_desktop_config.json"
                  code={`{
  "mcpServers": {
    "trendsurfer": {
      "command": "npx",
      "args": ["trendsurfer-mcp"],
      "env": {
        "HELIUS_API_KEY": "your-key-here"
      }
    }
  }
}`}
                />
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-700 mb-3">Available tools</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="hidden sm:grid grid-cols-[180px_1fr_120px] px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Tool</span>
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Description</span>
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium text-right">Returns</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {mcpTools.map((tool) => (
                      <div
                        key={tool.name}
                        className="sm:grid sm:grid-cols-[180px_1fr_120px] px-4 py-3"
                      >
                        <code
                          style={{ fontFamily: MONO_STACK }}
                          className="text-[13px] font-medium text-gray-900 block sm:inline"
                        >
                          {tool.name}
                        </code>
                        <p className="text-[13px] text-gray-500 mt-1 sm:mt-0">{tool.description}</p>
                        <code
                          style={{ fontFamily: MONO_STACK }}
                          className="text-[12px] text-gray-400 mt-1 sm:mt-0 block sm:text-right"
                        >
                          {tool.returnType}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <hr className="my-12 border-gray-100" />

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 5. x402 API                                                         */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          <motion.section id="x402-api" className="scroll-mt-20" {...SECTION_FADE}>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">x402 API</h2>
            <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
              Pay-per-call AI analysis via the{' '}
              <a href="https://www.x402.org" target="_blank" rel="noopener noreferrer" className="text-gray-700 underline underline-offset-2 decoration-gray-300 hover:decoration-gray-500">
                x402 protocol
              </a>
              . No API keys, no accounts. Just HTTP and USDC.
            </p>

            <div className="mt-6 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Endpoint</p>
                    <p style={{ fontFamily: MONO_STACK }} className="text-[13px] text-gray-800 mt-1">
                      GET /api/intelligence
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Price</p>
                    <p className="text-[13px] text-gray-800 mt-1">$0.001 USDC per call</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Network</p>
                    <p className="text-[13px] text-gray-800 mt-1">Solana mainnet USDC</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-700 mb-2">Query parameters</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3">
                    <div className="flex items-baseline gap-3">
                      <InlineCode>mint</InlineCode>
                      <span className="text-[12px] text-gray-400">string, required</span>
                    </div>
                    <p className="text-[13px] text-gray-500 mt-1">The token mint address to analyze.</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-700 mb-2">How it works</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                  <div className="px-4 py-3 flex items-start gap-3">
                    <span className="text-[12px] font-medium text-gray-400 mt-0.5 flex-shrink-0 w-4">1.</span>
                    <div>
                      <p className="text-[13px] text-gray-700">Send a request without payment headers</p>
                      <code style={{ fontFamily: MONO_STACK }} className="text-[12px] text-gray-500 mt-1 block">
                        GET /api/intelligence?mint=So11...
                      </code>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-start gap-3">
                    <span className="text-[12px] font-medium text-gray-400 mt-0.5 flex-shrink-0 w-4">2.</span>
                    <div>
                      <p className="text-[13px] text-gray-700">Receive 402 with payment requirements in response headers</p>
                      <code style={{ fontFamily: MONO_STACK }} className="text-[12px] text-gray-500 mt-1 block">
                        402 Payment Required + X-Payment-Required header
                      </code>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-start gap-3">
                    <span className="text-[12px] font-medium text-gray-400 mt-0.5 flex-shrink-0 w-4">3.</span>
                    <div>
                      <p className="text-[13px] text-gray-700">Pay $0.001 USDC on Solana and retry with signed transaction</p>
                      <code style={{ fontFamily: MONO_STACK }} className="text-[12px] text-gray-500 mt-1 block">
                        {'X-Payment: <signed-transaction>'}
                      </code>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-start gap-3">
                    <span className="text-[12px] font-medium text-gray-400 mt-0.5 flex-shrink-0 w-4">4.</span>
                    <div>
                      <p className="text-[13px] text-gray-700">Receive full AI graduation analysis</p>
                      <code style={{ fontFamily: MONO_STACK }} className="text-[12px] text-gray-500 mt-1 block">
                        200 OK
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-700 mb-2">Example</p>
                <CodeBlock
                  filename="x402-flow.ts"
                  badge="HTTP 402"
                  code={`// 1. Request analysis (no payment header)
const res = await fetch('/api/intelligence?mint=So1...')
// -> 402 Payment Required + X-Payment-Required header

// 2. Pay $0.001 USDC on Solana and retry
const paid = await fetch('/api/intelligence?mint=So1...', {
  headers: { 'X-Payment': signedTx }
})
// -> 200 OK

// 3. Response
const data = await paid.json()
// {
//   score: 87,
//   velocity: 'accelerating',
//   reasoning: 'High curve velocity + viral tweet...',
//   prediction: 'likely_graduate'
// }`}
                />
              </div>
            </div>
          </motion.section>

          <hr className="my-12 border-gray-100" />

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* 6. Architecture                                                     */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          <motion.section id="architecture" className="scroll-mt-20" {...SECTION_FADE}>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Architecture</h2>
            <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
              TrendSurfer sits between your agent and the Solana blockchain, providing structured
              intelligence about trends.fun token launches.
            </p>

            <div className="mt-8">
              {/* Architecture Diagram */}
              <div className="border border-gray-200 rounded-lg p-6 sm:p-8 bg-gray-50">
                {/* Desktop: horizontal flow */}
                <div className="hidden sm:flex items-center justify-center gap-3">
                  {[
                    { label: 'Your Agent', sub: 'Claude, GPT, any LLM' },
                    { label: 'TrendSurfer', sub: 'SDK or MCP Server' },
                    { label: 'Helius RPC', sub: 'Data + Execution' },
                    { label: 'Solana', sub: 'Meteora DBC' },
                  ].map((node, i, arr) => (
                    <div key={node.label} className="flex items-center gap-3">
                      <div className="bg-white border border-gray-200 rounded-lg px-5 py-3.5 text-center min-w-[150px]">
                        <p className="text-[13px] font-semibold text-gray-900">{node.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{node.sub}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <svg width="20" height="12" viewBox="0 0 20 12" className="text-gray-300 flex-shrink-0">
                          <path d="M0 6h16M12 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>

                {/* Mobile: vertical flow */}
                <div className="flex sm:hidden flex-col items-center gap-2">
                  {[
                    { label: 'Your Agent', sub: 'Claude, GPT, any LLM' },
                    { label: 'TrendSurfer', sub: 'SDK or MCP Server' },
                    { label: 'Helius RPC', sub: 'Data + Execution' },
                    { label: 'Solana', sub: 'Meteora DBC' },
                  ].map((node, i, arr) => (
                    <div key={node.label} className="flex flex-col items-center gap-2 w-full">
                      <div className="bg-white border border-gray-200 rounded-lg px-5 py-3.5 text-center w-full max-w-[240px]">
                        <p className="text-[13px] font-semibold text-gray-900">{node.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{node.sub}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <svg width="12" height="20" viewBox="0 0 12 20" className="text-gray-300">
                          <path d="M6 0v16M1 12l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-[13px] font-medium text-gray-700">Data flow</p>
                <ol className="text-[13px] text-gray-500 mt-2 space-y-1.5 list-decimal list-inside">
                  <li>Your agent calls the SDK or MCP tool to scan for new trends.fun launches</li>
                  <li>TrendSurfer reads on-chain Meteora DBC pool state via Helius RPC</li>
                  <li>Bonding curve progress, velocity, and graduation probability are computed</li>
                  <li>Security checks analyze on-chain token authority and permissions</li>
                  <li>Trade execution flows directly through Meteora DBC on Solana</li>
                </ol>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-[13px] font-medium text-gray-700">Key details</p>
                <ul className="text-[13px] text-gray-500 mt-2 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">--</span>
                    <span>
                      <strong className="text-gray-600">Meteora DBC Program:</strong>{' '}
                      <InlineCode>dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN</InlineCode>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">--</span>
                    <span>
                      <strong className="text-gray-600">Curve formula:</strong>{' '}
                      Constant product x * y = liquidity^2 with configurable segments
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">--</span>
                    <span>
                      <strong className="text-gray-600">Graduation:</strong>{' '}
                      When quote reserves hit migration_quote_threshold, auto-migrates to DAMM pool
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">--</span>
                    <span>
                      <strong className="text-gray-600">Direct on-chain trading:</strong>{' '}
                      Swaps executed directly on Meteora DBC pools via Solana transactions
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.section>

          {/* Bottom spacer */}
          <div className="h-12" />
        </main>
      </div>
    </div>
  )
}
