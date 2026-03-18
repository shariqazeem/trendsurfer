// ── AI Analysis Pipeline (CommonStack API) ──
// Uses CommonStack's OpenAI-compatible API for graduation prediction
// Supports any model: DeepSeek, GPT-4, Claude, Grok, etc.

import OpenAI from 'openai'
import type { GraduationAnalysis, TokenLaunch, SecurityCheck } from '../../../lib/types'

const COMMONSTACK_BASE_URL = 'https://api.commonstack.ai/v1'

// Use cheapest available model — Gemini Flash ($0.3/M input, $2.5/M output)
// Override with COMMONSTACK_MODEL env var
const DEFAULT_MODEL = 'google/gemini-2.5-flash'

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

const SYSTEM_PROMPT = `You predict trends.fun token graduations. Tokens are tokenized tweets on Meteora DBC (Solana). When bonding curve fills → graduates to DEX → price jumps. Respond with JSON only: {"score": 0-100, "reasoning": "2 sentences", "prediction": "will_graduate|unlikely|watching"}`

export async function analyzeWithClaude(
  launch: TokenLaunch,
  onChainAnalysis: GraduationAnalysis,
  security: SecurityCheck
): Promise<{
  score: number
  reasoning: string
  prediction: 'will_graduate' | 'unlikely' | 'watching'
}> {
  const prompt = `Analyze this trends.fun token for graduation probability:

**Token**: ${launch.name} (${launch.symbol})
**Mint**: ${launch.mint}
**Tweet URL**: ${launch.tweetUrl || 'Unknown'}
**Tweet Author**: ${launch.tweetAuthor ? `@${launch.tweetAuthor}` : 'Unknown'}
**Launched**: ${new Date(launch.createdAt).toISOString()}
**Age**: ${Math.round((Date.now() - launch.createdAt) / 1000 / 60)} minutes

**On-Chain Data**:
- Bonding curve progress: ${onChainAnalysis.curveProgress.toFixed(1)}%
- Fill velocity: ${onChainAnalysis.velocity} (score: ${onChainAnalysis.velocityScore}/100)
- Holder count: ${onChainAnalysis.holderCount || 'Unknown'}
- Top holder concentration: ${onChainAnalysis.topHolderConcentration || 'Unknown'}%

**Security (Bitget Audit)**:
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
      reasoning: `AI analysis unavailable. On-chain score: ${score}/100. ${onChainAnalysis.reasoning}`,
      prediction:
        score >= 75 ? 'will_graduate' : score >= 40 ? 'watching' : 'unlikely',
    }
  }
}
