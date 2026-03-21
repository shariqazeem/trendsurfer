import type { Metadata } from 'next'
import './globals.css'

const siteUrl = 'https://solana-trends-agent.vercel.app'

export const metadata: Metadata = {
  title: 'TrendSurfer — The Intelligence Skill for trends.fun',
  description: 'AI-powered graduation prediction for trends.fun tokens. Reusable TypeScript SDK + MCP server for any AI agent. Scan launches, analyze bonding curves, detect graduations, trade on Meteora DBC. Pay per analysis via x402.',
  keywords: ['trendsurfer', 'trends.fun', 'solana', 'meteora', 'bonding curve', 'graduation', 'mcp', 'ai agent', 'x402', 'agent-to-agent'],
  authors: [{ name: 'Shariq Azeem', url: 'https://x.com/AzeemShariq' }],
  openGraph: {
    title: 'TrendSurfer — The Intelligence Skill for trends.fun',
    description: 'Paste any token mint address → instant graduation analysis. AI scores bonding curve progress, tweet virality, holder distribution, and security. npm install trendsurfer-skill',
    url: siteUrl,
    siteName: 'TrendSurfer',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrendSurfer — The Intelligence Skill for trends.fun',
    description: 'AI-powered graduation prediction. Paste a mint → get a score. SDK on npm, MCP server, x402 micropayments. Built for the Agent Talent Show hackathon.',
    creator: '@AzeemShariq',
  },
  icons: {
    icon: '/favicon.svg',
  },
  metadataBase: new URL(siteUrl),
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
