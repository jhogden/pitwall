'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SeriesBadge from '@/components/SeriesBadge'
import { resolveSeriesColor } from '@/lib/constants'
import { api } from '@/lib/api'
import type { ConstructorStanding, DriverStanding, EventSummary, Series } from '@/lib/api'

export default function SeriesDetailPage() {
  const params = useParams()
  const slug = params.slug as string

  const [series, setSeries] = useState<Series | null>(null)
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([])
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>([])
  const [events, setEvents] = useState<EventSummary[]>([])
  const [standingClasses, setStandingClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors' | 'events'>('drivers')
  const [isLoading, setIsLoading] = useState(true)
  const isClassBasedSeries = series?.slug === 'wec' || series?.slug === 'imsa'

  useEffect(() => {
    let isCancelled = false

    const loadSeriesContext = async () => {
      setIsLoading(true)
      try {
        const [seriesData, seasons] = await Promise.all([
          api.getSeriesBySlug(slug),
          api.getSeasons(slug),
        ])
        if (isCancelled) return

        setSeries(seriesData)
        setYears(seasons)
        setSelectedYear(seasons[0] ?? null)
      } catch {
        if (isCancelled) return
        setSeries(null)
        setYears([])
        setSelectedYear(null)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    loadSeriesContext()
    return () => {
      isCancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!slug || !selectedYear) {
      setDriverStandings([])
      setConstructorStandings([])
      setEvents([])
      setStandingClasses([])
      setSelectedClass(null)
      return
    }

    let isCancelled = false

    const loadSeriesData = async () => {
      try {
        const [classes, calendar] = await Promise.all([
          api.getStandingClasses(slug, selectedYear),
          api.getCalendar(slug, selectedYear),
        ])
        if (isCancelled) return

        setStandingClasses(classes)
        const classToUse = (() => {
          if (!isClassBasedSeries || classes.length === 0) return null
          if (selectedClass && classes.includes(selectedClass)) return selectedClass
          return classes[0]
        })()

        setSelectedClass(classToUse)

        const [drivers, constructors] = await Promise.all([
          api.getDriverStandings(slug, selectedYear, classToUse || undefined),
          api.getConstructorStandings(slug, selectedYear, classToUse || undefined),
        ])
        if (isCancelled) return

        setDriverStandings(drivers)
        setConstructorStandings(constructors)
        setEvents(calendar)
      } catch {
        if (isCancelled) return
        setDriverStandings([])
        setConstructorStandings([])
        setEvents([])
        setStandingClasses([])
        setSelectedClass(null)
      }
    }

    loadSeriesData()
    return () => {
      isCancelled = true
    }
  }, [isClassBasedSeries, selectedClass, selectedYear, slug])

  const completedEvents = useMemo(
    () => events.filter(e => e.status === 'completed').slice(-8).reverse(),
    [events]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-pitwall-surface rounded animate-pulse" />
        <div className="h-48 bg-pitwall-surface rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!series) {
    return (
      <div className="text-center py-12">
        <p className="text-pitwall-text-muted">Series not found</p>
        <Link href="/series" className="text-pitwall-accent mt-2 inline-block">Back to Series</Link>
      </div>
    )
  }

  const seriesColor = resolveSeriesColor(series.slug, series.colorPrimary)

  return (
    <div>
      <Link
        href="/series"
        className="inline-flex items-center gap-1 text-sm text-pitwall-text-muted hover:text-pitwall-text mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        All Series
      </Link>

      <div
        className="rounded-xl p-6 mb-6 border"
        style={{
          borderColor: `${seriesColor}30`,
          background: `linear-gradient(135deg, ${seriesColor}10, transparent)`,
        }}
      >
        <SeriesBadge name={series.name} color={seriesColor} />
        <h1 className="text-3xl font-bold text-pitwall-text mt-2 mb-1">{series.name}</h1>
        <p className="text-pitwall-text-muted">Championship data for {selectedYear ?? 'selected season'}.</p>
        {isClassBasedSeries && selectedClass && (
          <p className="text-pitwall-text-muted text-sm mt-1">Class: {selectedClass}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-pitwall-surface rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'drivers' ? 'bg-pitwall-surface-2 text-pitwall-text' : 'text-pitwall-text-muted'
            }`}
          >
            Drivers
          </button>
          <button
            onClick={() => setActiveTab('constructors')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'constructors' ? 'bg-pitwall-surface-2 text-pitwall-text' : 'text-pitwall-text-muted'
            }`}
          >
            Constructors
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'events' ? 'bg-pitwall-surface-2 text-pitwall-text' : 'text-pitwall-text-muted'
            }`}
          >
            Events
          </button>
        </div>

        {years.length > 0 && (
          <select
            value={selectedYear ?? ''}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-pitwall-surface border border-pitwall-border rounded px-3 py-2 text-sm text-pitwall-text"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        )}
        {standingClasses.length > 1 && (
          <select
            value={selectedClass ?? ''}
            onChange={(e) => setSelectedClass(e.target.value || null)}
            className="bg-pitwall-surface border border-pitwall-border rounded px-3 py-2 text-sm text-pitwall-text"
          >
            {standingClasses.map(className => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        )}
      </div>

      {activeTab === 'drivers' && (
        <div className="bg-pitwall-surface rounded-lg border border-pitwall-border overflow-hidden">
          {driverStandings.length === 0 ? (
            <p className="text-pitwall-text-muted p-6 text-center">No driver standings available for this season yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-pitwall-border">
                  <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3 w-12">POS</th>
                  <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3">DRIVER</th>
                  <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3 hidden sm:table-cell">TEAM</th>
                  <th className="text-right text-xs text-pitwall-text-muted font-medium px-4 py-3 w-20">W</th>
                  <th className="text-right text-xs text-pitwall-text-muted font-medium px-4 py-3 w-20">PTS</th>
                </tr>
              </thead>
              <tbody>
                {driverStandings.map((standing) => (
                  <tr key={`${standing.position}-${standing.driverSlug}`} className="border-b border-pitwall-border/50 hover:bg-pitwall-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-sm text-pitwall-text">{standing.position}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: standing.teamColor || '#4D4D4D' }} />
                        <div>
                          <p className="font-semibold text-pitwall-text text-sm">{standing.driverName}</p>
                          <p className="text-xs text-pitwall-text-muted font-mono">{standing.driverNumber ? `#${standing.driverNumber}` : '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-pitwall-text-muted">{standing.teamName || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-pitwall-text-muted">{standing.wins}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-pitwall-text">{standing.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'constructors' && (
        <div className="bg-pitwall-surface rounded-lg border border-pitwall-border overflow-hidden">
          {constructorStandings.length === 0 ? (
            <p className="text-pitwall-text-muted p-6 text-center">No constructor standings available for this season yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-pitwall-border">
                  <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3 w-12">POS</th>
                  <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3">TEAM</th>
                  <th className="text-right text-xs text-pitwall-text-muted font-medium px-4 py-3 w-20">W</th>
                  <th className="text-right text-xs text-pitwall-text-muted font-medium px-4 py-3 w-20">PTS</th>
                </tr>
              </thead>
              <tbody>
                {constructorStandings.map((standing) => (
                  <tr key={`${standing.position}-${standing.teamName}`} className="border-b border-pitwall-border/50 hover:bg-pitwall-surface-2/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-sm text-pitwall-text">{standing.position}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: standing.teamColor || '#4D4D4D' }} />
                        <p className="font-semibold text-pitwall-text text-sm">{standing.teamName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-pitwall-text-muted">{standing.wins}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-pitwall-text">{standing.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-3">
          {completedEvents.length === 0 ? (
            <p className="text-pitwall-text-muted p-6 text-center bg-pitwall-surface rounded-lg border border-pitwall-border">No completed events found for this season.</p>
          ) : (
            completedEvents.map(event => (
              <Link
                key={event.slug}
                href={`/event/${slug}/${event.slug}`}
                className="flex items-center justify-between p-4 bg-pitwall-surface rounded-lg border border-pitwall-border hover:border-pitwall-accent/30 transition-colors"
              >
                <div>
                  <p className="font-semibold text-pitwall-text">{event.name}</p>
                  <p className="text-sm text-pitwall-text-muted">{event.startDate}</p>
                </div>
                <span className="text-xs text-pitwall-text-muted bg-pitwall-surface-2 px-2 py-1 rounded-full">
                  {event.status}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
