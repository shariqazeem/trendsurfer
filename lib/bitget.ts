// ── Bitget Wallet API Wrapper (TypeScript) ──
// Wraps the REST API at https://copenapi.bgwapi.io
// Auth: BKHmacAuth signature (no API key needed)
// All endpoints are POST with JSON body

import { createHash } from 'crypto'

const BASE_URL = 'https://copenapi.bgwapi.io'
const SOLANA_CHAIN = 'sol'
const SOL_NATIVE_CONTRACT = '' // Empty string = native token

// ── Auth / Signing ──

function compactJson(obj: unknown): string {
  return JSON.stringify(obj, null, 0) // compact, no spaces
}

function sign(method: string, path: string, body: string, timestamp: string): string {
  const message = method + path + body + timestamp
  const hash = createHash('sha256').update(message).digest('hex')
  return '0x' + hash
}

function getHeaders(path: string, body: string): Record<string, string> {
  const timestamp = Date.now().toString()
  const signature = sign('POST', path, body, timestamp)

  return {
    'Content-Type': 'application/json',
    'brand': 'IOS',
    'clientversion': '9.36.0',
    'language': 'en',
    'token': 'toc_agent',
    'X-SIGN': signature,
    'X-TIMESTAMP': timestamp,
  }
}

async function bitgetPost<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const jsonBody = compactJson(body)
  const headers = getHeaders(path, jsonBody)

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: jsonBody,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Bitget API ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = await response.json()

  // Bitget wraps responses in { status, error_code, data, msg }
  const errCode = data.error_code ?? data.code
  if (errCode !== undefined && errCode !== 0 && errCode !== '0') {
    throw new Error(`Bitget API error ${errCode}: ${data.msg || data.message || 'unknown'}`)
  }

  return data.data ?? data
}

// ── Token Search ──

export async function searchTokens(keyword: string, chain?: string) {
  return bitgetPost('/market/v2/search/tokens', {
    keyword,
    ...(chain ? { chain } : {}),
  })
}

// ── Token Info ──

export async function getTokenInfo(contract: string, chain: string = SOLANA_CHAIN) {
  const result = await bitgetPost('/market/v3/coin/batchGetBaseInfo', {
    list: [{ chain, contract }],
  })
  return Array.isArray(result) ? result[0] : result
}

export async function batchTokenInfo(tokens: { chain: string; contract: string }[]) {
  return bitgetPost('/market/v3/coin/batchGetBaseInfo', { list: tokens })
}

// ── Market Data ──

export async function getRankings(name: 'topGainers' | 'topLosers' | 'Hotpicks' = 'Hotpicks') {
  return bitgetPost('/market/v3/topRank/detail', { name })
}

export async function getKline(
  contract: string,
  period: '1s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' = '1h',
  chain: string = SOLANA_CHAIN,
  size: number = 100
) {
  return bitgetPost('/market/v3/coin/getKline', { chain, contract, period, size })
}

export async function getTxInfo(contract: string, chain: string = SOLANA_CHAIN) {
  return bitgetPost('/market/v3/coin/getTxInfo', { chain, contract })
}

export async function getPoolList(contract: string, chain: string = SOLANA_CHAIN) {
  return bitgetPost('/market/v3/poolList', { chain, contract })
}

export async function getHistoricalCoins(createTime: string, limit: number = 50) {
  return bitgetPost('/market/v3/historical-coins', { createTime, limit })
}

// ── Security ──

export async function getSecurityInfo(contract: string, chain: string = SOLANA_CHAIN) {
  return bitgetPost('/market/v3/coin/security/audits', {
    list: [{ chain, contract }],
    source: 'bg',
  })
}

// ── Swap Token Check ──

export async function checkSwapToken(contract: string, symbol: string = '', chain: string = SOLANA_CHAIN) {
  return bitgetPost('/swap-go/swapx/checkSwapToken', {
    list: [{ chain, contract, symbol }],
  })
}

// ── Balance ──

export async function getBalance(address: string, contracts: string[] = [''], chain: string = SOLANA_CHAIN) {
  return bitgetPost('/swap-go/swapx/getProcessedBalance', {
    list: [{ chain, address, contract: contracts }],
  })
}

export async function getBatchBalance(address: string, chain: string = SOLANA_CHAIN) {
  return bitgetPost('/user/wallet/batchV2', {
    list: [{ chain, address, contract: [''] }],
    nocache: true,
    appointCurrency: 'usd',
    noreport: true,
  })
}

// ── Token List ──

export async function getTokenList(chain: string = SOLANA_CHAIN) {
  return bitgetPost('/swap-go/swapx/getTokenList', {
    chain,
    isAllNetWork: 1,
  })
}

// ── Swap Flow ──

export interface SwapQuoteParams {
  fromChain?: string
  fromContract: string // '' for native SOL
  fromSymbol?: string
  fromAmount: string // Human-readable e.g. '0.01'
  toChain?: string
  toContract: string
  toSymbol?: string
  fromAddress: string // Wallet address
  toAddress?: string // Usually same as fromAddress
  slippage?: string // Default '0.5'
}

export async function getSwapQuote(params: SwapQuoteParams) {
  const chain = params.fromChain || SOLANA_CHAIN
  // Build body — only include symbol fields if they have values
  // Bitget API rejects empty string symbols
  const body: Record<string, unknown> = {
    fromContract: params.fromContract,
    fromAmount: params.fromAmount,
    fromChain: chain,
    toContract: params.toContract,
    fromAddress: params.fromAddress,
    toChain: params.toChain || chain,
    estimateGas: true,
    skipCache: true,
  }
  if (params.fromSymbol) body.fromSymbol = params.fromSymbol
  else if (params.fromContract === '') body.fromSymbol = 'SOL'
  if (params.toSymbol) body.toSymbol = params.toSymbol
  else if (params.toContract === '') body.toSymbol = 'SOL'
  if (params.slippage) body.slippage = params.slippage

  return bitgetPost('/swap-go/swapx/quote', body)
}

export interface SwapConfirmParams {
  fromChain?: string
  fromContract: string
  fromSymbol?: string
  fromAmount: string
  fromAddress: string
  toChain?: string
  toContract: string
  toSymbol?: string
  toAddress?: string
  market: string // From quote response
  protocol: string // From quote response
  slippage?: string
  lastOutAmount: string // From quote response
  gasless?: boolean
}

export async function confirmSwap(params: SwapConfirmParams) {
  const chain = params.fromChain || SOLANA_CHAIN
  const slippage = params.slippage || '0.5'
  const body: Record<string, unknown> = {
    fromChain: chain,
    fromSymbol: params.fromSymbol || '',
    fromContract: params.fromContract,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toChain: params.toChain || chain,
    toSymbol: params.toSymbol || '',
    toContract: params.toContract,
    toAddress: params.toAddress || params.fromAddress,
    market: params.market,
    protocol: params.protocol,
    slippage,
    gasLevel: 'average',
    features: params.gasless ? ['no_gas'] : ['user_gas'],
    recommendSlippage: slippage,
    lastOutAmount: params.lastOutAmount,
    mevProtection: {
      chain,
      mevFee: '0',
      amountMin: params.fromAmount,
      mevTarget: true,
      mode: 'smart',
    },
  }
  return bitgetPost('/swap-go/swapx/confirm', body)
}

export interface MakeOrderParams {
  orderId: string // From confirm response
  fromChain?: string
  fromContract: string
  fromSymbol?: string
  fromAmount: string
  fromAddress: string
  toChain?: string
  toContract: string
  toSymbol?: string
  toAddress?: string
  slippage?: string
  market: string
  protocol: string
}

export async function makeOrder(params: MakeOrderParams) {
  const chain = params.fromChain || SOLANA_CHAIN
  return bitgetPost('/swap-go/swapx/makeOrder', {
    orderId: params.orderId,
    fromChain: chain,
    fromContract: params.fromContract,
    fromSymbol: params.fromSymbol || '',
    fromAddress: params.fromAddress,
    toChain: params.toChain || chain,
    toContract: params.toContract,
    toSymbol: params.toSymbol || '',
    toAddress: params.toAddress || params.fromAddress,
    fromAmount: params.fromAmount,
    slippage: params.slippage || '0.5',
    market: params.market,
    protocol: params.protocol,
    source: 'agent',
  })
}

export async function sendOrder(orderId: string, signedTxs: { sig: string }[]) {
  return bitgetPost('/swap-go/swapx/send', {
    orderId,
    txs: signedTxs,
  })
}

export async function getOrderDetails(orderId: string) {
  return bitgetPost('/swap-go/swapx/getOrderDetails', { orderId })
}

// ── Constants ──
export const SOL_ADDRESS = '' // Native SOL uses empty string in Bitget API
export const SOLANA_CHAIN_ID = SOLANA_CHAIN
