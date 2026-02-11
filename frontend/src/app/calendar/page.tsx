'use client'

import { useState, useEffect, useMemo } from 'react'
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
import LiveIndicator from '@/components/LiveIndicator'
import { SERIES_FILTERS, STATUS_STYLES } from '@/lib/constants'
import { api } from '@/lib/api'
import type { EventSummary } from '@/lib/api'

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<'month' | 'list'>('list')
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<EventSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    api.getCalendar(selectedSeries || undefined, selectedYear)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setIsLoading(false))
  }, [selectedSeries, selectedYear])

  useEffect(() => {
    setCurrentMonth(new Date(selectedYear, 0, 1))
  }, [selectedYear])

  const eventsByMonth = useMemo(() => {
    const grouped: Record<string, EventSummary[]> = {}
    for (const event of events) {
      const monthKey = format(parseISO(event.startDate), 'MMMM yyyy')
      if (!grouped[monthKey]) grouped[monthKey] = []
      grouped[monthKey].push(event)
    }
    return grouped
  }, [events])

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const eventsOnDay = (day: Date) =>
    events.filter(e => {
      const startDate = parseISO(e.startDate)
      const endDate = parseISO(e.endDate)
      return day >= startDate && day <= endDate
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-pitwall-text">Calendar</h1>
          <div className="flex gap-1 bg-pitwall-surface rounded-lg p-0.5">
            {YEAR_OPTIONS.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1.5 rounded-md text-sm font-mono font-medium transition-all ${
                  selectedYear === year
                    ? 'bg-pitwall-accent text-white'
                    : 'text-pitwall-text-muted hover:text-pitwall-text'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
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

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-pitwall-surface rounded-lg animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-pitwall-text-muted text-center py-12">No events found.</p>
      ) : viewMode === 'list' ? (
        <div className="space-y-8">
          {Object.entries(eventsByMonth).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold text-pitwall-text-muted mb-3">{month}</h2>
              <div className="space-y-2">
                {monthEvents.map(event => (
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
                      <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${STATUS_STYLES[event.status] || ''}`}>
                        {event.status === 'live' && <LiveIndicator />}
                        {event.status === 'live' ? 'LIVE' : event.status}
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
