'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SeriesBadge from '@/components/SeriesBadge'

const SERIES_DATA: Record<string, { name: string; color: string; description: string }> = {
  f1: { name: 'Formula 1', color: '#E10600', description: 'The pinnacle of single-seater motorsport.' },
  wec: { name: 'FIA World Endurance Championship', color: '#00548F', description: 'The premier endurance racing series including the 24 Hours of Le Mans.' },
  imsa: { name: 'IMSA SportsCar Championship', color: '#DA291C', description: 'North American endurance and sprint racing.' },
}

const SAMPLE_STANDINGS = [
  { position: 1, driverName: 'Max Verstappen', driverNumber: 1, teamName: 'Red Bull Racing', teamColor: '#3671C6', points: 56 },
  { position: 2, driverName: 'Lando Norris', driverNumber: 4, teamName: 'McLaren', teamColor: '#FF8000', points: 44 },
  { position: 3, driverName: 'Charles Leclerc', driverNumber: 16, teamName: 'Ferrari', teamColor: '#E8002D', points: 38 },
  { position: 4, driverName: 'Carlos Sainz', driverNumber: 55, teamName: 'Ferrari', teamColor: '#E8002D', points: 34 },
  { position: 5, driverName: 'Lewis Hamilton', driverNumber: 44, teamName: 'Ferrari', teamColor: '#E8002D', points: 30 },
  { position: 6, driverName: 'George Russell', driverNumber: 63, teamName: 'Mercedes', teamColor: '#27F4D2', points: 24 },
  { position: 7, driverName: 'Oscar Piastri', driverNumber: 81, teamName: 'McLaren', teamColor: '#FF8000', points: 20 },
  { position: 8, driverName: 'Fernando Alonso', driverNumber: 14, teamName: 'Aston Martin', teamColor: '#229971', points: 14 },
  { position: 9, driverName: 'Isack Hadjar', driverNumber: 6, teamName: 'Red Bull Racing', teamColor: '#3671C6', points: 12 },
  { position: 10, driverName: 'Andrea Kimi Antonelli', driverNumber: 12, teamName: 'Mercedes', teamColor: '#27F4D2', points: 10 },
]

const SAMPLE_RECENT_EVENTS = [
  { slug: 'bahrain-gp-2025', name: 'Bahrain Grand Prix', date: 'Mar 14–16', status: 'completed', winner: 'Max Verstappen' },
]

export default function SeriesDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [activeTab, setActiveTab] = useState<'standings' | 'events'>('standings')

  const series = SERIES_DATA[slug]
  if (!series) {
    return (
      <div className="text-center py-12">
        <p className="text-pitwall-text-muted">Series not found</p>
        <Link href="/series" className="text-pitwall-accent mt-2 inline-block">Back to Series</Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/series"
        className="inline-flex items-center gap-1 text-sm text-pitwall-text-muted hover:text-pitwall-text mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        All Series
      </Link>

      <div
        className="rounded-xl p-6 mb-6 border"
        style={{
          borderColor: `${series.color}30`,
          background: `linear-gradient(135deg, ${series.color}10, transparent)`,
        }}
      >
        <SeriesBadge name={series.name} color={series.color} />
        <h1 className="text-3xl font-bold text-pitwall-text mt-2 mb-1">{series.name}</h1>
        <p className="text-pitwall-text-muted">{series.description}</p>
      </div>

      <div className="flex gap-1 bg-pitwall-surface rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('standings')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            activeTab === 'standings' ? 'bg-pitwall-surface-2 text-pitwall-text' : 'text-pitwall-text-muted'
          }`}
        >
          Standings
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            activeTab === 'events' ? 'bg-pitwall-surface-2 text-pitwall-text' : 'text-pitwall-text-muted'
          }`}
        >
          Recent Events
        </button>
      </div>

      {activeTab === 'standings' && (
        <div className="bg-pitwall-surface rounded-lg border border-pitwall-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pitwall-border">
                <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3 w-12">POS</th>
                <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3">DRIVER</th>
                <th className="text-left text-xs text-pitwall-text-muted font-medium px-4 py-3 hidden sm:table-cell">TEAM</th>
                <th className="text-right text-xs text-pitwall-text-muted font-medium px-4 py-3 w-20">PTS</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_STANDINGS.map((standing, index) => (
                <tr
                  key={standing.position}
                  className={`border-b border-pitwall-border/50 hover:bg-pitwall-surface-2/50 transition-colors ${
                    index < 3 ? 'bg-pitwall-surface-2/20' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-mono font-bold text-sm ${
                      standing.position === 1 ? 'text-yellow-400' :
                      standing.position === 2 ? 'text-gray-300' :
                      standing.position === 3 ? 'text-amber-600' :
                      'text-pitwall-text-muted'
                    }`}>
                      {standing.position}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1 h-8 rounded-full"
                        style={{ backgroundColor: standing.teamColor }}
                      />
                      <div>
                        <p className="font-semibold text-pitwall-text text-sm">{standing.driverName}</p>
                        <p className="text-xs text-pitwall-text-muted font-mono">#{standing.driverNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-pitwall-text-muted">{standing.teamName}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-bold text-pitwall-text">{standing.points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-3">
          {SAMPLE_RECENT_EVENTS.map(event => (
            <Link
              key={event.slug}
              href={`/event/${slug}/${event.slug}`}
              className="flex items-center justify-between p-4 bg-pitwall-surface rounded-lg border border-pitwall-border hover:border-pitwall-accent/30 transition-colors"
            >
              <div>
                <p className="font-semibold text-pitwall-text">{event.name}</p>
                <p className="text-sm text-pitwall-text-muted">{event.date}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-pitwall-text-muted bg-pitwall-surface-2 px-2 py-1 rounded-full">
                  {event.status}
                </span>
                {event.winner && (
                  <p className="text-sm text-pitwall-text mt-1">Winner: {event.winner}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
