# TrendSurfer: The Intelligence Skill for trends.fun

**Every agent builder on Solana is building a bot. We built the infrastructure they all need.**

---

## The Problem

The Solana agent economy has a gap. There are 15+ MCP servers for generic Solana analytics. There are SDKs for Jupiter swaps, token transfers, and wallet management. But there is nothing — zero tools — that give an AI agent intelligence about trends.fun, the tokenized-tweet platform backed by Anatoly Yakovenko, Lily Liu, and the Jupiter founders.

trends.fun lets anyone paste a tweet and instantly create a tradeable token on Solana. These tokens run on Meteora's Dynamic Bonding Curve. When enough buy pressure fills the curve, the token "graduates" — liquidity migrates to a full DEX pool, and the price jumps.

That graduation event is the alpha. The question is: which tokens will graduate, and when?

No existing tool answers that question. Until now.

## Introducing TrendSurfer

TrendSurfer is the first intelligence skill for trends.fun. Not a bot. Not a single-purpose agent. A reusable TypeScript SDK and MCP server that gives any AI agent the ability to:

- **Scan** trends.fun token launches in real-time
- **Analyze** bonding curve graduation probability with on-chain data + AI reasoning
- **Analyze tweets** — since every token IS a tokenized tweet, we score social signals (viral/trending/moderate)
- **Check** token security (honeypot detection, mint authority, freeze risk)
- **Track graduations** — detect when tokens graduate and measure prediction accuracy
- **Trade** directly on Meteora DBC bonding curves

Three lines of code. That is all it takes.

```typescript
import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({ heliusApiKey: 'your-key' })
const analysis = await skill.analyzeGraduation(tokenMint)
// → { score: 87, curveProgress: 72.3, velocity: 'accelerating', reasoning: '...' }
```

Install it: `npm install trendsurfer-skill`

Or connect it to any AI agent framework via MCP:

```json
{
  "mcpServers": {
    "trendsurfer": {
      "command": "npx",
      "args": ["trendsurfer-mcp"]
    }
  }
}
```

[SCREENSHOT: SDK code example in VS Code / terminal showing analysis output]

## How Graduation Prediction Works

Every trends.fun token sits on a Meteora Dynamic Bonding Curve — a constant-product curve where `x * y = liquidity^2`. When the quote token reserves hit the migration threshold, the token graduates to a full DAMM pool.

TrendSurfer reads the raw on-chain pool state via Helius RPC and computes:

1. **Curve Progress** (25%) — How full is the bonding curve? (0-100%)
2. **Fill Velocity** (30%) — Is the curve filling faster or slower over time? Exponential backoff protects RPC limits.
3. **Social Signal** (15%) — Since tokens ARE tweets, we derive virality from holder count + curve momentum. Viral tweets from high-follower authors graduate faster.
4. **Security Audit** (20%) — Honeypot detection, mint/freeze authority checks via on-chain analysis.
5. **Holder Distribution** (10%) — How concentrated is the token? High concentration = rug risk.
6. **AI Reasoning** — Gemini Flash analyzes all signals including tweet content and produces natural language reasoning.

The composite score blends on-chain math with AI judgment. The bonding curve is deterministic — if enough tokens are bought, graduation happens. TrendSurfer measures how close that threshold is, how fast the market is approaching it, and whether the tweet content suggests the momentum will continue.

[SCREENSHOT: Sandbox showing a token analysis with score circle, curve progress bar, and AI reasoning]

## What We Built

TrendSurfer is a full-stack intelligence platform. Here is every layer:

**The SDK** (`trendsurfer-skill` on npm v0.3.0) — 6 core functions: `scanLaunches`, `analyzeGraduation`, `checkSecurity`, `getQuote`, `executeTrade`, `getTradeStatus`. Published, versioned, documented. Any developer can install it and have trends.fun intelligence in their agent within minutes.

**The MCP Server** (`trendsurfer-mcp` on npm v0.3.0) — Wraps the SDK as 6 MCP tools. Works with Claude Desktop, Cursor, or any MCP-compatible agent framework. No vendor lock-in.

**The x402 API** — Our `/api/intelligence` endpoint implements the x402 micropayment protocol (by Coinbase). Pay $0.001 USDC per analysis call. No API keys. No signup. Just HTTP with a payment header. This is how agent-to-agent commerce should work.

**The Interactive Sandbox** — Paste any Solana token mint address and get a live graduation analysis in seconds. Real on-chain data, AI-enhanced scoring (Gemini Flash), tweet content analysis, social signal detection, Solscan links. Shareable URLs let you share analysis results. Judges: try it yourself at [solana-trends-agent.vercel.app](https://solana-trends-agent.vercel.app).

**The Autonomous Agent** — A trading agent that uses TrendSurfer's own skill to scan, analyze, and trade trends.fun tokens 24/7. It runs a continuous loop: scan launches, score each token, buy directly on Meteora DBC bonding curves, monitor for graduation, sell after migration. It also detects graduation events and tracks prediction accuracy.

**The Dashboard** — A Next.js app showing:
- **Agent Live Decisions** — see what the agent is watching and thinking in real-time
- **Graduation Tracker** — verified graduations with prediction accuracy stats
- **Live Scanner** — real-time token feed with bonding curve progress
- **Trading Performance** — PnL chart, win rate, trade history
- **Tweet Analysis** — social signal scoring (viral/trending/moderate/low)

Clean white design, Framer Motion animations, mobile responsive.

[SCREENSHOT: Dashboard showing token feed with graduation progress bars and prediction cards]

## The Architecture

```
┌────────────────────────────────────────────┐
│           TRENDSURFER SKILL                │
│        (npm package + MCP server)          │
│                                            │
│  scanLaunches()      analyzeGraduation()   │
│  checkSecurity()     getQuote()            │
│  executeTrade()      getTradeStatus()      │
└─────────┬─────────────────────┬────────────┘
          │                     │
  ┌───────▼────────┐   ┌───────▼────────┐
  │  OUR AGENT     │   │  YOUR AGENT    │
  │  (autonomous)  │   │  (uses skill)  │
  │  Scan → Score  │   │  npm install   │
  │  → Trade → PnL │   │  or MCP/x402   │
  └───────┬────────┘   └────────────────┘
          │
  ┌───────▼────────┐
  │  DASHBOARD     │
  │  Live feed     │
  │  Predictions   │
  │  PnL tracking  │
  └────────────────┘
```

The skill talks to Solana (Helius RPC for on-chain Meteora DBC data), executes trades directly on Meteora bonding curves, and uses AI models via CommonStack for graduation reasoning. The agent and dashboard are consumers of the skill — just like any third-party agent would be.

## Technical Highlights

**Direct On-Chain Trading** — Trades execute directly on Meteora Dynamic Bonding Curves via the official DBC SDK. No intermediary APIs — pure on-chain execution with real Solana transactions.

**Real On-Chain Data** — We deserialize Meteora DBC pool accounts directly via Helius RPC. No third-party APIs, no scrapers. The bonding curve state is the source of truth. Smart RPC routing uses public Solana RPC for heavy `getProgramAccounts` and Helius for fast single-account reads.

**Tweet-Aware Intelligence** — Since trends.fun tokens ARE tokenized tweets, we extract tweet content and author from on-chain metadata and score social signals. Viral tweets from influential authors graduate faster — our scoring model captures this.

**x402 Micropayments** — The intelligence endpoint returns HTTP 402 with payment requirements. Any x402-compatible client can pay and access analysis programmatically. This is native agent-to-agent commerce.

**TypeScript Throughout** — The entire stack is TypeScript. SDK on npm, MCP server, Next.js dashboard — all accessible to the massive Node.js/TypeScript agent ecosystem.

**Graduation Event Tracking** — The agent detects when tokens graduate and records prediction accuracy. This builds a verifiable track record over time — not just predictions, but proven outcomes.

## Try It Right Now

1. **Sandbox** — Paste a token, get analysis: [solana-trends-agent.vercel.app/sandbox](https://solana-trends-agent.vercel.app/sandbox)
2. **Dashboard** — See live predictions: [solana-trends-agent.vercel.app](https://solana-trends-agent.vercel.app)
3. **Install the SDK** — `npm install trendsurfer-skill`
4. **Connect via MCP** — `npx trendsurfer-mcp`
5. **Source code** — [github.com/shariqazeem/trendsurfer](https://github.com/shariqazeem/trendsurfer)

[SCREENSHOT: Sandbox idle state showing the 3-step flow cards]

## Why This Matters

The hackathon prompt says: "Build the skill that represents your agent."

Most teams will build a bot that does one thing. TrendSurfer is infrastructure. It is a skill that any agent — yours, mine, or one that does not exist yet — can use to understand trends.fun. The SDK is on npm. The MCP server works with any framework. The x402 API accepts micropayments from any client.

We did not build a trading bot. We built the intelligence layer that makes every trends.fun trading bot better.

---

**TrendSurfer** — The intelligence skill for trends.fun.

Built by [@AzeemShariq](https://x.com/AzeemShariq)

SDK: `npm install trendsurfer-skill` (v0.3.0)
MCP: `npm install trendsurfer-mcp` (v0.3.0)
Dashboard: [solana-trends-agent.vercel.app](https://solana-trends-agent.vercel.app)
Sandbox: [solana-trends-agent.vercel.app/sandbox](https://solana-trends-agent.vercel.app/sandbox)
GitHub: [github.com/shariqazeem/trendsurfer](https://github.com/shariqazeem/trendsurfer)

Built with Solana, Meteora DBC, trends.fun, Helius, CommonStack AI, x402.

#AgentTalentShow
