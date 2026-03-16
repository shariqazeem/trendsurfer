# TrendSurfer

**The intelligence skill for trends.fun — graduation prediction, bonding curve analysis, and trade execution for any AI agent.**

TrendSurfer gives your AI agent the ability to monitor trends.fun token launches, predict which tokens will graduate to full DEX pools, and execute trades via Bitget Wallet — all through a clean TypeScript SDK or MCP server.

## The Skill

```typescript
import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({
  heliusApiKey: process.env.HELIUS_API_KEY,
})

// Scan for new trends.fun launches
const launches = await skill.scanLaunches()

// Predict graduation probability for a token
const analysis = await skill.analyzeGraduation(tokenMint)
// → { score: 87, curveProgress: 72.3, velocity: 'accelerating', ... }

// Check token security via Bitget
const security = await skill.checkSecurity(tokenMint)
// → { safe: true, honeypot: false, warnings: [] }

// Execute a gasless trade via Bitget Wallet
const trade = await skill.executeTrade({
  tokenIn: 'SOL',
  tokenOut: tokenMint,
  amount: 0.1,
})
```

## The Agent

TrendSurfer includes an autonomous trading agent that uses the skill to:

1. **Scan** — Monitor every trends.fun launch in real-time
2. **Analyze** — AI scores each token's graduation probability (0-100)
3. **Decide** — If score > threshold, queue a buy via Bitget Wallet (gasless)
4. **Trade** — Execute pre-graduation, sell after DEX migration
5. **Report** — Post predictions and results on X with full reasoning

## The Dashboard

Beautiful Next.js dashboard showing:
- Live token feed with graduation progress bars
- AI-powered prediction cards with Claude's reasoning
- Trade history with PnL per trade
- Overall portfolio performance chart
- Agent reasoning log — full transparency on every decision

## How Graduation Prediction Works

trends.fun tokens use Meteora's Dynamic Bonding Curve (DBC). When enough buy pressure fills the curve, the token "graduates" — liquidity migrates from the bonding curve to a full DEX pool, typically causing a price jump.

TrendSurfer reads on-chain DBC state to calculate:
- **Curve progress** — How close to graduation (0-100%)
- **Fill velocity** — How fast the curve is filling (accelerating, steady, declining)
- **Creator analysis** — Tweet author's reach and engagement history
- **Holder distribution** — Concentration risk assessment
- **Security audit** — Honeypot detection via Bitget Wallet API

AI combines these signals into a graduation probability score with transparent reasoning.

## Tech Stack

- **Skill SDK**: TypeScript — reusable, publishable npm package
- **MCP Server**: Agent-framework-agnostic access to all skill functions
- **AI**: CommonStack API (DeepSeek, GPT-4, Claude, Grok) — graduation analysis and trade reasoning
- **Execution**: Bitget Wallet API — gasless trading, 110+ DEX aggregation
- **On-Chain**: Helius RPC + Meteora DBC program — bonding curve state
- **Dashboard**: Next.js 14 + Tailwind CSS + Framer Motion
- **Database**: SQLite — local prediction and trade history

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your HELIUS_API_KEY, COMMONSTACK_API_KEY, SOLANA_PRIVATE_KEY

# Run the dashboard
npm run dev

# Run the agent
npm run agent
```

## Built For

**Solana Agent Economy Hackathon: Agent Talent Show**

- **Main Track** — TrendSurfer Skill: the reusable intelligence layer for trends.fun
- **Bitget Wallet Track** — TrendSurfer Agent: ranked by trading PnL

---

Built with CommonStack AI | Powered by Solana, Bitget Wallet & trends.fun
