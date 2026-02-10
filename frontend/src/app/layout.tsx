import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import EventStrip from '@/components/EventStrip'

export const metadata: Metadata = {
  title: 'Pitwall — Motorsport Companion',
  description: 'Follow F1, WEC, IMSA and more in one place',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pitwall-bg">
        <Navigation />
        <EventStrip />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
