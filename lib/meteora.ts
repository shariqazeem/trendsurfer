// ── Meteora Dynamic Bonding Curve State Reader ──
// Reads on-chain state from Meteora DBC pools (trends.fun bonding curves)
// Program ID: dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
//
// Account layout sourced from MeteoraAg/dynamic-bonding-curve Anchor IDL.
// VirtualPool is 424 bytes, zero_copy (repr(C)).

import { PublicKey } from '@solana/web3.js'
import { getAccountInfo, getConnection, getProgramTransactions } from './helius'
import type { BondingCurveState } from './types'

export const METEORA_DBC_PROGRAM_ID = new PublicKey(
  'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN'
)

// ── VirtualPool Account Layout (424 bytes total) ──
// Derived from: programs/dynamic-bonding-curve/src/state/virtual_pool.rs
//
// [  0..  8] discriminator        (8 bytes)  hex: d5e005d16245775c
// [  8.. 72] volatility_tracker   (64 bytes) VolatilityTracker struct
// [ 72..104] config               (32 bytes) Pubkey → PoolConfig account
// [104..136] creator              (32 bytes) Pubkey
// [136..168] base_mint            (32 bytes) Pubkey (the token mint)
// [168..200] base_vault           (32 bytes) Pubkey
// [200..232] quote_vault          (32 bytes) Pubkey
// [232..240] base_reserve         (8 bytes)  u64 — current token reserves
// [240..248] quote_reserve        (8 bytes)  u64 — current SOL reserves
// [248..256] protocol_base_fee    (8 bytes)  u64
// [256..264] protocol_quote_fee   (8 bytes)  u64
// [264..272] partner_base_fee     (8 bytes)  u64
// [272..280] partner_quote_fee    (8 bytes)  u64
// [280..296] sqrt_price           (16 bytes) u128
// [296..304] activation_point     (8 bytes)  u64
// [304]      pool_type            (1 byte)   u8 — 0=SplToken, 1=Token2022
// [305]      is_migrated          (1 byte)   u8 — 1 = graduated/migrated
// [306]      is_partner_withdraw  (1 byte)   u8
// [307]      is_protocol_withdraw (1 byte)   u8
// [308]      migration_progress   (1 byte)   u8 — 0=Pre, 1=Post, 2=LockedVesting, 3=CreatedPool
// [309]      is_withdraw_leftover (1 byte)   u8
// [310]      is_creator_withdraw  (1 byte)   u8
// [311]      migration_fee_status (1 byte)   u8
// [312..344] metrics              (32 bytes) PoolMetrics
// [344..352] finish_curve_ts      (8 bytes)  u64
// ... (more fields up to 424)

const VIRTUAL_POOL_DISCRIMINATOR = 'd5e005d16245775c'
const VIRTUAL_POOL_SIZE = 424

const VP = {
  discriminator: 0,
  volatilityTracker: 8,
  config: 72,
  creator: 104,
  baseMint: 136, // The token mint on trends.fun
  baseVault: 168,
  quoteVault: 200,
  baseReserve: 232, // Current token reserves (u64)
  quoteReserve: 240, // Current SOL/quote reserves (u64)
  protocolBaseFee: 248,
  protocolQuoteFee: 256,
  partnerBaseFee: 264,
  partnerQuoteFee: 272,
  sqrtPrice: 280,
  activationPoint: 296,
  poolType: 304,
  isMigrated: 305,
  migrationProgress: 308,
  finishCurveTimestamp: 344,
} as const

// ── PoolConfig Account Layout (1048 bytes total) ──
// Discriminator: 1a6c0e7b74e6812b
// Key fields:
// [  8.. 40] quote_mint                  (32 bytes) Pubkey (usually wrapped SOL)
// [256..264] swap_base_amount            (8 bytes)  u64 — initial total base tokens for curve
// [264..272] migration_quote_threshold   (8 bytes)  u64 — SOL needed to graduate
// [272..280] migration_base_threshold    (8 bytes)  u64

const POOL_CONFIG_DISCRIMINATOR = '1a6c0e7b74e6812b'

const PC = {
  quoteMint: 8,
  swapBaseAmount: 256, // Initial total base tokens
  migrationQuoteThreshold: 264,
  migrationBaseThreshold: 272,
} as const

function readU64(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset)
}

function readU128(buffer: Buffer, offset: number): bigint {
  const lo = buffer.readBigUInt64LE(offset)
  const hi = buffer.readBigUInt64LE(offset + 8)
  return lo + (hi << 64n)
}

function readPubkey(buffer: Buffer, offset: number): string {
  return new PublicKey(buffer.subarray(offset, offset + 32)).toBase58()
}

function readU8(buffer: Buffer, offset: number): number {
  return buffer[offset]
}

// ── Pool Config fetching ──

export interface PoolConfig {
  quoteMint: string
  swapBaseAmount: bigint
  migrationQuoteThreshold: bigint
  migrationBaseThreshold: bigint
}

const configCache = new Map<string, PoolConfig>()

export async function getPoolConfig(configAddress: string): Promise<PoolConfig | null> {
  // Check cache
  const cached = configCache.get(configAddress)
  if (cached) return cached

  const accountInfo = await getAccountInfo(configAddress)
  if (!accountInfo || !accountInfo.data) return null

  const data = accountInfo.data as Buffer

  // Verify discriminator
  const disc = data.subarray(0, 8).toString('hex')
  if (disc !== POOL_CONFIG_DISCRIMINATOR) {
    console.warn(`PoolConfig ${configAddress} has unexpected discriminator: ${disc}`)
    return null
  }

  const config: PoolConfig = {
    quoteMint: readPubkey(data, PC.quoteMint),
    swapBaseAmount: readU64(data, PC.swapBaseAmount),
    migrationQuoteThreshold: readU64(data, PC.migrationQuoteThreshold),
    migrationBaseThreshold: readU64(data, PC.migrationBaseThreshold),
  }

  configCache.set(configAddress, config)
  return config
}

// ── VirtualPool reading ──

export interface VirtualPoolRaw {
  poolAddress: string
  configAddress: string
  creator: string
  baseMint: string // The trends.fun token
  baseVault: string
  quoteVault: string
  baseReserve: bigint // Current token reserves
  quoteReserve: bigint // Current SOL reserves
  sqrtPrice: bigint
  activationPoint: bigint
  poolType: number
  isMigrated: boolean
  migrationProgress: number // 0=Pre, 1=Post, 2=LockedVesting, 3=CreatedPool
  finishCurveTimestamp: bigint
}

export async function getVirtualPool(poolAddress: string): Promise<VirtualPoolRaw | null> {
  try {
    const accountInfo = await getAccountInfo(poolAddress)
    if (!accountInfo || !accountInfo.data) return null

    const data = accountInfo.data as Buffer

    // Verify owner
    if (!accountInfo.owner.equals(METEORA_DBC_PROGRAM_ID)) return null

    // Verify discriminator
    const disc = data.subarray(0, 8).toString('hex')
    if (disc !== VIRTUAL_POOL_DISCRIMINATOR) return null

    // Verify size
    if (data.length < VIRTUAL_POOL_SIZE) {
      console.warn(`VirtualPool ${poolAddress} too small: ${data.length} bytes, expected ${VIRTUAL_POOL_SIZE}`)
      return null
    }

    return {
      poolAddress,
      configAddress: readPubkey(data, VP.config),
      creator: readPubkey(data, VP.creator),
      baseMint: readPubkey(data, VP.baseMint),
      baseVault: readPubkey(data, VP.baseVault),
      quoteVault: readPubkey(data, VP.quoteVault),
      baseReserve: readU64(data, VP.baseReserve),
      quoteReserve: readU64(data, VP.quoteReserve),
      sqrtPrice: readU128(data, VP.sqrtPrice),
      activationPoint: readU64(data, VP.activationPoint),
      poolType: readU8(data, VP.poolType),
      isMigrated: readU8(data, VP.isMigrated) === 1,
      migrationProgress: readU8(data, VP.migrationProgress),
      finishCurveTimestamp: readU64(data, VP.finishCurveTimestamp),
    }
  } catch (error) {
    console.error(`Error reading VirtualPool ${poolAddress}:`, error)
    return null
  }
}

// ── Full pool state (VirtualPool + PoolConfig combined) ──

export async function getPoolState(poolAddress: string): Promise<BondingCurveState | null> {
  const pool = await getVirtualPool(poolAddress)
  if (!pool) return null

  // Fetch the config to get quote_mint and thresholds
  const config = await getPoolConfig(pool.configAddress)

  // Calculate graduation progress
  // progress = quoteReserve / migrationQuoteThreshold
  let curveProgress = 0
  if (config && config.migrationQuoteThreshold > 0n) {
    curveProgress = Number(
      (pool.quoteReserve * 10000n) / config.migrationQuoteThreshold
    ) / 100
  }

  const graduated = pool.isMigrated || pool.migrationProgress >= 3

  return {
    poolAddress,
    mint: pool.baseMint,
    baseMint: config?.quoteMint || 'So11111111111111111111111111111111111111112', // SOL is the quote on Meteora
    quoteMint: pool.baseMint, // The token is the "base" in Meteora terminology
    initialRealTokenReserves: config?.swapBaseAmount || 0n,
    currentTokenReserves: pool.baseReserve,
    currentSolReserves: pool.quoteReserve,
    migrationQuoteThreshold: config?.migrationQuoteThreshold || 0n,
    curveProgress: Math.min(curveProgress, 100),
    graduated,
    activationType: pool.poolType,
    collectFeeMode: pool.migrationProgress,
  }
}

// Calculate graduation progress from quote reserves vs threshold
export function calcGraduationProgress(
  quoteReserve: bigint,
  migrationQuoteThreshold: bigint
): number {
  if (migrationQuoteThreshold === 0n) return 0
  const progress = Number((quoteReserve * 10000n) / migrationQuoteThreshold) / 100
  return Math.min(Math.max(progress, 0), 100)
}

// Get recent pool creation events (new token launches)
export async function getRecentLaunches(limit: number = 50) {
  const signatures = await getProgramTransactions(
    METEORA_DBC_PROGRAM_ID.toBase58(),
    limit
  )
  return signatures
}

// Find pools by filtering program accounts with memcmp on baseMint
export async function findPoolsByMint(tokenMint: string): Promise<string[]> {
  const conn = getConnection()
  const accounts = await conn.getProgramAccounts(METEORA_DBC_PROGRAM_ID, {
    filters: [
      { dataSize: VIRTUAL_POOL_SIZE },
      {
        memcmp: {
          offset: VP.baseMint,
          bytes: tokenMint,
        },
      },
    ],
    dataSlice: { offset: 0, length: 0 }, // Just addresses
  })
  return accounts.map((a) => a.pubkey.toBase58())
}

// Find pools by creator
export async function findPoolsByCreator(creator: string): Promise<string[]> {
  const conn = getConnection()
  const accounts = await conn.getProgramAccounts(METEORA_DBC_PROGRAM_ID, {
    filters: [
      { dataSize: VIRTUAL_POOL_SIZE },
      {
        memcmp: {
          offset: VP.creator,
          bytes: creator,
        },
      },
    ],
    dataSlice: { offset: 0, length: 0 },
  })
  return accounts.map((a) => a.pubkey.toBase58())
}

// Discover active pools from recent program transactions
// More efficient than getProgramAccounts for 1M+ pools
export async function discoverRecentPools(limit: number = 30): Promise<VirtualPoolRaw[]> {
  const conn = getConnection()

  // Get recent transactions on the DBC program
  const sigs = await conn.getSignaturesForAddress(METEORA_DBC_PROGRAM_ID, { limit })
  const pools: VirtualPoolRaw[] = []
  const seen = new Set<string>()

  for (const sig of sigs) {
    if (sig.err) continue

    try {
      const tx = await conn.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      })
      if (!tx?.transaction?.message?.accountKeys) continue

      // Check each account key to see if it's a VirtualPool
      for (const key of tx.transaction.message.accountKeys) {
        const addr = typeof key === 'string' ? key : key.pubkey?.toBase58()
        if (!addr || seen.has(addr)) continue
        seen.add(addr)

        const pool = await getVirtualPool(addr)
        if (pool && !pool.isMigrated) {
          pools.push(pool)
          if (pools.length >= limit) return pools
        }
      }
    } catch {
      // Skip failed tx parsing
    }
  }

  return pools
}

// Monitor for new pool creations (polling approach)
export async function pollNewPools(
  lastSignature?: string,
  limit: number = 20
): Promise<{ signatures: any[]; latestSignature?: string }> {
  const conn = getConnection()
  const signatures = await conn.getSignaturesForAddress(
    METEORA_DBC_PROGRAM_ID,
    {
      limit,
      until: lastSignature,
    }
  )

  return {
    signatures,
    latestSignature: signatures.length > 0 ? signatures[0].signature : lastSignature,
  }
}

// Clear config cache (useful when refreshing)
export function clearConfigCache() {
  configCache.clear()
}
