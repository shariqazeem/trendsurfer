// ── AI Analysis Pipeline (CommonStack API) ──
// Uses CommonStack's OpenAI-compatible API for graduation prediction
// Supports any model: DeepSeek, GPT-4, Claude, Grok, etc.

import OpenAI from 'openai'
import type { GraduationAnalysis, TokenLaunch, SecurityCheck } from '../../../lib/types'

const COMMONSTACK_BASE_URL = 'https://api.commonstack.ai/v1'

// Use cheapest model — GPT OSS 120B ($0.05/M input, $0.25/M output)
// Override with COMMONSTACK_MODEL env var
const DEFAULT_MODEL = 'openai/gpt-oss-120b'

function getClient(): OpenAI {
  const apiKey = process.env.COMMONSTACK_API_KEY
  if (!apiKey) {
    throw new Error('COMMONSTACK_API_KEY env var not set')
  }
  return new OpenAI({
    apiKey,
    baseURL: COMMONSTACK_BASE_URL,
  })
}

function getModel(): string {
  return process.env.COMMONSTACK_MODEL || DEFAULT_MODEL
}

const SYSTEM_PROMPT = `You predict trends.fun token graduations. Tokens are tokenized tweets on Meteora DBC (Solana). When bonding curve fills → graduates to DEX → price jumps. Tweet quality matters — viral tweets from influential authors graduate faster. CRITICAL RULE: If the Bonding curve progress is 100% or greater, your prediction MUST be 'will_graduate' regardless of other factors. Respond with JSON only: {"score": 0-100, "reasoning": "2 sentences", "prediction": "will_graduate|unlikely|watching"}`

export async function analyzeWithClaude(
  launch: TokenLaunch,
  onChainAnalysis: GraduationAnalysis,
  security: SecurityCheck
): Promise<{
  score: number
  reasoning: string
  prediction: 'will_graduate' | 'unlikely' | 'watching'
}> {
  // Derive social signal from holder count + curve progress (same logic as analyze-live)
  const holders = onChainAnalysis.holderCount || 0
  const progress = onChainAnalysis.curveProgress || 0
  let socialSignal = 'low'
  if (holders >= 50 && progress >= 60) socialSignal = 'viral'
  else if (holders >= 20 && progress >= 30) socialSignal = 'trending'
  else if (holders >= 8 || progress >= 15) socialSignal = 'moderate'

  const tweetContent = onChainAnalysis.tweetAnalysis?.content || ''

  const prompt = `Analyze this trends.fun token for graduation probability:

**Token**: ${launch.name} (${launch.symbol})
**Mint**: ${launch.mint}
**Tweet URL**: ${launch.tweetUrl || 'Unknown'}
**Tweet Author**: ${launch.tweetAuthor ? `@${launch.tweetAuthor}` : 'Unknown'}
**Launched**: ${new Date(launch.createdAt).toISOString()}
**Age**: ${Math.round((Date.now() - launch.createdAt) / 1000 / 60)} minutes

**Tweet Analysis** (trends.fun tokens are tokenized tweets):
- Content: ${tweetContent || 'Not available'}
- Author: @${launch.tweetAuthor || 'Unknown'}
- Social Signal: ${socialSignal}
- Note: Viral/controversial tweets from high-follower accounts graduate much faster. Evaluate tweet quality.

**On-Chain Data**:
- Bonding curve progress: ${onChainAnalysis.curveProgress.toFixed(1)}%
- Fill velocity: ${onChainAnalysis.velocity} (score: ${onChainAnalysis.velocityScore}/100)
- Holder count: ${onChainAnalysis.holderCount || 'Unknown'}
- Top holder concentration: ${onChainAnalysis.topHolderConcentration || 'Unknown'}%

**Security Audit**:
- Safe: ${security.safe ? 'Yes' : 'NO'}
- Honeypot: ${security.honeypot ? 'YES — DO NOT BUY' : 'No'}
- Mint authority: ${security.mintAuthority ? 'Yes (risk)' : 'No'}
- Freeze authority: ${security.freezeAuthority ? 'Yes (risk)' : 'No'}
- Warnings: ${security.warnings.length > 0 ? security.warnings.join(', ') : 'None'}

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{"score": <0-100>, "reasoning": "<2-3 sentence analysis>", "prediction": "<will_graduate|unlikely|watching>"}`

  try {
    const client = getClient()
    const model = getModel()

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
      temperature: 0.3,
    })

    const text = response.choices[0]?.message?.content || ''

    // Extract JSON from response (handle markdown code blocks if model wraps it)
    let jsonStr = text.trim()
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const result = JSON.parse(jsonStr)

    return {
      score: Math.min(100, Math.max(0, result.score)),
      reasoning: result.reasoning,
      prediction: result.prediction as 'will_graduate' | 'unlikely' | 'watching',
    }
  } catch (error) {
    console.error('AI analysis failed:', error)

    // Fallback to on-chain analysis only
    const score = onChainAnalysis.score
    return {
      score,
      reasoning: onChainAnalysis.reasoning,
      prediction:
        onChainAnalysis.curveProgress >= 100 || score >= 75 ? 'will_graduate' : score >= 40 ? 'watching' : 'unlikely',
    }
  }
}
