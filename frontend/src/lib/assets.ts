import { resolveSeriesColor } from '@/lib/constants'

export type SeriesAsset = {
  slug: string
  name: string
  tagline: string
  heroImageUrl: string
}

export const SERIES_ASSETS: Record<string, SeriesAsset> = {
  f1: {
    slug: 'f1',
    name: 'Formula 1',
    tagline: 'Open-wheel precision',
    heroImageUrl: '/images/series/f1-car.svg',
  },
  wec: {
    slug: 'wec',
    name: 'World Endurance Championship',
    tagline: 'Multi-class endurance',
    heroImageUrl: '/images/series/wec-car.svg',
  },
  imsa: {
    slug: 'imsa',
    name: 'IMSA SportsCar',
    tagline: 'North American sportscar',
    heroImageUrl: '/images/series/imsa-car.svg',
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
