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
import { SESSION_TYPE_LABELS, STATUS_STYLES } from '@/lib/constants'
import { api } from '@/lib/api'
import type { EventDetail, Result, Session } from '@/lib/api'

const EVENT_STATUS_STYLES: Record<string, string> = {
  ...STATUS_STYLES,
  upcoming: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  live: 'text-green-400 bg-green-400/10 border-green-400/30',
  completed: 'text-pitwall-text-muted bg-pitwall-surface-2 border-pitwall-border',
}

const SESSION_PRIORITY = ['race', 'sprint', 'qualifying']

export default function EventDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)

  useEffect(() => {
    api.getEvent(slug)
      .then(data => {
        setEvent(data)

        const completedSessions = (data.sessions || []).filter(
          (s: Session) => s.status === 'completed' && s.type !== 'practice'
        )
        const best = SESSION_PRIORITY
          .map(type => completedSessions.find((s: Session) => s.type === type))
          .find(Boolean)
        if (best) setSelectedSession(best)
      })
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    if (!selectedSession) {
      setResults([])
      return
    }

    setIsLoadingResults(true)
    api.getResults(selectedSession.id)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setIsLoadingResults(false))
  }, [selectedSession])

  if (!event) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-pitwall-surface rounded animate-pulse" />
        <div className="h-48 bg-pitwall-surface rounded-lg animate-pulse" />
      </div>
    )
  }

  const resultSessions = event.sessions.filter(s => s.type !== 'practice')
  const raceSession = event.sessions.find(s => s.type === 'race')

  return (
    <div>
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1 text-sm text-pitwall-text-muted hover:text-pitwall-text mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Calendar
      </Link>

      <div
        className="rounded-xl p-6 mb-6 border"
        style={{
          borderColor: `${event.series.colorPrimary}30`,
          background: `linear-gradient(135deg, ${event.series.colorPrimary}08, transparent)`,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SeriesBadge name={event.series.name} color={event.series.colorPrimary} />
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
                <div className="flex gap-1 bg-pitwall-surface rounded-lg p-0.5">
                  {resultSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        selectedSession?.id === session.id
                          ? 'bg-pitwall-accent text-white'
                          : session.status === 'completed'
                            ? 'text-pitwall-text-muted hover:text-pitwall-text'
                            : 'text-pitwall-text-muted/50 cursor-not-allowed'
                      }`}
                      disabled={session.status !== 'completed'}
                    >
                      {SESSION_TYPE_LABELS[session.type] || session.name}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingResults ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-pitwall-surface rounded animate-pulse" />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <RaceResultCard
                  results={results.map(r => ({
                    position: r.position,
                    driverName: r.driverName,
                    driverNumber: r.driverNumber,
                    teamName: r.teamName,
                    teamColor: r.teamColor,
                    gap: r.gap,
                  }))}
                  eventName={`${event.name} — ${SESSION_TYPE_LABELS[selectedSession?.type || ''] || selectedSession?.name || ''}`}
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
