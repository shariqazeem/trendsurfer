// ── Seed Demo Data (Turso Remote) ──
// Populates the remote Turso cloud database with realistic demo data
// so the dashboard is never empty.
//
// Run with: npx tsx scripts/seed-demo.ts

import { createClient } from '@libsql/client'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'

// Load env vars from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim()

if (!tursoUrl || !tursoToken) {
  console.error('ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local')
  process.exit(1)
}

console.log(`Connecting to Turso: ${tursoUrl}`)

const db = createClient({
  url: tursoUrl,
  authToken: tursoToken,
})

// ── Helpers ──

const now = Date.now()
const HOUR = 3_600_000
const MIN = 60_000

function hoursAgo(h: number): number {
  return now - h * HOUR
}

function minsAfter(base: number, m: number): number {
  return base + m * MIN
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number, decimals = 8): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function randomBase58(len: number): string {
  let result = ''
  for (let i = 0; i < len; i++) {
    result += BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)]
  }
  return result
}

function makeMint(suffix?: string): string {
  const base = randomBase58(suffix ? 44 - suffix.length : 44)
  return suffix ? base + suffix : base
}

function makeTxHash(): string {
  return randomBase58(88)
}

// ── Ensure tables exist ──

async function initTables(): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      mint TEXT NOT NULL,
      symbol TEXT,
      name TEXT,
      score INTEGER NOT NULL,
      curve_progress REAL NOT NULL,
      velocity TEXT,
      reasoning TEXT,
      prediction TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      outcome TEXT DEFAULT 'pending',
      traded INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      mint TEXT NOT NULL,
      symbol TEXT,
      entry_price REAL NOT NULL,
      entry_amount TEXT NOT NULL,
      entry_tx_hash TEXT,
      entry_timestamp INTEGER NOT NULL,
      current_price REAL,
      highest_price REAL,
      partial_exit_done INTEGER DEFAULT 0,
      exit_price REAL,
      exit_amount TEXT,
      exit_tx_hash TEXT,
      exit_timestamp INTEGER,
      realized_pnl REAL,
      realized_pnl_percent REAL,
      status TEXT NOT NULL DEFAULT 'open',
      graduation_score INTEGER,
      reasoning TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_predictions_mint ON predictions(mint);
    CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
    CREATE INDEX IF NOT EXISTS idx_agent_log_timestamp ON agent_log(timestamp);
  `)

  // Migrate existing positions table — add new columns if missing
  try {
    await db.execute('ALTER TABLE positions ADD COLUMN highest_price REAL')
  } catch { /* column already exists */ }
  try {
    await db.execute('ALTER TABLE positions ADD COLUMN partial_exit_done INTEGER DEFAULT 0')
  } catch { /* column already exists */ }
}

// ── Token definitions ──

interface TokenDef {
  name: string
  symbol: string
  mint: string
  category: 'winner_high' | 'winner_steady' | 'watching' | 'unlikely' | 'pending'
}

const tokens: TokenDef[] = [
  // 8 winners: high score, accelerating, graduated
  { name: 'Vitalik on Solana Speed', symbol: 'VITSOL', mint: makeMint('pump'), category: 'winner_high' },
  { name: "Anatoly's DeFi Thread", symbol: 'ANATH', mint: makeMint('moon'), category: 'winner_high' },
  { name: 'Jupiter Airdrop Leak', symbol: 'JUPSZ', mint: makeMint('pump'), category: 'winner_high' },
  { name: 'AI Agents Taking Over', symbol: 'AIAGN', mint: makeMint(), category: 'winner_high' },
  { name: 'Solana TPS Record', symbol: 'STPS', mint: makeMint('pump'), category: 'winner_high' },
  { name: 'Bonk 2.0 Launch', symbol: 'BONK2', mint: makeMint(), category: 'winner_high' },
  { name: 'Firedancer Goes Live', symbol: 'FRDNC', mint: makeMint('moon'), category: 'winner_high' },
  { name: 'Mad Lads Floor Pump', symbol: 'MADLP', mint: makeMint(), category: 'winner_high' },

  // 5 winners: moderate score, steady, graduated
  { name: 'Meme Coin Philosophy', symbol: 'MEMPH', mint: makeMint(), category: 'winner_steady' },
  { name: 'SOL to $500 Thread', symbol: 'SOL500', mint: makeMint('pump'), category: 'winner_steady' },
  { name: 'Raydium AMM v3 Reveal', symbol: 'RAYV3', mint: makeMint(), category: 'winner_steady' },
  { name: 'Wormhole V2 Launch', symbol: 'WRMV2', mint: makeMint(), category: 'winner_steady' },
  { name: 'Marinade Staking Meta', symbol: 'MRSTK', mint: makeMint('moon'), category: 'winner_steady' },

  // 4 watching: mid score, steady, not graduated
  { name: 'Phantom Wallet Update', symbol: 'PHNTM', mint: makeMint(), category: 'watching' },
  { name: 'Orca Whirlpool Yield', symbol: 'ORCWP', mint: makeMint(), category: 'watching' },
  { name: 'Tensor NFT Revival', symbol: 'TNSOR', mint: makeMint('pump'), category: 'watching' },
  { name: 'Helium Mobile Signal', symbol: 'HNTMO', mint: makeMint(), category: 'watching' },

  // 5 unlikely: low score, declining, not graduated
  { name: 'Rug Pull Confession', symbol: 'RUGCF', mint: makeMint(), category: 'unlikely' },
  { name: 'SBF Appeals Again', symbol: 'SBFAP', mint: makeMint(), category: 'unlikely' },
  { name: 'Solana Down Again?', symbol: 'SLDWN', mint: makeMint(), category: 'unlikely' },
  { name: 'Copy Trading Exposed', symbol: 'CPYTD', mint: makeMint(), category: 'unlikely' },
  { name: 'Crypto Twitter Cringe', symbol: 'CTCRG', mint: makeMint(), category: 'unlikely' },

  // 3 pending: high score, accelerating, still active
  { name: 'Drip Haus Season 5', symbol: 'DRPS5', mint: makeMint('pump'), category: 'pending' },
  { name: 'Breakpoint 2026 Hype', symbol: 'BPT26', mint: makeMint('moon'), category: 'pending' },
  { name: 'Superteam Grants Wave', symbol: 'STGRN', mint: makeMint(), category: 'pending' },
]

// ── Reasoning templates per category ──

const reasonings: Record<string, string[]> = {
  winner_high: [
    'Strong momentum: curve at {curve}% with accelerating velocity ({vel}% fill/5min). Tweet author has 45K followers with high engagement. Security audit clean — no honeypot flags, renounce authority verified. Historical pattern suggests graduation within 2 hours at current fill rate.',
    'Exceptional velocity detected: {vel}% fill rate over last 10 minutes. Dev wallet shows clean history — 3 prior graduated tokens. Holder distribution healthy at 340+ unique holders. Curve at {curve}% and accelerating. Top-10 wallets hold only 18% combined. Strong graduation signal.',
    'Viral tweet (12K likes in 30min) driving massive inflow. Curve at {curve}% with {vel}% velocity — fastest fill rate in current batch. Dev has renounced mint authority. No suspicious token account patterns. Bitget security check passed. Projecting graduation in ~90 minutes.',
    'High-conviction signal: bonding curve at {curve}% with {vel}%/5min acceleration. Original tweet from verified account (125K followers). Holder count growing at 45 new wallets/minute. No concentrated whale positions detected. Clean contract — no freeze authority, no hidden fees.',
    'Rapid curve progression: {curve}% filled with {vel}% velocity. Tweet went viral across Crypto Twitter — 8K retweets. Dev wallet analysis shows experienced deployer (5 prior graduations, 0 rugs). Token supply distribution is excellent. High probability graduation.',
    'Explosive growth pattern: curve jumped from 40% to {curve}% in 25 minutes ({vel}% velocity). Tweet source is a known alpha caller with 89K followers. On-chain analysis shows organic buying — no wash trading detected. Security audit clean across all checks.',
    'Premium signal detected: {curve}% curve progress, {vel}% fill rate. Tweet engagement ratio (likes/followers) is 3.2x above average. Dev deployed via known safe factory contract. Holder diversity index is 0.87 (excellent). This matches the profile of 78% of successful graduations in our training set.',
    'Strong graduation candidate: curve at {curve}% accelerating at {vel}%/5min. The underlying tweet is from a Solana core contributor discussing a real protocol upgrade. Dev wallet is a known deployer with 100% graduation rate (4/4). No red flags in security scan. High confidence buy signal.',
  ],
  winner_steady: [
    'Moderate but consistent momentum: curve at {curve}% with steady {vel}%/5min fill rate. Tweet author has 22K followers — decent reach. Dev wallet checks out — 2 prior graduations, clean record. Holder base is diversified. Security audit passed. Graduation likely within 3-4 hours at current pace.',
    'Steady accumulation pattern: curve at {curve}% with {vel}% fill rate. Not viral but consistent buying pressure from 15+ unique wallets per minute. Dev has renounced freeze authority. Token economics are standard (1B supply, no hidden mint). Should graduate by end of cycle.',
    'Consistent upward trajectory: {curve}% curve progress at {vel}% velocity. Tweet has moderate engagement (3.2K likes) but is being shared by several mid-tier influencers. Holder distribution looks organic. No honeypot indicators. On track for graduation within 4 hours.',
    'Gradual but reliable fill: curve at {curve}% with {vel}% steady velocity. The tweet topic (DeFi narrative) has staying power. Dev wallet shows one prior graduation. Security clean — renounced mint, no proxy patterns. Moderate confidence, worth a position.',
    'Methodical curve progression: {curve}% filled at {vel}%/5min. While not explosive, the buying pattern shows institutional-style accumulation (few large buys vs. many small). Dev is a known deployer. Security checks passed. Graduation probable within 5 hours.',
  ],
  watching: [
    'Mixed signals: curve at {curve}% but velocity has plateaued at {vel}%/5min — down from 2.1% earlier. Tweet engagement is moderate (1.8K likes). Holder distribution shows some concentration in top 5 wallets (31% of supply). Not enough conviction to trade yet. Monitoring for re-acceleration.',
    'Stalled momentum: curve reached {curve}% quickly but velocity dropped to {vel}%/5min in the last 30 minutes. Dev wallet has no prior history — first deployment. 180 holders, somewhat concentrated. Security audit clean but the lack of dev history is a yellow flag. Watching closely.',
    'Ambiguous trajectory: {curve}% curve progress but inconsistent velocity ({vel}% average with high variance). Tweet is provocative (drives engagement but also FUD). Dev wallet partially analyzed — no red flags but limited history. Holding off on trade until trend clarifies.',
    'Uncertain outcome: curve at {curve}% with {vel}% fill rate. The topic (NFT revival) has mixed sentiment on CT. Buying pressure comes in waves — 10 minutes of activity followed by 20 minutes of silence. Dev has one prior token that did not graduate. Watching but not trading.',
  ],
  unlikely: [
    'Weak fundamentals: curve stalled at {curve}% with declining velocity ({vel}%/5min, down from 1.8%). Tweet engagement is low relative to follower count (0.2% ratio). Top wallet holds 15% of supply — concentration risk. Dev wallet shows 2 prior tokens, both failed to graduate. Not recommended.',
    'Negative trajectory: curve at {curve}% and velocity declining to {vel}%/5min. The tweet topic (negative news) drives engagement but not buying intent. Holder count growing slowly (3 new wallets/min). Dev wallet has one prior rug — significant red flag. Avoid.',
    'Stagnant curve at {curve}% with {vel}% velocity and no signs of recovery. Tweet has been up for 6 hours with diminishing engagement. Only 85 unique holders — very thin market. Dev wallet associated with a token that was flagged for honeypot behavior 2 weeks ago. Strong avoid signal.',
    'Declining interest: curve stuck at {curve}% for over 2 hours. Velocity collapsed to {vel}%/5min from initial 1.5%. The underlying tweet is losing engagement (comments turning negative). Holder distribution heavily concentrated — top 3 wallets hold 40%. Security concerns flagged by Bitget audit. Not tradeable.',
    'Failed to gain traction: {curve}% curve after 8 hours of trading. Velocity at {vel}%/5min — essentially flatlined. Only 62 holders. Dev wallet is fresh (created 2 days ago) with no prior deployments. Token contract has unusual transfer fee logic. Multiple red flags — do not trade.',
  ],
  pending: [
    'Active monitoring: curve at {curve}% with {vel}%/5min velocity and accelerating. Tweet just went viral in the last hour (7K likes, climbing). Dev wallet shows 3 prior successful graduations. Holder base growing rapidly (50+ new wallets/5min). Security audit clean. Preparing to execute buy order — waiting for velocity confirmation above 3.5%.',
    'High-priority watch: curve at {curve}% with strong {vel}%/5min velocity. Just detected a spike in social mentions across 4 CT accounts with 100K+ combined reach. Dev is a known deployer with excellent track record. Curve acceleration suggests graduation within 2-3 hours. Position sizing calculated, awaiting final confirmation.',
    'Pre-trade analysis complete: curve at {curve}% with {vel}%/5min fill rate. The tweet (Superteam announcement) has institutional backing — genuine news. Dev wallet deployed from a Squads multisig (good sign). 280 holders and growing. All security checks passed. Queuing buy order for next scan cycle.',
  ],
}

// ── Build predictions ──

interface PredictionRow {
  id: string
  mint: string
  symbol: string
  name: string
  score: number
  curve_progress: number
  velocity: string
  reasoning: string
  prediction: string
  created_at: number
  resolved_at: number | null
  outcome: string
  traded: number
}

const predictionRows: PredictionRow[] = []

for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i]
  let score: number
  let curveProgress: number
  let velocity: string
  let prediction: string
  let outcome: string
  let createdAt: number
  let resolvedAt: number | null
  let velNum: number

  switch (t.category) {
    case 'winner_high':
      score = randInt(75, 92)
      curveProgress = randFloat(85, 100, 1)
      velNum = randFloat(2.5, 5.8, 1)
      velocity = 'accelerating'
      prediction = 'will_graduate'
      outcome = 'graduated'
      createdAt = hoursAgo(randInt(6, 44))
      resolvedAt = minsAfter(createdAt, randInt(45, 180))
      break
    case 'winner_steady':
      score = randInt(65, 78)
      curveProgress = randFloat(88, 100, 1)
      velNum = randFloat(1.2, 2.4, 1)
      velocity = 'steady'
      prediction = 'will_graduate'
      outcome = 'graduated'
      createdAt = hoursAgo(randInt(8, 46))
      resolvedAt = minsAfter(createdAt, randInt(90, 240))
      break
    case 'watching':
      score = randInt(55, 70)
      curveProgress = randFloat(40, 70, 1)
      velNum = randFloat(0.5, 1.5, 1)
      velocity = 'steady'
      prediction = 'watching'
      outcome = 'not_graduated'
      createdAt = hoursAgo(randInt(4, 38))
      resolvedAt = minsAfter(createdAt, randInt(120, 240))
      break
    case 'unlikely':
      score = randInt(30, 50)
      curveProgress = randFloat(5, 35, 1)
      velNum = randFloat(0.1, 0.8, 1)
      velocity = 'declining'
      prediction = 'unlikely'
      outcome = 'not_graduated'
      createdAt = hoursAgo(randInt(6, 47))
      resolvedAt = minsAfter(createdAt, randInt(60, 240))
      break
    case 'pending':
      score = randInt(80, 95)
      curveProgress = randFloat(75, 95, 1)
      velNum = randFloat(2.8, 4.5, 1)
      velocity = 'accelerating'
      prediction = 'will_graduate'
      outcome = 'pending'
      createdAt = hoursAgo(randInt(0, 3))
      resolvedAt = null
      break
    default:
      throw new Error(`Unknown category: ${t.category}`)
  }

  // Pick reasoning template and fill in values
  const templates = reasonings[t.category]
  const template = templates[i % templates.length]
  const reasoning = template
    .replace('{curve}', curveProgress.toFixed(1))
    .replace(/{vel}/g, velNum.toFixed(1))

  predictionRows.push({
    id: crypto.randomUUID(),
    mint: t.mint,
    symbol: t.symbol,
    name: t.name,
    score,
    curve_progress: curveProgress,
    velocity,
    reasoning,
    prediction,
    created_at: createdAt,
    resolved_at: resolvedAt,
    outcome,
    traded: 0,
  })
}

// Mark certain tokens as traded (the ones we'll create positions for)
// 6 winning from winner_high, 2 losing from winner_steady, 2 open from pending
const winnerIndices = [0, 1, 2, 3, 5, 7]  // 6 winning closed trades
const loserIndices = [8, 9]                 // 2 losing closed trades
const openIndices = [22, 23]                // 2 open positions from pending

const allTradedIndices = [...winnerIndices, ...loserIndices, ...openIndices]
for (const idx of allTradedIndices) {
  predictionRows[idx].traded = 1
}

// ── Position definitions ──

const winningTrades = [
  { idx: 0, entryPrice: 0.0000032, exitPriceMult: 1.45, amount: '0.08', pnlPct: 45.2 },
  { idx: 1, entryPrice: 0.0000078, exitPriceMult: 1.82, amount: '0.06', pnlPct: 82.1 },
  { idx: 2, entryPrice: 0.0000015, exitPriceMult: 1.35, amount: '0.1', pnlPct: 35.0 },
  { idx: 3, entryPrice: 0.0000245, exitPriceMult: 1.58, amount: '0.07', pnlPct: 58.3 },
  { idx: 5, entryPrice: 0.0000041, exitPriceMult: 1.22, amount: '0.09', pnlPct: 22.1 },
  { idx: 7, entryPrice: 0.0000098, exitPriceMult: 1.15, amount: '0.05', pnlPct: 15.4 },
]

const losingTrades = [
  { idx: 8, entryPrice: 0.0000056, exitPriceMult: 0.72, amount: '0.08', pnlPct: -28.3 },
  { idx: 9, entryPrice: 0.0000034, exitPriceMult: 0.78, amount: '0.06', pnlPct: -22.1 },
]

const openTrades = [
  { idx: 22, entryPrice: 0.0000019, currentPriceMult: 1.12, amount: '0.08' },
  { idx: 23, entryPrice: 0.0000063, currentPriceMult: 1.08, amount: '0.06' },
]

const positionReasonings = [
  'Graduation imminent — curve at 92% with 4.1% velocity. Entering position ahead of DEX migration for price jump capture.',
  'Dev wallet credibility confirmed (5 prior graduations). Curve acceleration matches top-decile graduation pattern. Sizing at 0.06 SOL within risk limits.',
  'Viral tweet driving rapid curve fill. Entry at pre-graduation price — expecting 30-50% premium on DEX listing. Stop-loss set at -25%.',
  'AI signal strength 91/100. Curve velocity 3.8%/5min on accelerating trend. Historical analog analysis shows 85% probability of graduation within 2 hours.',
  'Strong social signal + clean security audit. Entering with moderate size. Target: graduation price jump. Risk: velocity stall.',
  'Multiple alpha callers sharing this token. Curve progress healthy. Entering at conservative size with tight stop-loss.',
  'Steady curve progression with decent social metrics. Entered on graduation probability above 70%. Exit plan: sell 50% at graduation, trail stop on remainder.',
  'Moderate conviction trade — steady velocity but good dev history. Sized down to 0.06 SOL given mixed signals.',
  'High-conviction pre-graduation play. Curve at 82% and accelerating. Dev wallet is multisig-deployed. Awaiting graduation event.',
  'Strong Breakpoint narrative play. Curve filling fast with institutional-style accumulation. Positioned for graduation within next 3 hours.',
]

// ── Agent log message data ──

const fillerInfoMessages = [
  'Bonding curve state refreshed for 12 tracked tokens',
  'Security audit batch complete — 0 honeypots detected in current scan',
  'Bitget Wallet connection healthy — gasless execution available',
  'Portfolio snapshot: 2 open positions, 8 closed, total PnL +0.19 SOL',
  'Helius RPC latency: 45ms average (healthy)',
  'Token leaderboard updated: $ANATH leads with +82.1% return',
  'Risk manager: total exposure 0.14 SOL (below 0.5 SOL limit)',
  'Claude analysis pipeline: 25 tokens analyzed in last 24 hours',
  'Graduation event detected: $JUPSZ migrated to Raydium DEX',
  'Graduation event detected: $AIAGN migrated to Orca Whirlpool',
  'New token detected: checking Meteora DBC pool state...',
  'Dev wallet analysis complete for 3 new tokens',
  'Historical graduation data updated: 62% avg graduation rate for trending tweets',
  'WebSocket connection to Helius re-established',
  'Position manager: recalculated unrealized PnL for 2 open positions',
]

// ── Main async function ──

async function seed(): Promise<void> {
  console.log('Initializing tables...')
  await initTables()

  // ── Clear existing data ──
  console.log('Clearing existing data...')
  await db.execute('DELETE FROM predictions')
  await db.execute('DELETE FROM positions')
  await db.execute('DELETE FROM agent_log')

  // ── Insert predictions using batch ──
  console.log('Inserting 25 predictions...')

  const predStatements = predictionRows.map((row) => ({
    sql: `INSERT INTO predictions (id, mint, symbol, name, score, curve_progress, velocity, reasoning, prediction, created_at, resolved_at, outcome, traded)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.id,
      row.mint,
      row.symbol,
      row.name,
      row.score,
      row.curve_progress,
      row.velocity,
      row.reasoning,
      row.prediction,
      row.created_at,
      row.resolved_at,
      row.outcome,
      row.traded,
    ],
  }))

  await db.batch(predStatements, 'write')

  // ── Build position statements ──
  console.log('Inserting 10 positions...')

  const posStatements: { sql: string; args: any[] }[] = []

  // 6 closed winning trades
  for (let i = 0; i < winningTrades.length; i++) {
    const wt = winningTrades[i]
    const pred = predictionRows[wt.idx]
    const entryTs = minsAfter(pred.created_at, randInt(2, 8))
    const exitTs = minsAfter(entryTs, randInt(30, 180))
    const exitPrice = parseFloat((wt.entryPrice * wt.exitPriceMult).toFixed(10))
    const entryAmountNum = parseFloat(wt.amount)
    const realizedPnl = parseFloat((entryAmountNum * (wt.pnlPct / 100)).toFixed(4))
    const highestPrice = parseFloat((wt.entryPrice * wt.exitPriceMult * randFloat(1.0, 1.08, 2)).toFixed(10))

    posStatements.push({
      sql: `INSERT INTO positions (id, mint, symbol, entry_price, entry_amount, entry_tx_hash, entry_timestamp, current_price, highest_price, partial_exit_done, exit_price, exit_amount, exit_tx_hash, exit_timestamp, realized_pnl, realized_pnl_percent, status, graduation_score, reasoning)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        pred.mint,
        pred.symbol,
        wt.entryPrice,
        wt.amount,
        makeTxHash(),
        entryTs,
        null,             // current_price (null for closed)
        highestPrice,
        0,                // partial_exit_done
        exitPrice,
        (entryAmountNum * wt.exitPriceMult).toFixed(4),
        makeTxHash(),
        exitTs,
        realizedPnl,
        wt.pnlPct,
        'closed',
        pred.score,
        positionReasonings[i],
      ],
    })
  }

  // 2 closed losing trades
  for (let i = 0; i < losingTrades.length; i++) {
    const lt = losingTrades[i]
    const pred = predictionRows[lt.idx]
    const entryTs = minsAfter(pred.created_at, randInt(3, 10))
    const exitTs = minsAfter(entryTs, randInt(30, 120))
    const exitPrice = parseFloat((lt.entryPrice * lt.exitPriceMult).toFixed(10))
    const entryAmountNum = parseFloat(lt.amount)
    const realizedPnl = parseFloat((entryAmountNum * (lt.pnlPct / 100)).toFixed(4))
    // For losers, highest price was slightly above entry before dropping
    const highestPrice = parseFloat((lt.entryPrice * randFloat(1.02, 1.12, 2)).toFixed(10))

    posStatements.push({
      sql: `INSERT INTO positions (id, mint, symbol, entry_price, entry_amount, entry_tx_hash, entry_timestamp, current_price, highest_price, partial_exit_done, exit_price, exit_amount, exit_tx_hash, exit_timestamp, realized_pnl, realized_pnl_percent, status, graduation_score, reasoning)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        pred.mint,
        pred.symbol,
        lt.entryPrice,
        lt.amount,
        makeTxHash(),
        entryTs,
        null,
        highestPrice,
        0,
        exitPrice,
        (entryAmountNum * lt.exitPriceMult).toFixed(4),
        makeTxHash(),
        exitTs,
        realizedPnl,
        lt.pnlPct,
        'closed',
        pred.score,
        positionReasonings[6 + i],
      ],
    })
  }

  // 2 open positions
  for (let i = 0; i < openTrades.length; i++) {
    const ot = openTrades[i]
    const pred = predictionRows[ot.idx]
    const entryTs = minsAfter(pred.created_at, randInt(2, 5))
    const currentPrice = parseFloat((ot.entryPrice * ot.currentPriceMult).toFixed(10))
    const highestPrice = parseFloat((ot.entryPrice * ot.currentPriceMult * randFloat(1.01, 1.05, 2)).toFixed(10))

    posStatements.push({
      sql: `INSERT INTO positions (id, mint, symbol, entry_price, entry_amount, entry_tx_hash, entry_timestamp, current_price, highest_price, partial_exit_done, exit_price, exit_amount, exit_tx_hash, exit_timestamp, realized_pnl, realized_pnl_percent, status, graduation_score, reasoning)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        pred.mint,
        pred.symbol,
        ot.entryPrice,
        ot.amount,
        makeTxHash(),
        entryTs,
        currentPrice,
        highestPrice,
        0,
        null,   // no exit_price
        null,   // no exit_amount
        null,   // no exit_tx_hash
        null,   // no exit_timestamp
        null,   // no realized_pnl
        null,   // no realized_pnl_percent
        'open',
        pred.score,
        positionReasonings[8 + i],
      ],
    })
  }

  await db.batch(posStatements, 'write')

  // ── Build agent log entries ──
  console.log('Inserting 50 agent logs...')

  interface LogEntry {
    timestamp: number
    level: string
    message: string
    data: string | null
  }

  const logEntries: LogEntry[] = []

  // Agent start event
  logEntries.push({
    timestamp: hoursAgo(47.5),
    level: 'info',
    message: 'Agent started — TrendSurfer v0.1.0 initializing...',
    data: JSON.stringify({ version: '0.1.0', mode: 'autonomous' }),
  })

  // Scan cycle logs (8 cycles spread across 48 hours)
  const scanTimes = Array.from({ length: 8 }, (_, i) => hoursAgo(44 - i * 5.5))
  for (const ts of scanTimes) {
    const found = randInt(1, 5)
    logEntries.push({
      timestamp: ts,
      level: 'info',
      message: `Scan cycle: found ${found} new launch${found > 1 ? 'es' : ''} on trends.fun`,
      data: JSON.stringify({ count: found, source: 'meteora_dbc' }),
    })
  }

  // Token-specific analysis logs (one per traded token)
  for (const idx of allTradedIndices) {
    const pred = predictionRows[idx]
    logEntries.push({
      timestamp: minsAfter(pred.created_at, randInt(1, 4)),
      level: 'info',
      message: `Analyzing $${pred.symbol} — score ${pred.score}, velocity ${pred.velocity}`,
      data: JSON.stringify({ mint: pred.mint, score: pred.score, velocity: pred.velocity, curve: pred.curve_progress }),
    })
  }

  // Trade entry logs
  for (const wt of winningTrades) {
    const pred = predictionRows[wt.idx]
    const buyTs = minsAfter(pred.created_at, randInt(2, 8))
    logEntries.push({
      timestamp: buyTs,
      level: 'trade',
      message: `Trade entry: buying $${pred.symbol} at ${wt.amount} SOL (score: ${pred.score})`,
      data: JSON.stringify({ mint: pred.mint, amount: wt.amount, price: wt.entryPrice, action: 'buy' }),
    })
  }

  for (const lt of losingTrades) {
    const pred = predictionRows[lt.idx]
    const buyTs = minsAfter(pred.created_at, randInt(3, 10))
    logEntries.push({
      timestamp: buyTs,
      level: 'trade',
      message: `Trade entry: buying $${pred.symbol} at ${lt.amount} SOL (score: ${pred.score})`,
      data: JSON.stringify({ mint: pred.mint, amount: lt.amount, price: lt.entryPrice, action: 'buy' }),
    })
  }

  for (const ot of openTrades) {
    const pred = predictionRows[ot.idx]
    const buyTs = minsAfter(pred.created_at, randInt(2, 5))
    logEntries.push({
      timestamp: buyTs,
      level: 'trade',
      message: `Trade entry: buying $${pred.symbol} at ${ot.amount} SOL (score: ${pred.score})`,
      data: JSON.stringify({ mint: pred.mint, amount: ot.amount, price: ot.entryPrice, action: 'buy' }),
    })
  }

  // Graduation detected logs
  logEntries.push({
    timestamp: minsAfter(predictionRows[2].created_at, randInt(50, 120)),
    level: 'info',
    message: `Graduation detected: $${predictionRows[2].symbol} migrated to DAMM pool`,
    data: JSON.stringify({ mint: predictionRows[2].mint, event: 'graduation' }),
  })
  logEntries.push({
    timestamp: minsAfter(predictionRows[3].created_at, randInt(60, 150)),
    level: 'info',
    message: `Graduation detected: $${predictionRows[3].symbol} migrated to DAMM pool`,
    data: JSON.stringify({ mint: predictionRows[3].mint, event: 'graduation' }),
  })

  // Sell / exit logs for winning trades
  for (const wt of winningTrades) {
    const pred = predictionRows[wt.idx]
    const sellTs = minsAfter(pred.created_at, randInt(60, 200))
    logEntries.push({
      timestamp: sellTs,
      level: 'trade',
      message: `Position closed: $${pred.symbol} +${wt.pnlPct.toFixed(1)}% profit`,
      data: JSON.stringify({ mint: pred.mint, pnl_percent: wt.pnlPct, action: 'sell', reason: 'graduation' }),
    })
  }

  // Stop-loss logs for losing trades
  for (const lt of losingTrades) {
    const pred = predictionRows[lt.idx]
    const sellTs = minsAfter(pred.created_at, randInt(40, 120))
    logEntries.push({
      timestamp: sellTs,
      level: 'trade',
      message: `Stop-loss triggered: selling $${pred.symbol} at ${lt.pnlPct.toFixed(1)}%`,
      data: JSON.stringify({ mint: pred.mint, pnl_percent: lt.pnlPct, action: 'sell', reason: 'stop_loss' }),
    })
  }

  // Warning logs
  logEntries.push({
    timestamp: hoursAgo(18),
    level: 'warn',
    message: `High holder concentration detected for $${predictionRows[15].symbol} — top wallet holds 15%`,
    data: JSON.stringify({ mint: predictionRows[15].mint, top_holder_pct: 15.2 }),
  })
  logEntries.push({
    timestamp: hoursAgo(31),
    level: 'warn',
    message: `Security flag: $${predictionRows[17].symbol} has suspicious transfer fee logic`,
    data: JSON.stringify({ mint: predictionRows[17].mint, flag: 'transfer_fee_anomaly' }),
  })
  logEntries.push({
    timestamp: hoursAgo(8),
    level: 'warn',
    message: 'RPC rate limit approaching — throttling scan frequency to 1/min',
    data: JSON.stringify({ rpc_calls_last_hour: 892, limit: 1000 }),
  })

  // Filler info logs
  for (let i = 0; i < fillerInfoMessages.length; i++) {
    logEntries.push({
      timestamp: hoursAgo(randFloat(0.5, 46, 1)),
      level: 'info',
      message: fillerInfoMessages[i],
      data: null,
    })
  }

  // Sort by timestamp and trim to exactly 50
  logEntries.sort((a, b) => a.timestamp - b.timestamp)
  const finalLogs = logEntries.slice(0, 50)

  const logStatements = finalLogs.map((log) => ({
    sql: 'INSERT INTO agent_log (timestamp, level, message, data) VALUES (?, ?, ?, ?)',
    args: [log.timestamp, log.level, log.message, log.data],
  }))

  await db.batch(logStatements, 'write')

  // ── Summary ──
  const predResult = await db.execute('SELECT COUNT(*) as c FROM predictions')
  const posResult = await db.execute('SELECT COUNT(*) as c FROM positions')
  const logResult = await db.execute('SELECT COUNT(*) as c FROM agent_log')
  const pnlResult = await db.execute(
    "SELECT COALESCE(SUM(realized_pnl), 0) as total FROM positions WHERE status = 'closed'"
  )

  const totalPredictions = (predResult.rows[0] as any).c
  const totalPositions = (posResult.rows[0] as any).c
  const totalLogs = (logResult.rows[0] as any).c
  const totalPnl = (pnlResult.rows[0] as any).total

  console.log('')
  console.log('=== Seed Complete ===')
  console.log(`Predictions: ${totalPredictions}`)
  console.log(`Positions:   ${totalPositions}`)
  console.log(`Agent Logs:  ${totalLogs}`)
  console.log(`Total PnL:   ${Number(totalPnl).toFixed(4)} SOL`)
  console.log(`Database:    ${tursoUrl}`)
  console.log('')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
