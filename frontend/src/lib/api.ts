const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
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
  time: string | null
  laps: number | null
  gap: string | null
  status: string
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
  getEvent: (slug: string) => fetchApi<EventDetail>(`/api/events/${slug}`),
  getFeed: (page = 0, size = 20, series?: string) =>
    fetchApi<FeedPage>(`/api/feed?page=${page}&size=${size}${series ? `&series=${series}` : ''}`),
  getResults: (slug: string, sessionId: number) => fetchApi<Result[]>(`/api/events/${slug}/results?sessionId=${sessionId}`),
  getDriver: (slug: string) => fetchApi<Driver>(`/api/drivers/${slug}`),
}
