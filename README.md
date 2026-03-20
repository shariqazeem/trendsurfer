# TrendSurfer

**The intelligence skill for trends.fun — graduation prediction, bonding curve analysis, tweet scoring, and gasless trade execution for any AI agent.**

[![npm](https://img.shields.io/npm/v/trendsurfer-skill)](https://www.npmjs.com/package/trendsurfer-skill)
[![npm](https://img.shields.io/npm/v/trendsurfer-mcp)](https://www.npmjs.com/package/trendsurfer-mcp)

**[Live Dashboard](https://solana-trends-agent.vercel.app)** | **[Try the Sandbox](https://solana-trends-agent.vercel.app/sandbox)** | **[SDK Docs](https://solana-trends-agent.vercel.app/developers)** | **[npm Package](https://www.npmjs.com/package/trendsurfer-skill)**

---

## What is this?

trends.fun lets anyone tokenize a tweet on Solana. Tokens run on Meteora's Dynamic Bonding Curve. When enough buy pressure fills the curve, the token **graduates** — liquidity migrates to a DEX pool, price jumps.

**TrendSurfer predicts which tokens will graduate, before it happens.**

Not a bot. A reusable TypeScript SDK + MCP server that any AI agent can use.

## The SDK

```bash
npm install trendsurfer-skill
```

```typescript
import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({ heliusApiKey: 'your-key' })

// Scan for new trends.fun launches
const { launches } = await skill.scanLaunches()

// Predict graduation probability
const analysis = await skill.analyzeGraduation(launch)
// → { score: 87, curveProgress: 72.3, velocity: 'accelerating', reasoning: '...' }

// Check security (honeypot, mint authority, freeze)
const security = await skill.checkSecurity(mint)

// Execute gasless trade via Bitget Wallet
const trade = await skill.executeTrade({
  tokenMint: mint,
  side: 'buy',
  amountSol: '0.1',
  walletAddress: wallet,
  gasless: true,
  signTransaction: signer,
})
```

## The MCP Server

```bash
npx trendsurfer-mcp
```

Works with Claude Desktop, Cursor, or any MCP-compatible framework:

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

**6 tools**: `scan_launches`, `analyze_graduation`, `check_security`, `score_dev_wallet`, `get_swap_quote`, `execute_trade`

## The x402 API

```
GET /api/intelligence?mint=<address>
→ 402 Payment Required
→ Pay $0.001 USDC → get analysis
```

Native agent-to-agent micropayments via x402 protocol.

## How Scoring Works

Every token gets a **0-100 graduation score** based on:

| Signal | Weight | Source |
|--------|--------|--------|
| Curve Progress | 25% | On-chain Meteora DBC pool state |
| Fill Velocity | 30% | Time-series bonding curve snapshots |
| Security Audit | 20% | Bitget Wallet API (honeypot, authorities) |
| Social Signal | 15% | Holder count × curve momentum (tweet virality proxy) |
| Holder Distribution | 10% | `getTokenLargestAccounts` RPC |

AI (Gemini Flash via CommonStack) blends signals with tweet content analysis for natural language reasoning.

## Architecture

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
  │  24/7 on VM    │   │  npm install   │
  │  Scan → Score  │   │  or MCP/x402   │
  │  → Trade → PnL │   │                │
  └───────┬────────┘   └────────────────┘
          │
  ┌───────▼────────┐
  │  DASHBOARD     │
  │  Live feed     │
  │  Predictions   │
  │  Graduations   │
  │  Agent logs    │
  └────────────────┘
```

## The Dashboard

- **Interactive Sandbox** — Paste any mint → instant analysis with AI reasoning
- **Agent Live Decisions** — See what the agent is watching in real-time
- **Graduation Tracker** — Verified graduations with prediction accuracy
- **Live Scanner** — Token feed with bonding curve progress bars
- **Trading Performance** — PnL chart, positions, trade history
- **Tweet Analysis** — Social signal scoring for tokenized tweets

## Quick Start

```bash
git clone https://github.com/shariqazeem/trendsurfer.git
cd trendsurfer
npm install

# Set up env vars
cp .env.example .env.local
# Add: HELIUS_API_KEY, COMMONSTACK_API_KEY

# Run dashboard
npm run dev

# Run agent (paper mode without wallet)
npm run agent

# Run MCP server
npm run mcp
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Skill SDK | TypeScript, npm package |
| MCP Server | @modelcontextprotocol/sdk |
| AI Analysis | CommonStack API (Gemini Flash) |
| Trading | Bitget Wallet REST API (gasless) |
| On-Chain | Helius RPC, Meteora DBC program |
| Dashboard | Next.js 14, Tailwind CSS, Framer Motion |
| Database | Turso (libSQL) |

## Built For

**Solana Agent Economy Hackathon: Agent Talent Show** (March 2026)

Built by [@AzeemShariq](https://x.com/AzeemShariq)

---

Built with Solana, Bitget Wallet, trends.fun, Helius, CommonStack AI, x402, MCP
