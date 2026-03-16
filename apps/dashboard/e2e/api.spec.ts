import { test, expect } from '@playwright/test'

test.describe('API endpoints', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/predictions
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/predictions returns valid JSON with predictions and launches arrays', async ({
    request,
  }) => {
    const response = await request.get('/api/predictions')
    expect(response.ok()).toBeTruthy()

    const contentType = response.headers()['content-type'] || ''
    expect(contentType).toContain('application/json')

    const body = await response.json()

    // Must have predictions array
    expect(body).toHaveProperty('predictions')
    expect(Array.isArray(body.predictions)).toBeTruthy()

    // Must have launches array
    expect(body).toHaveProperty('launches')
    expect(Array.isArray(body.launches)).toBeTruthy()

    // If there are predictions, validate structure of the first one
    if (body.predictions.length > 0) {
      const pred = body.predictions[0]
      expect(pred).toHaveProperty('id')
      expect(pred).toHaveProperty('mint')
      expect(pred).toHaveProperty('symbol')
      expect(pred).toHaveProperty('name')
      expect(pred).toHaveProperty('score')
      expect(pred).toHaveProperty('curveProgress')
      expect(pred).toHaveProperty('reasoning')
      expect(pred).toHaveProperty('prediction')
      expect(pred).toHaveProperty('createdAt')
      expect(pred).toHaveProperty('outcome')
      expect(pred).toHaveProperty('traded')
    }

    // If there are launches, validate structure
    if (body.launches.length > 0) {
      const launch = body.launches[0]
      expect(launch).toHaveProperty('mint')
      expect(launch).toHaveProperty('name')
      expect(launch).toHaveProperty('symbol')
      expect(launch).toHaveProperty('curveProgress')
      expect(launch).toHaveProperty('graduated')
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/trades
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/trades returns valid JSON with positions array and pnl object', async ({
    request,
  }) => {
    const response = await request.get('/api/trades')
    expect(response.ok()).toBeTruthy()

    const contentType = response.headers()['content-type'] || ''
    expect(contentType).toContain('application/json')

    const body = await response.json()

    // Must have positions array
    expect(body).toHaveProperty('positions')
    expect(Array.isArray(body.positions)).toBeTruthy()

    // Must have pnl object with expected fields
    expect(body).toHaveProperty('pnl')
    expect(body.pnl).toHaveProperty('totalPnl')
    expect(body.pnl).toHaveProperty('totalTrades')
    expect(body.pnl).toHaveProperty('winRate')
    expect(typeof body.pnl.totalPnl).toBe('number')
    expect(typeof body.pnl.totalTrades).toBe('number')
    expect(typeof body.pnl.winRate).toBe('number')

    // If there are positions, validate structure of the first one
    if (body.positions.length > 0) {
      const pos = body.positions[0]
      expect(pos).toHaveProperty('id')
      expect(pos).toHaveProperty('mint')
      expect(pos).toHaveProperty('symbol')
      expect(pos).toHaveProperty('entryPrice')
      expect(pos).toHaveProperty('entryAmount')
      expect(pos).toHaveProperty('entryTimestamp')
      expect(pos).toHaveProperty('status')
      expect(pos).toHaveProperty('graduationScore')
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/agent
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/agent returns valid JSON with running, tokensScanned, logs fields', async ({
    request,
  }) => {
    const response = await request.get('/api/agent')
    expect(response.ok()).toBeTruthy()

    const contentType = response.headers()['content-type'] || ''
    expect(contentType).toContain('application/json')

    const body = await response.json()

    // Must have core status fields
    expect(body).toHaveProperty('running')
    expect(typeof body.running).toBe('boolean')

    expect(body).toHaveProperty('tokensScanned')
    expect(typeof body.tokensScanned).toBe('number')

    expect(body).toHaveProperty('tokensAnalyzed')
    expect(typeof body.tokensAnalyzed).toBe('number')

    expect(body).toHaveProperty('totalTrades')
    expect(typeof body.totalTrades).toBe('number')

    expect(body).toHaveProperty('totalPnl')
    expect(typeof body.totalPnl).toBe('number')

    expect(body).toHaveProperty('winRate')
    expect(typeof body.winRate).toBe('number')

    expect(body).toHaveProperty('lastScan')
    expect(typeof body.lastScan).toBe('number')

    // Must have logs array
    expect(body).toHaveProperty('logs')
    expect(Array.isArray(body.logs)).toBeTruthy()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Content-Type Validation
  // ──────────────────────────────────────────────────────────────────────────

  test('all API responses have correct content-type', async ({ request }) => {
    const endpoints = ['/api/predictions', '/api/trades', '/api/agent']

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint)
      const contentType = response.headers()['content-type'] || ''
      expect(contentType).toContain('application/json')
    }
  })
})
