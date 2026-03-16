import { test, expect } from '@playwright/test'

test.describe('Developers — SDK/MCP documentation page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/developers')
    await page.waitForSelector('header', { timeout: 15_000 })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Page Load
  // ──────────────────────────────────────────────────────────────────────────

  test('/developers page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/TrendSurfer/)
    // The page should have the "Developers" tab active in the nav
    const devTab = page.locator('header nav span', { hasText: 'Developers' })
    await expect(devTab).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Hero Section
  // ──────────────────────────────────────────────────────────────────────────

  test('hero section shows "Intelligence Layer" heading', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /Intelligence Layer/ })
    await expect(heading).toBeVisible()
  })

  test('npm install block is visible with "trendsurfer-skill"', async ({ page }) => {
    const installBlock = page.getByText('trendsurfer-skill').first()
    await expect(installBlock).toBeVisible()

    const npmInstall = page.getByText('npm install')
    await expect(npmInstall).toBeVisible()
  })

  test('copy button works (clicks without error)', async ({ page }) => {
    // The install block is a button that copies to clipboard
    const installButton = page.locator('button').filter({ hasText: 'npm install' })
    await expect(installButton).toBeVisible()

    // Click should not throw. We can't easily verify clipboard in headless,
    // but we can verify the checkmark icon appears briefly.
    await installButton.click()

    // After clicking, the button shows a checkmark SVG (polyline points="20 6 9 17 4 12")
    const checkmark = installButton.locator('polyline[points="20 6 9 17 4 12"]')
    await expect(checkmark).toBeVisible({ timeout: 2_000 })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Architecture Diagram
  // ──────────────────────────────────────────────────────────────────────────

  test('architecture diagram is visible', async ({ page }) => {
    const archLabel = page.getByText('Architecture')
    await expect(archLabel).toBeVisible()

    // Four architecture nodes (rendered in both desktop + mobile layouts, so use .first())
    await expect(page.getByText('Your Agent').first()).toBeVisible()
    await expect(page.getByText('TrendSurfer SDK / MCP').first()).toBeVisible()
    await expect(page.getByText('Helius + Bitget').first()).toBeVisible()
    await expect(page.getByText('Solana').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Code Examples with SDK / MCP Tabs
  // ──────────────────────────────────────────────────────────────────────────

  test('code examples section has SDK / MCP tabs', async ({ page }) => {
    const sdkTab = page.getByRole('button', { name: 'TypeScript SDK' })
    const mcpTab = page.getByRole('button', { name: 'MCP Config' })

    await expect(sdkTab).toBeVisible()
    await expect(mcpTab).toBeVisible()
  })

  test('SDK tab shows TypeScript code by default', async ({ page }) => {
    // The default tab shows "agent.ts" filename in the code block header
    const filename = page.getByText('agent.ts')
    await expect(filename).toBeVisible()

    // Should contain SDK import (appears in code block + SDK Reference section)
    await expect(page.getByText('TrendSurferSkill').first()).toBeVisible()
  })

  test('clicking MCP tab shows MCP configuration', async ({ page }) => {
    const mcpTab = page.getByRole('button', { name: 'MCP Config' })
    await mcpTab.click()

    // The MCP tab shows "claude_desktop_config.json" in header + as a comment in code
    const filename = page.getByText('claude_desktop_config.json').first()
    await expect(filename).toBeVisible({ timeout: 3_000 })

    // Should contain MCP server config
    await expect(page.getByText('mcpServers').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // MCP Tools Table
  // ──────────────────────────────────────────────────────────────────────────

  test('MCP tools table shows 6 tools', async ({ page }) => {
    // Section heading
    const mcpLabel = page.getByText('MCP Tools').first()
    await expect(mcpLabel).toBeVisible()

    // All 6 tool names should be visible
    const toolNames = [
      'scan_launches',
      'analyze_graduation',
      'check_security',
      'get_quote',
      'get_launches',
      'refresh_launches',
    ]

    for (const toolName of toolNames) {
      await expect(page.getByText(toolName, { exact: true })).toBeVisible()
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SDK Reference
  // ──────────────────────────────────────────────────────────────────────────

  test('SDK reference section lists methods', async ({ page }) => {
    const sdkLabel = page.getByText('SDK Reference')
    await expect(sdkLabel).toBeVisible()

    // Check some representative methods from the different categories
    await expect(page.getByText('scanLaunches(limit?)')).toBeVisible()
    await expect(page.getByText('analyzeGraduation(launch)')).toBeVisible()
    await expect(page.getByText('checkSecurity(mint)')).toBeVisible()
    await expect(page.getByText('getQuote(params)')).toBeVisible()
    await expect(page.getByText('executeTrade(params)')).toBeVisible()

    // Category headers (some labels also appear in stats grid, so use .first())
    await expect(page.getByText('Scanning').first()).toBeVisible()
    await expect(page.getByText('Analysis').first()).toBeVisible()
    await expect(page.getByText('Security').first()).toBeVisible()
    await expect(page.getByText('Trading').first()).toBeVisible()
    await expect(page.getByText('Utility').first()).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Stats Grid
  // ──────────────────────────────────────────────────────────────────────────

  test('stats grid shows 6 cards', async ({ page }) => {
    const statLabels = ['MCP Tools', 'TypeScript', 'Analysis', 'Trading', 'Lines of Code', 'Framework']

    for (const label of statLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // CTA Section
  // ──────────────────────────────────────────────────────────────────────────

  test('CTA section has GitHub and Dashboard links', async ({ page }) => {
    const githubLink = page.getByRole('link', { name: /View on GitHub/ })
    await expect(githubLink).toBeVisible()
    await expect(githubLink).toHaveAttribute('href', /github\.com/)

    const dashboardLink = page.getByRole('link', { name: /View Live Dashboard/ })
    await expect(dashboardLink).toBeVisible()
  })

  test('Dashboard link navigates back to /', async ({ page }) => {
    const dashboardLink = page.getByRole('link', { name: /View Live Dashboard/ })
    await dashboardLink.click()
    await page.waitForURL('**/')

    // Should be back on the main dashboard
    const scannerTab = page.locator('header nav button', { hasText: 'Scanner' })
    await expect(scannerTab).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Mobile Responsiveness
  // ──────────────────────────────────────────────────────────────────────────

  test('page is mobile responsive (375px width)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/developers')
    await page.waitForSelector('header')

    // Header + brand should still be visible
    const brand = page.locator('header').getByText('TrendSurfer', { exact: true })
    await expect(brand).toBeVisible()

    // Hero heading visible
    await expect(page.getByRole('heading', { name: /Intelligence Layer/ })).toBeVisible()

    // Architecture diagram switches to vertical layout on mobile (md:hidden → flex)
    // Desktop layout is hidden, mobile layout is second in DOM → use .last()
    await expect(page.getByText('Your Agent').last()).toBeVisible()

    // Page should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(375 + 2)
  })
})
