// ── Helius RPC Helpers ──

import { Connection, PublicKey } from '@solana/web3.js'

function getHeliusApiKey(): string {
  return process.env.HELIUS_API_KEY || ''
}

function getHeliusRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${getHeliusApiKey()}`
}

let connection: Connection | null = null

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(getHeliusRpcUrl(), 'confirmed')
  }
  return connection
}

export async function getAccountInfo(address: string) {
  const conn = getConnection()
  const pubkey = new PublicKey(address)
  return conn.getAccountInfo(pubkey)
}

export async function getMultipleAccounts(addresses: string[]) {
  const conn = getConnection()
  const pubkeys = addresses.map((a) => new PublicKey(a))
  return conn.getMultipleAccountsInfo(pubkeys)
}

export async function getSignaturesForAddress(
  address: string,
  options?: { limit?: number; before?: string }
) {
  const conn = getConnection()
  const pubkey = new PublicKey(address)
  return conn.getSignaturesForAddress(pubkey, {
    limit: options?.limit || 20,
    before: options?.before,
  })
}

export async function getParsedTransaction(signature: string) {
  const conn = getConnection()
  return conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  })
}

export async function getTokenAccountsByOwner(owner: string, mint?: string) {
  const conn = getConnection()
  const ownerPubkey = new PublicKey(owner)

  if (mint) {
    return conn.getParsedTokenAccountsByOwner(ownerPubkey, {
      mint: new PublicKey(mint),
    })
  }

  return conn.getParsedTokenAccountsByOwner(ownerPubkey, {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  })
}

// Helius Enhanced API - get enriched transaction data
export async function getEnhancedTransaction(signature: string) {
  const response = await fetch(
    `https://api.helius.xyz/v0/transactions/?api-key=${getHeliusApiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [signature] }),
    }
  )
  const data = await response.json()
  return data[0]
}

// Helius DAS API - get token metadata
export async function getAsset(mint: string) {
  const response = await fetch(getHeliusRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'trendsurfer',
      method: 'getAsset',
      params: { id: mint },
    }),
  })
  const data = await response.json()
  return data.result
}

// Subscribe to program account changes (for real-time monitoring)
export function onProgramAccountChange(
  programId: string,
  callback: (accountInfo: { accountId: PublicKey; accountInfo: any }) => void
) {
  const conn = getConnection()
  const programPubkey = new PublicKey(programId)

  return conn.onProgramAccountChange(programPubkey, (info) => {
    callback({
      accountId: info.accountId,
      accountInfo: info.accountInfo,
    })
  })
}

// Get recent transactions for a program
export async function getProgramTransactions(
  programId: string,
  limit: number = 50
) {
  const conn = getConnection()
  const pubkey = new PublicKey(programId)
  const signatures = await conn.getSignaturesForAddress(pubkey, { limit })
  return signatures
}
