'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, MapPin } from 'lucide-react'
import SeriesBadge from '@/components/SeriesBadge'
import SessionTimeline from '@/components/SessionTimeline'
import RaceResultCard from '@/components/RaceResultCard'
import type { EventDetail, Result } from '@/lib/api'

const SAMPLE_EVENT: EventDetail = {
  id: 1, name: 'Bahrain Grand Prix', slug: 'bahrain-gp-2025',
  series: { id: 1, name: 'Formula 1', slug: 'f1', colorPrimary: '#E10600', colorSecondary: '#FF4444', logoUrl: null },
  circuit: { id: 1, name: 'Bahrain International Circuit', country: 'Bahrain', city: 'Sakhir', trackMapUrl: null, timezone: 'Asia/Bahrain' },
  startDate: '2025-03-14', endDate: '2025-03-16', status: 'completed',
  sessions: [
    { id: 1, type: 'practice', name: 'Free Practice 1', startTime: '2025-03-14T11:30:00Z', endTime: '2025-03-14T12:30:00Z', status: 'completed' },
    { id: 2, type: 'practice', name: 'Free Practice 2', startTime: '2025-03-14T15:00:00Z', endTime: '2025-03-14T16:00:00Z', status: 'completed' },
    { id: 3, type: 'practice', name: 'Free Practice 3', startTime: '2025-03-15T12:30:00Z', endTime: '2025-03-15T13:30:00Z', status: 'completed' },
    { id: 4, type: 'qualifying', name: 'Qualifying', startTime: '2025-03-15T16:00:00Z', endTime: '2025-03-15T17:00:00Z', status: 'completed' },
    { id: 5, type: 'race', name: 'Race', startTime: '2025-03-16T15:00:00Z', endTime: '2025-03-16T17:00:00Z', status: 'completed' },
  ],
}

const SAMPLE_RESULTS: Result[] = [
  { id: 1, position: 1, driverName: 'Max Verstappen', driverNumber: 1, teamName: 'Red Bull Racing', teamColor: '#3671C6', time: '1:31:44.742', laps: 57, gap: null, status: 'finished' },
  { id: 2, position: 2, driverName: 'Lando Norris', driverNumber: 4, teamName: 'McLaren', teamColor: '#FF8000', time: '+11.987', laps: 57, gap: '+11.987', status: 'finished' },
  { id: 3, position: 3, driverName: 'Charles Leclerc', driverNumber: 16, teamName: 'Ferrari', teamColor: '#E8002D', time: '+17.123', laps: 57, gap: '+17.123', status: 'finished' },
  { id: 4, position: 4, driverName: 'Carlos Sainz', driverNumber: 55, teamName: 'Ferrari', teamColor: '#E8002D', time: '+21.456', laps: 57, gap: '+21.456', status: 'finished' },
  { id: 5, position: 5, driverName: 'Lewis Hamilton', driverNumber: 44, teamName: 'Ferrari', teamColor: '#E8002D', time: '+34.789', laps: 57, gap: '+34.789', status: 'finished' },
  { id: 6, position: 6, driverName: 'George Russell', driverNumber: 63, teamName: 'Mercedes', teamColor: '#27F4D2', time: '+42.012', laps: 57, gap: '+42.012', status: 'finished' },
  { id: 7, position: 7, driverName: 'Oscar Piastri', driverNumber: 81, teamName: 'McLaren', teamColor: '#FF8000', time: '+48.345', laps: 57, gap: '+48.345', status: 'finished' },
  { id: 8, position: 8, driverName: 'Fernando Alonso', driverNumber: 14, teamName: 'Aston Martin', teamColor: '#229971', time: '+55.678', laps: 57, gap: '+55.678', status: 'finished' },
  { id: 9, position: 9, driverName: 'Pierre Gasly', driverNumber: 10, teamName: 'Alpine', teamColor: '#FF87BC', time: '+62.901', laps: 57, gap: '+62.901', status: 'finished' },
  { id: 10, position: 10, driverName: 'Yuki Tsunoda', driverNumber: 22, teamName: 'RB', teamColor: '#6692FF', time: '+68.234', laps: 57, gap: '+68.234', status: 'finished' },
]

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  live: 'text-green-400 bg-green-400/10 border-green-400/30',
  completed: 'text-pitwall-text-muted bg-pitwall-surface-2 border-pitwall-border',
}

export default function EventDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [results, setResults] = useState<Result[]>([])

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        const response = await fetch(`${apiBase}/api/events/${slug}`)
        if (response.ok) {
          const data = await response.json()
          setEvent(data)

          if (data.status === 'completed' && data.sessions?.length > 0) {
            const raceSession = data.sessions.find((s: { type: string }) => s.type === 'race')
            if (raceSession) {
              const resultsResponse = await fetch(`${apiBase}/api/events/${slug}/results?sessionId=${raceSession.id}`)
              if (resultsResponse.ok) {
                setResults(await resultsResponse.json())
                return
              }
            }
          }
          return
        }
      } catch {
        // API unavailable
      }
      setEvent(SAMPLE_EVENT)
      setResults(SAMPLE_RESULTS)
    }

    fetchEventData()
  }, [slug])

  if (!event) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-pitwall-surface rounded animate-pulse" />
        <div className="h-48 bg-pitwall-surface rounded-lg animate-pulse" />
      </div>
    )
  }

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
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[event.status] || ''}`}>
                {event.status}
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
          {event.status === 'completed' && results.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-pitwall-text mb-4">Race Results</h2>
              <RaceResultCard
                results={results.map(r => ({
                  position: r.position,
                  driverName: r.driverName,
                  driverNumber: r.driverNumber,
                  teamName: r.teamName,
                  teamColor: r.teamColor,
                  gap: r.gap,
                }))}
                eventName={event.name}
              />
            </div>
          )}

          {event.status === 'upcoming' && (
            <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-8 text-center">
              <p className="text-pitwall-text-muted text-lg">
                Results will be available after the race
              </p>
              <p className="text-sm text-pitwall-text-muted mt-2">
                Race starts {format(parseISO(event.sessions.find(s => s.type === 'race')?.startTime || event.startDate), 'PPpp')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
