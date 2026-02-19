import { resolveSeriesColor } from '@/lib/constants'

export type SeriesAsset = {
  slug: string
  name: string
  tagline: string
  heroImageUrl: string
  heroImageCandidates: string[]
}

function seriesImageCandidates(slug: string): string[] {
  return [
    `/images/series/${slug}-car-photo.webp`,
    `/images/series/${slug}-car-photo.jpg`,
    `/images/series/${slug}-car-photo.png`,
    `/images/series/${slug}-car.svg`,
  ]
}

export const SERIES_ASSETS: Record<string, SeriesAsset> = {
  f1: {
    slug: 'f1',
    name: 'Formula 1',
    tagline: 'Open-wheel precision',
    heroImageUrl: '/images/series/f1-car.svg',
    heroImageCandidates: seriesImageCandidates('f1'),
  },
  wec: {
    slug: 'wec',
    name: 'World Endurance Championship',
    tagline: 'Multi-class endurance',
    heroImageUrl: '/images/series/wec-car.svg',
    heroImageCandidates: seriesImageCandidates('wec'),
  },
  imsa: {
    slug: 'imsa',
    name: 'IMSA SportsCar',
    tagline: 'North American sportscar',
    heroImageUrl: '/images/series/imsa-car.svg',
    heroImageCandidates: seriesImageCandidates('imsa'),
  },
}

export const HOMEPAGE_SERIES_SPOTLIGHT = [
  SERIES_ASSETS.f1,
  SERIES_ASSETS.wec,
  SERIES_ASSETS.imsa,
] as const

export function getSeriesAsset(slug: string | null | undefined): SeriesAsset | null {
  if (!slug) return null
  return SERIES_ASSETS[slug] || null
}

export function seriesHeroBackground(slug: string | null | undefined): string {
  const color = resolveSeriesColor(slug)
  return `linear-gradient(130deg, ${color}25 0%, transparent 62%)`
}

const EVENT_WINNER_CAR_OVERRIDES: Record<string, string> = {}

export function getWinnerCarImageCandidates(eventSlug: string, seriesSlug: string): string[] {
  const overrides = EVENT_WINNER_CAR_OVERRIDES[eventSlug] ? [EVENT_WINNER_CAR_OVERRIDES[eventSlug]] : []
  return [
    ...overrides,
    `/images/events/winners/${eventSlug}.webp`,
    `/images/events/winners/${eventSlug}.jpg`,
    `/images/events/winners/${eventSlug}.png`,
    ...seriesImageCandidates(seriesSlug),
  ]
}
