// ── TrendSurfer Skill ──
// The intelligence skill for trends.fun
// Provides graduation prediction, bonding curve analysis, and trade execution

import {
  scanLaunches,
  getKnownLaunches,
  refreshLaunches,
  addKnownPool,
  clearCache,
  setPoolConfigFilter,
} from './scanner'
import {
  analyzeGraduation,
  recordSnapshot,
  calculateVelocity,
  getVelocityHistory,
} from './analyzer'
import { checkTokenSecurity } from './security'
import { getTradeQuote, executeTrade, getTradeStatus } from './trader'
import { findPoolsByMint, getPoolState } from '../../../lib/meteora'
import { getAsset } from '../../../lib/helius'
import type {
  TokenLaunch,
  GraduationAnalysis,
  SecurityCheck,
  SwapQuote,
  TradeExecution,
  SkillConfig,
  ScanResult,
  CreatorProfile,
} from './types'
import { getTokenInfo } from '../../../lib/bitget'

export class TrendSurferSkill {
  private config: SkillConfig
  private pollingTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: SkillConfig = {}) {
    this.config = {
      pollingIntervalMs: 10000,
      maxTokenAge: 24 * 60 * 60 * 1000, // 24 hours
      ...config,
    }

    // Set env vars if provided
    if (config.heliusApiKey) {
      process.env.HELIUS_API_KEY = config.heliusApiKey
    }
    if (config.heliusRpcUrl) {
      process.env.HELIUS_RPC_URL = config.heliusRpcUrl
    }
    // Set pool config filter for trends.fun-specific scanning
    if (config.poolConfigAddress) {
      setPoolConfigFilter(config.poolConfigAddress)
    }
  }

  // ── Validation ──

  /** Validate a Solana mint address (base58, 32-44 chars) */
  private async validateMint(mint: string): Promise<void> {
    if (!mint || mint.length < 32 || mint.length > 44) {
      throw new Error('Invalid Solana mint address: must be 32-44 characters')
    }
    try {
      const { PublicKey } = await import('@solana/web3.js')
      new PublicKey(mint)
    } catch {
      throw new Error('Invalid Solana mint address: not valid base58')
    }
  }

  // ── One-shot Analysis ──

  /** One-shot analysis: pass a mint address, get graduation score + security check.
   *  This is the killer feature — finds the pool, fetches metadata, and returns
   *  a combined graduation analysis + security report in one call.
   *
   *  @param mint - Solana token mint address (base58, 32-44 chars)
   *  @returns Object with `graduation` (GraduationAnalysis), `security` (SecurityCheck), and `token` (TokenLaunch)
   *  @throws If mint is invalid or no Meteora DBC pool is found
   */
  async analyzeByMint(mint: string): Promise<{
    graduation: GraduationAnalysis
    security: SecurityCheck
    token: TokenLaunch
  }> {
    await this.validateMint(mint)

    // Find pool
    const poolAddresses = await findPoolsByMint(mint)
    if (!poolAddresses || poolAddresses.length === 0) {
      throw new Error(`No Meteora DBC pool found for mint ${mint}`)
    }

    // Get full pool state for curve progress and graduation status
    const poolState = await getPoolState(poolAddresses[0])
    const curveProgress = poolState?.curveProgress ?? 0
    const graduated = poolState?.graduated ?? false

    // Get metadata
    let name = 'Unknown'
    let symbol = 'UNK'
    let tweetUrl: string | undefined
    let tweetAuthor: string | undefined
    try {
      const asset = await getAsset(mint)
      if (asset) {
        name = asset.content?.metadata?.name || name
        symbol = asset.content?.metadata?.symbol || symbol
        const extUrl = asset.content?.links?.external_url || ''
        if (extUrl.includes('x.com') || extUrl.includes('twitter.com')) {
          tweetUrl = extUrl
        }
        const desc = asset.content?.metadata?.description || ''
        const authorMatch = desc.match(/@(\w+)/)
        if (authorMatch) tweetAuthor = authorMatch[1]
      }
    } catch { /* metadata optional */ }

    const token: TokenLaunch = {
      mint,
      poolAddress: poolAddresses[0],
      name,
      symbol,
      tweetUrl,
      tweetAuthor,
      createdAt: Date.now(),
      curveProgress,
      graduated,
    }

    // Run graduation analysis + security check in parallel
    const [graduation, security] = await Promise.all([
      this.analyzeGraduation(token),
      this.checkSecurity(mint),
    ])

    return { graduation, security, token }
  }

  // ── Scanning ──

  /** Scan for new trends.fun token launches */
  async scanLaunches(limit?: number): Promise<ScanResult> {
    const launches = await scanLaunches(limit)
    return {
      launches,
      totalScanned: launches.length,
      timestamp: Date.now(),
    }
  }

  /** Get all cached/known launches */
  getLaunches(): TokenLaunch[] {
    return getKnownLaunches()
  }

  /** Refresh curve progress for all tracked launches */
  async refreshLaunches(): Promise<TokenLaunch[]> {
    return refreshLaunches()
  }

  /** Start continuous polling for new launches */
  startPolling(callback: (launches: TokenLaunch[]) => void): void {
    if (this.pollingTimer) return

    this.pollingTimer = setInterval(async () => {
      try {
        const result = await scanLaunches()
        if (result.length > 0) {
          callback(result)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, this.config.pollingIntervalMs)
  }

  /** Stop continuous polling */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  // ── Analysis ──

  /** Analyze graduation probability for a token */
  async analyzeGraduation(launch: TokenLaunch): Promise<GraduationAnalysis> {
    return analyzeGraduation(launch)
  }

  /** Record a velocity snapshot (call periodically for accurate velocity tracking) */
  recordSnapshot(mint: string, curveProgress: number): void {
    recordSnapshot(mint, curveProgress)
  }

  /** Get velocity data for a token */
  getVelocity(mint: string) {
    return calculateVelocity(mint)
  }

  /** Get velocity history for a token */
  getVelocityHistory(mint: string) {
    return getVelocityHistory(mint)
  }

  // ── Security ──

  /** Check token security via Bitget Wallet API */
  async checkSecurity(mint: string): Promise<SecurityCheck> {
    await this.validateMint(mint)
    return checkTokenSecurity(mint)
  }

  // ── Trading ──

  /** Get a swap quote from Bitget Wallet API.
   *
   *  @returns The Bitget quote response containing route info, expected output amount,
   *  price impact, and transaction data needed for execution. Shape depends on Bitget API
   *  but typically includes `{ toAmount, priceImpact, route, txData }`.
   */
  async getQuote(params: {
    tokenMint: string
    tokenSymbol?: string
    side: 'buy' | 'sell'
    amount: string
    walletAddress: string
    slippage?: string
  }): Promise<any> {
    return getTradeQuote(params)
  }

  /** Execute a trade via Bitget Wallet (gasless) */
  async executeTrade(params: {
    tokenMint: string
    side: 'buy' | 'sell'
    amountSol?: string
    amountToken?: string
    slippage?: string
    walletAddress: string
    gasless?: boolean
    signTransaction: (txData: any) => Promise<{ sig: string }[]>
  }): Promise<TradeExecution> {
    return executeTrade(params)
  }

  /** Check trade execution status via Bitget Wallet API.
   *
   *  @param orderId - The order ID returned from `executeTrade`
   *  @returns Order status object from Bitget, typically `{ orderId, status, txHash, ... }`
   *  where status is one of 'pending' | 'confirmed' | 'failed'.
   */
  async getTradeStatus(orderId: string) {
    return getTradeStatus(orderId)
  }

  // ── Creator Wallet Risk (GoldRush + Bitget) ──

  /**
   * Score a token creator's wallet risk using GoldRush (Covalent) on-chain data
   * and Bitget's creator intelligence (rug history, token deploy count).
   * Requires GOLDRUSH_API_KEY env var for wallet data.
   * Bitget data works without an API key.
   *
   * @param creatorAddress - Solana wallet address of the token creator
   * @param tokenMint - Optional: token mint to fetch Bitget creator intel (rug count)
   */
  async scoreDevWallet(creatorAddress: string, tokenMint?: string): Promise<CreatorProfile> {
    const profile: CreatorProfile = {
      address: creatorAddress,
      walletAgeDays: 0,
      totalTokens: 0,
      totalValueUsd: 0,
      transactionCount: 0,
      riskScore: 50,
      riskLevel: 'medium',
      flags: [],
    }

    const goldrushKey = process.env.GOLDRUSH_API_KEY
    const fetches: Promise<void>[] = []

    // 1. GoldRush: wallet balances + transactions
    if (goldrushKey) {
      fetches.push((async () => {
        try {
          const res = await fetch(
            `https://api.covalenthq.com/v1/solana-mainnet/address/${creatorAddress}/balances_v2/?key=${goldrushKey}&no-spam=true`,
            { signal: AbortSignal.timeout(8000) }
          )
          if (res.ok) {
            const d = await res.json()
            const items = d?.data?.items || []
            profile.totalTokens = items.length
            profile.totalValueUsd = items.reduce((s: number, i: any) => s + (i.quote || 0), 0)
          }
        } catch { /* timeout or network */ }
      })())
      fetches.push((async () => {
        try {
          const res = await fetch(
            `https://api.covalenthq.com/v1/solana-mainnet/address/${creatorAddress}/transactions_v3/?key=${goldrushKey}&page=0&page-size=20`,
            { signal: AbortSignal.timeout(8000) }
          )
          if (res.ok) {
            const d = await res.json()
            const items = d?.data?.items || []
            profile.transactionCount = d?.data?.pagination?.total_count || items.length
            if (items.length > 0) {
              const oldest = items[items.length - 1]
              const ts = new Date(oldest.block_signed_at || oldest.block_timestamp || Date.now()).getTime()
              profile.walletAgeDays = Math.max(0, Math.floor((Date.now() - ts) / 86400000))
            }
          }
        } catch { /* timeout or network */ }
      })())
    }

    // 2. Bitget: creator rug history (works without API key)
    if (tokenMint) {
      fetches.push((async () => {
        try {
          const info = await getTokenInfo(tokenMint)
          const item = info?.list?.[0] || info
          if (item) {
            profile.devTokensCreated = item.dev_issue_coin_count ?? undefined
            profile.devRugCount = item.dev_rug_coin_count ?? undefined
          }
        } catch { /* Bitget fetch failed */ }
      })())
    }

    await Promise.allSettled(fetches)

    // 3. Score
    let score = 50

    // Wallet age
    if (profile.walletAgeDays >= 180) score += 20
    else if (profile.walletAgeDays >= 30) score += 10
    else if (profile.walletAgeDays < 7) { score -= 15; profile.flags.push('New wallet (<7 days)') }

    // Portfolio diversity
    if (profile.totalTokens >= 10) score += 10
    else if (profile.totalTokens >= 3) score += 5
    else if (profile.totalTokens <= 1) { score -= 10; profile.flags.push('Minimal portfolio') }

    // Portfolio value
    if (profile.totalValueUsd >= 1000) score += 10
    else if (profile.totalValueUsd >= 100) score += 5

    // Activity
    if (profile.transactionCount >= 50) score += 10
    else if (profile.transactionCount >= 10) score += 5
    else if (profile.transactionCount < 5) { score -= 10; profile.flags.push('Low activity') }

    // Rug history (devastating signal)
    if (profile.devRugCount !== undefined && profile.devRugCount > 0) {
      const rugRatio = profile.devTokensCreated ? profile.devRugCount / profile.devTokensCreated : 1
      if (rugRatio >= 0.5) { score -= 30; profile.flags.push(`Serial rugger (${profile.devRugCount}/${profile.devTokensCreated} rugged)`) }
      else { score -= 15; profile.flags.push(`${profile.devRugCount} past rug(s)`) }
    }

    // Many tokens created (potential spam deployer)
    if (profile.devTokensCreated && profile.devTokensCreated >= 10) {
      profile.flags.push(`${profile.devTokensCreated} tokens created`)
    }

    profile.riskScore = Math.max(0, Math.min(100, score))
    profile.riskLevel = profile.riskScore >= 65 ? 'low' : profile.riskScore >= 40 ? 'medium' : 'high'

    return profile
  }

  // ── Utility ──

  /** Add a known pool to track */
  addPool(launch: TokenLaunch): void {
    addKnownPool(launch)
  }

  /** Clear all cached data */
  clearCache(): void {
    clearCache()
  }

  /** Destroy the skill (stop polling, clean up) */
  destroy(): void {
    this.stopPolling()
    this.clearCache()
  }
}

// Re-export types
export type {
  TokenLaunch,
  GraduationAnalysis,
  SecurityCheck,
  SwapQuote,
  TradeExecution,
  BondingCurveState,
  SkillConfig,
  ScanResult,
  VelocitySnapshot,
  CreatorProfile,
} from './types'

// Export individual modules for advanced usage
export { scanLaunches as rawScanLaunches } from './scanner'
export { analyzeGraduation as rawAnalyzeGraduation } from './analyzer'
export { checkTokenSecurity } from './security'
export { getTradeQuote, executeTrade as rawExecuteTrade } from './trader'
