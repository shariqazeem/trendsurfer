#!/bin/bash
# ═══════════════════════════════════════════════════
# SCREENSHOT COMMANDS — Run each in Terminal.app
# Open this file, copy-paste each command
# ═══════════════════════════════════════════════════

# ── SCREENSHOT 1: SDK Install + Use ──
# Copy this entire block and paste in Terminal:

cd /tmp && rm -rf trendsurfer-demo && mkdir trendsurfer-demo && cd trendsurfer-demo && npm init -y && npm install trendsurfer-skill && node -e "const { TrendSurferSkill } = require('trendsurfer-skill'); const skill = new TrendSurferSkill({ heliusApiKey: 'c9176354-0a44-452d-b2b8-b982ebeb97d4' }); console.log('Analyzing token...'); console.log(''); skill.analyzeByMint('EK7NyRkRmstUZ49g9Z5a6Y3vFDywJu1cCph3SsRcvb8N').then(r => { console.log('Token:', r.token.name, '(' + r.token.symbol + ')'); console.log('Score:', r.graduation.score + '/100'); console.log('Curve:', r.graduation.curveProgress.toFixed(1) + '%'); console.log('Velocity:', r.graduation.velocity); console.log('Safe:', r.security.safe); console.log('Reasoning:', r.graduation.reasoning.substring(0, 150)); }).catch(e => console.error(e.message));"


# ── SCREENSHOT 2: x402 Payment Flow ──
# Copy this and paste in Terminal:

cd ~/projects/solana-trends-agent && npx tsx scripts/x402-client.ts EK7NyRkRmstUZ49g9Z5a6Y3vFDywJu1cCph3SsRcvb8N
