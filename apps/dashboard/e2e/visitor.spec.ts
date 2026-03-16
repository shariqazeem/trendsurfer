import { test, expect } from '@playwright/test'

test.describe('Visitor — main dashboard experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the loading skeleton to disappear and the main content to render.
    // The dashboard shows a loading state initially, then the ScannerView or
    // empty-state once API calls resolve.
    await page.waitForSelector('header', { timeout: 15_000 })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Branding & Layout
  // ──────────────────────────────────────────────────────────────────────────

  test('page loads successfully and shows TrendSurfer branding', async ({ page }) => {
    await expect(page).toHaveTitle(/TrendSurfer/)
    const brand = page.locator('header').getByText('TrendSurfer', { exact: true })
    await expect(brand).toBeVisible()
  })

  test('navigation bar is visible with Scanner / Trades / Log tabs', async ({ page }) => {
    const nav = page.locator('header nav')
    await expect(nav).toBeVisible()

    await expect(nav.getByRole('button', { name: 'Scanner' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Trades' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Log' })).toBeVisible()
  })

  test('default view is Scanner', async ({ page }) => {
    const scannerTab = page.locator('header nav button', { hasText: 'Scanner' })
    // The active tab gets a white background + shadow; the inactive ones don't.
    await expect(scannerTab).toHaveClass(/bg-white/)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Tab Switching
  // ──────────────────────────────────────────────────────────────────────────

  test('clicking "Trades" tab switches to trades view', async ({ page }) => {
    await page.locator('header nav button', { hasText: 'Trades' }).click()

    // Trades view shows a "Strategy:" explainer or metric cards
    await expect(page.getByText('Strategy:', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('clicking "Log" tab switches to log view', async ({ page }) => {
    await page.locator('header nav button', { hasText: 'Log' }).click()

    // Log view either shows log entries or "No agent activity yet" empty state
    const logContent = page.getByText('No agent activity yet').or(
      page.locator('[class*="bg-white rounded-lg border"]').first()
    )
    await expect(logContent).toBeVisible({ timeout: 5_000 })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Agent Status
  // ──────────────────────────────────────────────────────────────────────────

  test('agent status indicator is visible (Live or Offline)', async ({ page }) => {
    // The status indicator shows "Live" or "Offline" next to a dot
    const statusText = page.locator('header').getByText(/^(Live|Offline)$/)
    await expect(statusText).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Nav Metrics (PnL / Win Rate / Trades)
  // ──────────────────────────────────────────────────────────────────────────

  test('PnL, Win Rate, and Trades metrics are visible in nav', async ({ page }) => {
    // These are hidden on mobile (hidden sm:block) so use a desktop viewport.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForSelector('header')

    await expect(page.locator('header').getByText('PnL')).toBeVisible()
    await expect(page.locator('header').getByText('Win Rate')).toBeVisible()
    // "Trades" appears as both a nav tab and a metric label — use .first()
    await expect(page.locator('header').getByText('Trades').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Token List (Scanner View)
  // ──────────────────────────────────────────────────────────────────────────

  test('token list renders or shows empty state', async ({ page }) => {
    // Wait for loading to finish
    await page.waitForFunction(() => {
      return !document.querySelector('[class*="animate-pulse"]')
    }, { timeout: 15_000 }).catch(() => {})

    // Either there are token rows or an empty state message.
    // Use auto-retrying .or() assertion to handle framer-motion fade-in.
    const tokenOrEmpty = page
      .locator('[class*="cursor-pointer"]')
      .first()
      .or(page.getByText('No tokens detected yet'))

    await expect(tokenOrEmpty).toBeVisible({ timeout: 10_000 })
  })

  test('clicking a token shows the detail panel (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForSelector('header')

    // Wait for loading
    await page.waitForFunction(() => {
      return !document.querySelector('[class*="animate-pulse"]')
    }, { timeout: 15_000 }).catch(() => {})

    const tokenRow = page.locator('[class*="cursor-pointer"]').first()
    const hasTokens = await tokenRow.isVisible().catch(() => false)

    if (hasTokens) {
      await tokenRow.click()

      // Detail panel should appear with sections like "Bonding Curve" or "AI Analysis"
      const detailPanel = page.getByText('Bonding Curve').or(page.getByText('AI Analysis'))
      await expect(detailPanel).toBeVisible({ timeout: 5_000 })
    } else {
      // No tokens — the right panel shows "Select a token" placeholder
      const placeholder = page.getByText('Select a token')
      await expect(placeholder).toBeVisible()
    }
  })

  test('bonding curve visualization renders in detail panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForSelector('header')

    await page.waitForFunction(() => {
      return !document.querySelector('[class*="animate-pulse"]')
    }, { timeout: 15_000 }).catch(() => {})

    const tokenRow = page.locator('[class*="cursor-pointer"]').first()
    const hasTokens = await tokenRow.isVisible().catch(() => false)

    if (hasTokens) {
      await tokenRow.click()
      // The CurveViz component renders an <svg> with a polyline for the bonding curve
      const curveSvg = page.locator('svg').filter({ has: page.locator('polyline') })
      await expect(curveSvg.first()).toBeVisible({ timeout: 5_000 })
    } else {
      // If no tokens, skip gracefully — the detail panel is a placeholder
      test.skip()
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Filter Pills
  // ──────────────────────────────────────────────────────────────────────────

  test('filter pills (All, Hot, Graduating, Graduated) are clickable', async ({ page }) => {
    // Wait for scanner view to be ready
    await page.waitForFunction(() => {
      return !document.querySelector('[class*="animate-pulse"]')
    }, { timeout: 15_000 }).catch(() => {})

    const filters = ['All', 'Hot', 'Graduating', 'Graduated']

    for (const label of filters) {
      const pill = page.getByRole('button', { name: new RegExp(`^${label}`) })
      await expect(pill).toBeVisible()
      await pill.click()
      // Active pill gets dark background
      await expect(pill).toHaveClass(/bg-gray-900/)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Developers Link
  // ──────────────────────────────────────────────────────────────────────────

  test('Developers link is visible and navigates to /developers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForSelector('header')

    const devLink = page.locator('header').getByRole('link', { name: 'Developers' })
    await expect(devLink).toBeVisible()

    await devLink.click()
    await page.waitForURL('**/developers')
    expect(page.url()).toContain('/developers')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Mobile Responsiveness
  // ──────────────────────────────────────────────────────────────────────────

  test('page is mobile responsive (375px width)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForSelector('header')

    // Header and brand should still be visible
    const brand = page.locator('header').getByText('TrendSurfer', { exact: true })
    await expect(brand).toBeVisible()

    // Nav tabs should still be visible
    const scannerTab = page.locator('header nav button', { hasText: 'Scanner' })
    await expect(scannerTab).toBeVisible()

    // Page should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(375 + 2) // small tolerance
  })
})
