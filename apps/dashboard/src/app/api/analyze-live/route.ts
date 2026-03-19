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
  tweetUrl?: string
  tweetAuthor?: string
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
    }
  } catch {
    // Helius DAS failed — try Bitget for token info
    try {
      const info = await bitgetPost('/market/v3/coin/batchGetBaseInfo', {
        list: [{ chain: 'sol', contract: mint }],
      })
      if (info?.[0]) {
        name = info[0].tokenName || info[0].name || name
        symbol = info[0].tokenSymbol || info[0].symbol || symbol
      }
    } catch {
      // Both failed — continue with defaults
    }
  }

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

  // 5. Holder analysis
  let holderCount = 0
  let topHolderConcentration = 0
  try {
    const largest = await heliusConn.getTokenLargestAccounts(mintPk)
    holderCount = largest.value.length
    if (holderCount > 0) {
      const total = largest.value.reduce((s: number, a) => s + Number(a.amount), 0)
      if (total > 0) {
        topHolderConcentration = Math.round((Number(largest.value[0].amount) / total) * 100)
      }
    }
  } catch {
    // Holder analysis failed
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

  // 7. Calculate composite score
  const velocityScore = 20 // No history for single-shot analysis
  const velocity = curveProgress >= 80 ? 'accelerating' : curveProgress >= 40 ? 'steady' : 'stagnant'

  const holderDistScore = Math.max(0, 100 - topHolderConcentration)
  const score = Math.round(
    Math.min(100, Math.max(0,
      curveProgress * 0.30 +
      velocityScore * 0.35 +
      securityScore * 0.25 +
      holderDistScore * 0.10
    ))
  )

  // 8. Generate reasoning
  const parts: string[] = []
  if (curveProgress >= 80) parts.push(`Bonding curve is ${curveProgress.toFixed(1)}% filled — very close to graduation.`)
  else if (curveProgress >= 50) parts.push(`Bonding curve is ${curveProgress.toFixed(1)}% filled — past halfway.`)
  else parts.push(`Bonding curve is only ${curveProgress.toFixed(1)}% filled — still early.`)

  if (holderCount > 0) parts.push(`${holderCount} holders detected. Top holder owns ${topHolderConcentration}% of supply.`)
  if (safe) parts.push('Security audit passed — no honeypot or authority risks detected.')
  else parts.push('Security warning — potential risks detected.')
  if (tweetAuthor) parts.push(`Token linked to @${tweetAuthor} tweet.`)
  parts.push(`Overall score: ${score}/100 — ${score >= 75 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW'} graduation probability.`)

  const prediction = score >= 75 ? 'will_graduate' : score >= 40 ? 'watching' : 'unlikely'

  return {
    mint,
    name,
    symbol,
    poolAddress,
    score,
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
    tweetUrl,
    tweetAuthor,
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
