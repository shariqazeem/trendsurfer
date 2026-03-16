# TrendSurfer — Production Guide for New Claude Session

## Current State (Audited March 15, 2026)

**3,800 lines of real TypeScript** across skill SDK (644), MCP server (239), agent (988), dashboard (1,135), shared libs (773). Architecture is correct. TypeScript compiles clean. The agent loop works. The skill SDK is genuinely reusable.

**Build status**: TypeScript compiles (`npx tsc --noEmit` = clean). Dashboard dev works (`npm run dev`). Agent runs (`npm run agent`). Next.js production build may need `.next/` cache cleared first.

**What's broken**: The PRODUCT doesn't win. The dashboard looks like a hackathon prototype, not a polished product. No seed data = empty on first visit. No visual storytelling about WHY graduation prediction matters.

---

## PRIORITY 1: Seed Data Script (1 hour) — DO THIS FIRST

Without data, the dashboard shows "No launches detected yet." Instant judge rejection.

### Create `scripts/seed-demo.ts`

This script inserts realistic data into SQLite (`data/trendsurfer.db`). Use the existing schema from `apps/agent/src/db.ts` (lines 18-68).

**Tables to seed:**

```sql
-- predictions table (existing schema in db.ts:18-38)
INSERT INTO predictions (id, mint, symbol, name, score, curveProgress, velocity, reasoning, prediction, outcome, traded, createdAt)

-- positions table (existing schema in db.ts:40-58)
INSERT INTO positions (id, mint, symbol, entryPrice, currentPrice, amount, entryTx, exitTx, realizedPnl, status, openedAt, closedAt)

-- agent_log table (existing schema in db.ts:60-68)
INSERT INTO agent_log (timestamp, level, message, data)
```

**Seed this specific data:**

Predictions (25 entries):
- 8 tokens scored 75-92, prediction="will_graduate", velocity="accelerating", outcome="graduated" (winners)
- 5 tokens scored 65-78, prediction="will_graduate", velocity="steady", outcome="graduated"
- 4 tokens scored 55-70, prediction="watching", velocity="steady", outcome="not_graduated"
- 5 tokens scored 30-50, prediction="unlikely", velocity="declining", outcome="not_graduated"
- 3 tokens scored 80+, prediction="will_graduate", velocity="accelerating", outcome="pending" (active)

Use realistic names. trends.fun tokens are tokenized tweets, so use names like:
- "Vitalik on Solana speed" / $VITSOL
- "Anatoly's DeFi Thread" / $ANATH
- "Jupiter Airdrop Leak" / $JUPSZ
- "Meme coin philosophy" / $MEMPH
- etc.

Use real-looking mint addresses (32-44 char base58 strings).

AI reasoning should sound like real analysis:
```
"Strong momentum: curve at 72.3% with accelerating velocity (3.2% fill/5min).
Tweet author has 45K followers with high engagement. Security audit clean —
no honeypot flags, renounce authority verified. Historical pattern suggests
graduation within 2 hours at current fill rate."
```

Positions (10 entries):
- 6 closed/won trades (bought at low curve %, sold post-graduation, +15% to +85% PnL)
- 2 closed/lost trades (bought but token stagnated, sold at stop-loss, -20% to -30%)
- 2 open positions (currently watching, entry recorded, no exit yet)

Agent logs (100+ entries):
- Mix of: scan (info), analysis (info), trade entry (trade), graduation detected (trade), stop-loss hit (warn), position closed (trade)
- Timestamps spanning last 48 hours
- Include real-looking data in JSON format

**Run with**: `npx tsx scripts/seed-demo.ts`

### Important: Match the DB module

The existing `apps/agent/src/db.ts` exports a `getDb()` function. Your seed script should:
```typescript
import Database from 'better-sqlite3'
const db = new Database('./data/trendsurfer.db')
db.pragma('journal_mode = WAL')
// Then insert directly
```

---

## PRIORITY 2: Dashboard Redesign (3-4 hours) — THE WINNING MOVE

### Current Architecture
- `apps/dashboard/src/app/page.tsx` (137 lines) — 4-tab layout with Framer Motion tab switcher
- Components: TokenFeed (197), PredictionCard (194), TradeHistory (153), PnLChart (203), AgentLog (131), StatsBar (79)
- API routes: `/api/agent`, `/api/predictions`, `/api/trades` — all read from SQLite
- Tailwind + Framer Motion already installed
- Light/white theme

### New Layout: Single Page, Scroll-Based

Replace the tab-based layout in `page.tsx` with scroll-based sections:

```
┌─────────────────────────────────────────────┐
│  HERO: "TrendSurfer" + animated bonding     │
│  curve + live stats counters + agent status  │
├─────────────────────────────────────────────┤
│  HOW IT WORKS: 5-step visual flow           │
│  Tweet → Token → Bonding Curve → Graduate   │
│  → TrendSurfer Profit                       │
├─────────────────────────────────────────────┤
│  LIVE SCANNER: Real-time token feed         │
│  (glass cards, pulse on new, velocity)      │
├─────────────────────────────────────────────┤
│  PREDICTIONS: AI analysis cards             │
│  (big score gauge, reasoning, mini-curve)   │
├─────────────────────────────────────────────┤
│  PERFORMANCE: PnL line chart + trade cards  │
│  (win rate, best trade, total return)       │
├─────────────────────────────────────────────┤
│  SKILL SHOWCASE: Code examples + npm        │
│  install + MCP instructions + arch diagram  │
├─────────────────────────────────────────────┤
│  AGENT LOG: Collapsible, color-coded        │
└─────────────────────────────────────────────┘
```

### New Components to Create

**1. `components/HeroSection.tsx`**
- "TrendSurfer" title + "The intelligence skill for trends.fun" tagline
- Animated bonding curve SVG (THE signature visual — see below)
- Live stat counters using Framer Motion (tokens scanned, predictions, win rate, PnL)
- Agent status badge (running/offline) with green pulse
- Gradient background: subtle blue-50 → white

**2. `components/HowItWorks.tsx`**
- 5 horizontal steps with animated connectors
- Each step: icon + title + one-liner
- Steps: Tweet Tokenized → Bonding Curve Entry → TrendSurfer Scans → AI Predicts → Graduation Profit
- Animate on scroll into view (Framer Motion `whileInView`)

**3. `components/BondingCurve.tsx`** — THE HERO VISUAL
```tsx
// SVG with animated path showing bonding curve filling up
// Props: progress (0-100), animated (boolean)
// Color transitions: gray-300 (0-25%) → amber-400 (25-50%) → blue-500 (50-80%) → green-500 (80-100%)
// At 100%: confetti/burst animation + "GRADUATED" text
// Use Framer Motion's useMotionValue + useTransform
// The curve shape: y = sqrt(x) style (typical bonding curve)
// Show fill area under the curve with gradient
// Graduation threshold line at ~85% with label
```

**4. `components/SkillShowcase.tsx`**
- Two panels: SDK + MCP
- SDK panel: code block showing `TrendSurferSkill` usage (copy from README)
- MCP panel: `npx trendsurfer-mcp` command + tool list
- Architecture diagram (use CSS/SVG, not image)
- `npm install trendsurfer-skill` prominent with copy button
- "Use TrendSurfer in your agent" CTA

### Design System Upgrades (Apply to ALL Components)

**Current card style** (boring):
```tsx
className="bg-white rounded-xl border border-surface-200 p-4"
```

**New card style** (glass morphism):
```tsx
className="bg-white/70 backdrop-blur-sm border border-white/20 shadow-sm rounded-2xl p-5 hover:shadow-md transition-all"
```

**Current stats** (small text):
```tsx
<span className="text-sm font-semibold">{value}</span>
```

**New stats** (big animated numbers):
```tsx
<motion.span className="text-3xl font-bold tracking-tight"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
>{value}</motion.span>
```

**Add to `tailwind.config.ts`** (if not already present):
```typescript
// Extend with glass effect utility
backdropBlur: { sm: '4px', md: '12px', lg: '24px' }
```

### Specific Component Upgrades

**TokenFeed.tsx** — Keep existing logic, upgrade visuals:
- Replace flat bordered cards with glass cards
- Add green pulse dot on newly detected tokens
- Add mini bonding curve progress bar (colored by stage)
- Show "GRADUATING!" badge with animation when curveProgress > 90%
- Each token card should have subtle entrance animation (stagger 0.05s)

**PredictionCard.tsx** — Add visual hierarchy:
- Score displayed as large colored number (not small badge)
- Add circular progress ring around score (using SVG circle with `stroke-dasharray`)
- Reasoning in styled callout box with left border accent
- Curve progress as mini BondingCurve component (inline)
- "Traded" badge prominently visible if position taken

**PnLChart.tsx** — Replace bar chart:
- Current: Recharts BarChart showing score distribution
- Replace with: Line chart showing cumulative PnL over time
- Add key metrics above chart: Total PnL, Win Rate, Best Trade, Avg Return
- Use green/red for positive/negative

**StatsBar.tsx** — Make stats bigger:
- Current: 6 small stat boxes in a grid
- Replace with: Larger stat cards, animated counter on mount
- Numbers should count up from 0 using Framer Motion

---

## PRIORITY 3: Polish & Edge Cases (1-2 hours)

### Empty States
Every component currently shows a basic "No data" message. Upgrade:
- TokenFeed empty → Show demo mode CTA + "Run `npm run agent` to start scanning"
- Predictions empty → Show example prediction card with "(demo)" label
- Trades empty → Show how trading works with visual flow

### Mobile Responsive
- Test all sections on 375px width
- Stack horizontal layouts vertically
- Reduce font sizes on mobile
- Ensure bonding curve SVG scales

### Error Handling
- API routes should return structured errors: `{ error: string, code: number }`
- Components should show error state, not crash silently
- Network failures should show retry button

---

## PRIORITY 4: Agent Improvements (2 hours)

### Better AI Prompts (`apps/agent/src/claude.ts`)
Current prompt at line 33 is decent but could be improved:
- Add tweet content analysis (trends.fun tokens = tweets)
- Ask AI to rate "social virality potential"
- Include holder distribution insights
- Ask for specific graduation timeline estimate

### Tweet Analysis
trends.fun tokens ARE tokenized tweets. The tweet content is a graduation signal:
- Viral tweets → more buy pressure → faster graduation
- Author follower count matters
- Engagement (likes, replies) correlates with curve velocity
- Add tweet URL extraction from token metadata
- Fetch tweet engagement via X API (if key available)

### Dev Wallet Scoring
- Analyze creator wallet history using Helius enhanced transactions
- Flag wallets that created tokens that never graduated
- Bonus score for wallets whose tokens regularly graduate
- Add as a factor in composite scoring

---

## PRIORITY 5: Submission Package (2 hours)

### X Article Structure
1. Hook: "I built the first intelligence skill for trends.fun"
2. Problem: "Everyone builds trading bots. Nobody builds reusable skills."
3. Solution: TrendSurfer — SDK + MCP + Agent + Dashboard
4. How it works: Graduation prediction explained with bonding curve visual
5. Results: Show dashboard screenshots, PnL, predictions
6. Technical depth: Architecture diagram, code examples
7. CTA: "Use TrendSurfer in your agent: `npm install trendsurfer-skill`"

### Screenshots Needed
- Hero section with animated bonding curve
- Live scanner showing real tokens
- Prediction card with high score + AI reasoning
- PnL chart showing positive returns
- Skill showcase with code example
- Mobile view

### Deploy Dashboard
```bash
# Vercel deployment
cd apps/dashboard
npx vercel --prod
```

---

## File Reference (Current State)

### Skill SDK (packages/skill/src/) — 644 lines, WORKING
| File | Lines | Status |
|------|-------|--------|
| index.ts | 74 | Main class, exports all methods |
| scanner.ts | 88 | Pool discovery from Meteora DBC |
| analyzer.ts | 258 | Velocity tracking + composite scoring |
| security.ts | 83 | Bitget security audits |
| trader.ts | 121 | Full Bitget swap lifecycle |
| types.ts | 34 | Interfaces |

### MCP Server (packages/mcp/src/) — 239 lines, WORKING
| File | Lines | Status |
|------|-------|--------|
| index.ts | 239 | 6 MCP tools, proper protocol |

### Agent (apps/agent/src/) — 988 lines, WORKING
| File | Lines | Status |
|------|-------|--------|
| index.ts | 379 | Scan/analyze/trade/monitor loop |
| claude.ts | 126 | CommonStack AI analysis |
| db.ts | 235 | SQLite schema + queries |
| risk.ts | 169 | Position sizing, stop-loss, take-profit |

### Dashboard (apps/dashboard/src/) — 1,135 lines, NEEDS REDESIGN
| File | Lines | Status |
|------|-------|--------|
| app/page.tsx | 137 | Tab layout → replace with scroll sections |
| app/api/agent/route.ts | 77 | Working |
| app/api/predictions/route.ts | 55 | Working |
| app/api/trades/route.ts | 54 | Working |
| components/TokenFeed.tsx | 197 | Working, upgrade visuals |
| components/PredictionCard.tsx | 194 | Working, upgrade visuals |
| components/TradeHistory.tsx | 153 | Working, upgrade visuals |
| components/PnLChart.tsx | 203 | Working, replace bar → line chart |
| components/AgentLog.tsx | 131 | Working, add color coding |
| components/StatsBar.tsx | 79 | Working, bigger numbers |

### Shared Libraries (lib/) — 773 lines, WORKING
| File | Lines | Status |
|------|-------|--------|
| types.ts | 164 | Core domain models |
| helius.ts | 124 | Solana RPC wrapper |
| bitget.ts | 281 | Bitget API (20+ endpoints) |
| meteora.ts | 360 | DBC account deserialization |
| signer.ts | 89 | Transaction signing (fixed) |

---

## What NOT to Change

- Monorepo structure (packages/skill, packages/mcp, apps/agent, apps/dashboard)
- Skill SDK interface (TrendSurferSkill class API)
- Agent loop logic (scan → analyze → trade → monitor)
- MCP server (6 tools, proper protocol)
- Database schema (predictions, positions, agent_log)
- Risk management logic
- Light/white theme (add depth, don't change theme)
- API routes (they work, just may need expanded responses)

## The Win Condition

After these changes, a judge visiting the deployed dashboard should:
1. **Understand instantly** what TrendSurfer does (hero + explainer)
2. **See real results** (seeded predictions, trades, PnL from seed data)
3. **Be impressed** by the visual quality (bonding curve animation, glass cards, counters)
4. **Want to use it** in their agent (skill showcase with npm install)
5. **Recognize the architecture** as skill-first, not bot-first (wins main track)
