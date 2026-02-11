'use client'

import { useState, useEffect } from 'react'
import FeedCard from '@/components/FeedCard'
import { SERIES_FILTERS } from '@/lib/constants'
import { api } from '@/lib/api'
import type { FeedItem } from '@/lib/api'

export default function HomePage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    api.getFeed(0, 20, selectedSeries || undefined)
      .then(data => setFeedItems(data.content || []))
      .catch(() => setFeedItems([]))
      .finally(() => setIsLoading(false))
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
            {filter.color && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: filter.color }}
              />
            )}
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
