import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const hasToken = !!process.env.TURSO_AUTH_TOKEN

  if (!tursoUrl) {
    return NextResponse.json({ error: 'TURSO_DATABASE_URL not set', envKeys: Object.keys(process.env).filter(k => k.startsWith('TURSO')) })
  }

  try {
    const db = createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
    const result = await db.execute('SELECT COUNT(*) as c FROM predictions')
    const count = result.rows[0] as any
    return NextResponse.json({ tursoUrl: tursoUrl.substring(0, 30) + '...', hasToken, count: count?.c })
  } catch (error) {
    return NextResponse.json({ error: String(error), tursoUrl: tursoUrl?.substring(0, 30), hasToken })
  }
}
