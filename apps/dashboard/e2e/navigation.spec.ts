import { test, expect } from '@playwright/test'

test.describe('Navigation flow', () => {
  test('can navigate from / to /developers and back', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-spin"]'),
      { timeout: 15_000 }
    ).catch(() => {})

    // Find Developers link and click it
    const devLink = page.getByRole('link', { name: 'Developers' }).first()
    await expect(devLink).toBeVisible()
    await devLink.click()

    await page.waitForURL('**/developers')
    expect(page.url()).toContain('/developers')

    // Navigate back to dashboard
    const dashLink = page.getByRole('link', { name: 'Dashboard' }).or(
      page.getByRole('link', { name: 'TrendSurfer' })
    )
    await dashLink.first().click()
    await page.waitForURL(/\/$/)
    expect(page.url()).not.toContain('/developers')
  })

  test('scroll sections are present on main page', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-spin"]'),
      { timeout: 15_000 }
    ).catch(() => {})

    // All major sections should exist
    await expect(page.getByText('How It Works')).toBeVisible()
    await expect(page.getByText('Live Scanner')).toBeVisible()
    await expect(page.getByText('Recent Predictions')).toBeVisible()
    await expect(page.getByText('Trading Performance')).toBeVisible()
    await expect(page.getByText('Use TrendSurfer in Your Agent')).toBeVisible()
    await expect(page.getByText('Agent Log')).toBeVisible()
  })

  test('"View Scanner" CTA scrolls to scanner section', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-spin"]'),
      { timeout: 15_000 }
    ).catch(() => {})

    const viewScanner = page.getByRole('link', { name: /View Scanner/ })
    await viewScanner.click()

    const scanner = page.locator('#scanner')
    await expect(scanner).toBeVisible()
  })

  test('browser back button works after navigating to /developers', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-spin"]'),
      { timeout: 15_000 }
    ).catch(() => {})

    const devLink = page.getByRole('link', { name: 'Developers' }).first()
    await devLink.click()
    await page.waitForURL('**/developers')

    await page.goBack()
    await page.waitForURL(/\/$/)
    expect(page.url()).not.toContain('/developers')
  })
})
