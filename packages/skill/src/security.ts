// ── Security Checker ──
// Token safety analysis using Bitget Wallet API

import { getSecurityInfo, checkSwapToken } from '../../../lib/bitget'
import type { SecurityCheck } from './types'

export async function checkTokenSecurity(mint: string): Promise<SecurityCheck> {
  try {
    const [securityResult, swapCheck] = await Promise.all([
      getSecurityInfo(mint).catch(() => null),
      checkSwapToken(mint).catch(() => null),
    ])

    const warnings: string[] = []

    // Parse security audit response (Bitget returns array format)
    const securityInfo = Array.isArray(securityResult) ? securityResult[0] : securityResult

    let isHoneypot = false
    let hasMintAuth = false
    let hasFreezeAuth = false

    if (securityInfo) {
      // Bitget security response may have different field names
      // Adapt to whatever comes back
      if (securityInfo.isHoneypot || securityInfo.is_honeypot) {
        isHoneypot = true
        warnings.push('HONEYPOT DETECTED — cannot sell this token')
      }
      if (securityInfo.hasMintFunction || securityInfo.mint_authority || securityInfo.mintAuthority) {
        hasMintAuth = true
        warnings.push('Token has mint authority — supply can be inflated')
      }
      if (securityInfo.hasFreezeFunction || securityInfo.freeze_authority || securityInfo.freezeAuthority) {
        hasFreezeAuth = true
        warnings.push('Token has freeze authority — your tokens can be frozen')
      }
      // Collect any warning strings from the response
      if (securityInfo.warnings && Array.isArray(securityInfo.warnings)) {
        warnings.push(...securityInfo.warnings)
      }
      if (securityInfo.riskLevel && securityInfo.riskLevel !== 'safe') {
        warnings.push(`Risk level: ${securityInfo.riskLevel}`)
      }
    }

    // Parse swap check
    let swapForbidden = false
    if (swapCheck) {
      const checkResult = Array.isArray(swapCheck) ? swapCheck[0] : swapCheck
      if (checkResult?.forbidden || checkResult?.isForbidden) {
        swapForbidden = true
        warnings.push(`Swap forbidden: ${checkResult.reason || 'unknown reason'}`)
      }
    }

    const safe = !isHoneypot && !swapForbidden && warnings.length <= 1

    return {
      mint,
      safe,
      honeypot: isHoneypot,
      mintAuthority: hasMintAuth,
      freezeAuthority: hasFreezeAuth,
      warnings,
      details: {
        securityInfo,
        swapCheck,
      },
    }
  } catch (error) {
    return {
      mint,
      safe: false,
      honeypot: false,
      mintAuthority: false,
      freezeAuthority: false,
      warnings: [`Security check failed: ${error}`],
      details: {},
    }
  }
}
