// ── Full Integration Test ──

process.env.HELIUS_API_KEY = '873c5824-7255-40c9-9a39-4d3d04efe717'
process.env.HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

import { TrendSurferSkill } from '../packages/skill/src'
import { getSecurityInfo, getRankings, getTokenInfo } from '../lib/bitget'
import { discoverRecentPools, getPoolState } from '../lib/meteora'

async function main() {
  console.log('=== TrendSurfer Full Integration Test ===\n')

  // 1. Discover recent pools
  console.log('1. Discovering recent active pools from DBC transactions...')
  const pools = await discoverRecentPools(5)
  console.log(`   Found ${pools.length} active pools\n`)

  for (const pool of pools) {
    const state = await getPoolState(pool.poolAddress)
    if (!state) continue

    console.log(`   Pool: ${pool.poolAddress.slice(0, 12)}...`)
    console.log(`   Token: ${pool.baseMint}`)
    console.log(`   Progress: ${state.curveProgress.toFixed(1)}%`)
    console.log(`   SOL in curve: ${(Number(state.currentSolReserves) / 1e9).toFixed(4)}`)
    console.log(`   Graduated: ${state.graduated}`)

    // Try Bitget security check on this token
    try {
      const security = await getSecurityInfo(pool.baseMint)
      const checks = Array.isArray(security) ? security[0] : security
      const riskCount = checks?.riskChecks?.length || 0
      const warnCount = checks?.warnChecks?.length || 0
      console.log(`   Security: ${riskCount} risks, ${warnCount} warnings`)
    } catch (err: any) {
      console.log(`   Security: ${err.message}`)
    }

    // Try Bitget token info
    try {
      const info = await getTokenInfo(pool.baseMint)
      const tokenData = Array.isArray(info?.list) ? info.list[0] : info
      if (tokenData) {
        console.log(`   Name: ${tokenData.name || 'Unknown'} (${tokenData.symbol || '?'})`)
        console.log(`   Holders: ${tokenData.holders || '?'} | Liquidity: $${tokenData.liquidity ? Number(tokenData.liquidity).toFixed(0) : '?'}`)
      }
    } catch (err: any) {
      console.log(`   Token info: ${err.message}`)
    }

    console.log()
  }

  // 2. Test the Skill class
  console.log('2. Testing TrendSurferSkill class...')
  const skill = new TrendSurferSkill({
    heliusApiKey: process.env.HELIUS_API_KEY,
  })

  const result = await skill.scanLaunches(3)
  console.log(`   Scanned: ${result.totalScanned} launches`)
  console.log(`   Timestamp: ${new Date(result.timestamp).toISOString()}`)

  for (const launch of result.launches) {
    console.log(`   → ${launch.name} (${launch.symbol}) | ${launch.curveProgress.toFixed(1)}% | ${launch.tweetAuthor ? '@' + launch.tweetAuthor : 'no tweet'}`)
  }

  // 3. Test Hot Picks from Bitget
  console.log('\n3. Bitget Hot Picks...')
  try {
    const hotPicks = await getRankings('Hotpicks')
    const list = hotPicks?.list || hotPicks
    if (Array.isArray(list)) {
      for (const token of list.slice(0, 5)) {
        console.log(`   ${token.symbol} | $${Number(token.price).toFixed(6)} | 24h: ${Number(token.change_24h).toFixed(1)}% | Vol: $${(Number(token.volume_24h) / 1e6).toFixed(1)}M`)
      }
    }
  } catch (err: any) {
    console.log(`   Error: ${err.message}`)
  }

  skill.destroy()
  console.log('\n=== Integration Test Complete ===')
}

main().catch(console.error)
