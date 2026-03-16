// ── AI Analysis Pipeline (CommonStack API) ──
// Uses CommonStack's OpenAI-compatible API for graduation prediction
// Supports any model: DeepSeek, GPT-4, Claude, Grok, etc.

import OpenAI from 'openai'
import type { GraduationAnalysis, TokenLaunch, SecurityCheck } from '../../../lib/types'

const COMMONSTACK_BASE_URL = 'https://api.commonstack.ai/v1'

// Default to a cheap, fast model — override with COMMONSTACK_MODEL env var
const DEFAULT_MODEL = 'deepseek/deepseek-v3.2'

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

const SYSTEM_PROMPT = `You are TrendSurfer's AI analyst — an expert at predicting whether trends.fun tokens will "graduate" (complete their bonding curve and migrate to a full DEX pool).

You analyze tokens launched on trends.fun, which are tokenized X/Twitter posts on Solana using Meteora's Dynamic Bonding Curve (DBC).

When a token's bonding curve fills up (enough buy pressure), it "graduates" — liquidity auto-migrates to a full Meteora DAMM pool. Pre-graduation buyers often see a price jump.

You receive on-chain data about each token and must provide:
1. A graduation score (0-100) — probability the token will graduate
2. A clear, concise reasoning for your score
3. A prediction: "will_graduate", "unlikely", or "watching"

Key factors to consider:
- Curve progress (% filled) — higher = closer to graduation
- Fill velocity — accelerating curves are bullish
- Security audit — honeypots, mint authority, freeze authority
- Tweet content/author — viral tweets from high-follower accounts graduate faster
- Time since launch — tokens that fill quickly are more likely to graduate
- Holder distribution — concentrated holdings are risky

Be direct and specific. Traders rely on your analysis.`

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
      max_tokens: 300,
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
