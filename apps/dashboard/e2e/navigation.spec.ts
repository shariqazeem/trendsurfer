import { test, expect } from '@playwright/test'

test.describe('Navigation flow', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Cross-page Navigation
  // ──────────────────────────────────────────────────────────────────────────

  test('can navigate from / to /developers and back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // Start at dashboard
    await page.goto('/')
    await page.waitForSelector('header')

    // Verify we are on the dashboard — Scanner tab should be visible
    await expect(page.locator('header nav button', { hasText: 'Scanner' })).toBeVisible()

    // Navigate to /developers via the nav link
    await page.locator('header').getByRole('link', { name: 'Developers' }).click()
    await page.waitForURL('**/developers')
    expect(page.url()).toContain('/developers')

    // Verify developers page loaded
    await expect(page.getByRole('heading', { name: /Intelligence Layer/ })).toBeVisible()

    // Navigate back to dashboard via the "Dashboard" link in the developers nav
    await page.locator('header nav').getByRole('link', { name: 'Dashboard' }).click()
    await page.waitForURL(url => !url.toString().includes('/developers'))

    // Verify dashboard loaded
    await expect(page.locator('header nav button', { hasText: 'Scanner' })).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Tab Switching Preserves Data
  // ──────────────────────────────────────────────────────────────────────────

  test('tab switching preserves data (Scanner to Trades and back)', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('header')

    // Wait for initial load to complete
    await page.waitForFunction(() => {
      return !document.querySelector('[class*="animate-pulse"]')
    }, { timeout: 15_000 }).catch(() => {})

    // We are on Scanner view — note the filter pill states
    const allPill = page.getByRole('button', { name: /^All/ })

    // Check if the All pill is visible (Scanner view is loaded)
    const scannerLoaded = await allPill.isVisible().catch(() => false)
    if (!scannerLoaded) {
      // Loading might still be showing — wait a bit more
      await page.waitForTimeout(2_000)
    }

    // Switch to Trades
    await page.locator('header nav button', { hasText: 'Trades' }).click()
    await expect(page.getByText('Strategy:', { exact: false })).toBeVisible({ timeout: 5_000 })

    // Switch back to Scanner
    await page.locator('header nav button', { hasText: 'Scanner' }).click()

    // Filter pills should be visible again — data is preserved
    await expect(page.getByRole('button', { name: /^All/ })).toBeVisible({ timeout: 5_000 })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // URL Does Not Change on Tab Switch
  // ──────────────────────────────────────────────────────────────────────────

  test('URL does not change when switching tabs (client-side state)', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('header')
    const initialUrl = page.url()

    // Switch to Trades
    await page.locator('header nav button', { hasText: 'Trades' }).click()
    await page.waitForTimeout(500)
    expect(page.url()).toBe(initialUrl)

    // Switch to Log
    await page.locator('header nav button', { hasText: 'Log' }).click()
    await page.waitForTimeout(500)
    expect(page.url()).toBe(initialUrl)

    // Switch back to Scanner
    await page.locator('header nav button', { hasText: 'Scanner' }).click()
    await page.waitForTimeout(500)
    expect(page.url()).toBe(initialUrl)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Browser Back Button
  // ──────────────────────────────────────────────────────────────────────────

  test('browser back button works after navigating to /developers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // Start at dashboard
    await page.goto('/')
    await page.waitForSelector('header')

    // Navigate to /developers
    await page.locator('header').getByRole('link', { name: 'Developers' }).click()
    await page.waitForURL('**/developers')

    // Go back with browser back button
    await page.goBack()
    await page.waitForURL(url => !url.toString().includes('/developers'))

    // Should be back on dashboard
    await expect(page.locator('header nav button', { hasText: 'Scanner' })).toBeVisible()
  })
})
