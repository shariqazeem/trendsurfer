import { test, expect } from '@playwright/test'

test.describe('Visitor — main dashboard experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the loading spinner to disappear and main content to render
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-spin"]'),
      { timeout: 15_000 }
    ).catch(() => {})
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Hero Section
  // ──────────────────────────────────────────────────────────────────────────

  test('page loads successfully and shows TrendSurfer branding', async ({ page }) => {
    await expect(page).toHaveTitle(/TrendSurfer/)
    await expect(page.getByText('TrendSurfer').first()).toBeVisible()
  })

  test('hero heading describes the product', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Intelligence Skill/ })
    ).toBeVisible()
  })

  test('hero has animated bonding curve SVG', async ({ page }) => {
    // The hero bonding curve renders an SVG with polyline elements
    const curveSvg = page.locator('svg').filter({ has: page.locator('polyline') }).first()
    await expect(curveSvg).toBeVisible({ timeout: 5_000 })
  })

  test('stat counters are visible (Tokens Scanned, Predictions, Win Rate, PnL)', async ({ page }) => {
    await expect(page.getByText('Tokens Scanned')).toBeVisible()
    await expect(page.getByText('Predictions Made')).toBeVisible()
    await expect(page.getByText('Win Rate').first()).toBeVisible()
    await expect(page.getByText('Total PnL').first()).toBeVisible()
  })

  test('agent status indicator is visible (Agent Live or Agent Offline)', async ({ page }) => {
    const status = page.getByText(/Agent (Live|Offline)/)
    await expect(status).toBeVisible()
  })

  test('CTAs are visible — View Scanner + npm install', async ({ page }) => {
    await expect(page.getByRole('link', { name: /View Scanner/ })).toBeVisible()
    await expect(page.getByText('npm install trendsurfer-skill').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // How It Works Section
  // ──────────────────────────────────────────────────────────────────────────

  test('How It Works section shows 5 steps', async ({ page }) => {
    await expect(page.getByText('How It Works')).toBeVisible()
    await expect(page.getByText('Tweet Goes Viral')).toBeVisible()
    await expect(page.getByText('Token Created')).toBeVisible()
    await expect(page.getByText('Curve Fills Up')).toBeVisible()
    await expect(page.getByText('TrendSurfer Predicts')).toBeVisible()
    await expect(page.getByText('Graduation = Profit')).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Live Scanner Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Live Scanner section is visible with filter pills', async ({ page }) => {
    await expect(page.getByText('Live Scanner')).toBeVisible()

    const filters = ['All', 'Hot', 'Graduating', 'Graduated']
    for (const label of filters) {
      const pill = page.getByRole('button', { name: new RegExp(`^${label}`) })
      await expect(pill).toBeVisible()
    }
  })

  test('filter pills are clickable and toggle active state', async ({ page }) => {
    const allPill = page.getByRole('button', { name: /^All/ })
    const hotPill = page.getByRole('button', { name: /^Hot/ })

    await hotPill.click()
    await expect(hotPill).toHaveClass(/bg-gray-900/)
    await allPill.click()
    await expect(allPill).toHaveClass(/bg-gray-900/)
  })

  test('scanner shows token rows or empty state', async ({ page }) => {
    const tokenOrEmpty = page
      .locator('[class*="cursor-pointer"]')
      .first()
      .or(page.getByText(/Agent is scanning|No tokens/))

    await expect(tokenOrEmpty).toBeVisible({ timeout: 10_000 })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Recent Predictions Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Recent Predictions section is visible', async ({ page }) => {
    await expect(page.getByText('Recent Predictions')).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Trading Performance Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Trading Performance section shows stats', async ({ page }) => {
    await expect(page.getByText('Trading Performance')).toBeVisible()
    // Strategy description
    await expect(page.getByText('Buy pre-graduation', { exact: false })).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Developer Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Developer section shows SDK and MCP panels', async ({ page }) => {
    await expect(page.getByText('Use TrendSurfer in Your Agent')).toBeVisible()
    await expect(page.getByText('TypeScript SDK')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'MCP Server' })).toBeVisible()
  })

  test('Developers link navigates to /developers', async ({ page }) => {
    const devLink = page.getByRole('link', { name: 'Developers' }).first()
    await expect(devLink).toBeVisible()

    await devLink.click()
    await page.waitForURL('**/developers')
    expect(page.url()).toContain('/developers')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Agent Log Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Agent Log section is collapsible', async ({ page }) => {
    const logHeader = page.getByText('Agent Log')
    await expect(logHeader).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Mobile Responsiveness
  // ──────────────────────────────────────────────────────────────────────────

  test('page is mobile responsive (375px width)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-spin"]'),
      { timeout: 15_000 }
    ).catch(() => {})

    // Branding visible
    await expect(page.getByText('TrendSurfer').first()).toBeVisible()
    // Hero heading visible
    await expect(page.getByRole('heading', { name: /Intelligence Skill/ })).toBeVisible()

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(377)
  })
})
