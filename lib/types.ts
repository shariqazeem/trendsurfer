// ── Core Types for TrendSurfer ──

export interface TokenLaunch {
  mint: string
  poolAddress: string
  name: string
  symbol: string
  tweetUrl?: string
  tweetAuthor?: string
  createdAt: number // unix timestamp
  curveProgress: number // 0-100
  graduated: boolean
  migrationPool?: string
}

export interface BondingCurveState {
  poolAddress: string
  mint: string
  baseMint: string // SOL usually
  quoteMint: string // the token
  initialRealTokenReserves: bigint
  currentTokenReserves: bigint
  currentSolReserves: bigint
  migrationQuoteThreshold: bigint
  curveProgress: number // 0-100
  graduated: boolean
  activationType: number
  collectFeeMode: number
}

export interface GraduationAnalysis {
  mint: string
  score: number // 0-100 graduation probability
  curveProgress: number // 0-100 bonding curve fill %
  velocity: 'accelerating' | 'steady' | 'declining' | 'stagnant'
  velocityScore: number // 0-100
  holderCount: number
  topHolderConcentration: number // 0-100 %
  securityScore: number // 0-100
  tweetAnalysis?: {
    author: string
    followerCount?: number
    engagementScore?: number
    content?: string
  }
  reasoning: string // Claude's explanation
  timestamp: number
}

export interface SecurityCheck {
  mint: string
  safe: boolean
  honeypot: boolean
  mintAuthority: boolean
  freezeAuthority: boolean
  warnings: string[]
  details: Record<string, unknown>
}

export interface SwapQuote {
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  priceImpact: number
  route: string
  minReceived: string
  fee: string
}

export interface TradeExecution {
  id: string
  mint: string
  side: 'buy' | 'sell'
  amountIn: string
  amountOut: string
  price: number
  txHash: string
  timestamp: number
  status: 'pending' | 'confirmed' | 'failed'
}

export interface Position {
  id: string
  mint: string
  symbol: string
  entryPrice: number
  entryAmount: string
  entryTxHash: string
  entryTimestamp: number
  currentPrice?: number
  unrealizedPnl?: number
  unrealizedPnlPercent?: number
  exitPrice?: number
  exitAmount?: string
  exitTxHash?: string
  exitTimestamp?: number
  realizedPnl?: number
  realizedPnlPercent?: number
  status: 'open' | 'closed' | 'pending'
  graduationScore: number
  reasoning: string
}

export interface AgentStatus {
  running: boolean
  uptime: number
  tokensScanned: number
  tokensAnalyzed: number
  activePositions: number
  totalTrades: number
  totalPnl: number
  winRate: number
  lastScan: number
}

export interface Prediction {
  id: string
  mint: string
  symbol: string
  name: string
  score: number
  curveProgress: number
  velocity: string
  reasoning: string
  prediction: 'will_graduate' | 'unlikely' | 'watching'
  createdAt: number
  resolvedAt?: number
  outcome?: 'graduated' | 'failed' | 'pending'
  traded: boolean
}

// Bitget API types
export interface BitgetTokenInfo {
  chainId: string
  address: string
  name: string
  symbol: string
  decimals: number
  logoURI?: string
  price?: string
  priceChangePercent24h?: string
  volume24h?: string
  marketCap?: string
}

export interface BitgetSecurityInfo {
  isHoneypot: boolean
  hasMintFunction: boolean
  hasFreezeFunction: boolean
  isOpenSource: boolean
  warnings: string[]
}

export interface BitgetRankingToken {
  address: string
  name: string
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  marketCap: string
}
