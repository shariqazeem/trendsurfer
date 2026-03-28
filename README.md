# TrendSurfer

**The intelligence skill for trends.fun — graduation prediction, bonding curve analysis, creator wallet risk scoring, and trade execution via Meteora DBC for any AI agent.**

[![npm](https://img.shields.io/npm/v/trendsurfer-skill)](https://www.npmjs.com/package/trendsurfer-skill)
[![npm](https://img.shields.io/npm/v/trendsurfer-mcp)](https://www.npmjs.com/package/trendsurfer-mcp)

**[Live Dashboard](https://solana-trends-agent.vercel.app)** | **[Try the Sandbox](https://solana-trends-agent.vercel.app/sandbox)** | **[SDK Docs](https://solana-trends-agent.vercel.app/developers)** | **[npm Package](https://www.npmjs.com/package/trendsurfer-skill)**

---

## What is this?

trends.fun lets anyone tokenize a tweet on Solana. Tokens run on Meteora's Dynamic Bonding Curve. When enough buy pressure fills the curve, the token **graduates** — liquidity migrates to a DEX pool, price jumps.

**TrendSurfer predicts which tokens will graduate, before it happens.**

Not a bot. A reusable TypeScript SDK + MCP server that any AI agent can use.

### Live Agent Stats

| Metric | Value |
|--------|-------|
| Tokens Scanned | 113,600+ |
| Unique Tokens | 865+ |
| Graduations Detected | 1,339+ |
| AI Predictions | 113,600+ |
| Agent Uptime | 24/7 on VM |

## The SDK

```bash
npm install trendsurfer-skill
```

```typescript
import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({ heliusApiKey: 'your-key' })

// Scan for new trends.fun launches
const { launches } = await skill.scanLaunches()

// One-shot analysis from just a mint address
const { graduation, security, token } = await skill.analyzeByMint(mint)
// → { score: 87, curveProgress: 72.3, velocity: 'accelerating', reasoning: '...' }

// Check security (honeypot, mint authority, freeze)
const security = await skill.checkSecurity(mint)

// Execute trade directly on Meteora DBC bonding curve
const trade = await skill.executeTrade({
  tokenMint: mint,
  side: 'buy',
  amountSol: '0.1',
  walletAddress: wallet,
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

**8 tools**: `analyze_by_mint`, `scan_launches`, `analyze_graduation`, `check_security`, `get_quote`, `get_launches`, `refresh_launches`, `score_dev_wallet`

## Creator Wallet Risk Scoring (GoldRush)

TrendSurfer uses the [GoldRush (Covalent)](https://goldrush.dev) API to score token creators' wallets:

```
Token Creator Address → GoldRush API → Risk Profile
  - Wallet age (days)
  - Token holdings (portfolio diversity)
  - Portfolio value (USD)
  - Transaction count (activity level)
  → Risk Score 0-100 (low / medium / high)
  → Flags: "New wallet", "Low activity", etc.
```

Available via SDK, MCP (`score_dev_wallet` tool), and the dashboard sandbox.

## The x402 API

```
GET /api/intelligence?mint=<address>
→ 402 Payment Required
→ Pay $0.001 USDC → get analysis
```

Native agent-to-agent micropayments via x402 protocol on Solana.

## How Scoring Works

Every token gets a **0-100 graduation score** based on:

| Signal | Weight | Source |
|--------|--------|--------|
| Curve Progress | 25% | On-chain Meteora DBC pool state |
| Fill Velocity | 30% | Time-series bonding curve snapshots |
| Security Audit | 20% | On-chain analysis (honeypot, authorities) |
| Social Signal | 15% | Holder count x curve momentum (tweet virality proxy) |
| Holder Distribution | 10% | `getTokenLargestAccounts` RPC |

AI (Gemini Flash via [CommonStack](https://commonstack.ai)) blends signals with tweet content analysis for natural language reasoning.

Creator wallet risk via [GoldRush](https://goldrush.dev) provides an additional trust layer.

## Architecture

```
┌────────────────────────────────────────────────┐
│             TRENDSURFER SKILL                  │
│          (npm package + MCP server)            │
│                                                │
│  scanLaunches()      analyzeByMint()           │
│  analyzeGraduation() checkSecurity()           │
│  getQuote()          executeTrade()            │
│  scoreDevWallet()    (via GoldRush)            │
└──────────┬──────────────────────┬──────────────┘
           │                      │
   ┌───────▼────────┐    ┌───────▼────────┐
   │  OUR AGENT     │    │  YOUR AGENT    │
   │  24/7 on VM    │    │  npm install   │
   │  Scan → Score  │    │  or MCP/x402   │
   │  → Trade       │    │                │
   └───────┬────────┘    └────────────────┘
           │
   ┌───────▼────────┐
   │  DASHBOARD     │
   │  Live feed     │
   │  Predictions   │
   │  Graduations   │
   │  Creator Risk  │
   │  Agent logs    │
   └────────────────┘
```

## The Dashboard

- **Interactive Sandbox** — Paste any mint, auto-analyzes trending tokens on first visit
- **Creator Wallet Risk** — GoldRush-powered wallet age, portfolio, activity scoring
- **Agent Live Decisions** — See what the agent is watching in real-time
- **Graduation Tracker** — Verified graduations with prediction accuracy
- **Live Scanner** — Token feed with bonding curve progress bars
- **AI Reasoning** — Full CommonStack AI analysis for every prediction
- **Tweet Analysis** — Social signal scoring for tokenized tweets

## Quick Start

```bash
git clone https://github.com/shariqazeem/trendsurfer.git
cd trendsurfer
npm install

# Set up env vars
cp .env.example .env.local
# Add: HELIUS_API_KEY, COMMONSTACK_API_KEY, GOLDRUSH_API_KEY

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
| MCP Server | @modelcontextprotocol/sdk (8 tools) |
| AI Analysis | CommonStack API (Gemini Flash) |
| Wallet Risk | GoldRush / Covalent API |
| Trading | Meteora DBC (direct on-chain) |
| On-Chain | Helius RPC, Meteora DBC program |
| Dashboard | Next.js 14, Tailwind CSS, Framer Motion |
| Database | SQLite (better-sqlite3) |
| Payments | x402 protocol (USDC micropayments) |

## Built For

**Solana Agent Economy Hackathon: Agent Talent Show** (March-April 2026)

Built by [@shariqshkt](https://x.com/shariqshkt)

---

Built with Solana, Meteora DBC, trends.fun, Helius, CommonStack AI, GoldRush (Covalent), x402, MCP
