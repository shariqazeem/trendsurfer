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
- **Analyze** bonding curve graduation probability with on-chain data
- **Check** token security (honeypot detection, mint authority, freeze risk)
- **Execute** gasless trades via Bitget Wallet API

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

1. **Curve Progress** — How full is the bonding curve? (0-100%)
2. **Fill Velocity** — Is the curve filling faster or slower over time? (accelerating / steady / declining / stagnant)
3. **Holder Distribution** — How concentrated is the token? High concentration = rug risk.
4. **Security Audit** — Honeypot detection, mint/freeze authority checks via Bitget Wallet API.
5. **Composite Score** — AI combines all signals into a single 0-100 graduation probability with transparent reasoning.

This is not speculation. It is math. The bonding curve is deterministic — if enough tokens are bought, graduation happens. TrendSurfer measures how close that threshold is and how fast the market is approaching it.

[SCREENSHOT: Sandbox showing a token analysis with score circle, curve progress bar, and AI reasoning]

## What We Built

TrendSurfer is a full-stack intelligence platform. Here is every layer:

**The SDK** (`trendsurfer-skill` on npm) — 6 core functions: `scanLaunches`, `analyzeGraduation`, `checkSecurity`, `getQuote`, `executeTrade`, `getTradeStatus`. Published, versioned, documented. Any developer can install it and have trends.fun intelligence in their agent within minutes.

**The MCP Server** (`trendsurfer-mcp` on npm) — Wraps the SDK as 6 MCP tools. Works with Claude Desktop, Cursor, or any MCP-compatible agent framework. No vendor lock-in.

**The x402 API** — Our `/api/intelligence` endpoint implements the x402 micropayment protocol (by Coinbase). Pay $0.001 USDC per analysis call. No API keys. No signup. Just HTTP with a payment header. This is how agent-to-agent commerce should work.

**The Interactive Sandbox** — Paste any Solana token mint address and get a live graduation analysis in seconds. Real on-chain data, real scoring, real AI reasoning. Judges: try it yourself at [solana-trends-agent.vercel.app/sandbox](https://solana-trends-agent.vercel.app/sandbox).

**The Autonomous Agent** — A trading agent that uses TrendSurfer's own skill to scan, analyze, and trade trends.fun tokens 24/7. It runs a continuous loop: scan launches, score each token, buy above threshold via Bitget Wallet (gasless), monitor for graduation, sell after migration. Every decision is logged with full AI reasoning.

**The Dashboard** — A Next.js app showing the live token feed, graduation scores, AI prediction cards with reasoning, trade history, and PnL tracking. Clean white design, Framer Motion animations, mobile responsive.

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

The skill talks to Solana (Helius RPC for on-chain Meteora DBC data), Bitget Wallet API (security audits + gasless trade execution), and AI models via CommonStack (graduation reasoning). The agent and dashboard are consumers of the skill — just like any third-party agent would be.

## Technical Highlights

**Gasless Trading** — Bitget Wallet's swap API deducts gas from the input token. Zero SOL balance required. This removes the biggest friction point for autonomous agents.

**Real On-Chain Data** — We deserialize Meteora DBC pool accounts directly. No third-party APIs, no scrapers. The bonding curve state is the source of truth.

**x402 Micropayments** — The intelligence endpoint returns HTTP 402 with payment requirements. Any x402-compatible client can pay and access analysis programmatically. This is native agent-to-agent commerce.

**TypeScript Throughout** — Bitget's official SDK is Python-only. TrendSurfer provides the first TypeScript wrapper for their Wallet API, making it accessible to the massive Node.js/TypeScript agent ecosystem.

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

SDK: `npm install trendsurfer-skill` (v0.2.0)
MCP: `npm install trendsurfer-mcp` (v0.2.0)
Dashboard: [solana-trends-agent.vercel.app](https://solana-trends-agent.vercel.app)
Sandbox: [solana-trends-agent.vercel.app/sandbox](https://solana-trends-agent.vercel.app/sandbox)
GitHub: [github.com/shariqazeem/trendsurfer](https://github.com/shariqazeem/trendsurfer)

Built with Solana, Bitget Wallet, trends.fun, Helius, CommonStack AI, x402.

#AgentTalentShow
