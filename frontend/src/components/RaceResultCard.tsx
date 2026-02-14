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
  onDriverClick?: (entry: RaceResultEntry) => void
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

export default function RaceResultCard({ results, eventName, onDriverClick }: RaceResultCardProps) {
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

      <div className="grid grid-cols-[2.5rem,1fr,4rem,5.5rem] gap-3 px-3 py-2 border-b border-pitwall-border text-[10px] font-semibold uppercase tracking-wide text-pitwall-text-muted">
        <span className="text-right">Pos</span>
        <span>Driver</span>
        <span className="text-right">Car</span>
        <span className="text-right">Interval</span>
      </div>

      <div className="divide-y divide-pitwall-border/50">
        {displayedResults.map((entry, i) => (
          <div
            key={entry.position}
            className={`grid grid-cols-[2.5rem,1fr,4rem,5.5rem] items-center gap-3 px-3 py-1.5 text-sm ${positionBg(entry.position)} ${i % 2 === 1 ? 'bg-pitwall-surface/30' : ''}`}
          >
            <span className={`font-mono font-bold text-right text-sm ${positionColor(entry.position)}`}>
              {entry.position}
            </span>

            <div className="min-w-0 flex items-center gap-2">
              <span
                className="h-2.5 w-1 rounded-full shrink-0"
                style={{ backgroundColor: entry.teamColor }}
              />
              <button
                type="button"
                onClick={() => onDriverClick?.(entry)}
                className={`text-pitwall-text font-medium truncate text-left ${onDriverClick ? 'hover:text-pitwall-accent transition-colors' : 'cursor-default'}`}
                disabled={!onDriverClick}
              >
                {entry.driverName}
              </button>
            </div>

            <span className="font-mono text-xs text-pitwall-text-muted text-right">
              {entry.driverNumber !== null ? `#${entry.driverNumber}` : '—'}
            </span>

            <span className="font-mono text-xs text-pitwall-text-muted text-right">
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
