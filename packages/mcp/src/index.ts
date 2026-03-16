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
    version: '0.1.0',
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
      name: 'scan_launches',
      description:
        'Scan trends.fun for new token launches. Returns recently created tokens with their bonding curve progress.',
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
        'Analyze graduation probability for a trends.fun token. Returns a 0-100 score, velocity analysis, and reasoning.',
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
        'Check token security via Bitget Wallet API. Returns honeypot detection, mint/freeze authority, and warnings.',
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
        'Get a swap quote for buying or selling a token via Bitget Wallet (gasless).',
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
            description: 'Wallet address for the quote',
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
        const quote = await skill.getQuote({
          tokenMint: args!.tokenMint as string,
          side: args!.side as 'buy' | 'sell',
          amount: args!.amount as string,
          walletAddress: (args?.walletAddress as string) || '',
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
