import { SERIES_THEME_COLORS } from '@/lib/theme'

export const SERIES_COLORS: Record<string, string> = {
  f1: SERIES_THEME_COLORS.f1,
  wec: SERIES_THEME_COLORS.wec,
  imsa: SERIES_THEME_COLORS.imsa,
  fe: '#00A3E0',
  indycar: '#1E3A6D',
}

export function resolveSeriesColor(slug: string | null | undefined, fallback?: string | null): string {
  if (slug && SERIES_COLORS[slug]) {
    return SERIES_COLORS[slug]
  }
  return fallback || '#6366f1'
}

export const SERIES_NAMES: Record<string, string> = {
  f1: 'Formula 1',
  wec: 'WEC',
  imsa: 'IMSA',
  fe: 'Formula E',
  indycar: 'IndyCar',
}

export const SESSION_TYPE_LABELS: Record<string, string> = {
  practice: 'Practice',
  qualifying: 'Qualifying',
  race: 'Race',
  sprint: 'Sprint',
  warmup: 'Warm Up',
}

export interface SeriesFilter {
  slug: string | null
  name: string
  color?: string
}

export const SERIES_FILTERS: SeriesFilter[] = [
  { slug: null, name: 'All' },
  { slug: 'f1', name: 'F1', color: SERIES_COLORS.f1 },
  { slug: 'wec', name: 'WEC', color: SERIES_COLORS.wec },
  { slug: 'imsa', name: 'IMSA', color: SERIES_COLORS.imsa },
]

export const STATUS_STYLES: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-400/10',
  live: 'text-green-400 bg-green-400/10',
  completed: 'text-pitwall-text-muted bg-pitwall-surface-2',
}
