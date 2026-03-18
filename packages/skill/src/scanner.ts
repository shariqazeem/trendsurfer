// ── Token Scanner ──
// Monitors trends.fun for new token launches by watching Meteora DBC program
// Two strategies:
// 1. Watch recent DBC transactions for new pool creations
// 2. Use Bitget historical-coins API for recently launched tokens

import { PublicKey } from '@solana/web3.js'
import {
  getConnection,
  getParsedTransaction,
  getAsset,
} from '../../../lib/helius'
import {
  METEORA_DBC_PROGRAM_ID,
  getVirtualPool,
  getPoolState,
  pollNewPools,
  findPoolsByMint,
  discoverRecentPools,
} from '../../../lib/meteora'
import type { TokenLaunch } from './types'

// Cache of known pools to avoid reprocessing
const knownPools = new Map<string, TokenLaunch>()
let lastSignature: string | undefined
let poolConfigFilter: string | undefined

/** Set the PoolConfig address to filter for (e.g. trends.fun's deployer config) */
export function setPoolConfigFilter(configAddress?: string) {
  poolConfigFilter = configAddress
}

export async function scanLaunches(limit: number = 20): Promise<TokenLaunch[]> {
  const newLaunches: TokenLaunch[] = []

  // Strategy 1: Discover pools from recent DBC transactions
  try {
    const recentPools = await discoverRecentPools(limit)

    for (const pool of recentPools) {
      if (knownPools.has(pool.poolAddress)) continue
      if (pool.isMigrated) continue

      // Filter by PoolConfig if set (e.g. only trends.fun pools)
      if (poolConfigFilter && pool.configAddress !== poolConfigFilter) continue

      // Get full state including config
      const state = await getPoolState(pool.poolAddress)
      if (!state) continue

      // Get token metadata
      let name = 'Unknown'
      let symbol = 'UNK'
      let tweetUrl: string | undefined
      let tweetAuthor: string | undefined

      try {
        const asset = await getAsset(pool.baseMint)
        if (asset) {
          name = asset.content?.metadata?.name || name
          symbol = asset.content?.metadata?.symbol || symbol
          const desc = asset.content?.metadata?.description || ''
          const extUrl = asset.content?.links?.external_url || ''
          if (extUrl.includes('x.com') || extUrl.includes('twitter.com')) {
            tweetUrl = extUrl
          }
          const authorMatch = desc.match(/@(\w+)/)
          if (authorMatch) {
            tweetAuthor = authorMatch[1]
          }
        }
      } catch {
        // Metadata fetch failed
      }

      const launch: TokenLaunch = {
        mint: pool.baseMint,
        poolAddress: pool.poolAddress,
        name,
        symbol,
        tweetUrl,
        tweetAuthor,
        createdAt: Date.now(), // Approximate — we don't have exact creation time from pool state
        curveProgress: state.curveProgress,
        graduated: state.graduated,
      }

      knownPools.set(pool.poolAddress, launch)
      newLaunches.push(launch)
    }
  } catch (error) {
    console.error('Pool discovery error:', error)
  }

  return newLaunches
}

// Get all known launches (cached)
export function getKnownLaunches(): TokenLaunch[] {
  return Array.from(knownPools.values())
}

// Refresh curve progress for all known non-graduated launches
export async function refreshLaunches(): Promise<TokenLaunch[]> {
  const launches = getKnownLaunches()

  for (const launch of launches) {
    if (launch.graduated) continue

    try {
      const poolState = await getPoolState(launch.poolAddress)
      if (poolState) {
        launch.curveProgress = poolState.curveProgress
        launch.graduated = poolState.graduated
      }
    } catch {
      // Skip failed refresh
    }
  }

  return launches
}

// Add a known pool manually (e.g., from a list of existing pools)
export function addKnownPool(launch: TokenLaunch) {
  knownPools.set(launch.poolAddress, launch)
}

// Clear the cache
export function clearCache() {
  knownPools.clear()
  lastSignature = undefined
}
