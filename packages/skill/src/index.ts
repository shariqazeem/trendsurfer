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
} from './types'

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
} from './types'

// Export individual modules for advanced usage
export { scanLaunches as rawScanLaunches } from './scanner'
export { analyzeGraduation as rawAnalyzeGraduation } from './analyzer'
export { checkTokenSecurity } from './security'
export { getTradeQuote, executeTrade as rawExecuteTrade } from './trader'
