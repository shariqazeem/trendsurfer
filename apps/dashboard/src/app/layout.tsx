import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TrendSurfer — trends.fun Intelligence',
  description: 'AI-powered graduation prediction and trading for trends.fun tokens',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
