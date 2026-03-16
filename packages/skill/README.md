# trendsurfer-skill

The first intelligence skill for [trends.fun](https://trends.fun) — graduation prediction, bonding curve analysis, and trade execution for Solana AI agents.

TrendSurfer gives any AI agent the ability to monitor trends.fun token launches, predict which tokens will graduate from their bonding curve to a full DEX pool, and execute trades via Bitget Wallet's gasless swap API.

## Install

```bash
npm install trendsurfer-skill
```

## Quick Start

```typescript
import { TrendSurferSkill } from 'trendsurfer-skill'

const skill = new TrendSurferSkill({
  heliusApiKey: process.env.HELIUS_API_KEY,
  heliusRpcUrl: process.env.HELIUS_RPC_URL,
})

// Scan for new trends.fun token launches
const { launches } = await skill.scanLaunches()

// Analyze graduation probability for a token
for (const launch of launches) {
  const analysis = await skill.analyzeGraduation(launch)
  console.log(`${launch.symbol}: ${analysis.score}/100 — ${analysis.velocity}`)
  console.log(analysis.reasoning)
}

// Check token security before trading
const security = await skill.checkSecurity(launches[0].mint)
if (security.safe) {
  console.log('Token passed security checks')
}
```

## API Reference

### `new TrendSurferSkill(config?)`

Create a new skill instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heliusApiKey` | `string` | `process.env.HELIUS_API_KEY` | Helius RPC API key |
| `heliusRpcUrl` | `string` | derived from key | Full Helius RPC URL |
| `pollingIntervalMs` | `number` | `10000` | Polling interval for continuous scanning |
| `maxTokenAge` | `number` | `86400000` | Max token age in ms to consider "new" |

### Scanning

#### `skill.scanLaunches(limit?): Promise<ScanResult>`

Scan for new trends.fun token launches by monitoring Meteora Dynamic Bonding Curve program activity.

#### `skill.getLaunches(): TokenLaunch[]`

Get all currently tracked/cached token launches.

#### `skill.refreshLaunches(): Promise<TokenLaunch[]>`

Refresh bonding curve progress for all tracked (non-graduated) launches.

#### `skill.startPolling(callback): void`

Start continuous polling for new launches. The callback fires whenever new tokens are discovered.

#### `skill.stopPolling(): void`

Stop continuous polling.

### Analysis

#### `skill.analyzeGraduation(launch): Promise<GraduationAnalysis>`

Full graduation probability analysis for a token. Returns:

- `score` (0-100) — composite graduation probability
- `curveProgress` (0-100) — current bonding curve fill percentage
- `velocity` — `'accelerating'` | `'steady'` | `'declining'` | `'stagnant'`
- `velocityScore` (0-100) — curve fill rate score
- `securityScore` (0-100) — token safety score
- `reasoning` — human-readable explanation

#### `skill.recordSnapshot(mint, curveProgress): void`

Record a velocity snapshot. Call periodically for accurate velocity tracking.

#### `skill.getVelocity(mint)`

Get current velocity classification and score for a token.

#### `skill.getVelocityHistory(mint): VelocitySnapshot[]`

Get all recorded velocity snapshots for a token.

### Security

#### `skill.checkSecurity(mint): Promise<SecurityCheck>`

Check token security via Bitget Wallet API. Returns honeypot detection, mint/freeze authority status, and warning list.

### Trading

#### `skill.getQuote(params): Promise<SwapQuote>`

Get a swap quote for buying or selling a token via Bitget Wallet.

```typescript
const quote = await skill.getQuote({
  tokenMint: 'So11...addr',
  side: 'buy',
  amount: '0.1', // SOL
  walletAddress: 'your-wallet-address',
  slippage: '0.5',
})
```

#### `skill.executeTrade(params): Promise<TradeExecution>`

Execute a full trade via Bitget Wallet (gasless — gas is deducted from the input token).

#### `skill.getTradeStatus(orderId): Promise<OrderDetails>`

Check the status of a submitted trade.

### Utility

#### `skill.addPool(launch): void`

Manually add a token launch to track.

#### `skill.clearCache(): void`

Clear all cached token data.

#### `skill.destroy(): void`

Stop polling and clean up resources.

## Types

All types are exported from the package:

```typescript
import type {
  TokenLaunch,
  GraduationAnalysis,
  SecurityCheck,
  SwapQuote,
  TradeExecution,
  BondingCurveState,
  SkillConfig,
  ScanResult,
  VelocitySnapshot,
} from 'trendsurfer-skill'
```

## MCP Server

For agent-framework-agnostic access, use the companion MCP server:

```bash
npm install -g trendsurfer-mcp
trendsurfer-mcp
```

Or add to your MCP config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "trendsurfer": {
      "command": "npx",
      "args": ["trendsurfer-mcp"],
      "env": {
        "HELIUS_API_KEY": "your-key"
      }
    }
  }
}
```

Available MCP tools: `scan_launches`, `analyze_graduation`, `check_security`, `get_quote`, `get_launches`, `refresh_launches`.

## How It Works

trends.fun tokens are tokenized tweets built on Meteora's Dynamic Bonding Curve (DBC). When enough buy pressure fills the bonding curve, the token "graduates" — liquidity auto-migrates to a full Meteora DAMM pool, typically causing a price jump.

TrendSurfer reads on-chain DBC pool state via Helius RPC, tracks curve fill velocity over time, runs security audits via Bitget Wallet API, and produces a composite graduation probability score. This intelligence can power autonomous trading agents, alert bots, or analytics dashboards.

## Links

- [GitHub](https://github.com/shariqazeem/trendsurfer)
- [trends.fun](https://trends.fun)
- [Meteora DBC Docs](https://docs.meteora.ag/dynamic-bonding-curve)
- [Bitget Wallet API](https://github.com/bitget-wallet-ai-lab/bitget-wallet-skill)

## License

MIT
