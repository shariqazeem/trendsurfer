// ── Solana Transaction Signer ──
// Signs transactions for Bitget Wallet swap flow using Ed25519

import { Keypair, VersionedTransaction, Transaction } from '@solana/web3.js'
import bs58 from 'bs58'
// tweetnacl is used as fallback signer (imported dynamically)

let keypair: Keypair | null = null

export function getKeypair(): Keypair {
  if (!keypair) {
    const privateKey = process.env.SOLANA_PRIVATE_KEY
    if (!privateKey) {
      throw new Error('SOLANA_PRIVATE_KEY env var not set')
    }
    keypair = Keypair.fromSecretKey(bs58.decode(privateKey))
  }
  return keypair
}

export function getWalletAddress(): string {
  return getKeypair().publicKey.toBase58()
}

// Sign a Bitget order's transaction(s)
// Bitget makeOrder returns transaction data that needs to be signed
export async function signBitgetOrder(orderData: any): Promise<{ sig: string }[]> {
  const kp = getKeypair()
  const signedTxs: { sig: string }[] = []

  // orderData may contain a `txs` array or a single `tx`
  const txList = orderData.txs || orderData.transactions || [orderData]

  for (const txData of txList) {
    try {
      const rawTx = txData.rawTransaction || txData.data || txData.tx || txData

      if (typeof rawTx === 'string') {
        // Try base64 first, then base58
        let txBytes: Uint8Array
        try {
          txBytes = Buffer.from(rawTx, 'base64')
        } catch {
          txBytes = bs58.decode(rawTx)
        }

        // Try as VersionedTransaction
        try {
          const vtx = VersionedTransaction.deserialize(txBytes)
          vtx.sign([kp])
          const sig = bs58.encode(vtx.signatures[0])
          signedTxs.push({ sig })
          continue
        } catch {
          // Not a VersionedTransaction
        }

        // Try as legacy Transaction
        try {
          const tx = Transaction.from(txBytes)
          tx.sign(kp)
          const sig = bs58.encode(tx.signature!)
          signedTxs.push({ sig })
          continue
        } catch {
          // Not a legacy Transaction
        }

        // If neither VersionedTransaction nor legacy Transaction can parse it,
        // the raw data format is unsupported
        throw new Error('Unsupported transaction format from Bitget API')
      }
    } catch (error) {
      console.error('Transaction signing error:', error)
      throw new Error(`Failed to sign transaction: ${error}`)
    }
  }

  return signedTxs
}

export function hasWallet(): boolean {
  return !!process.env.SOLANA_PRIVATE_KEY
}
