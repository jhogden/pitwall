const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Type definitions matching backend DTOs
export interface Series {
  id: number
  name: string
  slug: string
  colorPrimary: string
  colorSecondary: string
  logoUrl: string | null
}

export interface EventSummary {
  id: number
  name: string
  slug: string
  seriesSlug: string
  seriesName: string
  seriesColor: string
  circuitName: string
  country: string
  city: string
  startDate: string
  endDate: string
  status: string
}

export interface Session {
  id: number
  type: string
  name: string
  startTime: string
  endTime: string | null
  status: string
}

export interface Circuit {
  id: number
  name: string
  country: string
  city: string
  trackMapUrl: string | null
  timezone: string
}

export interface EventDetail {
  id: number
  name: string
  slug: string
  series: Series
  circuit: Circuit
  startDate: string
  endDate: string
  status: string
  sessions: Session[]
}

export interface Driver {
  id: number
  name: string
  number: number | null
  teamName: string
  teamColor: string
  nationality: string | null
  slug: string
}

export interface Team {
  id: number
  name: string
  shortName: string
  color: string
  seriesSlug: string
}

export interface Result {
  id: number
  position: number
  driverName: string
  driverNumber: number | null
  teamName: string
  teamColor: string
  className: string
  time: string | null
  laps: number | null
  gap: string | null
  status: string
}

export interface LapTelemetryPoint {
  id: number
  lapNumber: number
  position: number | null
  carNumber: string
  driverName: string | null
  driverNumber: number | null
  teamName: string | null
  teamColor: string | null
  lapTime: string | null
  sector1Time: string | null
  sector2Time: string | null
  sector3Time: string | null
  sector4Time: string | null
  averageSpeedKph: string | null
  topSpeedKph: string | null
  sessionElapsed: string | null
  lapTimestamp: string | null
  isValid: boolean | null
  crossingPitFinishLane: boolean | null
}

export interface DriverStanding {
  position: number
  driverName: string
  driverSlug: string
  driverNumber: number | null
  teamName: string | null
  teamColor: string | null
  className: string
  points: number
  wins: number
}

export interface ConstructorStanding {
  position: number
  teamName: string
  teamColor: string | null
  className: string
  points: number
  wins: number
}

export interface FeedItem {
  id: number
  type: string
  seriesSlug: string | null
  seriesName: string | null
  seriesColor: string | null
  eventId: number | null
  eventSlug: string | null
  title: string
  summary: string
  contentUrl: string | null
  thumbnailUrl: string | null
  publishedAt: string
}

export interface FeedPage {
  content: FeedItem[]
  totalPages: number
  totalElements: number
  number: number
}

// API functions
export const api = {
  getSeries: () => fetchApi<Series[]>('/api/series'),
  getSeriesBySlug: (slug: string) => fetchApi<Series>(`/api/series/${slug}`),
  getCalendar: (series?: string, year?: number) => {
    const params = new URLSearchParams()
    if (series) params.set('series', series)
    if (year) params.set('year', String(year))
    const qs = params.toString()
    return fetchApi<EventSummary[]>(`/api/calendar${qs ? `?${qs}` : ''}`)
  },
  getSeasons: (series?: string) => {
    const params = new URLSearchParams()
    if (series) params.set('series', series)
    const qs = params.toString()
    return fetchApi<number[]>(`/api/calendar/seasons${qs ? `?${qs}` : ''}`)
  },
  getEvent: (slug: string) => fetchApi<EventDetail>(`/api/events/${slug}`),
  getFeed: (page = 0, size = 20, series?: string) =>
    fetchApi<FeedPage>(`/api/feed?page=${page}&size=${size}${series ? `&series=${series}` : ''}`),
  getResults: (slug: string, sessionId: number, className?: string) => {
    const params = new URLSearchParams({ sessionId: String(sessionId) })
    if (className) params.set('className', className)
    return fetchApi<Result[]>(`/api/events/${slug}/results?${params.toString()}`)
  },
  getResultClasses: (slug: string, sessionId: number) =>
    fetchApi<string[]>(`/api/events/${slug}/result-classes?sessionId=${sessionId}`),
  getTelemetry: (slug: string, sessionId: number) =>
    fetchApi<LapTelemetryPoint[]>(`/api/events/${slug}/telemetry?sessionId=${sessionId}`),
  getDriverStandings: (slug: string, year?: number, className?: string) => {
    const params = new URLSearchParams()
    if (year) params.set('year', String(year))
    if (className) params.set('className', className)
    const qs = params.toString()
    return fetchApi<DriverStanding[]>(`/api/series/${slug}/standings${qs ? `?${qs}` : ''}`)
  },
  getConstructorStandings: (slug: string, year?: number, className?: string) => {
    const params = new URLSearchParams()
    if (year) params.set('year', String(year))
    if (className) params.set('className', className)
    const qs = params.toString()
    return fetchApi<ConstructorStanding[]>(`/api/series/${slug}/constructors${qs ? `?${qs}` : ''}`)
  },
  getStandingClasses: (slug: string, year?: number) =>
    fetchApi<string[]>(`/api/series/${slug}/classes${year ? `?year=${year}` : ''}`),
  getDriver: (slug: string) => fetchApi<Driver>(`/api/drivers/${slug}`),
}
