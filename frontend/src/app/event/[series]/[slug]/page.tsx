'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, MapPin } from 'lucide-react'
import SeriesBadge from '@/components/SeriesBadge'
import LiveIndicator from '@/components/LiveIndicator'
import SessionTimeline from '@/components/SessionTimeline'
import RaceResultCard from '@/components/RaceResultCard'
import TelemetryLiteCard from '@/components/TelemetryLiteCard'
import { SESSION_TYPE_LABELS, STATUS_STYLES } from '@/lib/constants'
import { resolveSeriesColor } from '@/lib/constants'
import { api } from '@/lib/api'
import type { EventDetail, LapTelemetryPoint, Result, Session } from '@/lib/api'

const EVENT_STATUS_STYLES: Record<string, string> = {
  ...STATUS_STYLES,
  upcoming: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  live: 'text-green-400 bg-green-400/10 border-green-400/30',
  completed: 'text-pitwall-text-muted bg-pitwall-surface-2 border-pitwall-border',
}

const SESSION_PRIORITY = ['race', 'sprint', 'qualifying']
const LIVE_POLL_INTERVAL_MS = 5000

function parseTimingToSeconds(raw: string | null): number | null {
  if (!raw) return null
  const cleaned = raw.trim().replace(/^\+/, '')
  if (!cleaned) return null
  if (/[A-Za-z]/.test(cleaned)) return null
  if (!/^\d+(?::\d+){0,2}(?:\.\d+)?$/.test(cleaned)) return null

  const parts = cleaned.split(':').map(Number)
  if (parts.some(Number.isNaN)) return null

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0]
}

function formatIntervalSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds - minutes * 60
    return `+${minutes}:${remainder.toFixed(3).padStart(6, '0')}`
  }
  return `+${seconds.toFixed(3)}`
}

function computeClassIntervals(rows: Result[]): string[] {
  if (rows.length === 0) return []
  const intervals: string[] = ['']

  for (let i = 1; i < rows.length; i += 1) {
    const current = rows[i]
    const previous = rows[i - 1]

    if (
      previous.laps !== null &&
      current.laps !== null &&
      current.laps < previous.laps
    ) {
      intervals.push(`+${previous.laps - current.laps}L`)
      continue
    }

    const currentSeconds = parseTimingToSeconds(current.time)
    const previousSeconds = parseTimingToSeconds(previous.time)
    if (
      currentSeconds !== null &&
      previousSeconds !== null &&
      currentSeconds >= previousSeconds
    ) {
      intervals.push(formatIntervalSeconds(currentSeconds - previousSeconds))
      continue
    }

    intervals.push(current.gap || '')
  }

  return intervals
}

function pickDefaultSession(eventStatus: string, sessions: Session[]): Session | null {
  const nonPractice = sessions.filter(s => s.type !== 'practice')
  if (nonPractice.length === 0) return null

  const pickByPriority = (candidates: Session[]) =>
    SESSION_PRIORITY
      .map(type => candidates.find(s => s.type === type))
      .find(Boolean) || null

  if (eventStatus === 'live') {
    return pickByPriority(nonPractice) || nonPractice[0]
  }

  const completed = nonPractice.filter(s => s.status === 'completed')
  return pickByPriority(completed) || completed[0] || pickByPriority(nonPractice) || nonPractice[0]
}

export default function EventDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [telemetry, setTelemetry] = useState<LapTelemetryPoint[]>([])
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false)
  const [availableClasses, setAvailableClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [showTelemetryModal, setShowTelemetryModal] = useState(false)
  const [preferredTelemetryDriver, setPreferredTelemetryDriver] = useState<{ name: string; carNumber: number | null } | null>(null)

  const isClassBasedSeries = event?.series.slug === 'wec' || event?.series.slug === 'imsa'

  useEffect(() => {
    api.getEvent(slug)
      .then(data => {
        setEvent(data)
        const best = pickDefaultSession(data.status, data.sessions || [])
        if (best) setSelectedSession(best)
      })
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    if (!selectedSession) {
      setResults([])
      setTelemetry([])
      setAvailableClasses([])
      setSelectedClass(null)
      return
    }

    api.getResultClasses(slug, selectedSession.id)
      .then(classes => {
        const filtered = classes.filter(Boolean)
        setAvailableClasses(filtered)
        setSelectedClass(prev => {
          if (prev && filtered.includes(prev)) return prev
          return null
        })
      })
      .catch(() => {
        setAvailableClasses([])
        setSelectedClass(null)
      })
  }, [event?.series.slug, isClassBasedSeries, selectedSession, slug])

  useEffect(() => {
    if (!selectedSession) {
      setResults([])
      setTelemetry([])
      return
    }

    setIsLoadingResults(true)
    api.getResults(slug, selectedSession.id, selectedClass || undefined)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setIsLoadingResults(false))

    setIsLoadingTelemetry(true)
    api.getTelemetry(slug, selectedSession.id)
      .then(setTelemetry)
      .catch(() => setTelemetry([]))
      .finally(() => setIsLoadingTelemetry(false))
  }, [selectedClass, selectedSession, slug])

  useEffect(() => {
    if (!event || event.status !== 'live') return

    const pollLiveData = async () => {
      try {
        const latestEvent = await api.getEvent(slug)
        setEvent(latestEvent)

        if (!selectedSession) return

        const latestSession = latestEvent.sessions.find(s => s.id === selectedSession.id)
        if (
          latestSession &&
          (latestSession.status !== selectedSession.status ||
            latestSession.name !== selectedSession.name ||
            latestSession.startTime !== selectedSession.startTime ||
            latestSession.endTime !== selectedSession.endTime)
        ) {
          setSelectedSession(latestSession)
        }

        const [nextResults, nextTelemetry] = await Promise.all([
          api.getResults(slug, selectedSession.id, selectedClass || undefined).catch(() => null),
          api.getTelemetry(slug, selectedSession.id).catch(() => null),
        ])

        if (nextResults) setResults(nextResults)
        if (nextTelemetry) setTelemetry(nextTelemetry)
      } catch {
        // Keep current UI state during transient polling failures.
      }
    }

    pollLiveData()
    const intervalId = setInterval(pollLiveData, LIVE_POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [event?.status, selectedClass, selectedSession, slug])

  if (!event) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-pitwall-surface rounded animate-pulse" />
        <div className="h-48 bg-pitwall-surface rounded-lg animate-pulse" />
      </div>
    )
  }

  const eventYear = parseISO(event.startDate).getFullYear()
  const resultSessions = event.sessions.filter(s => s.type !== 'practice')
  const raceSession = event.sessions.find(s => s.type === 'race')
  const seriesColor = resolveSeriesColor(event.series.slug, event.series.colorPrimary)
  const useClassIntervals =
    (event.series.slug === 'wec' || event.series.slug === 'imsa') &&
    Boolean(selectedClass)
  const classIntervals = useClassIntervals ? computeClassIntervals(results) : []

  return (
    <div>
      <Link
        href={`/calendar/${eventYear}/${event.series.slug}`}
        className="inline-flex items-center gap-1 text-sm text-pitwall-text-muted hover:text-pitwall-text mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Calendar
      </Link>

      <div
        className="rounded-xl p-6 mb-6 border"
        style={{
          borderColor: `${seriesColor}30`,
          background: `linear-gradient(135deg, ${seriesColor}08, transparent)`,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SeriesBadge name={event.series.name} color={seriesColor} />
              <span className={`text-xs px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${EVENT_STATUS_STYLES[event.status] || ''}`}>
                {event.status === 'live' && <LiveIndicator />}
                {event.status === 'live' ? 'LIVE' : event.status}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-pitwall-text mb-2">{event.name}</h1>
            <div className="flex items-center gap-2 text-pitwall-text-muted">
              <MapPin size={16} />
              <span>{event.circuit.name} — {event.circuit.city}, {event.circuit.country}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono text-pitwall-text">
              {format(parseISO(event.startDate), 'MMM d')}
              {event.startDate !== event.endDate && ` – ${format(parseISO(event.endDate), 'MMM d')}`}
            </p>
            <p className="text-sm text-pitwall-text-muted">{format(parseISO(event.startDate), 'yyyy')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-pitwall-text mb-4">Schedule</h2>
          <SessionTimeline sessions={event.sessions} />
        </div>

        <div className="lg:col-span-2">
          {resultSessions.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-pitwall-text">Results</h2>
                <button
                  type="button"
                  onClick={() => {
                    const leader = results[0]
                    setPreferredTelemetryDriver(
                      leader
                        ? { name: leader.driverName, carNumber: leader.driverNumber }
                        : null
                    )
                    setShowTelemetryModal(true)
                  }}
                  disabled={telemetry.length === 0}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    telemetry.length > 0
                      ? 'border-pitwall-accent text-pitwall-accent hover:bg-pitwall-accent/10'
                      : 'border-pitwall-border text-pitwall-text-muted/60 cursor-not-allowed'
                  }`}
                >
                  Telemetry Lite
                </button>
                <div className="flex gap-1 bg-pitwall-surface rounded-lg p-0.5">
                  {resultSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        selectedSession?.id === session.id
                          ? 'bg-pitwall-accent text-white'
                          : session.status === 'completed' || event.status === 'live'
                            ? 'text-pitwall-text-muted hover:text-pitwall-text'
                            : 'text-pitwall-text-muted/50 cursor-not-allowed'
                      }`}
                      disabled={session.status !== 'completed' && event.status !== 'live'}
                    >
                      {SESSION_TYPE_LABELS[session.type] || session.name}
                    </button>
                  ))}
                </div>
                {isClassBasedSeries && availableClasses.length > 0 && (
                  <select
                    value={selectedClass ?? '__all__'}
                    onChange={(e) => setSelectedClass(e.target.value === '__all__' ? null : e.target.value)}
                    className="bg-pitwall-surface border border-pitwall-border rounded px-3 py-1.5 text-sm text-pitwall-text"
                  >
                    <option value="__all__">All classes</option>
                    {availableClasses.map(className => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                )}
              </div>

              {isLoadingResults ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-pitwall-surface rounded animate-pulse" />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <RaceResultCard
                  results={results.map((r, idx) => ({
                    position: r.position,
                    driverName: r.driverName,
                    driverNumber: r.driverNumber,
                    teamName: r.teamName,
                    teamColor: r.teamColor,
                    gap: useClassIntervals ? (classIntervals[idx] ?? r.gap) : r.gap,
                  }))}
                  eventName={`${event.name} — ${SESSION_TYPE_LABELS[selectedSession?.type || ''] || selectedSession?.name || ''}`}
                  onDriverClick={(entry) => {
                    setPreferredTelemetryDriver({
                      name: entry.driverName,
                      carNumber: entry.driverNumber,
                    })
                    setShowTelemetryModal(true)
                  }}
                />
              ) : selectedSession ? (
                <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-8 text-center">
                  <p className="text-pitwall-text-muted">No results available for this session yet.</p>
                </div>
              ) : null}
            </div>
          )}

          {event.status === 'upcoming' && (
            <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-8 text-center">
              <p className="text-pitwall-text-muted text-lg">
                Results will be available after sessions complete
              </p>
              {raceSession && (
                <p className="text-sm text-pitwall-text-muted mt-2">
                  Race starts {format(parseISO(raceSession.startTime), 'PPpp')}
                </p>
              )}
            </div>
          )}

          {event.status === 'live' && (
            <div className="bg-green-400/5 rounded-lg border border-green-400/20 p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <LiveIndicator size="md" />
                <p className="text-green-400 text-lg font-semibold">Event is LIVE</p>
              </div>
              <p className="text-sm text-pitwall-text-muted">
                Results will update as sessions complete
              </p>
              <p className="text-xs text-pitwall-text-muted mt-2">
                Auto-refreshing every {LIVE_POLL_INTERVAL_MS / 1000}s
              </p>
            </div>
          )}
        </div>
      </div>

      {showTelemetryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 md:p-8 overflow-y-auto"
          onClick={() => setShowTelemetryModal(false)}
        >
          <div
            className="max-w-5xl mx-auto mt-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-pitwall-text-muted uppercase tracking-wide">
                Telemetry Lite
              </h3>
              <button
                type="button"
                onClick={() => setShowTelemetryModal(false)}
                className="px-3 py-1.5 text-xs font-medium rounded border border-pitwall-border text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-surface transition-colors"
              >
                Close
              </button>
            </div>
            {isLoadingTelemetry ? (
              <div className="h-72 bg-pitwall-surface rounded-lg animate-pulse" />
            ) : telemetry.length > 0 ? (
              <TelemetryLiteCard
                telemetry={telemetry}
                eventName={`${event.name} — ${SESSION_TYPE_LABELS[selectedSession?.type || ''] || selectedSession?.name || ''}`}
                preferredDriver={preferredTelemetryDriver}
                leaderboardOrder={results.map(r => ({
                  name: r.driverName,
                  carNumber: r.driverNumber,
                }))}
              />
            ) : (
              <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-8 text-center">
                <p className="text-pitwall-text-muted">No telemetry available for this session.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
