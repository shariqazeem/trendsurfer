#!/usr/bin/env npx tsx
/**
 * x402 Client Demo — Agent-to-Agent Payment for Intelligence
 *
 * This script demonstrates how any AI agent can pay for TrendSurfer's
 * graduation intelligence via the x402 micropayment protocol.
 *
 * Flow:
 * 1. Request intelligence → get 402 Payment Required
 * 2. Parse payment requirements (amount, payTo, network)
 * 3. Create signed USDC transfer transaction
 * 4. Retry with X-Payment header → get intelligence data
 *
 * Usage:
 *   npx tsx scripts/x402-client.ts [mint-address]
 *   npx tsx scripts/x402-client.ts EK7NyRkRmstUZ49g9Z5a6Y3vFDywJu1cCph3SsRcvb8N
 */

const API_BASE = process.env.API_BASE || 'https://solana-trends-agent.vercel.app'

async function main() {
  const mint = process.argv[2] || ''
  const url = mint
    ? `${API_BASE}/api/intelligence?mint=${mint}`
    : `${API_BASE}/api/intelligence`

  console.log('x402 Agent-to-Agent Payment Demo')
  console.log('================================')
  console.log(`Endpoint: ${url}`)
  console.log('')

  // Step 1: Request without payment → expect 402
  console.log('Step 1: Requesting intelligence (no payment)...')
  const res1 = await fetch(url)
  console.log(`  Status: ${res1.status} ${res1.statusText}`)

  if (res1.status !== 402) {
    console.log('  Unexpected status — expected 402 Payment Required')
    const body = await res1.json()
    console.log('  Body:', JSON.stringify(body, null, 2).substring(0, 300))
    return
  }

  // Step 2: Parse payment requirements
  const paymentHeader = res1.headers.get('X-Payment-Required')
  const body402 = await res1.json()
  console.log('  Got 402 Payment Required')
  console.log('')

  console.log('Step 2: Payment Requirements:')
  const requirements = body402.x402
  const accept = requirements.accepts[0]
  console.log(`  Price: ${accept.maxAmountRequired ? (Number(accept.maxAmountRequired) / 1_000_000).toFixed(6) + ' USDC' : body402.message}`)
  console.log(`  Pay To: ${accept.payTo}`)
  console.log(`  Network: ${accept.network}`)
  console.log(`  Asset: ${accept.asset || 'USDC'}`)
  console.log('')

  // Step 3: Create a mock signed payment (for demo — real agents would sign a USDC transfer)
  console.log('Step 3: Creating x402 payment...')
  const payment = {
    x402Version: 1,
    scheme: 'exact',
    network: accept.network,
    payload: {
      serializedTransaction: Buffer.from('demo-signed-usdc-transfer').toString('base64'),
      signature: 'demo-signature',
    },
  }
  const xPayment = Buffer.from(JSON.stringify(payment)).toString('base64')
  console.log(`  Payment header: ${xPayment.substring(0, 50)}...`)
  console.log('')

  // Step 4: Retry with payment
  console.log('Step 4: Retrying with X-Payment header...')
  const res2 = await fetch(url, {
    headers: { 'X-Payment': xPayment },
  })
  console.log(`  Status: ${res2.status} ${res2.statusText}`)

  const data = await res2.json()

  if (res2.status === 200) {
    console.log('')
    console.log('Step 5: Intelligence Received!')
    console.log('  Payment confirmed:', data.x402?.paid ? 'YES' : 'NO')

    if (data.analysis) {
      const a = data.analysis
      console.log('')
      console.log(`  Token: ${a.name} ($${a.symbol})`)
      console.log(`  Score: ${a.score}/100`)
      console.log(`  Curve: ${a.curveProgress}%`)
      console.log(`  Prediction: ${a.prediction}`)
      console.log(`  Reasoning: ${a.reasoning?.substring(0, 150)}...`)
    } else if (data.analyses) {
      console.log(`  Received ${data.count} analyses`)
      for (const a of data.analyses.slice(0, 3)) {
        console.log(`    ${a.symbol}: score ${a.score}, curve ${a.curveProgress}%, ${a.prediction}`)
      }
      if (data.count > 3) console.log(`    ... and ${data.count - 3} more`)
    }
  } else {
    console.log('  Error:', JSON.stringify(data))
  }

  console.log('')
  console.log('Done. This flow works with any x402-compatible agent.')
  console.log('Real agents would sign an actual USDC transfer transaction.')
}

main().catch(console.error)
