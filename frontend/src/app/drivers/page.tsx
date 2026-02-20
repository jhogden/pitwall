'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, X, ChevronDown, Users } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { api } from '@/lib/api'
import type { Driver, DriverResult } from '@/lib/api'
import { SERIES_FILTERS } from '@/lib/constants'

const SESSION_TYPES = [
  { value: 'race', label: 'Race' },
  { value: 'qualifying', label: 'Qualifying' },
  { value: 'sprint', label: 'Sprint' },
]

function positionColor(pos: number): string {
  if (pos === 1) return '#FFD700'
  if (pos === 2) return '#C0C0C0'
  if (pos === 3) return '#CD7F32'
  return ''
}

interface SelectedDriverData {
  driver: Driver
  results: DriverResult[]
  seasons: number[]
  circuits: string[]
  isLoading: boolean
}

export default function DriversPage() {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedDrivers, setSelectedDrivers] = useState<Map<string, SelectedDriverData>>(new Map())

  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [selectedCircuit, setSelectedCircuit] = useState<string | undefined>(undefined)
  const [selectedSessionType, setSelectedSessionType] = useState<string>('race')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load drivers for selected series
  useEffect(() => {
    if (!selectedSeries) {
      setAllDrivers([])
      return
    }
    setDriversLoading(true)
    api.getDrivers(selectedSeries)
      .then(setAllDrivers)
      .catch(() => setAllDrivers([]))
      .finally(() => setDriversLoading(false))
  }, [selectedSeries])

  // Clear selections when series changes
  const handleSeriesChange = useCallback((slug: string | null) => {
    if (slug === selectedSeries) return
    setSelectedSeries(slug)
    setSelectedDrivers(new Map())
    setSearchQuery('')
    setDropdownOpen(false)
    setSelectedYear(undefined)
    setSelectedCircuit(undefined)
    setSelectedSessionType('race')
  }, [selectedSeries])

  const seriesFilters = useMemo(() => SERIES_FILTERS.filter(f => f.slug !== null), [])


  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredDropdownDrivers = useMemo(() => {
    const selectedNames = new Set(Array.from(selectedDrivers.values()).map(d => d.driver.name))
    // Deduplicate by name, keeping the first occurrence
    const seen = new Set<string>()
    const unique = allDrivers.filter(d => {
      if (seen.has(d.name) || selectedNames.has(d.name)) return false
      seen.add(d.name)
      return true
    })
    const sorted = unique.sort((a, b) => a.name.localeCompare(b.name))
    if (!searchQuery.trim()) return sorted.slice(0, 50)
    const q = searchQuery.toLowerCase()
    return sorted.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.teamName?.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [allDrivers, searchQuery, selectedDrivers])

  // Load driver data when selected
  const addDriver = useCallback((driver: Driver) => {
    setSelectedDrivers(prev => {
      if (prev.has(driver.slug)) return prev
      const next = new Map(prev)
      next.set(driver.slug, {
        driver,
        results: [],
        seasons: [],
        circuits: [],
        isLoading: true,
      })
      return next
    })
    setSearchQuery('')
    setDropdownOpen(false)

    // Fetch metadata
    Promise.all([
      api.getDriverSeasons(driver.slug).catch(() => [] as number[]),
      api.getDriverCircuits(driver.slug).catch(() => [] as string[]),
    ]).then(([seasons, circuits]) => {
      setSelectedDrivers(prev => {
        const entry = prev.get(driver.slug)
        if (!entry) return prev
        const next = new Map(prev)
        next.set(driver.slug, { ...entry, seasons, circuits })
        return next
      })
    })
  }, [])

  const removeDriver = useCallback((slug: string) => {
    setSelectedDrivers(prev => {
      const next = new Map(prev)
      next.delete(slug)
      return next
    })
  }, [])

  // Fetch results when filters or selected drivers change
  useEffect(() => {
    selectedDrivers.forEach((data, slug) => {
      setSelectedDrivers(prev => {
        const entry = prev.get(slug)
        if (!entry) return prev
        const next = new Map(prev)
        next.set(slug, { ...entry, isLoading: true })
        return next
      })

      api.getDriverResults(slug, selectedYear, selectedCircuit, selectedSessionType)
        .then(results => {
          setSelectedDrivers(prev => {
            const entry = prev.get(slug)
            if (!entry) return prev
            const next = new Map(prev)
            next.set(slug, { ...entry, results, isLoading: false })
            return next
          })
        })
        .catch(() => {
          setSelectedDrivers(prev => {
            const entry = prev.get(slug)
            if (!entry) return prev
            const next = new Map(prev)
            next.set(slug, { ...entry, results: [], isLoading: false })
            return next
          })
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedCircuit, selectedSessionType, selectedDrivers.size])

  // Compute union of seasons and circuits across all selected drivers
  const allSeasons = useMemo(() => {
    const set = new Set<number>()
    selectedDrivers.forEach(d => d.seasons.forEach(s => set.add(s)))
    return Array.from(set).sort((a, b) => b - a)
  }, [selectedDrivers])

  const allCircuits = useMemo(() => {
    const set = new Set<string>()
    selectedDrivers.forEach(d => d.circuits.forEach(c => set.add(c)))
    return Array.from(set).sort()
  }, [selectedDrivers])

  const driversArray = useMemo(() => Array.from(selectedDrivers.values()), [selectedDrivers])
  const anyLoading = driversArray.some(d => d.isLoading)

  // Chart data: align by event name so lines overlay
  const chartData = useMemo(() => {
    if (driversArray.length === 0) return []
    const showByYear = !selectedYear && !!selectedCircuit

    // Collect all unique x-axis labels in order
    const labelOrder: string[] = []
    const labelSet = new Set<string>()

    for (const dd of driversArray) {
      for (const r of dd.results) {
        if (r.position <= 0) continue
        const label = showByYear ? String(r.year) : r.eventName.replace(/Grand Prix/i, 'GP').substring(0, 20)
        if (!labelSet.has(label)) {
          labelSet.add(label)
          labelOrder.push(label)
        }
      }
    }

    return labelOrder.map(label => {
      const point: Record<string, string | number | null> = { label }
      for (const dd of driversArray) {
        const match = dd.results.find(r => {
          if (r.position <= 0) return false
          const rLabel = showByYear ? String(r.year) : r.eventName.replace(/Grand Prix/i, 'GP').substring(0, 20)
          return rLabel === label
        })
        point[dd.driver.slug] = match ? match.position : null
        if (match) {
          point[`${dd.driver.slug}_event`] = match.eventName
          point[`${dd.driver.slug}_date`] = match.date
          point[`${dd.driver.slug}_gap`] = match.gap
        }
      }
      return point
    })
  }, [driversArray, selectedYear, selectedCircuit])

  const maxPosition = useMemo(() => {
    if (chartData.length === 0) return 20
    let max = 1
    for (const point of chartData) {
      for (const dd of driversArray) {
        const val = point[dd.driver.slug]
        if (typeof val === 'number' && val > max) max = val
      }
    }
    return Math.min(max + 2, 25)
  }, [chartData, driversArray])

  // Stats per driver
  const statsMap = useMemo(() => {
    const map = new Map<string, {
      wins: number
      podiums: number
      dnfs: number
      bestFinish: number | null
      avgPosition: number | null
      totalRaces: number
    }>()
    driversArray.forEach(dd => {
      const positions = dd.results.filter(r => r.position > 0).map(r => r.position)
      const wins = positions.filter(p => p === 1).length
      const podiums = positions.filter(p => p <= 3).length
      const dnfs = dd.results.filter(r =>
        r.status && r.status.toLowerCase() !== 'finished' && r.status !== 'classified' && r.status !== '+1 Lap' && r.position === 0
      ).length
      const bestFinish = positions.length > 0 ? Math.min(...positions) : null
      const avgPosition = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null
      map.set(dd.driver.slug, { wins, podiums, dnfs, bestFinish, avgPosition, totalRaces: dd.results.length })
    })
    return map
  }, [driversArray])

  // Merged results for the table
  const mergedResults = useMemo(() => {
    const all: (DriverResult & { driverSlug: string; driverName: string; teamColor: string })[] = []
    driversArray.forEach(dd => {
      dd.results.forEach(r => {
        all.push({ ...r, driverSlug: dd.driver.slug, driverName: dd.driver.name, teamColor: dd.driver.teamColor })
      })
    })
    return all.sort((a, b) => b.date.localeCompare(a.date))
  }, [driversArray])

  const totalResults = mergedResults.length

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-pitwall-text">Drivers</h1>
        <p className="text-sm text-pitwall-text-muted mt-1">Select a series, then compare drivers</p>
      </div>

      {/* Series selector */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4">
        {seriesFilters.map(filter => (
          <button
            key={filter.slug}
            onClick={() => handleSeriesChange(filter.slug)}
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

      {/* Selected driver chips */}
      {driversArray.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {driversArray.map(dd => (
            <span
              key={dd.driver.slug}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-pitwall-surface border border-pitwall-border"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: dd.driver.teamColor || '#6366f1' }}
              />
              <span className="text-pitwall-text">{dd.driver.name}</span>
              <button
                onClick={() => removeDriver(dd.driver.slug)}
                className="ml-0.5 text-pitwall-text-muted hover:text-pitwall-text transition-colors"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Driver search/selector — only shown when a series is selected */}
      {selectedSeries && (
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div ref={dropdownRef} className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pitwall-text-muted z-10" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search and add drivers..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              setDropdownOpen(true)
            }}
            onFocus={() => setDropdownOpen(true)}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-pitwall-surface border border-pitwall-border text-sm text-pitwall-text placeholder:text-pitwall-text-muted focus:outline-none focus:border-pitwall-accent"
          />
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-pitwall-text-muted pointer-events-none" />

          {dropdownOpen && !driversLoading && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-pitwall-surface border border-pitwall-border rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
              {filteredDropdownDrivers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-pitwall-text-muted">No matching drivers</p>
              ) : (
                filteredDropdownDrivers.map(d => (
                  <button
                    key={d.id}
                    onClick={() => addDriver(d)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-pitwall-surface-2 transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: d.teamColor || '#6366f1' }}
                    />
                    <span className="text-sm text-pitwall-text">{d.name}</span>
                    <span className="text-xs text-pitwall-text-muted ml-auto">{d.teamName}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Filters (only show when drivers are selected) */}
        {driversArray.length > 0 && (
          <>
            <select
              value={selectedYear ?? ''}
              onChange={e => setSelectedYear(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-2 rounded-lg bg-pitwall-surface border border-pitwall-border text-sm text-pitwall-text focus:outline-none focus:border-pitwall-accent"
            >
              <option value="">All Years</option>
              {allSeasons.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              value={selectedCircuit ?? ''}
              onChange={e => setSelectedCircuit(e.target.value || undefined)}
              className="px-3 py-2 rounded-lg bg-pitwall-surface border border-pitwall-border text-sm text-pitwall-text focus:outline-none focus:border-pitwall-accent"
            >
              <option value="">All Circuits</option>
              {allCircuits.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="flex gap-1 rounded-lg bg-pitwall-surface border border-pitwall-border p-0.5">
              {SESSION_TYPES.map(st => (
                <button
                  key={st.label}
                  onClick={() => setSelectedSessionType(st.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    selectedSessionType === st.value
                      ? 'bg-pitwall-accent text-white'
                      : 'text-pitwall-text-muted hover:text-pitwall-text'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {/* Empty state */}
      {!selectedSeries && (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-pitwall-text-muted/40 mb-4" />
          <p className="text-pitwall-text-muted text-lg mb-1">Choose a series to get started</p>
          <p className="text-pitwall-text-muted/60 text-sm">Select a series above, then search and add drivers to compare</p>
        </div>
      )}

      {selectedSeries && driversArray.length === 0 && (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-pitwall-text-muted/40 mb-4" />
          <p className="text-pitwall-text-muted text-lg mb-1">Select drivers to compare</p>
          <p className="text-pitwall-text-muted/60 text-sm">Search for drivers above to view position trends, stats, and results</p>
        </div>
      )}

      {/* Loading state */}
      {driversArray.length > 0 && anyLoading && (
        <div className="space-y-4">
          <div className="h-64 bg-pitwall-surface rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-pitwall-surface rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {driversArray.length > 0 && !anyLoading && (
        <>
          {/* Position Trend Chart */}
          {chartData.length > 1 && (
            <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-4 mb-6">
              <h2 className="text-sm font-semibold text-pitwall-text-muted uppercase tracking-wide mb-3">
                Position Trend
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    reversed
                    domain={[1, maxPosition]}
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                    tickLine={false}
                    label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141420',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#e4e4ef',
                    }}
                    formatter={(value: number, name: string) => {
                      const dd = driversArray.find(d => d.driver.slug === name)
                      return [`P${value}`, dd?.driver.name || name]
                    }}
                    labelFormatter={(label: string) => label}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const dd = driversArray.find(d => d.driver.slug === value)
                      return dd?.driver.name || value
                    }}
                    iconType="circle"
                  />
                  {driversArray.map(dd => (
                    <Line
                      key={dd.driver.slug}
                      type="monotone"
                      dataKey={dd.driver.slug}
                      name={dd.driver.slug}
                      stroke={dd.driver.teamColor || '#6366f1'}
                      strokeWidth={2}
                      dot={{ r: 3, fill: dd.driver.teamColor || '#6366f1', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stats */}
          {driversArray.length === 1 ? (
            <SingleDriverStats
              driver={driversArray[0].driver}
              stats={statsMap.get(driversArray[0].driver.slug)}
            />
          ) : driversArray.length > 1 ? (
            <ComparisonTable driversArray={driversArray} statsMap={statsMap} />
          ) : null}

          {/* Results Table */}
          {totalResults > 0 && (
            <div className="bg-pitwall-surface rounded-lg border border-pitwall-border overflow-hidden">
              <div className="px-4 py-3 border-b border-pitwall-border">
                <h2 className="text-sm font-semibold text-pitwall-text-muted uppercase tracking-wide">
                  Results ({totalResults})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-pitwall-text-muted border-b border-pitwall-border">
                      <th className="px-4 py-2 font-medium">Pos</th>
                      {driversArray.length > 1 && (
                        <th className="px-4 py-2 font-medium">Driver</th>
                      )}
                      <th className="px-4 py-2 font-medium">Event</th>
                      <th className="px-4 py-2 font-medium hidden sm:table-cell">Circuit</th>
                      <th className="px-4 py-2 font-medium hidden md:table-cell">Session</th>
                      <th className="px-4 py-2 font-medium hidden sm:table-cell">Date</th>
                      <th className="px-4 py-2 font-medium">Gap</th>
                      <th className="px-4 py-2 font-medium hidden md:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedResults.map((r, i) => {
                      const pColor = positionColor(r.position)
                      return (
                        <tr key={i} className="border-b border-pitwall-border/50 hover:bg-pitwall-surface-2/50 transition-colors">
                          <td className="px-4 py-2.5">
                            <span
                              className="font-mono font-semibold"
                              style={pColor ? { color: pColor } : undefined}
                            >
                              {r.position > 0 ? `P${r.position}` : '-'}
                            </span>
                          </td>
                          {driversArray.length > 1 && (
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: r.teamColor || '#6366f1' }}
                                />
                                <span className="text-pitwall-text">{r.driverName}</span>
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-pitwall-text">{r.eventName}</td>
                          <td className="px-4 py-2.5 text-pitwall-text-muted hidden sm:table-cell">{r.circuitName}</td>
                          <td className="px-4 py-2.5 text-pitwall-text-muted capitalize hidden md:table-cell">{r.sessionType}</td>
                          <td className="px-4 py-2.5 text-pitwall-text-muted font-mono hidden sm:table-cell">{r.date}</td>
                          <td className="px-4 py-2.5 text-pitwall-text-muted font-mono">{r.gap || '-'}</td>
                          <td className="px-4 py-2.5 text-pitwall-text-muted hidden md:table-cell">{r.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalResults === 0 && (
            <p className="text-pitwall-text-muted text-center py-12">No results found for the selected filters.</p>
          )}
        </>
      )}
    </div>
  )
}

function SingleDriverStats({ driver, stats }: {
  driver: Driver
  stats?: { wins: number; podiums: number; dnfs: number; bestFinish: number | null; avgPosition: number | null; totalRaces: number }
}) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <StatCard label="Best Finish" value={stats.bestFinish != null ? `P${stats.bestFinish}` : '-'} highlight={stats.bestFinish === 1} color={driver.teamColor} />
      <StatCard label="Avg Position" value={stats.avgPosition != null ? `P${stats.avgPosition.toFixed(1)}` : '-'} color={driver.teamColor} />
      <StatCard label="Wins" value={String(stats.wins)} highlight={stats.wins > 0} color={driver.teamColor} />
      <StatCard label="Podiums" value={String(stats.podiums)} color={driver.teamColor} />
      <StatCard label="Races" value={String(stats.totalRaces)} color={driver.teamColor} />
    </div>
  )
}

function StatCard({ label, value, highlight, color }: {
  label: string
  value: string
  highlight?: boolean
  color?: string
}) {
  return (
    <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-3">
      <p className="text-xs text-pitwall-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-mono font-bold ${highlight ? 'text-yellow-400' : 'text-pitwall-text'}`}>
        {value}
      </p>
    </div>
  )
}

function ComparisonTable({ driversArray, statsMap }: {
  driversArray: SelectedDriverData[]
  statsMap: Map<string, { wins: number; podiums: number; dnfs: number; bestFinish: number | null; avgPosition: number | null; totalRaces: number }>
}) {
  const rows = [
    { label: 'Best Finish', key: 'bestFinish', format: (v: number | null) => v != null ? `P${v}` : '-' },
    { label: 'Avg Position', key: 'avgPosition', format: (v: number | null) => v != null ? `P${v.toFixed(1)}` : '-' },
    { label: 'Wins', key: 'wins', format: (v: number) => String(v) },
    { label: 'Podiums', key: 'podiums', format: (v: number) => String(v) },
    { label: 'DNFs', key: 'dnfs', format: (v: number) => String(v) },
    { label: 'Races', key: 'totalRaces', format: (v: number) => String(v) },
  ]

  return (
    <div className="bg-pitwall-surface rounded-lg border border-pitwall-border overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-pitwall-border">
        <h2 className="text-sm font-semibold text-pitwall-text-muted uppercase tracking-wide">
          Comparison
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pitwall-border">
              <th className="px-4 py-2 text-left text-pitwall-text-muted font-medium" />
              {driversArray.map(dd => (
                <th key={dd.driver.slug} className="px-4 py-2 text-center font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dd.driver.teamColor || '#6366f1' }}
                    />
                    <span className="text-pitwall-text">{dd.driver.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-b border-pitwall-border/50 hover:bg-pitwall-surface-2/50 transition-colors">
                <td className="px-4 py-2.5 text-pitwall-text-muted font-medium">{row.label}</td>
                {driversArray.map(dd => {
                  const s = statsMap.get(dd.driver.slug)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const val = s ? (s as any)[row.key] : null
                  return (
                    <td key={dd.driver.slug} className="px-4 py-2.5 text-center font-mono text-pitwall-text">
                      {row.format(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
