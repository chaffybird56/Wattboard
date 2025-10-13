import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wattboard - Energy Monitoring Dashboard',
  description: 'Multi-site energy monitoring with real-time insights and alerts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">
        {children}
      </body>
    </html>
  )
}
