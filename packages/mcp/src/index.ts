// ── TrendSurfer MCP Server ──
// Exposes the TrendSurfer Skill as MCP tools for any AI agent framework

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { TrendSurferSkill } from '../../skill/src'

const skill = new TrendSurferSkill({
  heliusApiKey: process.env.HELIUS_API_KEY,
  heliusRpcUrl: process.env.HELIUS_RPC_URL,
})

const server = new Server(
  {
    name: 'trendsurfer',
    version: '0.4.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_by_mint',
      description:
        'Analyze any Solana token by mint address. Finds the Meteora DBC pool, checks graduation probability, holder distribution, and security. Returns score (0-100), curve progress, velocity, and detailed reasoning. This is the main tool — use it to evaluate any trends.fun token.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          mint: { type: 'string', description: 'Solana token mint address (base58)' },
        },
        required: ['mint'],
      },
    },
    {
      name: 'scan_launches',
      description:
        'Scan trends.fun for new token launches. Returns token name, symbol, mint address, pool address, curve progress %, and graduation status for each token found.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: {
            type: 'number',
            description: 'Max number of recent transactions to scan (default 20)',
          },
        },
      },
    },
    {
      name: 'analyze_graduation',
      description:
        'Analyze graduation probability for a trends.fun token. Returns a 0-100 score, velocity analysis, and reasoning. Requires both mint and poolAddress. Use analyze_by_mint instead if you only have a mint address.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          mint: { type: 'string', description: 'Token mint address' },
          poolAddress: { type: 'string', description: 'Meteora DBC pool address' },
          name: { type: 'string', description: 'Token name' },
          symbol: { type: 'string', description: 'Token symbol' },
        },
        required: ['mint', 'poolAddress'],
      },
    },
    {
      name: 'check_security',
      description:
        'Check token security. Returns safe (boolean), honeypot detection, mint/freeze authority checks, and specific warning messages.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          mint: { type: 'string', description: 'Token mint address' },
        },
        required: ['mint'],
      },
    },
    {
      name: 'get_quote',
      description:
        'Get a swap quote for buying or selling a token on Meteora DBC.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tokenMint: { type: 'string', description: 'Token mint address' },
          side: {
            type: 'string',
            enum: ['buy', 'sell'],
            description: 'Trade side',
          },
          amount: {
            type: 'string',
            description: 'Amount (SOL for buys, tokens for sells)',
          },
          walletAddress: {
            type: 'string',
            description: 'Wallet address for the quote (optional — omit if you just want a price estimate)',
          },
          slippage: {
            type: 'string',
            description: 'Slippage tolerance in % (default 0.5)',
          },
        },
        required: ['tokenMint', 'side', 'amount'],
      },
    },
    {
      name: 'score_dev_wallet',
      description:
        'Score a token creator\'s wallet risk using GoldRush (Covalent) on-chain data. Returns wallet age, portfolio diversity, transaction history, and a risk score (0-100). Requires GOLDRUSH_API_KEY env var.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          walletAddress: { type: 'string', description: 'Solana wallet address of the token creator' },
        },
        required: ['walletAddress'],
      },
    },
    {
      name: 'get_launches',
      description: 'Get all currently tracked/cached token launches.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'refresh_launches',
      description:
        'Refresh bonding curve progress for all tracked launches.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ],
}))

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'analyze_by_mint': {
        const result = await skill.analyzeByMint(args!.mint as string)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              token: { name: result.token.name, symbol: result.token.symbol, mint: result.token.mint },
              graduation: {
                score: result.graduation.score,
                curveProgress: result.graduation.curveProgress,
                velocity: result.graduation.velocity,
                reasoning: result.graduation.reasoning,
              },
              security: {
                safe: result.security.safe,
                honeypot: result.security.honeypot,
                warnings: result.security.warnings,
              },
            }, null, 2),
          }],
        }
      }

      case 'scan_launches': {
        const result = await skill.scanLaunches(args?.limit as number)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }

      case 'analyze_graduation': {
        const launch = {
          mint: args!.mint as string,
          poolAddress: args!.poolAddress as string,
          name: (args?.name as string) || 'Unknown',
          symbol: (args?.symbol as string) || 'UNK',
          createdAt: Date.now(),
          curveProgress: 0,
          graduated: false,
        }
        const analysis = await skill.analyzeGraduation(launch)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(analysis, null, 2),
            },
          ],
        }
      }

      case 'check_security': {
        const security = await skill.checkSecurity(args!.mint as string)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(security, null, 2),
            },
          ],
        }
      }

      case 'get_quote': {
        const walletAddress = (args?.walletAddress as string) || ''
        if (!walletAddress) {
          throw new Error('walletAddress is required for get_quote. Provide the Solana wallet address that will execute the swap.')
        }
        const quote = await skill.getQuote({
          tokenMint: args!.tokenMint as string,
          side: args!.side as 'buy' | 'sell',
          amount: args!.amount as string,
          walletAddress,
          slippage: args?.slippage as string,
        })
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(quote, null, 2),
            },
          ],
        }
      }

      case 'score_dev_wallet': {
        const walletAddr = args!.walletAddress as string
        const goldrushKey = process.env.GOLDRUSH_API_KEY
        if (!goldrushKey) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'GOLDRUSH_API_KEY not configured. Get a free key at goldrush.dev' }) }] }
        }
        // Fetch wallet data from GoldRush
        const [balRes, txRes] = await Promise.allSettled([
          fetch(`https://api.covalenthq.com/v1/solana-mainnet/address/${walletAddr}/balances_v2/?key=${goldrushKey}&no-spam=true`, { signal: AbortSignal.timeout(8000) }),
          fetch(`https://api.covalenthq.com/v1/solana-mainnet/address/${walletAddr}/transactions_v3/?key=${goldrushKey}&page=0&page-size=20`, { signal: AbortSignal.timeout(8000) }),
        ])
        let totalTokens = 0, totalValueUsd = 0, txCount = 0, walletAgeDays = 0, flags: string[] = []
        if (balRes.status === 'fulfilled' && balRes.value.ok) {
          const d = await balRes.value.json(); const items = d?.data?.items || []
          totalTokens = items.length; totalValueUsd = items.reduce((s: number, i: any) => s + (i.quote || 0), 0)
        }
        if (txRes.status === 'fulfilled' && txRes.value.ok) {
          const d = await txRes.value.json(); const items = d?.data?.items || []
          txCount = d?.data?.pagination?.total_count || items.length
          if (items.length > 0) { const oldest = items[items.length - 1]; walletAgeDays = Math.max(0, Math.floor((Date.now() - new Date(oldest.block_signed_at).getTime()) / 86400000)) }
        }
        let score = 50
        if (walletAgeDays >= 180) score += 20; else if (walletAgeDays >= 30) score += 10; else if (walletAgeDays < 7) { score -= 15; flags.push('New wallet') }
        if (totalTokens >= 10) score += 10; else if (totalTokens <= 1) { score -= 10; flags.push('Minimal portfolio') }
        if (totalValueUsd >= 1000) score += 10; else if (totalValueUsd >= 100) score += 5
        if (txCount >= 50) score += 10; else if (txCount < 5) { score -= 10; flags.push('Low activity') }
        score = Math.max(0, Math.min(100, score))
        return { content: [{ type: 'text' as const, text: JSON.stringify({
          address: walletAddr, walletAgeDays, totalTokens, totalValueUsd: Math.round(totalValueUsd),
          transactionCount: txCount, riskScore: score,
          riskLevel: score >= 65 ? 'low' : score >= 40 ? 'medium' : 'high', flags,
        }, null, 2) }] }
      }

      case 'get_launches': {
        const launches = skill.getLaunches()
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(launches, null, 2),
            },
          ],
        }
      }

      case 'refresh_launches': {
        const launches = await skill.refreshLaunches()
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(launches, null, 2),
            },
          ],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('TrendSurfer MCP server running on stdio')
}

main().catch(console.error)
