'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check, Radio } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { EventSummary } from '@/lib/api'
import SeriesBadge from '@/components/SeriesBadge'

const SAMPLE_EVENTS: EventSummary[] = [
  { id: 1, name: 'Bahrain Grand Prix', slug: 'bahrain-gp-2025', seriesSlug: 'f1', seriesName: 'F1', seriesColor: '#E10600', circuitName: 'Bahrain International Circuit', country: 'Bahrain', city: 'Sakhir', startDate: '2025-03-14', endDate: '2025-03-16', status: 'completed' },
  { id: 2, name: 'Saudi Arabian Grand Prix', slug: 'saudi-gp-2025', seriesSlug: 'f1', seriesName: 'F1', seriesColor: '#E10600', circuitName: 'Jeddah Corniche Circuit', country: 'Saudi Arabia', city: 'Jeddah', startDate: '2025-03-21', endDate: '2025-03-23', status: 'upcoming' },
  { id: 3, name: 'Qatar 1812km', slug: 'qatar-1812-2025', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F', circuitName: 'Lusail International Circuit', country: 'Qatar', city: 'Lusail', startDate: '2025-02-28', endDate: '2025-03-01', status: 'completed' },
  { id: 4, name: '6 Hours of Imola', slug: 'imola-6h-2025', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F', circuitName: 'Autodromo Enzo e Dino Ferrari', country: 'Italy', city: 'Imola', startDate: '2025-04-20', endDate: '2025-04-20', status: 'upcoming' },
  { id: 5, name: 'Australian Grand Prix', slug: 'australia-gp-2025', seriesSlug: 'f1', seriesName: 'F1', seriesColor: '#E10600', circuitName: 'Albert Park Circuit', country: 'Australia', city: 'Melbourne', startDate: '2025-03-28', endDate: '2025-03-30', status: 'upcoming' },
]

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (startDate === endDate) {
    return format(start, 'MMM d')
  }
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')}–${format(end, 'd')}`
  }
  return `${format(start, 'MMM d')}–${format(end, 'MMM d')}`
}

function StatusIndicator({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
        </span>
        LIVE
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 text-xs text-pitwall-text-muted">
        <Check size={12} />
        Done
      </span>
    )
  }
  return (
    <span className="text-xs text-pitwall-text-muted">
      Upcoming
    </span>
  )
}

export default function EventStrip() {
  const [events, setEvents] = useState<EventSummary[]>(SAMPLE_EVENTS)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/calendar')
        if (!res.ok) throw new Error('Failed to fetch')
        const data: EventSummary[] = await res.json()
        if (data.length > 0) setEvents(data)
      } catch {
        // Keep sample data on failure
      }
    }
    fetchEvents()
  }, [])

  const updateScrollButtons = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollButtons()
    el.addEventListener('scroll', updateScrollButtons, { passive: true })
    window.addEventListener('resize', updateScrollButtons)
    return () => {
      el.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [events])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = 300
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div className="relative bg-pitwall-surface border-b border-pitwall-border">
      {/* Left fade + button */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center">
          <div className="absolute inset-0 w-16 bg-gradient-to-r from-pitwall-surface to-transparent pointer-events-none" />
          <button
            onClick={() => scroll('left')}
            className="relative z-10 ml-1 p-1 rounded-full bg-pitwall-surface-2 border border-pitwall-border text-pitwall-text-muted hover:text-pitwall-text transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {/* Right fade + button */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center">
          <div className="absolute inset-0 w-16 bg-gradient-to-l from-pitwall-surface to-transparent pointer-events-none" />
          <button
            onClick={() => scroll('right')}
            className="relative z-10 mr-1 p-1 rounded-full bg-pitwall-surface-2 border border-pitwall-border text-pitwall-text-muted hover:text-pitwall-text transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="hide-scrollbar flex gap-3 px-4 py-3 overflow-x-auto"
      >
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.slug}`}
            className="shrink-0 w-56 rounded-lg bg-pitwall-bg border border-pitwall-border hover:border-pitwall-text-muted transition-colors group"
          >
            {/* Series color top border */}
            <div
              className="h-0.5 rounded-t-lg"
              style={{ backgroundColor: event.seriesColor }}
            />
            <div className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <SeriesBadge name={event.seriesName} color={event.seriesColor} size="sm" />
                <StatusIndicator status={event.status} />
              </div>
              <p className="text-sm font-semibold text-pitwall-text truncate group-hover:text-white transition-colors">
                {event.name}
              </p>
              <p className="text-xs text-pitwall-text-muted truncate">
                {event.circuitName}
              </p>
              <p className="text-xs text-pitwall-text-muted font-mono">
                {formatDateRange(event.startDate, event.endDate)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
