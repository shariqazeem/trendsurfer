# trendsurfer-mcp

MCP server for [TrendSurfer](https://github.com/shariqazeem/trendsurfer) — gives any AI agent trends.fun intelligence via Model Context Protocol.

## Setup

```bash
npx trendsurfer-mcp
```

Or add to your MCP config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "trendsurfer": {
      "command": "npx",
      "args": ["trendsurfer-mcp"],
      "env": {
        "HELIUS_API_KEY": "your-helius-api-key"
      }
    }
  }
}
```

Get a free Helius API key at [helius.dev](https://helius.dev).

## Tools

### `analyze_by_mint`

Analyze any Solana token by mint address. The main tool — use this to evaluate any trends.fun token.

**Input:** `{ mint: "token-mint-address" }`

**Returns:** Score (0-100), curve progress, velocity, security check, and detailed reasoning.

### `scan_launches`

Scan trends.fun for new token launches. Returns recently created tokens with bonding curve progress.

**Input:** `{ limit?: number }` (default 20)

### `check_security`

Check token security via Bitget Wallet API. Returns honeypot detection, mint/freeze authority, and warnings.

**Input:** `{ mint: "token-mint-address" }`

### `get_quote`

Get a swap quote for buying or selling a token via Bitget Wallet. Gasless — gas is deducted from input token.

**Input:** `{ tokenMint, side: "buy"|"sell", amount, walletAddress?, slippage? }`

### `analyze_graduation`

Full graduation analysis for a token (requires both mint and pool address). Use `analyze_by_mint` if you only have a mint address.

**Input:** `{ mint, poolAddress, name?, symbol? }`

### `get_launches` / `refresh_launches`

Get cached launches or refresh bonding curve progress for all tracked tokens.

## What is trends.fun?

trends.fun lets anyone tokenize a tweet on Solana. Tokens run on Meteora's Dynamic Bonding Curve. When the curve fills up, the token "graduates" to a DEX pool — price jumps. TrendSurfer predicts which tokens will graduate.

## Links

- [SDK](https://www.npmjs.com/package/trendsurfer-skill) — `npm install trendsurfer-skill`
- [Dashboard](https://solana-trends-agent.vercel.app)
- [GitHub](https://github.com/shariqazeem/trendsurfer)

## License

MIT
