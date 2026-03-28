import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'

// ── Inline SDK logic for serverless (can't use file-based imports on Vercel) ──
// We replicate the core analysis pipeline here using the same Bitget + Helius APIs

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || ''
const HELIUS_RPC_URL =
  process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
const PUBLIC_RPC_URL = 'https://api.mainnet-beta.solana.com'

const METEORA_DBC_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN'
const VIRTUAL_POOL_DISC = 'd5e005d16245775c'
const CONFIG_DISC = '1a6c0e7b74e6812b'
const BITGET_BASE = 'https://copenapi.bgwapi.io'
const COMMONSTACK_API_KEY = process.env.COMMONSTACK_API_KEY || ''
const COMMONSTACK_BASE_URL = 'https://api.commonstack.ai/v1'
const AI_MODEL = process.env.COMMONSTACK_MODEL || 'openai/gpt-oss-120b'
const GOLDRUSH_API_KEY = process.env.GOLDRUSH_API_KEY || ''

// ── Helpers ──

function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset)
}

function readPubkey(buf: Buffer, offset: number): string {
  return new PublicKey(buf.subarray(offset, offset + 32)).toBase58()
}

function bitgetSign(method: string, path: string, body: string, ts: string): string {
  const crypto = require('crypto')
  return '0x' + crypto.createHash('sha256').update(method + path + body + ts).digest('hex')
}

async function bitgetPost(path: string, body: Record<string, unknown>) {
  const jsonBody = JSON.stringify(body)
  const ts = Date.now().toString()
  const sig = bitgetSign('POST', path, jsonBody, ts)
  const res = await fetch(`${BITGET_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      brand: 'IOS',
      clientversion: '9.36.0',
      language: 'en',
      token: 'toc_agent',
      'X-SIGN': sig,
      'X-TIMESTAMP': ts,
    },
    body: jsonBody,
  })
  const data = await res.json()
  const errCode = data.error_code ?? data.code
  if (errCode !== undefined && errCode !== 0 && errCode !== '0') {
    return null // Non-critical — security check may fail for unknown tokens
  }
  return data.data ?? data
}

// ── Core Analysis ──

interface CreatorProfile {
  address: string
  walletAgeDays: number
  totalTokens: number
  totalValueUsd: number
  transactionCount: number
  riskScore: number        // 0-100 (0 = high risk, 100 = safe)
  riskLevel: 'low' | 'medium' | 'high'
  flags: string[]
}

async function scoreDevWallet(creatorAddress: string): Promise<CreatorProfile | null> {
  if (!GOLDRUSH_API_KEY || !creatorAddress) return null

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

  try {
    // 1. Get token balances — shows portfolio diversity
    const balRes = await fetch(
      `https://api.covalenthq.com/v1/solana-mainnet/address/${creatorAddress}/balances_v2/?key=${GOLDRUSH_API_KEY}&no-spam=true`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (balRes.ok) {
      const balData = await balRes.json()
      const items = balData?.data?.items || []
      profile.totalTokens = items.length
      profile.totalValueUsd = items.reduce((sum: number, i: any) => sum + (i.quote || 0), 0)
    }
  } catch { /* balance fetch failed */ }

  try {
    // 2. Get recent transactions — shows activity level + wallet age estimate
    const txRes = await fetch(
      `https://api.covalenthq.com/v1/solana-mainnet/address/${creatorAddress}/transactions_v3/?key=${GOLDRUSH_API_KEY}&page=0&page-size=20`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (txRes.ok) {
      const txData = await txRes.json()
      const txItems = txData?.data?.items || []
      profile.transactionCount = txData?.data?.pagination?.total_count || txItems.length

      // Estimate wallet age from oldest tx in sample
      if (txItems.length > 0) {
        const oldest = txItems[txItems.length - 1]
        const oldestDate = new Date(oldest.block_signed_at || oldest.block_timestamp || Date.now())
        profile.walletAgeDays = Math.max(0, Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)))
      }
    }
  } catch { /* tx fetch failed */ }

  // 3. Score the wallet
  let score = 50

  // Wallet age: older = more trustworthy
  if (profile.walletAgeDays >= 180) score += 20
  else if (profile.walletAgeDays >= 30) score += 10
  else if (profile.walletAgeDays < 7) { score -= 15; profile.flags.push('New wallet (<7 days)') }

  // Portfolio diversity: more tokens = likely real user
  if (profile.totalTokens >= 10) score += 10
  else if (profile.totalTokens >= 3) score += 5
  else if (profile.totalTokens <= 1) { score -= 10; profile.flags.push('Minimal portfolio') }

  // Portfolio value: skin in the game
  if (profile.totalValueUsd >= 1000) score += 10
  else if (profile.totalValueUsd >= 100) score += 5

  // Activity level
  if (profile.transactionCount >= 50) score += 10
  else if (profile.transactionCount >= 10) score += 5
  else if (profile.transactionCount < 5) { score -= 10; profile.flags.push('Low activity') }

  profile.riskScore = Math.max(0, Math.min(100, score))
  profile.riskLevel = profile.riskScore >= 65 ? 'low' : profile.riskScore >= 40 ? 'medium' : 'high'

  return profile
}

interface AnalysisResult {
  mint: string
  name: string
  symbol: string
  poolAddress: string
  score: number
  curveProgress: number
  velocity: string
  velocityScore: number
  holderCount: number
  topHolderConcentration: number
  securityScore: number
  safe: boolean
  reasoning: string
  prediction: string
  graduated: boolean
  creatorProfile?: CreatorProfile | null
  tweetUrl?: string
  tweetAuthor?: string
  tweetContent?: string
  tweetEngagement?: {
    estimatedViews: string
    tokenHolders: number
    socialSignal: 'viral' | 'trending' | 'moderate' | 'low'
  }
}

function getHeliusConnection(): Connection {
  return new Connection(HELIUS_RPC_URL, 'confirmed')
}

function getPublicConnection(): Connection {
  return new Connection(PUBLIC_RPC_URL, 'confirmed')
}

async function analyzeMint(mint: string): Promise<AnalysisResult> {
  // Use public RPC for getProgramAccounts (Helius blocks it for large programs)
  // Use Helius for everything else (faster, DAS API)
  const publicConn = getPublicConnection()
  const heliusConn = getHeliusConnection()

  // 1. Find the pool for this mint
  const mintPk = new PublicKey(mint)

  // First: try to get token metadata from Helius DAS
  let name = 'Unknown'
  let symbol = 'UNK'
  let tweetUrl: string | undefined
  let tweetAuthor: string | undefined
  let tweetContent: string | undefined

  // Try Helius DAS for token metadata
  try {
    const dasRes = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'das-1',
        method: 'getAsset',
        params: { id: mint },
      }),
    })
    const dasData = await dasRes.json()
    const asset = dasData?.result
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
      if (desc && desc.length > 10) {
        tweetContent = desc
      }
    }
  } catch {
    // DAS network error — will try fallbacks below
  }

  // Fallback: if DAS returned Unknown, try Bitget token info
  if (name === 'Unknown' || symbol === 'UNK') {
    try {
      const info = await bitgetPost('/market/v3/coin/batchGetBaseInfo', {
        list: [{ chain: 'sol', contract: mint }],
      })
      // bitgetPost strips outer `data`, so result is { list: [...] } or directly [...]
      const item = info?.list?.[0] || info?.[0] || (Array.isArray(info) ? info[0] : null)
      if (item) {
        if (name === 'Unknown') name = item.name || item.tokenName || name
        if (symbol === 'UNK') symbol = item.symbol || item.tokenSymbol || symbol
      }
    } catch {
      // Bitget also failed
    }
  }

  // Fallback: if still Unknown, try Helius token-metadata API
  if (name === 'Unknown' || symbol === 'UNK') {
    try {
      const metaRes = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mintAccounts: [mint] }),
      })
      const metaData = await metaRes.json()
      if (metaData?.[0]) {
        const m = metaData[0]
        if (name === 'Unknown') name = m.onChainMetadata?.metadata?.data?.name?.replace(/\0/g, '').trim() || m.legacyMetadata?.name || name
        if (symbol === 'UNK') symbol = m.onChainMetadata?.metadata?.data?.symbol?.replace(/\0/g, '').trim() || m.legacyMetadata?.symbol || symbol
      }
    } catch {
      // All metadata lookups failed — use defaults
    }
  }

  // Final cleanup: trim null bytes and whitespace from name/symbol
  name = name.replace(/\0/g, '').trim()
  symbol = symbol.replace(/\0/g, '').trim()
  if (!name || name === 'null') name = 'Unknown Token'
  if (!symbol || symbol === 'null') symbol = mint.substring(0, 6)

  // 2. Find the Meteora DBC pool for this mint
  //    Search program accounts where baseMint (offset 136) matches our mint
  let poolAddress = ''
  let poolData: Buffer | null = null

  try {
    // Use public RPC for getProgramAccounts — Helius blocks this for large programs
    const accounts = await publicConn.getProgramAccounts(new PublicKey(METEORA_DBC_PROGRAM), {
      filters: [
        { dataSize: 424 },
        { memcmp: { offset: 136, bytes: mint } },
      ],
    })
    if (accounts.length > 0) {
      poolAddress = accounts[0].pubkey.toBase58()
      poolData = accounts[0].account.data as Buffer
    }
  } catch (rpcErr: any) {
    const msg = rpcErr?.message || ''
    if (msg.includes('429') || msg.includes('rate') || msg.includes('max usage')) {
      throw new Error('RPC rate limit reached. Try again in a moment.')
    }
    throw new Error('Failed to search for Meteora DBC pool. The token may not be on a bonding curve.')
  }

  if (!poolData) {
    throw new Error(`No Meteora DBC pool found for mint ${mint.substring(0, 8)}... — this token may not be on a bonding curve.`)
  }

  // 3. Parse pool state
  const disc = poolData.subarray(0, 8).toString('hex')
  if (disc !== VIRTUAL_POOL_DISC) {
    throw new Error('Account is not a valid Meteora DBC VirtualPool')
  }

  const configAddress = readPubkey(poolData, 72)
  const creatorAddress = readPubkey(poolData, 104)
  const baseMint = readPubkey(poolData, 136)
  const quoteReserve = readU64(poolData, 240)
  const isMigrated = poolData[305] === 1

  // 4. Get pool config for graduation threshold
  let curveProgress = 0
  let migrationThreshold = BigInt(0)

  try {
    const configInfo = await heliusConn.getAccountInfo(new PublicKey(configAddress))
    if (configInfo?.data) {
      const configBuf = configInfo.data as Buffer
      const configDisc = configBuf.subarray(0, 8).toString('hex')
      if (configDisc === CONFIG_DISC) {
        migrationThreshold = readU64(configBuf, 264)
        if (migrationThreshold > BigInt(0)) {
          curveProgress = Number((quoteReserve * BigInt(10000)) / migrationThreshold) / 100
        }
      }
    }
  } catch {
    // Config fetch failed — estimate from reserves
    curveProgress = isMigrated ? 100 : 0
  }

  // 5. Holder analysis + Creator wallet scoring (parallel)
  let holderCount = 0
  let topHolderConcentration = 0
  let creatorProfile: CreatorProfile | null = null

  const [holderResult, creatorResult] = await Promise.allSettled([
    // Holder analysis
    (async () => {
      const largest = await heliusConn.getTokenLargestAccounts(mintPk)
      holderCount = largest.value.length
      if (holderCount > 0) {
        const total = largest.value.reduce((s: number, a) => s + Number(a.amount), 0)
        if (total > 0) {
          topHolderConcentration = Math.round((Number(largest.value[0].amount) / total) * 100)
        }
      }
    })(),
    // Creator wallet scoring via GoldRush
    scoreDevWallet(creatorAddress),
  ])

  if (creatorResult.status === 'fulfilled' && creatorResult.value) {
    creatorProfile = creatorResult.value
  }

  // 6. Security check via Bitget
  let securityScore = 50
  let safe = true
  try {
    const sec = await bitgetPost('/market/v3/coin/security/audits', {
      chain: 'sol',
      contract: mint,
    })
    if (sec) {
      const honeypot = sec.isHoneypot || sec.is_honeypot
      const mintAuth = sec.mintAuthority || sec.mint_authority || sec.ownerChangeAuthority
      const freezeAuth = sec.freezeAuthority || sec.freeze_authority
      if (honeypot) { securityScore = 0; safe = false }
      else if (mintAuth || freezeAuth) { securityScore = 40 }
      else { securityScore = 100 }
    }
  } catch {
    // Security check failed — neutral score
  }

  // 7. Social signal analysis (trends.fun tokens are tokenized tweets)
  const velocityScore = 20 // No history for single-shot analysis
  const velocity = curveProgress >= 80 ? 'accelerating' : curveProgress >= 40 ? 'steady' : 'stagnant'

  // Determine social signal based on holder count + curve velocity
  // More holders = more viral tweet; faster curve fill = more social momentum
  let socialSignal: 'viral' | 'trending' | 'moderate' | 'low' = 'low'
  let socialSignalScore = 20
  if (holderCount >= 50 && curveProgress >= 60) {
    socialSignal = 'viral'
    socialSignalScore = 100
  } else if (holderCount >= 20 && curveProgress >= 30) {
    socialSignal = 'trending'
    socialSignalScore = 75
  } else if (holderCount >= 8 || curveProgress >= 15) {
    socialSignal = 'moderate'
    socialSignalScore = 50
  }

  // Estimate views from holder count (rough heuristic: each holder ~50-200 viewers)
  const estimatedViews = holderCount > 0
    ? `${(holderCount * 120).toLocaleString()}+`
    : 'Unknown'

  const tweetEngagement = {
    estimatedViews,
    tokenHolders: holderCount,
    socialSignal,
  }

  // Calculate composite score with social signal weight
  const holderDistScore = Math.max(0, 100 - topHolderConcentration)
  const score = Math.round(
    Math.min(100, Math.max(0,
      curveProgress * 0.25 +
      velocityScore * 0.30 +
      securityScore * 0.20 +
      holderDistScore * 0.10 +
      socialSignalScore * 0.15
    ))
  )

  // 8. AI-enhanced analysis (if API key is available and curve is meaningful)
  let aiScore: number | null = null
  let aiReasoning = ''
  let aiPrediction = ''

  if (COMMONSTACK_API_KEY && curveProgress >= 15) {
    try {
      const aiPrompt = `Analyze this trends.fun token for graduation probability:

Token: ${name} (${symbol})
Tweet URL: ${tweetUrl || 'Unknown'}
Tweet Author: @${tweetAuthor || 'Unknown'}
Tweet Content: ${tweetContent || 'Not available'}

On-Chain: ${curveProgress.toFixed(1)}% curve filled, ${holderCount} holders, top holder ${topHolderConcentration}%
Security: ${safe ? 'Passed' : 'Warning'} (score ${securityScore}/100)
Social Signal: ${socialSignal} (est. ${estimatedViews} views)

Respond JSON only: {"score": 0-100, "reasoning": "2-3 sentences with specific analysis", "prediction": "will_graduate|unlikely|watching"}`

      const aiRes = await fetch(`${COMMONSTACK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${COMMONSTACK_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: 'You predict trends.fun token graduations. Tokens are tokenized tweets on Meteora DBC (Solana). When bonding curve fills → graduates to DEX → price jumps. Tweet quality matters — viral tweets from influential authors graduate faster. Respond with JSON only.' },
            { role: 'user', content: aiPrompt },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      })
      const aiData = await aiRes.json()
      const aiText = aiData.choices?.[0]?.message?.content || ''
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        aiScore = Math.min(100, Math.max(0, parsed.score))
        aiReasoning = parsed.reasoning || ''
        aiPrediction = parsed.prediction || ''
      }
    } catch {
      // AI analysis failed — fall through to on-chain reasoning
    }
  }

  // Use AI score if available, otherwise fallback to on-chain
  const finalScore = aiScore !== null ? Math.round((aiScore + score) / 2) : score

  // Generate reasoning
  const parts: string[] = []

  if (aiReasoning) {
    parts.push(aiReasoning)
  } else {
    if (curveProgress >= 80) parts.push(`Bonding curve is ${curveProgress.toFixed(1)}% filled — very close to graduation.`)
    else if (curveProgress >= 50) parts.push(`Bonding curve is ${curveProgress.toFixed(1)}% filled — past halfway.`)
    else parts.push(`Bonding curve is only ${curveProgress.toFixed(1)}% filled — still early.`)

    if (holderCount > 0) parts.push(`${holderCount} holders detected. Top holder owns ${topHolderConcentration}% of supply.`)
    if (safe) parts.push('Security audit passed — no honeypot or authority risks detected.')
    else parts.push('Security warning — potential risks detected.')
  }

  // Always append data points
  if (tweetContent && !aiReasoning) {
    const truncated = tweetContent.length > 100 ? tweetContent.substring(0, 100) + '...' : tweetContent
    parts.push(`Tweet content: '${truncated}'`)
  }
  if (tweetAuthor && !aiReasoning) parts.push(`Token linked to @${tweetAuthor} tweet.`)
  parts.push(`Social signal: ${socialSignal.toUpperCase()} (est. ${estimatedViews} views, ${holderCount} holders).`)
  parts.push(`Overall score: ${finalScore}/100 — ${finalScore >= 75 ? 'HIGH' : finalScore >= 40 ? 'MODERATE' : 'LOW'} graduation probability.`)

  const prediction = aiPrediction || (finalScore >= 65 ? 'will_graduate' : finalScore >= 35 ? 'watching' : 'unlikely')

  return {
    mint,
    name,
    symbol,
    poolAddress,
    score: finalScore,
    curveProgress,
    velocity,
    velocityScore,
    holderCount,
    topHolderConcentration,
    securityScore,
    safe,
    reasoning: parts.join(' '),
    prediction,
    graduated: isMigrated,
    creatorProfile,
    tweetUrl,
    tweetAuthor,
    tweetContent,
    tweetEngagement,
  }
}

// ── Route Handler ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const mint = body.mint?.trim()

    if (!mint) {
      return NextResponse.json({ error: 'Missing "mint" field in request body' }, { status: 400 })
    }

    // Validate base58 format
    try {
      new PublicKey(mint)
    } catch {
      return NextResponse.json({ error: 'Invalid Solana address. Must be a valid base58 public key.' }, { status: 400 })
    }

    if (!HELIUS_API_KEY) {
      return NextResponse.json({ error: 'Server not configured — missing HELIUS_API_KEY' }, { status: 500 })
    }

    const result = await analyzeMint(mint)
    return NextResponse.json({ success: true, analysis: result })
  } catch (error: any) {
    const msg = error?.message || 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
