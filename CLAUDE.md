# TrendSurfer — The Intelligence Skill for trends.fun

## MISSION: Win the Solana Agent Economy Hackathon ("Agent Talent Show")

**Prize Pool**: $30K main + $5K Bitget Wallet track = $35K total
**Deadline**: March 27, 2026 2PM UTC
**Submission**: X Article + Quote RT with #AgentTalentShow
**Today**: March 15, 2026 — 12 days remaining

---

## THE WINNING STRATEGY

The hackathon literally says: **"Build the skill that represents your agent. Show the app that empowers their agents."**

Past winners (The Hive $60K, FXN $30K, AgentiPy $15K) were ALL platforms/skills — not single-purpose bots. We follow that pattern.

**TrendSurfer is two things:**

1. **The Skill** — A reusable TypeScript SDK + MCP server that gives ANY AI agent intelligence about trends.fun token launches, bonding curve graduation prediction, and trade execution via Bitget Wallet. This is what wins the main track.

2. **The Agent** — An autonomous trading agent that USES the skill to predict which trends.fun tokens will graduate, buys pre-graduation, and sells after DEX migration. This is what wins the Bitget PnL track.

### Why This Wins

1. **trends.fun is the CO-HOST** — we're building infrastructure FOR their platform. Judges will love this.
2. **"Build the skill"** — we literally answer the hackathon prompt. Everyone else builds bots.
3. **Reusable by any agent** — `npm install trendsurfer-skill` or connect via MCP. Not locked to our agent.
4. **Real PnL** — our demo agent actually trades via Bitget Wallet, generating measurable returns.
5. **Uses ALL sponsor tech** — Solana (on-chain data), Bitget Wallet (execution), trends.fun (data source).
6. **Nobody else will do this** — no existing tool combines trends.fun intelligence + graduation prediction + trade execution as a reusable skill.

### What is trends.fun?

trends.fun is a "Capitalized Information Market" — users paste an X/Twitter post URL and instantly create a tradeable token linked to that tweet. Each tweet can only be tokenized once. Token price is driven by market demand. Built on Meteora's Dynamic Bonding Curve (DBC). Founded by Mable Jiang (ex-STEPN CRO, ex-Multicoin Capital), backed by Anatoly Yakovenko, Lily Liu, Jupiter founders, and more.

**Key mechanic**: When a token's bonding curve fills up (enough buy pressure), it "graduates" — liquidity auto-migrates from the bonding curve to a full Meteora DAMM pool. This graduation event typically causes a price jump. **Our alpha: predict which tokens will graduate, buy before, sell after.**

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   TRENDSURFER SKILL                      │
│              (npm package + MCP server)                  │
│                                                          │
│  scanLaunches()     → Real-time trends.fun token feed   │
│  analyzeGraduation()→ Bonding curve velocity + AI score │
│  scoreDevWallet()   → Creator wallet history analysis   │
│  checkSecurity()    → Token safety via Bitget API       │
│  getQuote()         → Swap quote via Bitget Wallet      │
│  executeTrade()     → Gasless trade via Bitget Wallet   │
└──────────────┬──────────────────────────────┬───────────┘
               │                              │
    ┌──────────▼──────────┐       ┌───────────▼──────────┐
    │  TRENDSURFER AGENT  │       │   ANY OTHER AGENT    │
    │  (autonomous trader)│       │   (uses the skill)   │
    │                     │       │                      │
    │  AI analysis (CommonStack) │       │  Your bot, your MCP  │
    │  Risk management    │       │  client, your app... │
    │  Position tracking  │       │                      │
    │  Auto buy/sell      │       │                      │
    └──────────┬──────────┘       └──────────────────────┘
               │
    ┌──────────▼──────────┐
    │   NEXT.JS DASHBOARD │
    │                     │
    │  Live token feed    │
    │  Graduation scores  │
    │  Agent reasoning    │
    │  Trade history      │
    │  PnL tracking       │
    └─────────────────────┘
```

---

## COMPETITIVE RESEARCH

### What Already Exists (DO NOT rebuild)
- `bitget-wallet-mcp` — Bitget's own MCP server (Python, 13 tools)
- `bitget-wallet-skill` — Python SDK for Bitget Wallet API (21+ commands)
- `sendaifun/solana-mcp` — Solana Agent Kit MCP (11 tools)
- `solana-agent-kit` — 60+ actions, plugin architecture. Bloated, generic.
- 15+ generic Solana MCP servers — read-only analytics, Jupiter swaps

### The GAP We Fill
- **No skill/SDK provides trends.fun intelligence** — token scanning, graduation prediction, curve analysis
- **No MCP server tracks launchpad bonding curves** (trends.fun, Pump.fun, Meteora DBC)
- **No agent predicts token graduations** using on-chain curve velocity analysis
- **No TypeScript wrapper for Bitget Wallet API** — their SDK is Python-only
- **No combined intelligence + execution skill** for trend trading

---

## TECH STACK

| Layer | Technology | Why |
|-------|-----------|-----|
| **Skill SDK** | TypeScript / Node.js | Publishable npm package, user's strength |
| **MCP Server** | TypeScript MCP SDK | Agent-framework-agnostic access to the skill |
| **AI Analysis** | CommonStack API (DeepSeek/GPT/Claude/Grok) | Graduation prediction, reasoning |
| **Trading** | Bitget Wallet REST API | Gasless, 110+ DEX, security audit |
| **On-Chain Data** | Helius RPC + Solana web3.js | Read Meteora DBC bonding curves |
| **Dashboard** | Next.js 14 + Tailwind + Framer Motion | Beautiful UI, real-time updates |
| **Database** | SQLite (better-sqlite3) | Store predictions, trades, PnL locally |
| **Social** | X API v2 | Post predictions + trades publicly |

### Key APIs

**Bitget Wallet API** (base URL: `https://copenapi.bgwapi.io`):
- All calls are POST with JSON body, no API key needed for public endpoints
- `search-tokens` — Search tokens by name/address
- `token-info` / `batch-token-info` — Token details
- `token-price` — Current price
- `security` — Security audit (honeypot, permissions, warnings)
- `rankings` — Hot picks, top gainers, top losers
- `check-swap-token` — Pre-trade safety check (forbidden-buy detection)
- `quote` → `confirm` → `make-order` → sign → `send` — Full swap flow
- `get-order-details` — Track order status
- `kline` — Price charts (1s/1m/5m/15m/30m/1h/4h/1d/1w)
- `liquidity` — Pool liquidity data
- Gasless via EIP-7702 (gas deducted from input token, min ~$5 USD)
- Docs: https://github.com/bitget-wallet-ai-lab/bitget-wallet-skill

**Trends.fun / Meteora DBC On-Chain**:
- Program ID: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` (Meteora Dynamic Bonding Curve)
- Anchor 0.31.0, Solana 2.1.0
- Formula: Constant product `x * y = liquidity^2` with configurable curve segments
- Graduation: When quote token reserves reach `migration_quote_threshold`, auto-migrates to DAMM pool
- Graduation % calc: `100 - ((leftTokens * 100) / initialRealTokenReserves)`
- Anti-sniper protection (A.S.S.): Rate limiters + fee schedulers for large buys at launch
- Monitor `initialize_virtual_pool_with_spl_token` instructions for new launches
- Track migration events for graduations
- tokens represent tokenized X/Twitter posts — tweet virality is a graduation signal

**Helius RPC**:
- Key: `873c5824-7255-40c9-9a39-4d3d04efe717`
- Endpoint: `https://mainnet.helius-rpc.com/?api-key=873c5824-7255-40c9-9a39-4d3d04efe717`
- Enhanced transaction API, DAS API, webhooks

---

## WHAT TO BUILD (Prioritized)

### Phase 1: Core Skill SDK (Days 1-3, March 15-17)
1. **Project scaffolding** — monorepo with `packages/skill` + `packages/agent` + `apps/dashboard`
2. **Helius RPC wrapper** (`lib/helius.ts`) — connection, enhanced APIs
3. **Meteora DBC reader** (`lib/meteora.ts`) — deserialize pool state, calculate graduation %
4. **Token scanner** (`skill/scanner.ts`) — poll for new trends.fun launches, detect new pools
5. **Graduation analyzer** (`skill/analyzer.ts`) — bonding curve velocity, time-weighted fill rate
6. **Bitget API wrapper** (`lib/bitget.ts`) — TypeScript wrapper for all Bitget Wallet REST endpoints
7. **Security checker** (`skill/security.ts`) — token safety via Bitget security API
8. **Export clean SDK interface** (`skill/index.ts`) — `TrendSurferSkill` class with all methods

### Phase 2: MCP Server + Agent (Days 4-6, March 18-20)
9. **MCP server** (`packages/mcp/`) — wrap the skill as MCP tools, agent-framework-agnostic
10. **Claude analysis pipeline** (`agent/analyzer.ts`) — for each token: graduation %, dev wallet, tweet content, security → 0-100 score with reasoning
11. **Trade decision engine** (`agent/trader.ts`) — score threshold → Bitget quote → execute
12. **Risk manager** (`agent/risk.ts`) — max position size, max exposure, stop-loss
13. **Position manager** (`agent/positions.ts`) — track open positions, unrealized PnL, exit conditions
14. **SQLite database** (`lib/db.ts`) — predictions, trades, PnL history
15. **Agent orchestrator** (`agent/index.ts`) — autonomous loop: scan → analyze → decide → trade → monitor

### Phase 3: Dashboard (Days 7-9, March 21-23)
16. **Next.js app** with:
    - Live token feed (new launches, graduation %, bonding curve visualization)
    - Prediction cards (tokens being watched, scores, Claude's reasoning)
    - Trade history (entry, exit, PnL per trade)
    - Overall PnL chart
    - Agent reasoning log (Claude's full analysis for each decision)
    - Skill demo section (show the SDK/MCP interface, code examples)
    - Settings (risk params, auto-trade toggle)
17. **API routes** — agent status, predictions, trades, PnL data
18. **Real-time updates** — SSE or polling for live data

### Phase 4: Polish + Social (Days 10-11, March 24-25)
19. **X Bot** — post predictions, trade results, graduation alerts automatically
20. **Landing section** in dashboard — "Use TrendSurfer Skill in your agent" with code snippets
21. **Mobile responsive** — judges will check on phone
22. **Error handling + edge cases** — robust for live trading

### Phase 5: Live Trading + Submit (Days 11-12, March 25-27)
23. **Run agent live** — accumulate real PnL for Bitget track
24. **X Article** — write compelling submission with screenshots, architecture, results
25. **Submit** — Quote RT with #AgentTalentShow

---

## KEY DIFFERENTIATORS TO HIGHLIGHT IN SUBMISSION

1. **"The first intelligence skill for trends.fun"** — not a bot, a reusable skill
2. **Graduation prediction** — novel on-chain bonding curve velocity analysis
3. **Skill + Agent architecture** — any agent can use TrendSurfer's intelligence
4. **MCP server** — plug into any AI agent framework
5. **Transparent reasoning** — Claude's analysis visible for every decision
6. **Real PnL** — actually trades via Bitget Wallet, measurable results
7. **Tweet analysis** — trends.fun tokens ARE tweets, so we analyze tweet content + author as graduation signals
8. **Beautiful dashboard** — not a CLI bot, a full premium app

---

## DESIGN PRINCIPLES

- **LIGHT/WHITE THEME** — clean, premium UI (signature style)
- **Framer Motion animations** — smooth, polished feel
- **Mobile-responsive** — judges will check on phone
- **Real data, real trades** — not mock data
- **Show the agent's thinking** — Claude's reasoning is the show
- **Skill-first framing** — the SDK/MCP is the product, the agent is the demo

---

## PROJECT STRUCTURE

```
solana-trends-agent/
├── CLAUDE.md                 ← This file
├── README.md                 ← Hackathon-facing README (skill-first)
├── package.json              ← Root package.json (monorepo)
├── tsconfig.json             ← Shared TypeScript config
├── turbo.json                ← Turborepo config (if needed)
├── .env.local                ← API keys
│
├── packages/
│   ├── skill/                ← THE REUSABLE SKILL (npm publishable)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts      ← Main export: TrendSurferSkill class
│   │   │   ├── scanner.ts    ← Monitor trends.fun launches
│   │   │   ├── analyzer.ts   ← Graduation prediction (on-chain)
│   │   │   ├── security.ts   ← Token safety checks
│   │   │   ├── trader.ts     ← Bitget Wallet trade execution
│   │   │   └── types.ts      ← Shared types
│   │   └── README.md         ← SDK documentation
│   │
│   └── mcp/                  ← MCP SERVER (agent-framework-agnostic)
│       ├── package.json
│       ├── src/
│       │   └── index.ts      ← MCP tool definitions wrapping the skill
│       └── README.md
│
├── apps/
│   ├── agent/                ← THE AUTONOMOUS TRADING AGENT
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts      ← Agent orchestrator (autonomous loop)
│   │   │   ├── claude.ts     ← AI analysis (CommonStack) pipeline
│   │   │   ├── risk.ts       ← Risk management
│   │   │   ├── positions.ts  ← Position tracking
│   │   │   └── db.ts         ← SQLite for predictions/trades/PnL
│   │   └── tsconfig.json
│   │
│   └── dashboard/            ← NEXT.JS DASHBOARD
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx          ← Main dashboard
│       │   │   ├── layout.tsx
│       │   │   └── api/
│       │   │       ├── agent/route.ts
│       │   │       ├── predictions/route.ts
│       │   │       └── trades/route.ts
│       │   └── components/
│       │       ├── TokenFeed.tsx
│       │       ├── PredictionCard.tsx
│       │       ├── TradeHistory.tsx
│       │       ├── PnLChart.tsx
│       │       ├── AgentLog.tsx
│       │       ├── SkillDemo.tsx      ← Shows SDK/MCP usage
│       │       └── BondingCurve.tsx   ← Visual bonding curve
│       └── tsconfig.json
│
├── lib/                      ← SHARED LIBRARIES
│   ├── helius.ts             ← Helius RPC helpers
│   ├── meteora.ts            ← Meteora DBC state reader
│   ├── bitget.ts             ← Bitget Wallet API wrapper (TypeScript!)
│   └── types.ts              ← Shared types across all packages
│
└── scripts/
    └── run-agent.ts          ← Quick-start agent runner
```

---

## ENV VARS NEEDED

```bash
# Helius (already have)
HELIUS_API_KEY=873c5824-7255-40c9-9a39-4d3d04efe717
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=873c5824-7255-40c9-9a39-4d3d04efe717

# CommonStack AI API (OpenAI-compatible, multi-model)
COMMONSTACK_API_KEY=<get from commonstack.ai>
# COMMONSTACK_MODEL=deepseek/deepseek-chat

# Bitget Wallet (public endpoints — no key needed for most calls)
# Signing requires a Solana private key for the trading wallet
SOLANA_PRIVATE_KEY=<base58 encoded private key for trading wallet>

# X API (for social posting)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# Optional
DATABASE_URL=./data/trendsurfer.db
```

---

## BUILD STATUS (As of March 15, 2026)

**TypeScript**: Compiles clean — `npx tsc --noEmit` passes with zero errors
**Dashboard dev**: Works — `npm run dev` starts Next.js on localhost:3000
**Agent**: Works — `npm run agent` runs scan/analyze/trade loop (paper mode if no SOLANA_PRIVATE_KEY)
**MCP**: Works — `npm run mcp` starts stdio MCP server
**Production build**: May need `rm -rf apps/dashboard/.next` before `npm run build`
**Database**: SQLite at `data/trendsurfer.db` — auto-created by agent on first run

### Code stats
- Skill SDK: 644 lines (6 files) — COMPLETE
- MCP Server: 239 lines (1 file) — COMPLETE
- Agent: 988 lines (4 files) — COMPLETE
- Dashboard: 1,135 lines (10 files) — WORKING BUT NEEDS REDESIGN
- Shared libs: 773 lines (5 files) — COMPLETE
- **Total: ~3,800 lines of real TypeScript**

### What's done
- Full skill SDK with scanner, analyzer, security checker, trader
- MCP server with 6 tools
- Autonomous agent with scan → analyze → trade → monitor loop
- AI integration via CommonStack (DeepSeek/GPT/Claude)
- Risk management (position sizing, stop-loss, take-profit)
- Paper trading mode (runs without wallet)
- Working dashboard with 6 components + 3 API routes

### What needs work → See NEXT_STEPS.md
1. **Seed data script** — dashboard is empty without agent running
2. **Dashboard redesign** — tab layout → scroll sections, hero, bonding curve animation, skill showcase
3. **Agent improvements** — tweet analysis, dev wallet scoring, better prompts
4. **Submission package** — X article, screenshots, deploy

---

## IMPORTANT NOTES

- **bitget-wallet-skill is PYTHON** — do NOT try to npm install it. We wrap their REST API at `https://copenapi.bgwapi.io` directly in TypeScript.
- **trends.fun has no public REST API** — we read on-chain Meteora DBC state directly via Helius RPC. Requires Anchor IDL deserialization.
- **trends.fun tokens ARE tokenized tweets** — tweet content, author follower count, and engagement are graduation signals. Claude should analyze the tweet itself.
- **Gasless trading** via Bitget deducts gas from input token (min ~$5 USD). Zero SOL balance needed. KEY feature to highlight.
- **The skill is the product** — frame everything as "the intelligence skill for trends.fun" not "a trading bot."
- **The agent is the demo** — it proves the skill works by generating real PnL.
- **MCP server makes it universal** — any agent framework can use TrendSurfer's intelligence.
- **Don't over-engineer** — ship fast, iterate. Working > perfect. Monorepo is for clean separation, not complexity.
- **User's strengths**: Next.js, Tailwind, Framer Motion, Solana, API integrations. LIGHT/WHITE THEME always.
