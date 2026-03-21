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
    version: '0.3.0',
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
        'Check token security via Bitget Wallet API. Returns safe (boolean), honeypot detection, mint/freeze authority checks, and specific warning messages.',
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
        'Get a swap quote for buying or selling a token via Bitget Wallet. Gasless — gas is deducted from input token. Minimum trade ~$5 USD.',
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
