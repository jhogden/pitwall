'use client'

import Link from 'next/link'

const SERIES_LIST = [
  {
    slug: 'f1',
    name: 'Formula 1',
    color: '#E10600',
    description: 'The pinnacle of single-seater motorsport. 24 races across the globe featuring the fastest cars and most skilled drivers in the world.',
    teams: 10,
    races: 24,
  },
  {
    slug: 'wec',
    name: 'FIA World Endurance Championship',
    color: '#00548F',
    description: 'The premier endurance racing series including the legendary 24 Hours of Le Mans. Multiple car classes racing together for hours at a time.',
    teams: 16,
    races: 8,
  },
  {
    slug: 'imsa',
    name: 'IMSA SportsCar Championship',
    color: '#DA291C',
    description: 'North American endurance and sprint racing featuring prototypes and GT cars at iconic circuits like Daytona, Sebring, and Road America.',
    teams: 20,
    races: 11,
  },
]

export default function SeriesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-pitwall-text mb-6">Series</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SERIES_LIST.map(series => (
          <Link
            key={series.slug}
            href={`/series/${series.slug}`}
            className="group block bg-pitwall-surface rounded-xl border border-pitwall-border hover:border-opacity-50 transition-all overflow-hidden"
            style={{ '--series-color': series.color } as React.CSSProperties}
          >
            <div
              className="h-2"
              style={{ backgroundColor: series.color }}
            />
            <div className="p-6">
              <h2 className="text-xl font-bold text-pitwall-text mb-2 group-hover:opacity-90 transition-opacity">
                {series.name}
              </h2>
              <p className="text-sm text-pitwall-text-muted mb-4 line-clamp-3">
                {series.description}
              </p>
              <div className="flex gap-4 text-sm">
                <span className="text-pitwall-text-muted">
                  <span className="font-mono font-semibold text-pitwall-text">{series.teams}</span> teams
                </span>
                <span className="text-pitwall-text-muted">
                  <span className="font-mono font-semibold text-pitwall-text">{series.races}</span> races
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
