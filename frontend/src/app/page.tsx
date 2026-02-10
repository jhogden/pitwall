'use client'

import { useState, useEffect } from 'react'
import FeedCard from '@/components/FeedCard'
import SeriesBadge from '@/components/SeriesBadge'
import type { FeedItem } from '@/lib/api'

const SERIES_FILTERS = [
  { slug: null, name: 'All', color: '#6366f1' },
  { slug: 'f1', name: 'F1', color: '#E10600' },
  { slug: 'wec', name: 'WEC', color: '#00548F' },
  { slug: 'imsa', name: 'IMSA', color: '#DA291C' },
]

const SAMPLE_FEED: FeedItem[] = [
  {
    id: 1, type: 'race_result', seriesSlug: 'f1', seriesName: 'Formula 1', seriesColor: '#E10600',
    eventId: 1, eventSlug: 'bahrain-gp-2025', title: 'Verstappen wins season opener in Bahrain',
    summary: 'Max Verstappen took a commanding victory at the Bahrain Grand Prix, leading from lights to flag. Lando Norris secured P2 for McLaren with Charles Leclerc completing the podium for Ferrari.',
    contentUrl: null, thumbnailUrl: null, publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 2, type: 'preview', seriesSlug: 'f1', seriesName: 'Formula 1', seriesColor: '#E10600',
    eventId: 2, eventSlug: 'saudi-gp-2025', title: 'Saudi Arabian Grand Prix Preview',
    summary: 'The circus moves to Jeddah for Round 2. The high-speed street circuit has produced dramatic races in previous years. Can anyone challenge Red Bull on this power-dependent track?',
    contentUrl: null, thumbnailUrl: null, publishedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 3, type: 'race_result', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F',
    eventId: 3, eventSlug: 'qatar-1812-2025', title: 'Toyota takes victory in Qatar 1812km season opener',
    summary: 'Toyota Gazoo Racing claimed victory in the season-opening Qatar 1812km. The #7 car of Conway, Kobayashi, and de Vries led a Toyota 1-2 at Lusail International Circuit.',
    contentUrl: null, thumbnailUrl: null, publishedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 4, type: 'highlight', seriesSlug: 'f1', seriesName: 'Formula 1', seriesColor: '#E10600',
    eventId: 1, eventSlug: 'bahrain-gp-2025', title: 'Race Highlights: 2025 Bahrain Grand Prix',
    summary: 'Watch the best moments from the season-opening Bahrain Grand Prix including the dramatic opening lap battle and the fight for the final podium position.',
    contentUrl: 'https://youtube.com', thumbnailUrl: null, publishedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 5, type: 'analysis', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F',
    eventId: 3, eventSlug: 'qatar-1812-2025', title: 'Strategy Analysis: How Toyota won in Qatar',
    summary: 'A deep dive into the strategy calls that decided the Qatar 1812km. We look at the pit stop timing, fuel management, and driver stint lengths that gave Toyota the edge.',
    contentUrl: null, thumbnailUrl: null, publishedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
]

export default function HomePage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>(SAMPLE_FEED)
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchFeed = async () => {
      setIsLoading(true)
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        const url = selectedSeries
          ? `${apiBase}/api/feed?series=${selectedSeries}`
          : `${apiBase}/api/feed`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          const items = data.content || data
          if (Array.isArray(items) && items.length > 0) {
            setFeedItems(items)
            return
          }
        }
      } catch {
        // API unavailable, use sample data
      }
      const filtered = selectedSeries
        ? SAMPLE_FEED.filter(item => item.seriesSlug === selectedSeries)
        : SAMPLE_FEED
      setFeedItems(filtered)
      setIsLoading(false)
    }

    fetchFeed()
  }, [selectedSeries])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-pitwall-text">Latest</h1>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        {SERIES_FILTERS.map(filter => (
          <button
            key={filter.name}
            onClick={() => setSelectedSeries(filter.slug)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              selectedSeries === filter.slug
                ? 'bg-pitwall-surface-2 text-pitwall-text border border-pitwall-border'
                : 'text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-surface'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: filter.color }}
            />
            {filter.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-32 bg-pitwall-surface rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {feedItems.map(item => (
            <FeedCard key={item.id} item={item} />
          ))}
          {feedItems.length === 0 && (
            <p className="text-center text-pitwall-text-muted py-12">
              No items to show for this series.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
