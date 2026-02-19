'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api, type DataCoverageRow } from '@/lib/api'
import { SERIES_FILTERS } from '@/lib/constants'

function pctClass(value: number): string {
  if (value >= 90) return 'text-green-300'
  if (value >= 60) return 'text-yellow-300'
  return 'text-red-300'
}

export default function DataCoveragePage() {
  const [rows, setRows] = useState<DataCoverageRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [seriesFilter, setSeriesFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<string>('all')

  useEffect(() => {
    setIsLoading(true)
    const series = seriesFilter === 'all' ? undefined : seriesFilter
    const year = yearFilter === 'all' ? undefined : Number(yearFilter)
    api.getDataCoverage(series, year)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setIsLoading(false))
  }, [seriesFilter, yearFilter])

  const years = useMemo(
    () => Array.from(new Set(rows.map(row => row.year))).sort((a, b) => b - a),
    [rows]
  )

  const totals = useMemo(() => {
    const totalEvents = rows.reduce((sum, row) => sum + row.eventCount, 0)
    const totalSessions = rows.reduce((sum, row) => sum + row.sessionCount, 0)
    const totalRaceSessions = rows.reduce((sum, row) => sum + row.raceSessionCount, 0)
    const totalResultSessions = rows.reduce((sum, row) => sum + row.sessionsWithResults, 0)
    const totalTelemetrySessions = rows.reduce((sum, row) => sum + row.sessionsWithTelemetry, 0)
    const totalTireSessions = rows.reduce((sum, row) => sum + row.sessionsWithTireStints, 0)

    const safePct = (numerator: number, denominator: number) =>
      denominator > 0 ? Math.round((numerator * 100) / denominator) : 0

    return {
      totalEvents,
      totalSessions,
      resultCoverage: safePct(totalResultSessions, totalRaceSessions),
      telemetryCoverage: safePct(totalTelemetrySessions, totalRaceSessions),
      tireCoverage: safePct(totalTireSessions, totalRaceSessions),
    }
  }, [rows])

  return (
    <div className="space-y-5">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-pitwall-text-muted hover:text-pitwall-text transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Settings
      </Link>

      <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-5">
        <h1 className="text-2xl font-bold text-pitwall-text">Data Coverage</h1>
        <p className="mt-2 text-sm text-pitwall-text-muted">
          Coverage by series and year for events, race-session results, telemetry, tire stints, track maps, and standings.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={seriesFilter}
            onChange={(event) => setSeriesFilter(event.target.value)}
            className="rounded-lg border border-pitwall-border bg-pitwall-bg px-3 py-2 text-sm text-pitwall-text"
          >
            <option value="all">All series</option>
            {SERIES_FILTERS.filter(item => item.slug).map(item => (
              <option key={item.slug} value={item.slug || ''}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="rounded-lg border border-pitwall-border bg-pitwall-bg px-3 py-2 text-sm text-pitwall-text"
          >
            <option value="all">All years</option>
            {years.map(year => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-pitwall-border bg-pitwall-bg p-3">
            <p className="text-[11px] uppercase tracking-wide text-pitwall-text-muted">Rows</p>
            <p className="text-lg font-semibold text-pitwall-text">{rows.length}</p>
          </div>
          <div className="rounded-lg border border-pitwall-border bg-pitwall-bg p-3">
            <p className="text-[11px] uppercase tracking-wide text-pitwall-text-muted">Events</p>
            <p className="text-lg font-semibold text-pitwall-text">{totals.totalEvents}</p>
          </div>
          <div className="rounded-lg border border-pitwall-border bg-pitwall-bg p-3">
            <p className="text-[11px] uppercase tracking-wide text-pitwall-text-muted">Sessions</p>
            <p className="text-lg font-semibold text-pitwall-text">{totals.totalSessions}</p>
          </div>
          <div className="rounded-lg border border-pitwall-border bg-pitwall-bg p-3">
            <p className="text-[11px] uppercase tracking-wide text-pitwall-text-muted">Telemetry</p>
            <p className={`text-lg font-semibold ${pctClass(totals.telemetryCoverage)}`}>{totals.telemetryCoverage}%</p>
          </div>
          <div className="rounded-lg border border-pitwall-border bg-pitwall-bg p-3">
            <p className="text-[11px] uppercase tracking-wide text-pitwall-text-muted">Tires</p>
            <p className={`text-lg font-semibold ${pctClass(totals.tireCoverage)}`}>{totals.tireCoverage}%</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-pitwall-border bg-pitwall-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-pitwall-bg text-pitwall-text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Series</th>
                <th className="px-3 py-2 text-left">Year</th>
                <th className="px-3 py-2 text-left">Events</th>
                <th className="px-3 py-2 text-left">Track Maps</th>
                <th className="px-3 py-2 text-left">Race Sessions</th>
                <th className="px-3 py-2 text-left">Results</th>
                <th className="px-3 py-2 text-left">Telemetry</th>
                <th className="px-3 py-2 text-left">Tire Stints</th>
                <th className="px-3 py-2 text-left">Standings</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-pitwall-text-muted">
                    Loading coverage...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-pitwall-text-muted">
                    No coverage rows found for this filter.
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={`${row.seriesSlug}-${row.year}`} className="border-t border-pitwall-border">
                  <td className="px-3 py-2 text-pitwall-text font-medium">{row.seriesName}</td>
                  <td className="px-3 py-2 text-pitwall-text">{row.year}</td>
                  <td className="px-3 py-2 text-pitwall-text">{row.eventCount}</td>
                  <td className="px-3 py-2 text-pitwall-text">
                    {row.eventsWithTrackMap}/{row.eventCount}{' '}
                    <span className={pctClass(row.trackMapCoveragePct)}>({row.trackMapCoveragePct}%)</span>
                  </td>
                  <td className="px-3 py-2 text-pitwall-text">{row.raceSessionCount}</td>
                  <td className="px-3 py-2 text-pitwall-text">
                    {row.sessionsWithResults}/{row.raceSessionCount}{' '}
                    <span className={pctClass(row.resultsCoveragePct)}>({row.resultsCoveragePct}%)</span>
                  </td>
                  <td className="px-3 py-2 text-pitwall-text">
                    {row.sessionsWithTelemetry}/{row.raceSessionCount}{' '}
                    <span className={pctClass(row.telemetryCoveragePct)}>({row.telemetryCoveragePct}%)</span>
                  </td>
                  <td className="px-3 py-2 text-pitwall-text">
                    {row.sessionsWithTireStints}/{row.raceSessionCount}{' '}
                    <span className={pctClass(row.tireCoveragePct)}>({row.tireCoveragePct}%)</span>
                  </td>
                  <td className="px-3 py-2 text-pitwall-text">
                    D:{row.driverStandingsCount} C:{row.constructorStandingsCount}{' '}
                    <span className={pctClass(row.standingsCoveragePct)}>({row.standingsCoveragePct}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
