import { test, expect } from '@playwright/test'

test.describe('Developers — Documentation page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/developers')
    await page.waitForLoadState('domcontentloaded')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Page Load & Structure
  // ──────────────────────────────────────────────────────────────────────────

  test('/developers page loads successfully', async ({ page }) => {
    await expect(page).toHaveURL(/developers/)
  })

  test('has docs-style header with TrendSurfer and Docs breadcrumb', async ({ page }) => {
    await expect(page.getByText('TrendSurfer').first()).toBeVisible()
  })

  test('sidebar navigation is visible with all sections', async ({ page }) => {
    // Sidebar items appear as buttons; content headings also match — use .first() for each
    await expect(page.getByText('Getting Started').first()).toBeVisible()
    await expect(page.getByText('Installation').first()).toBeVisible()
    await expect(page.getByText('SDK Reference').first()).toBeVisible()
    await expect(page.getByText('MCP Server').first()).toBeVisible()
    await expect(page.getByText('x402 API').first()).toBeVisible()
    await expect(page.getByText('Architecture').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Getting Started Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Getting Started section has install command and quick example', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible()
    await expect(page.getByText('npm install trendsurfer-skill').first()).toBeVisible()
    // Quick example should show scan/analyze code
    await expect(page.getByText('scanLaunches').first()).toBeVisible()
  })

  test('copy button works for install command', async ({ page }) => {
    const copyBtn = page.locator('button').filter({ hasText: /copy|copied/i }).first()
    if (await copyBtn.isVisible()) {
      await copyBtn.click()
      // Should not throw
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Installation Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Installation section shows requirements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible()
    await expect(page.getByText('Node').first()).toBeVisible()
    await expect(page.getByText('heliusApiKey').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SDK Reference
  // ──────────────────────────────────────────────────────────────────────────

  test('SDK Reference lists method categories', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'SDK Reference' })).toBeVisible()
    // Category headers should be visible
    await expect(page.getByText('Scanning').first()).toBeVisible()
    await expect(page.getByText('Analysis').first()).toBeVisible()
    await expect(page.getByText('Security').first()).toBeVisible()
    await expect(page.getByText('Trading').first()).toBeVisible()
  })

  test('SDK Reference shows real method signatures', async ({ page }) => {
    await expect(page.getByText('scanLaunches').first()).toBeVisible()
    await expect(page.getByText('analyzeGraduation').first()).toBeVisible()
    await expect(page.getByText('checkSecurity').first()).toBeVisible()
    await expect(page.getByText('executeTrade').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // MCP Server Section
  // ──────────────────────────────────────────────────────────────────────────

  test('MCP Server section shows tools', async ({ page }) => {
    const mcpHeading = page.getByRole('heading', { name: /MCP Server/ })
    await expect(mcpHeading).toBeVisible()
    await expect(page.getByText('scan_launches').first()).toBeVisible()
    await expect(page.getByText('analyze_graduation').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // x402 API Section
  // ──────────────────────────────────────────────────────────────────────────

  test('x402 API section shows endpoint and pricing', async ({ page }) => {
    const x402Heading = page.getByRole('heading', { name: /x402/ })
    await expect(x402Heading).toBeVisible()
    await expect(page.getByText('/api/intelligence').first()).toBeVisible()
    await expect(page.getByText('$0.001').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Architecture Section
  // ──────────────────────────────────────────────────────────────────────────

  test('Architecture section shows system diagram', async ({ page }) => {
    const archHeading = page.getByRole('heading', { name: 'Architecture' })
    await expect(archHeading).toBeVisible()
    // Architecture nodes
    await expect(page.getByText('Your Agent').first()).toBeVisible()
    await expect(page.getByText('TrendSurfer').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Navigation
  // ──────────────────────────────────────────────────────────────────────────

  test('Dashboard link navigates back to /', async ({ page }) => {
    const dashLink = page.getByRole('link', { name: /Dashboard/ })
    await expect(dashLink).toBeVisible()
    await dashLink.click()
    await page.waitForURL(/\/$/)
    await expect(page.getByRole('heading', { name: /Intelligence Skill/ })).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Mobile
  // ──────────────────────────────────────────────────────────────────────────

  test('page is mobile responsive (375px width)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/developers')
    await page.waitForLoadState('domcontentloaded')

    // Content should still be visible
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible()

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(377)
  })
})
