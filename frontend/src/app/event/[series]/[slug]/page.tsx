'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, MapPin, PlayCircle } from 'lucide-react'
import LiveIndicator from '@/components/LiveIndicator'
import SessionTimeline from '@/components/SessionTimeline'
import RaceResultCard from '@/components/RaceResultCard'
import TelemetryLiteCard from '@/components/TelemetryLiteCard'
import TireStrategyCard from '@/components/TireStrategyCard'
import RaceReplayCard from '@/components/RaceReplayCard'
import FallbackImage from '@/components/FallbackImage'
import { SESSION_TYPE_LABELS, STATUS_STYLES } from '@/lib/constants'
import { resolveSeriesColor } from '@/lib/constants'
import { getWinnerCarImageCandidates, seriesHeroBackground } from '@/lib/assets'
import { api } from '@/lib/api'
import type { EventDetail, FeedItem, LapTelemetryPoint, Result, Session, TireStint } from '@/lib/api'
import { generateTrackPoints, parseTrackGeometry, pathFromPoints } from '@/lib/track'

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

function driverInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'DR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
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
  const [tireStints, setTireStints] = useState<TireStint[]>([])
  const [availableClasses, setAvailableClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [showTelemetryModal, setShowTelemetryModal] = useState(false)
  const [preferredTelemetryDriver, setPreferredTelemetryDriver] = useState<{ name: string; carNumber: number | null } | null>(null)
  const [highlights, setHighlights] = useState<FeedItem[]>([])
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false)

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
    setIsLoadingHighlights(true)
    api.getHighlights(0, 6, undefined, slug)
      .then(page => setHighlights(page.content || []))
      .catch(() => setHighlights([]))
      .finally(() => setIsLoadingHighlights(false))
  }, [slug])

  useEffect(() => {
    if (!selectedSession) {
      setResults([])
      setTelemetry([])
      setTireStints([])
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
      setTireStints([])
      return
    }

    setIsLoadingResults(true)
    api.getResults(slug, selectedSession.id, selectedClass || undefined)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setIsLoadingResults(false))

    setIsLoadingTelemetry(true)
    Promise.allSettled([
      api.getTelemetry(slug, selectedSession.id),
      api.getTireStints(slug, selectedSession.id),
    ])
      .then(([telemetryResult, stintsResult]) => {
        setTelemetry(telemetryResult.status === 'fulfilled' ? telemetryResult.value : [])
        setTireStints(stintsResult.status === 'fulfilled' ? stintsResult.value : [])
      })
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

        const [nextResults, nextTelemetry, nextStints] = await Promise.all([
          api.getResults(slug, selectedSession.id, selectedClass || undefined).catch(() => null),
          api.getTelemetry(slug, selectedSession.id).catch(() => null),
          api.getTireStints(slug, selectedSession.id).catch(() => null),
        ])

        if (nextResults) setResults(nextResults)
        if (nextTelemetry) setTelemetry(nextTelemetry)
        if (nextStints) setTireStints(nextStints)
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
  const trackSeed = `${event.series.slug}-${event.slug}-${event.circuit.name}`
  const trackPreviewPoints = event.circuit.trackGeometry
    ? (() => { try { return parseTrackGeometry(event.circuit.trackGeometry, { width: 440, height: 270, padding: 20 }) } catch { return null } })()
    : null
  const trackPreviewPath = pathFromPoints(trackPreviewPoints || generateTrackPoints(trackSeed, { centerX: 220, centerY: 135, baseRadius: 145, count: 240 }))
  const useClassIntervals =
    (event.series.slug === 'wec' || event.series.slug === 'imsa') &&
    Boolean(selectedClass)
  const classIntervals = useClassIntervals ? computeClassIntervals(results) : []
  const podium = results.slice(0, 3)
  const winnerCarImageCandidates = getWinnerCarImageCandidates(event.slug, event.series.slug)

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
        className="rounded-xl p-6 mb-6 border relative overflow-hidden"
        style={{
          borderColor: `${seriesColor}30`,
          background: `linear-gradient(135deg, ${seriesColor}12, transparent)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: seriesHeroBackground(event.series.slug) }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <span className={`text-xs px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${EVENT_STATUS_STYLES[event.status] || ''}`}>
              {event.status === 'live' && <LiveIndicator />}
              {event.status === 'live' ? 'LIVE' : event.status}
            </span>
            <h1 className="mt-2 text-3xl font-bold text-pitwall-text">{event.name}</h1>
          </div>
          <div className="w-full md:w-72 lg:w-80">
            <div className="rounded-lg border border-pitwall-border bg-pitwall-surface/70 overflow-hidden h-28 md:h-32">
              <FallbackImage
                candidates={winnerCarImageCandidates}
                alt={`${event.name} winning car`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-4 2xl:col-span-3 space-y-5">
          <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-4">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-pitwall-text">{event.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-pitwall-text-muted">
                <MapPin size={14} />
                <span>{event.circuit.name} — {event.circuit.city}, {event.circuit.country}</span>
              </p>
            </div>
            <div className="rounded-lg border border-pitwall-border bg-pitwall-bg p-3 h-44 flex items-center justify-center overflow-hidden">
              {event.circuit.trackMapUrl ? (
                <img
                  src={event.circuit.trackMapUrl}
                  alt={`${event.circuit.name} track layout`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <svg viewBox="0 0 440 270" className="w-full h-full">
                  <path
                    d={trackPreviewPath}
                    fill="none"
                    stroke="rgba(148,163,184,0.32)"
                    strokeWidth="10"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
            {!event.circuit.trackMapUrl && (
              <p className="mt-2 text-xs text-pitwall-text-muted">
                Official track image unavailable for this circuit yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-4">
            <h2 className="text-lg font-semibold text-pitwall-text mb-3">Schedule</h2>
            <SessionTimeline sessions={event.sessions} />
          </div>

          {podium.length > 0 && (
            <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-4">
              <h2 className="text-lg font-semibold text-pitwall-text mb-3">Podium Snapshot</h2>
              <div className="grid grid-cols-1 gap-2">
                {podium.map((entry, idx) => (
                  <div
                    key={`${entry.driverName}-${entry.position}`}
                    className="rounded-lg border border-pitwall-border bg-pitwall-bg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-pitwall-text-muted">P{entry.position}</span>
                      <span className="text-xs text-pitwall-text-muted">{idx === 0 ? 'Winner' : idx === 1 ? '+1' : '+2'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{
                          backgroundColor: `${entry.teamColor || seriesColor}33`,
                          color: entry.teamColor || seriesColor,
                        }}
                        title={entry.driverName}
                      >
                        {driverInitials(entry.driverName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-pitwall-text">{entry.driverName}</p>
                        <p className="truncate text-xs text-pitwall-text-muted">{entry.teamName}</p>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-pitwall-text-muted">
                      {entry.gap || entry.time || (entry.position === 1 ? 'Leader' : '')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <PlayCircle size={16} className="text-red-400" />
              <h2 className="text-lg font-semibold text-pitwall-text">Event Highlights</h2>
            </div>
            {isLoadingHighlights ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-md bg-pitwall-bg animate-pulse" />
                ))}
              </div>
            ) : highlights.length > 0 ? (
              <div className="space-y-2">
                {highlights.slice(0, 4).map(item => (
                  <a
                    key={item.id}
                    href={item.contentUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-md p-1 hover:bg-pitwall-bg transition-colors"
                  >
                    <div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-pitwall-bg">
                      {item.thumbnailUrl && (
                        <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-medium text-pitwall-text">{item.title}</p>
                      <p className="mt-1 text-[11px] text-pitwall-text-muted">
                        {format(parseISO(item.publishedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-pitwall-text-muted">No event highlights available yet.</p>
            )}
          </div>

          {event.status === 'upcoming' && (
            <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-5 text-center">
              <p className="text-pitwall-text-muted">Results will be available after sessions complete</p>
              {raceSession && (
                <p className="text-sm text-pitwall-text-muted mt-2">
                  Race starts {format(parseISO(raceSession.startTime), 'PPpp')}
                </p>
              )}
            </div>
          )}

          {event.status === 'live' && (
            <div className="bg-green-400/5 rounded-lg border border-green-400/20 p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <LiveIndicator size="md" />
                <p className="text-green-400 font-semibold">Event is LIVE</p>
              </div>
              <p className="text-sm text-pitwall-text-muted">Results update during the session</p>
              <p className="text-xs text-pitwall-text-muted mt-1">
                Auto-refresh every {LIVE_POLL_INTERVAL_MS / 1000}s
              </p>
            </div>
          )}
        </div>

        <div className="xl:col-span-8 2xl:col-span-9 space-y-5">
          {resultSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
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
                  showLeaderGap={selectedSession?.type === 'qualifying'}
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

              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                {isLoadingTelemetry ? (
                  <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden">
                    <div className="px-3 py-2 border-b border-pitwall-border">
                      <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
                        Race Replay (Beta)
                      </h4>
                    </div>
                    <div className="p-4">
                      <div className="h-24 rounded-md bg-pitwall-surface animate-pulse" />
                    </div>
                  </div>
                ) : telemetry.length > 0 ? (
                  <RaceReplayCard
                    telemetry={telemetry}
                    trackMapUrl={event.circuit.trackMapUrl}
                    trackGeometry={event.circuit.trackGeometry}
                    trackSeed={`${event.series.slug}-${event.slug}-${event.circuit.name}`}
                  />
                ) : (
                  <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden">
                    <div className="px-3 py-2 border-b border-pitwall-border">
                      <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
                        Race Replay (Beta)
                      </h4>
                    </div>
                    <div className="p-4 text-sm text-pitwall-text-muted">
                      Replay requires lap telemetry for this session. Try a session/event with telemetry data.
                    </div>
                  </div>
                )}

                {isLoadingTelemetry ? (
                  <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden">
                    <div className="px-3 py-2 border-b border-pitwall-border">
                      <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
                        Tire / Stint Strategy (Lite)
                      </h4>
                    </div>
                    <div className="p-4">
                      <div className="h-20 rounded-md bg-pitwall-surface animate-pulse" />
                    </div>
                  </div>
                ) : (telemetry.length > 0 || tireStints.length > 0) ? (
                  <TireStrategyCard
                    telemetry={telemetry}
                    tireStints={tireStints}
                    leaderboardOrder={results.map(r => ({
                      name: r.driverName,
                      carNumber: r.driverNumber,
                      teamColor: r.teamColor,
                    }))}
                  />
                ) : (
                  <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden">
                    <div className="px-3 py-2 border-b border-pitwall-border">
                      <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
                        Tire / Stint Strategy (Lite)
                      </h4>
                    </div>
                    <div className="p-4 text-sm text-pitwall-text-muted">
                      No telemetry-derived stint data is available for this session yet.
                    </div>
                  </div>
                )}
              </div>
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
