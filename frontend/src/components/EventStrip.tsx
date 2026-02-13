'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check, Radio } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { api, type EventSummary } from '@/lib/api'
import SeriesBadge from '@/components/SeriesBadge'

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
  const [events, setEvents] = useState<EventSummary[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  useEffect(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const nextYear = currentYear + 1

    const rankStatus = (status: string) => {
      if (status === 'live') return 0
      if (status === 'upcoming') return 1
      return 2
    }

    const sortEvents = (a: EventSummary, b: EventSummary) => {
      const statusDiff = rankStatus(a.status) - rankStatus(b.status)
      if (statusDiff !== 0) return statusDiff

      const aDate = parseISO(a.startDate).getTime()
      const bDate = parseISO(b.startDate).getTime()
      if (a.status === 'completed' && b.status === 'completed') {
        return bDate - aDate
      }
      return aDate - bDate
    }

    async function fetchHeaderEvents() {
      try {
        const [thisYear, followingYear] = await Promise.all([
          api.getCalendar(undefined, currentYear),
          api.getCalendar(undefined, nextYear),
        ])

        const merged = [...thisYear, ...followingYear]
        const uniqueById = new Map<number, EventSummary>()
        for (const event of merged) {
          uniqueById.set(event.id, event)
        }

        const prioritized = Array.from(uniqueById.values())
          .sort(sortEvents)
          .slice(0, 16)

        setEvents(prioritized)
      } catch {
        // API unavailable
      }
    }

    fetchHeaderEvents()
    const intervalId = setInterval(fetchHeaderEvents, 60000)
    return () => clearInterval(intervalId)
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

  const liveEvents = events.filter(event => event.status === 'live')
  const upcomingEvents = events.filter(event => event.status === 'upcoming')
  const completedEvents = events.filter(event => event.status === 'completed')
  const fallbackEvents = liveEvents.length === 0 && upcomingEvents.length === 0 ? completedEvents.slice(0, 6) : []

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
        {liveEvents.length > 0 && (
          <div className="shrink-0 flex items-center">
            <span className="text-[10px] font-semibold tracking-wide text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-1 rounded-full">
              LIVE NOW
            </span>
          </div>
        )}
        {upcomingEvents.length > 0 && (
          <div className="shrink-0 flex items-center">
            <span className="text-[10px] font-semibold tracking-wide text-pitwall-text-muted bg-pitwall-surface-2 border border-pitwall-border px-2 py-1 rounded-full">
              UP NEXT
            </span>
          </div>
        )}
        {liveEvents.length === 0 && upcomingEvents.length === 0 && fallbackEvents.length > 0 && (
          <div className="shrink-0 flex items-center">
            <span className="text-[10px] font-semibold tracking-wide text-pitwall-text-muted bg-pitwall-surface-2 border border-pitwall-border px-2 py-1 rounded-full">
              RECENTLY FINISHED
            </span>
          </div>
        )}
        {events.length === 0 && (
          <div className="text-sm text-pitwall-text-muted py-2">No live or upcoming events available.</div>
        )}
        {(liveEvents.length > 0 || upcomingEvents.length > 0
          ? [...liveEvents, ...upcomingEvents, ...completedEvents]
          : fallbackEvents
        ).map((event) => {
          const seriesColor = event.seriesColor
          return (
          <Link
            key={event.id}
            href={`/event/${event.seriesSlug}/${event.slug}`}
            className="shrink-0 w-56 rounded-lg bg-pitwall-bg border border-pitwall-border hover:border-pitwall-text-muted transition-colors group"
          >
            {/* Series color top border */}
            <div
              className="h-0.5 rounded-t-lg"
              style={{ backgroundColor: seriesColor }}
            />
            <div className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <SeriesBadge name={event.seriesName} color={seriesColor} size="sm" />
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
          )
        })}
      </div>
    </div>
  )
}
