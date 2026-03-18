// ── Trade Executor ──
// Executes trades via Bitget Wallet API (gasless)
// Flow: quote → confirm → makeOrder → sign → send → getOrderDetails

import {
  getSwapQuote,
  confirmSwap,
  makeOrder,
  sendOrder,
  getOrderDetails,
  SOL_ADDRESS,
} from '../../../lib/bitget'
import type { SwapQuote, TradeExecution } from './types'

export interface TradeParams {
  tokenMint: string
  side: 'buy' | 'sell'
  amountSol?: string // For buys: amount of SOL to spend
  amountToken?: string // For sells: amount of token to sell
  slippage?: string // Default 0.5%
  walletAddress: string
  gasless?: boolean // Default true
  signTransaction: (txData: any) => Promise<{ sig: string }[]>
}

// Get a swap quote
export async function getTradeQuote(params: {
  tokenMint: string
  tokenSymbol?: string // Required by Bitget API — pass the token symbol
  side: 'buy' | 'sell'
  amount: string
  walletAddress: string
  slippage?: string
}): Promise<any> {
  const isBuy = params.side === 'buy'
  const fromContract = isBuy ? SOL_ADDRESS : params.tokenMint
  const toContract = isBuy ? params.tokenMint : SOL_ADDRESS
  const tokenSym = params.tokenSymbol || 'TOKEN'

  return getSwapQuote({
    fromContract,
    fromSymbol: isBuy ? 'SOL' : tokenSym,
    toContract,
    toSymbol: isBuy ? tokenSym : 'SOL',
    fromAmount: params.amount,
    fromAddress: params.walletAddress,
    slippage: params.slippage || '0.5',
  })
}

// Execute a full trade: quote → confirm → makeOrder → sign → send
export async function executeTrade(params: TradeParams): Promise<TradeExecution> {
  const amount =
    params.side === 'buy'
      ? params.amountSol || '0.1'
      : params.amountToken || '0'

  const fromContract = params.side === 'buy' ? SOL_ADDRESS : params.tokenMint
  const toContract = params.side === 'buy' ? params.tokenMint : SOL_ADDRESS

  // 1. Get quote
  const quote = await getSwapQuote({
    fromContract,
    toContract,
    fromAmount: amount,
    fromAddress: params.walletAddress,
    slippage: params.slippage || '0.5',
  })

  // Extract market/protocol from quote response
  // Quote response structure varies — adapt to actual response
  const market = quote.market || quote.bestMarket || ''
  const protocol = quote.protocol || quote.bestProtocol || ''
  const outAmount = quote.toAmount || quote.outAmount || quote.bestOutAmount || '0'

  // 2. Confirm swap
  const confirmResult = await confirmSwap({
    fromContract,
    toContract,
    fromAmount: amount,
    fromAddress: params.walletAddress,
    market,
    protocol,
    lastOutAmount: outAmount,
    gasless: params.gasless !== false,
    slippage: params.slippage || '0.5',
  })

  const orderId = confirmResult.orderId || confirmResult.order_id

  // 3. Make order (get unsigned transaction)
  const orderResult = await makeOrder({
    orderId,
    fromContract,
    toContract,
    fromAmount: amount,
    fromAddress: params.walletAddress,
    market,
    protocol,
    slippage: params.slippage || '0.5',
  })

  // 4. Sign the transaction(s)
  const signedTxs = await params.signTransaction(orderResult)

  // 5. Send signed transaction
  const sendResult = await sendOrder(orderId, signedTxs)

  return {
    id: orderId,
    mint: params.tokenMint,
    side: params.side,
    amountIn: amount,
    amountOut: outAmount,
    price: parseFloat(outAmount) / parseFloat(amount),
    txHash: sendResult.txHash || sendResult.hash || orderId,
    timestamp: Date.now(),
    status: 'pending',
  }
}

// Check trade status
export async function getTradeStatus(orderId: string) {
  return getOrderDetails(orderId)
}
