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

// Exponential backoff state for RPC 429s
let backoffMs = 0
let lastRateLimit = 0
const MAX_BACKOFF = 5 * 60 * 1000 // 5 minutes max

function checkBackoff(): boolean {
  if (backoffMs > 0 && Date.now() - lastRateLimit < backoffMs) {
    const remaining = Math.round((backoffMs - (Date.now() - lastRateLimit)) / 1000)
    console.log(`RPC backoff active — ${remaining}s remaining`)
    return true // skip this cycle
  }
  return false
}

function handleRateLimit() {
  lastRateLimit = Date.now()
  backoffMs = backoffMs === 0 ? 15000 : Math.min(backoffMs * 2, MAX_BACKOFF)
  console.log(`RPC 429 — backing off for ${backoffMs / 1000}s`)
}

function resetBackoff() {
  if (backoffMs > 0) {
    console.log('RPC backoff cleared — calls succeeding')
    backoffMs = 0
  }
}

/** Set the PoolConfig address to filter for (e.g. trends.fun's deployer config) */
export function setPoolConfigFilter(configAddress?: string) {
  poolConfigFilter = configAddress
}

export async function scanLaunches(limit: number = 20): Promise<TokenLaunch[]> {
  // Skip if in backoff from previous 429
  if (checkBackoff()) return []

  const newLaunches: TokenLaunch[] = []

  // Strategy 1: Discover pools from recent DBC transactions
  try {
    const recentPools = await discoverRecentPools(limit)
    resetBackoff() // RPC call succeeded

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
  } catch (error: any) {
    const msg = String(error?.message || error)
    if (msg.includes('429') || msg.includes('rate') || msg.includes('max usage')) {
      handleRateLimit()
    } else {
      console.error('Pool discovery error:', msg.substring(0, 200))
    }
  }

  return newLaunches
}

// Get all known launches (cached)
export function getKnownLaunches(): TokenLaunch[] {
  return Array.from(knownPools.values())
}

// Refresh curve progress for promising non-graduated launches only
// Skips graduated tokens and tokens below 40% curve to save RPC calls
export async function refreshLaunches(): Promise<TokenLaunch[]> {
  if (checkBackoff()) return getKnownLaunches()

  const launches = getKnownLaunches()
  let refreshed = 0

  for (const launch of launches) {
    // Skip graduated tokens — no need to check anymore
    if (launch.graduated) continue
    // Skip low-progress tokens — they rarely change fast enough to matter
    if (launch.curveProgress < 40) continue

    try {
      const poolState = await getPoolState(launch.poolAddress)
      if (poolState) {
        launch.curveProgress = poolState.curveProgress
        launch.graduated = poolState.graduated
        refreshed++
      }
      resetBackoff()
    } catch (error: any) {
      const msg = String(error?.message || error)
      if (msg.includes('429') || msg.includes('rate') || msg.includes('max usage')) {
        handleRateLimit()
        break // Stop refreshing on rate limit
      }
    }
  }

  if (refreshed > 0) {
    console.log(`Refreshed ${refreshed} active tokens (>40% curve)`)
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
