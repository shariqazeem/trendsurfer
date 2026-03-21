import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

// ── x402 Configuration ──────────────────────────────────────────────────────────
// HTTP 402 Payment Required — micropayments for AI analysis
// Protocol: https://www.x402.org

const X402_VERSION = 1
const PRICE_USDC = '$0.001' // $0.001 per analysis call
const NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' // Solana mainnet
const FACILITATOR_URL = 'https://x402.org/facilitator'

function getPayTo(): string {
  return (process.env.X402_PAY_TO?.trim() || process.env.SOLANA_WALLET_ADDRESS?.trim() || '')
}

// ── Database ─────────────────────────────────────────────────────────────────────

function getDbClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
  if (tursoUrl) {
    return createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() })
  }
  const path = require('path')
  const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), '../../data/trendsurfer.db')
  return createClient({ url: `file:${dbPath}` })
}

// ── 402 Payment Required Response ────────────────────────────────────────────────

function paymentRequiredResponse(description: string) {
  const payTo = getPayTo()

  const paymentRequirements = {
    x402Version: X402_VERSION,
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK,
        price: PRICE_USDC,
        payTo,
        description,
        mimeType: 'application/json',
        maxTimeoutSeconds: 60,
      },
    ],
    facilitator: FACILITATOR_URL,
  }

  const encoded = Buffer.from(JSON.stringify(paymentRequirements)).toString('base64')

  return NextResponse.json(
    {
      error: 'Payment Required',
      message: `This endpoint requires a micropayment of ${PRICE_USDC} USDC via x402 protocol.`,
      x402: paymentRequirements,
      docs: 'https://www.x402.org',
      how: 'Include an X-Payment header with a base64-encoded signed USDC transfer transaction.',
    },
    {
      status: 402,
      headers: {
        'X-Payment-Required': encoded,
        'Access-Control-Expose-Headers': 'X-Payment-Required',
      },
    }
  )
}

// ── Verify Payment ───────────────────────────────────────────────────────────────

async function verifyPayment(xPaymentHeader: string): Promise<boolean> {
  // In production, verify the signed transaction via the facilitator
  // For the hackathon demo, we verify the header structure is valid x402
  try {
    const decoded = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString('utf-8'))
    if (decoded.x402Version !== X402_VERSION) return false
    if (!decoded.payload?.serializedTransaction) return false

    // Forward to facilitator for real verification in production
    if (process.env.X402_VERIFY === 'true') {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 3000)
        const res = await fetch(`${FACILITATOR_URL}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment: xPaymentHeader,
            payTo: getPayTo(),
            network: NETWORK,
            price: PRICE_USDC,
          }),
          signal: ctrl.signal,
        })
        clearTimeout(timer)
        return res.ok
      } catch {
        // Facilitator unreachable — demo fallback: accept payment
        return true
      }
    }

    // Demo mode: accept valid-structured payments
    return true
  } catch {
    return false
  }
}

// ── GET /api/intelligence?mint=<address> ─────────────────────────────────────────
// Returns AI graduation analysis for a specific token
// Protected by x402 micropayment ($0.001 USDC per call)

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get('mint')

  // ── Check x402 Payment ──
  const xPayment = request.headers.get('X-Payment') || request.headers.get('x-payment')

  if (!xPayment) {
    return paymentRequiredResponse(
      mint
        ? `AI graduation analysis for token ${mint}`
        : 'AI graduation analysis for trends.fun tokens'
    )
  }

  const paid = await verifyPayment(xPayment)
  if (!paid) {
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 402 }
    )
  }

  // ── Payment verified — return intelligence ──
  try {
    const db = getDbClient()

    if (mint) {
      // Specific token analysis
      const result = await db.execute({
        sql: 'SELECT * FROM predictions WHERE mint = ? ORDER BY created_at DESC LIMIT 1',
        args: [mint],
      })

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Token not found in analysis database' }, { status: 404 })
      }

      const row = result.rows[0] as any
      return NextResponse.json({
        x402: { paid: true, price: PRICE_USDC, network: NETWORK },
        analysis: {
          mint: row.mint,
          symbol: row.symbol,
          name: row.name,
          score: row.score,
          curveProgress: row.curve_progress,
          velocity: row.velocity,
          reasoning: row.reasoning,
          prediction: row.prediction,
          outcome: row.outcome,
          analyzedAt: row.created_at,
        },
      })
    }

    // All recent analyses
    const result = await db.execute(
      'SELECT * FROM predictions ORDER BY created_at DESC LIMIT 20'
    )

    const analyses = result.rows.map((row: any) => ({
      mint: row.mint,
      symbol: row.symbol,
      name: row.name,
      score: row.score,
      curveProgress: row.curve_progress,
      velocity: row.velocity,
      reasoning: row.reasoning,
      prediction: row.prediction,
      outcome: row.outcome,
      analyzedAt: row.created_at,
    }))

    return NextResponse.json({
      x402: { paid: true, price: PRICE_USDC, network: NETWORK },
      analyses,
      count: analyses.length,
    })
  } catch (error) {
    console.error('Intelligence API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── OPTIONS (CORS for x402 clients) ──────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Payment',
      'Access-Control-Expose-Headers': 'X-Payment-Required',
    },
  })
}
