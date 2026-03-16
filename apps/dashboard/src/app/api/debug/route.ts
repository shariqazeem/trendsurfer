import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const hasToken = !!process.env.TURSO_AUTH_TOKEN

  if (!tursoUrl) {
    return NextResponse.json({ error: 'TURSO_DATABASE_URL not set' })
  }

  // Debug: show exact URL bytes
  const urlBytes = Array.from(tursoUrl).map(c => c.charCodeAt(0))
  const trimmedUrl = tursoUrl.trim()

  try {
    const { createClient } = await import('@libsql/client')
    const db = createClient({ url: trimmedUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() })
    const result = await db.execute('SELECT COUNT(*) as c FROM predictions')
    const count = result.rows[0] as any
    return NextResponse.json({ ok: true, count: count?.c, urlLen: tursoUrl.length, trimmedLen: trimmedUrl.length })
  } catch (error: any) {
    return NextResponse.json({
      error: String(error),
      urlLen: tursoUrl.length,
      trimmedLen: trimmedUrl.length,
      lastChars: urlBytes.slice(-5),
      firstChars: urlBytes.slice(0, 10),
    })
  }
}
