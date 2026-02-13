'use client'

import { useState } from 'react'

interface RaceResultEntry {
  position: number
  driverName: string
  driverNumber: number | null
  teamName: string
  teamColor: string
  gap: string | null
}

interface RaceResultCardProps {
  results: RaceResultEntry[]
  eventName: string
}

function positionColor(position: number): string {
  if (position === 1) return 'text-amber-400'
  if (position === 2) return 'text-gray-300'
  if (position === 3) return 'text-amber-600'
  return 'text-pitwall-text-muted'
}

function positionBg(position: number): string {
  if (position === 1) return 'bg-amber-400/10'
  if (position === 2) return 'bg-gray-300/5'
  if (position === 3) return 'bg-amber-600/5'
  return ''
}

export default function RaceResultCard({ results, eventName }: RaceResultCardProps) {
  const [showAll, setShowAll] = useState(false)
  const hasMore = results.length > 10
  const displayedResults = showAll ? results : results.slice(0, 10)

  return (
    <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden">
      <div className="px-3 py-2 border-b border-pitwall-border">
        <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
          {eventName} — Classification
        </h4>
      </div>

      <div className="divide-y divide-pitwall-border/50">
        {displayedResults.map((entry, i) => (
          <div
            key={entry.position}
            className={`flex items-center gap-3 px-3 py-1.5 text-sm ${positionBg(entry.position)} ${i % 2 === 1 ? 'bg-pitwall-surface/30' : ''}`}
          >
            {/* Position */}
            <span className={`font-mono font-bold w-6 text-right text-sm ${positionColor(entry.position)}`}>
              {entry.position}
            </span>

            {/* Team color dot */}
            <span
              className="h-2.5 w-1 rounded-full shrink-0"
              style={{ backgroundColor: entry.teamColor }}
            />

            {/* Driver info */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-pitwall-text font-medium truncate">
                {entry.driverName}
              </span>
              {entry.driverNumber !== null && (
                <span className="font-mono text-xs text-pitwall-text-muted">
                  #{entry.driverNumber}
                </span>
              )}
            </div>

            {/* Team name */}
            <span className="hidden sm:block text-xs text-pitwall-text-muted truncate max-w-[120px]">
              {entry.teamName}
            </span>

            {/* Gap */}
            <span className="font-mono text-xs text-pitwall-text-muted w-20 text-right shrink-0">
              {entry.position === 1 ? '' : entry.gap || ''}
            </span>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          className="w-full px-3 py-2 text-xs font-medium text-pitwall-accent hover:bg-pitwall-surface/50 transition-colors border-t border-pitwall-border/50"
        >
          {showAll ? 'Show top 10' : `Show full classification (${results.length} drivers)`}
        </button>
      )}
    </div>
  )
}
