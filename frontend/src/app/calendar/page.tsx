'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, List, Grid3X3 } from 'lucide-react'
import SeriesBadge from '@/components/SeriesBadge'
import type { EventSummary } from '@/lib/api'

const SAMPLE_EVENTS: EventSummary[] = [
  { id: 1, name: 'Bahrain Grand Prix', slug: 'bahrain-gp-2025', seriesSlug: 'f1', seriesName: 'F1', seriesColor: '#E10600', circuitName: 'Bahrain International Circuit', country: 'Bahrain', city: 'Sakhir', startDate: '2025-03-14', endDate: '2025-03-16', status: 'completed' },
  { id: 2, name: 'Saudi Arabian Grand Prix', slug: 'saudi-gp-2025', seriesSlug: 'f1', seriesName: 'F1', seriesColor: '#E10600', circuitName: 'Jeddah Corniche Circuit', country: 'Saudi Arabia', city: 'Jeddah', startDate: '2025-03-21', endDate: '2025-03-23', status: 'upcoming' },
  { id: 3, name: 'Qatar 1812km', slug: 'qatar-1812-2025', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F', circuitName: 'Lusail International Circuit', country: 'Qatar', city: 'Lusail', startDate: '2025-02-28', endDate: '2025-03-01', status: 'completed' },
  { id: 4, name: '6 Hours of Imola', slug: 'imola-6h-2025', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F', circuitName: 'Autodromo Enzo e Dino Ferrari', country: 'Italy', city: 'Imola', startDate: '2025-04-20', endDate: '2025-04-20', status: 'upcoming' },
  { id: 5, name: 'Australian Grand Prix', slug: 'australia-gp-2025', seriesSlug: 'f1', seriesName: 'F1', seriesColor: '#E10600', circuitName: 'Albert Park Circuit', country: 'Australia', city: 'Melbourne', startDate: '2025-03-28', endDate: '2025-03-30', status: 'upcoming' },
  { id: 6, name: '6 Hours of Spa', slug: 'spa-6h-2025', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F', circuitName: 'Circuit de Spa-Francorchamps', country: 'Belgium', city: 'Spa', startDate: '2025-05-10', endDate: '2025-05-10', status: 'upcoming' },
  { id: 7, name: 'Monaco Grand Prix', slug: 'monaco-gp-2025', seriesSlug: 'f1', seriesName: 'F1', seriesColor: '#E10600', circuitName: 'Circuit de Monaco', country: 'Monaco', city: 'Monte Carlo', startDate: '2025-05-23', endDate: '2025-05-25', status: 'upcoming' },
  { id: 8, name: '24 Hours of Le Mans', slug: 'le-mans-24h-2025', seriesSlug: 'wec', seriesName: 'WEC', seriesColor: '#00548F', circuitName: 'Circuit de la Sarthe', country: 'France', city: 'Le Mans', startDate: '2025-06-14', endDate: '2025-06-15', status: 'upcoming' },
]

const SERIES_FILTERS = [
  { slug: null, name: 'All' },
  { slug: 'f1', name: 'F1', color: '#E10600' },
  { slug: 'wec', name: 'WEC', color: '#00548F' },
  { slug: 'imsa', name: 'IMSA', color: '#DA291C' },
]

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-400/10',
  live: 'text-green-400 bg-green-400/10',
  completed: 'text-pitwall-text-muted bg-pitwall-surface-2',
}

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<'month' | 'list'>('list')
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 2, 1)) // March 2025

  const filteredEvents = useMemo(() => {
    return selectedSeries
      ? SAMPLE_EVENTS.filter(e => e.seriesSlug === selectedSeries)
      : SAMPLE_EVENTS
  }, [selectedSeries])

  const eventsByMonth = useMemo(() => {
    const grouped: Record<string, EventSummary[]> = {}
    for (const event of filteredEvents) {
      const monthKey = format(parseISO(event.startDate), 'MMMM yyyy')
      if (!grouped[monthKey]) grouped[monthKey] = []
      grouped[monthKey].push(event)
    }
    return grouped
  }, [filteredEvents])

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const eventsOnDay = (day: Date) =>
    filteredEvents.filter(e => {
      const startDate = parseISO(e.startDate)
      const endDate = parseISO(e.endDate)
      return day >= startDate && day <= endDate
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-pitwall-text">Calendar</h1>
        <div className="flex gap-1 bg-pitwall-surface rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-pitwall-surface-2 text-pitwall-text' : 'text-pitwall-text-muted'}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`p-2 rounded ${viewMode === 'month' ? 'bg-pitwall-surface-2 text-pitwall-text' : 'text-pitwall-text-muted'}`}
          >
            <Grid3X3 size={18} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        {SERIES_FILTERS.map(filter => (
          <button
            key={filter.name}
            onClick={() => setSelectedSeries(filter.slug)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              selectedSeries === filter.slug
                ? 'bg-pitwall-surface-2 text-pitwall-text border border-pitwall-border'
                : 'text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-surface'
            }`}
          >
            {filter.color && (
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filter.color }} />
            )}
            {filter.name}
          </button>
        ))}
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-8">
          {Object.entries(eventsByMonth).map(([month, events]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold text-pitwall-text-muted mb-3">{month}</h2>
              <div className="space-y-2">
                {events.map(event => (
                  <Link
                    key={event.id}
                    href={`/event/${event.slug}`}
                    className="flex items-center gap-4 p-4 bg-pitwall-surface rounded-lg border border-pitwall-border hover:border-pitwall-accent/50 transition-colors"
                  >
                    <div
                      className="w-1 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.seriesColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SeriesBadge name={event.seriesName} color={event.seriesColor} size="sm" />
                        <span className="text-sm text-pitwall-text-muted">{event.country}</span>
                      </div>
                      <p className="font-semibold text-pitwall-text truncate">{event.name}</p>
                      <p className="text-sm text-pitwall-text-muted">{event.circuitName}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono text-pitwall-text">
                        {format(parseISO(event.startDate), 'MMM d')}
                        {event.startDate !== event.endDate && ` – ${format(parseISO(event.endDate), 'd')}`}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[event.status] || ''}`}>
                        {event.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              className="p-2 text-pitwall-text-muted hover:text-pitwall-text"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-pitwall-text">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              className="p-2 text-pitwall-text-muted hover:text-pitwall-text"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-pitwall-text-muted py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {monthDays.map(day => {
              const dayEvents = eventsOnDay(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isSameDay(day, new Date())

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[80px] p-2 rounded-lg border ${
                    isToday
                      ? 'border-pitwall-accent bg-pitwall-accent/10'
                      : 'border-pitwall-border/50 bg-pitwall-surface'
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <span className="text-xs text-pitwall-text-muted">{format(day, 'd')}</span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.map(event => (
                      <Link
                        key={event.id}
                        href={`/event/${event.slug}`}
                        className="block text-xs truncate px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: `${event.seriesColor}20`,
                          color: event.seriesColor,
                        }}
                      >
                        {event.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
