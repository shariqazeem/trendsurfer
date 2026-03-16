import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const hasToken = !!process.env.TURSO_AUTH_TOKEN

  if (!tursoUrl) {
    return NextResponse.json({ error: 'TURSO_DATABASE_URL not set', envKeys: Object.keys(process.env).filter(k => k.startsWith('TURSO')) })
  }

  try {
    const { createClient } = await import('@libsql/client')
    const db = createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
    const result = await db.execute('SELECT COUNT(*) as c FROM predictions')
    const count = result.rows[0] as any
    return NextResponse.json({ ok: true, tursoUrl: tursoUrl.substring(0, 40) + '...', hasToken, count: count?.c, nodeVersion: process.version })
  } catch (error: any) {
    return NextResponse.json({
      error: String(error),
      stack: error?.stack?.split('\n').slice(0, 5),
      tursoUrl: tursoUrl?.substring(0, 40),
      hasToken,
      nodeVersion: process.version
    })
  }
}
