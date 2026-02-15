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
import TireStrategyCard from '@/components/TireStrategyCard'
import RaceReplayCard from '@/components/RaceReplayCard'
import { SESSION_TYPE_LABELS, STATUS_STYLES } from '@/lib/constants'
import { resolveSeriesColor } from '@/lib/constants'
import { api } from '@/lib/api'
import type { EventDetail, LapTelemetryPoint, Result, Session, TireStint } from '@/lib/api'

const EVENT_STATUS_STYLES: Record<string, string> = {
  ...STATUS_STYLES,
  upcoming: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  live: 'text-green-400 bg-green-400/10 border-green-400/30',
  completed: 'text-pitwall-text-muted bg-pitwall-surface-2 border-pitwall-border',
}

const SESSION_PRIORITY = ['race', 'sprint', 'qualifying']
const LIVE_POLL_INTERVAL_MS = 5000

type TrackPoint = { x: number; y: number }

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateTrackPoints(seedText: string, count = 240): TrackPoint[] {
  const rand = mulberry32(hashString(seedText || 'pitwall'))
  const a1 = 2 + rand() * 1.8
  const a2 = 4 + rand() * 2.2
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  const p3 = rand() * Math.PI * 2
  const baseR = 145 + rand() * 28
  const squash = 0.5 + rand() * 0.2

  const points: TrackPoint[] = []
  for (let i = 0; i <= count; i += 1) {
    const t = (i / count) * Math.PI * 2
    const r = baseR + 28 * Math.sin(a1 * t + p1) + 16 * Math.sin(a2 * t + p2)
    const wobble = 16 * Math.sin(3 * t + p3)
    points.push({
      x: 220 + r * Math.cos(t) + wobble,
      y: 135 + r * squash * Math.sin(t) - wobble * 0.2,
    })
  }
  return points
}

function pathFromPoints(points: TrackPoint[]): string {
  if (!points.length) return ''
  return `M ${points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`
}

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
  const trackPreviewPath = pathFromPoints(generateTrackPoints(trackSeed))
  const useClassIntervals =
    (event.series.slug === 'wec' || event.series.slug === 'imsa') &&
    Boolean(selectedClass)
  const classIntervals = useClassIntervals ? computeClassIntervals(results) : []
  const podium = results.slice(0, 3)

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
          background: `linear-gradient(135deg, ${seriesColor}08, transparent)`,
        }}
      >
        {event.circuit.trackMapUrl && (
          <div className="pointer-events-none absolute -right-8 -top-6 hidden md:block opacity-20">
            <img
              src={event.circuit.trackMapUrl}
              alt=""
              className="h-44 w-80 object-contain"
            />
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-6 mb-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
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
          <div className="text-left sm:text-right">
            <p className="text-lg font-mono text-pitwall-text">
              {format(parseISO(event.startDate), 'MMM d')}
              {event.startDate !== event.endDate && ` – ${format(parseISO(event.endDate), 'MMM d')}`}
            </p>
            <p className="text-sm text-pitwall-text-muted">{format(parseISO(event.startDate), 'yyyy')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 relative">
          <div className="bg-pitwall-surface/70 border border-pitwall-border rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-pitwall-text-muted">Sessions</p>
            <p className="text-sm font-semibold text-pitwall-text">{event.sessions.length}</p>
          </div>
          <div className="bg-pitwall-surface/70 border border-pitwall-border rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-pitwall-text-muted">Circuit</p>
            <p className="text-sm font-semibold text-pitwall-text truncate">{event.circuit.name}</p>
          </div>
          <div className="bg-pitwall-surface/70 border border-pitwall-border rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-pitwall-text-muted">Timezone</p>
            <p className="text-sm font-semibold text-pitwall-text truncate">{event.circuit.timezone}</p>
          </div>
          <div className="bg-pitwall-surface/70 border border-pitwall-border rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-pitwall-text-muted">Status</p>
            <p className="text-sm font-semibold text-pitwall-text capitalize">{event.status}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-4 2xl:col-span-3 space-y-5">
          <div className="rounded-xl border border-pitwall-border bg-pitwall-surface p-4">
            <h2 className="text-lg font-semibold text-pitwall-text mb-3">Track Layout</h2>
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
