'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Radio, PlayCircle } from 'lucide-react'
import FeedCard from '@/components/FeedCard'
import { api } from '@/lib/api'
import type { EventSummary, FeedItem } from '@/lib/api'
import { SERIES_FILTERS } from '@/lib/constants'

function sortByPriority(a: EventSummary, b: EventSummary) {
  const rank = (status: string) => {
    if (status === 'live') return 0
    if (status === 'upcoming') return 1
    return 2
  }
  const statusDiff = rank(a.status) - rank(b.status)
  if (statusDiff !== 0) return statusDiff

  const aDate = parseISO(a.startDate).getTime()
  const bDate = parseISO(b.startDate).getTime()
  if (a.status === 'completed' && b.status === 'completed') return bDate - aDate
  return aDate - bDate
}

function compactRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (startDate === endDate) return format(start, 'MMM d')
  if (start.getMonth() === end.getMonth()) return `${format(start, 'MMM d')} - ${format(end, 'd')}`
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
}

export default function HomePage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [highlights, setHighlights] = useState<FeedItem[]>([])
  const [liveEvents, setLiveEvents] = useState<EventSummary[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<EventSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [followedSeries, setFollowedSeries] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('pitwall.home.followedSeries')
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .filter((value): value is string => typeof value === 'string')
          .filter(value => ['f1', 'wec', 'imsa'].includes(value))
        setFollowedSeries(normalized)
      }
    } catch {
      // Ignore invalid localStorage data
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('pitwall.home.followedSeries', JSON.stringify(followedSeries))
    } catch {
      // Ignore storage errors
    }
  }, [followedSeries])

  useEffect(() => {
    setIsLoading(true)
    const year = new Date().getFullYear()
    Promise.all([
      api.getCalendar(undefined, year),
      api.getCalendar(undefined, year + 1),
      api.getHighlights(0, 9),
      api.getFeed(0, 8),
    ])
      .then(([thisYear, nextYear, highlightsPage, feedPage]) => {
        const merged = [...thisYear, ...nextYear]
        const unique = new Map<number, EventSummary>()
        for (const event of merged) unique.set(event.id, event)
        const ranked = Array.from(unique.values()).sort(sortByPriority)
        setLiveEvents(ranked.filter(event => event.status === 'live').slice(0, 3))
        setUpcomingEvents(ranked.filter(event => event.status === 'upcoming').slice(0, 8))
        setHighlights(highlightsPage.content || [])
        setFeedItems(feedPage.content || [])
      })
      .catch(() => {
        setLiveEvents([])
        setUpcomingEvents([])
        setHighlights([])
        setFeedItems([])
      })
      .finally(() => setIsLoading(false))
  }, [])

  const activeSeries = useMemo(() => new Set(followedSeries), [followedSeries])
  const isAllSeries = followedSeries.length === 0
  const isSeriesVisible = (seriesSlug: string | null | undefined) =>
    isAllSeries || (!!seriesSlug && activeSeries.has(seriesSlug))

  const visibleLiveEvents = useMemo(
    () => liveEvents.filter(event => isSeriesVisible(event.seriesSlug)),
    [liveEvents, followedSeries]
  )
  const visibleUpcomingEvents = useMemo(
    () => upcomingEvents.filter(event => isSeriesVisible(event.seriesSlug)),
    [upcomingEvents, followedSeries]
  )
  const visibleHighlights = useMemo(
    () => highlights.filter(item => isSeriesVisible(item.seriesSlug)),
    [highlights, followedSeries]
  )
  const visibleFeedItems = useMemo(
    () => feedItems.filter(item => isSeriesVisible(item.seriesSlug)),
    [feedItems, followedSeries]
  )

  function toggleSeries(slug: string | null) {
    if (slug === null) {
      setFollowedSeries([])
      return
    }
    setFollowedSeries(prev =>
      prev.includes(slug)
        ? prev.filter(value => value !== slug)
        : [...prev, slug]
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-pitwall-border bg-gradient-to-br from-pitwall-surface to-pitwall-bg p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-pitwall-text-muted">Pitwall</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-pitwall-text">
          Live timing, class battles, and race highlights in one place
        </h1>
        <p className="mt-3 max-w-3xl text-pitwall-text-muted">
          Follow F1, WEC, and IMSA with live-aware event tracking, class-specific results, and telemetry-lite context.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 rounded-lg bg-pitwall-text px-4 py-2 text-sm font-medium text-pitwall-bg hover:opacity-90"
          >
            <CalendarDays size={16} />
            Open Calendar
          </Link>
          <Link
            href="/series"
            className="inline-flex items-center gap-2 rounded-lg border border-pitwall-border px-4 py-2 text-sm font-medium text-pitwall-text hover:bg-pitwall-surface-2"
          >
            Explore Series
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-pitwall-text">Followed Series</h2>
          <p className="text-xs text-pitwall-text-muted">Saved on this device</p>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {SERIES_FILTERS.map(filter => {
            const isActive = filter.slug === null
              ? isAllSeries
              : followedSeries.includes(filter.slug)
            return (
              <button
                key={filter.name}
                onClick={() => toggleSeries(filter.slug)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-pitwall-text text-pitwall-text bg-pitwall-surface-2'
                    : 'border-pitwall-border text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-surface'
                }`}
              >
                {filter.color && (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: filter.color }} />
                )}
                {filter.name}
              </button>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-green-400" />
            <h2 className="text-lg font-semibold text-pitwall-text">Now and Next</h2>
          </div>

          {isLoading ? (
            <div className="h-40 rounded-xl bg-pitwall-surface animate-pulse" />
          ) : visibleLiveEvents.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleLiveEvents.map(event => (
                <Link
                  key={event.id}
                  href={`/event/${event.seriesSlug}/${event.slug}`}
                  className="rounded-xl border border-green-500/40 bg-green-500/5 p-4 hover:border-green-400/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wide text-green-400">LIVE</span>
                    <span className="text-xs text-pitwall-text-muted">{event.seriesName}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-pitwall-text">{event.name}</p>
                  <p className="mt-1 text-xs text-pitwall-text-muted">{event.circuitName}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-4">
              <p className="text-sm text-pitwall-text">No events are live right now.</p>
              <p className="mt-1 text-xs text-pitwall-text-muted">Upcoming sessions are listed below.</p>
            </div>
          )}

          <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-4">
            <h3 className="text-sm font-semibold text-pitwall-text">Upcoming</h3>
            <div className="mt-3 space-y-2">
              {visibleUpcomingEvents.slice(0, 6).map(event => (
                <Link
                  key={event.id}
                  href={`/event/${event.seriesSlug}/${event.slug}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-pitwall-surface-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-pitwall-text">{event.name}</p>
                    <p className="truncate text-xs text-pitwall-text-muted">{event.seriesName} · {event.circuitName}</p>
                  </div>
                  <span className="ml-3 shrink-0 text-xs text-pitwall-text-muted">
                    {compactRange(event.startDate, event.endDate)}
                  </span>
                </Link>
              ))}
              {visibleUpcomingEvents.length === 0 && !isLoading && (
                <p className="text-xs text-pitwall-text-muted">No upcoming events found.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="flex items-center gap-2">
            <PlayCircle size={16} className="text-red-400" />
            <h2 className="text-lg font-semibold text-pitwall-text">Top Highlights</h2>
          </div>
          <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-3 space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-lg bg-pitwall-surface-2 animate-pulse" />
                ))}
              </div>
            ) : visibleHighlights.slice(0, 6).map(item => (
              <a
                key={item.id}
                href={item.contentUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-lg p-1 hover:bg-pitwall-surface-2 transition-colors"
              >
                <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md bg-pitwall-bg">
                  {item.thumbnailUrl && (
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-medium text-pitwall-text">{item.title}</p>
                  <p className="mt-1 text-[11px] text-pitwall-text-muted">{item.seriesName || 'Motorsport'}</p>
                </div>
              </a>
            ))}
            {!isLoading && visibleHighlights.length === 0 && (
              <p className="text-xs text-pitwall-text-muted">No highlights available yet.</p>
            )}
          </div>
        </aside>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-pitwall-text">Latest Updates</h2>
          <Link href="/calendar" className="text-xs text-pitwall-text-muted hover:text-pitwall-text">View full schedule</Link>
        </div>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-pitwall-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleFeedItems.map(item => (
              <FeedCard key={item.id} item={item} />
            ))}
            {visibleFeedItems.length === 0 && (
              <p className="text-center text-pitwall-text-muted py-8">
                No updates to show right now.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
