export const SERIES_COLORS: Record<string, string> = {
  f1: '#E10600',
  wec: '#00548F',
  imsa: '#DA291C',
  fe: '#00A3E0',
  indycar: '#1E3A6D',
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
  { slug: 'f1', name: 'F1', color: '#E10600' },
  { slug: 'wec', name: 'WEC', color: '#00548F' },
  { slug: 'imsa', name: 'IMSA', color: '#DA291C' },
]

export const STATUS_STYLES: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-400/10',
  live: 'text-green-400 bg-green-400/10',
  completed: 'text-pitwall-text-muted bg-pitwall-surface-2',
}
