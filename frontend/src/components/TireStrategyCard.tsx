'use client'

import { useMemo } from 'react'
import type { LapTelemetryPoint, TireStint } from '@/lib/api'

interface DriverRef {
  name: string
  carNumber: number | null
  teamColor?: string | null
}

interface TireStrategyCardProps {
  telemetry: LapTelemetryPoint[]
  tireStints?: TireStint[]
  leaderboardOrder?: DriverRef[]
  maxDrivers?: number
}

interface Stint {
  startLap: number
  endLap: number
  compound?: string | null
  stintNumber?: number
}

interface DriverStrategy {
  key: string
  name: string
  teamColor: string
  stints: Stint[]
  pitLaps: number[]
  completedLaps: number
}

const STINT_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899']
const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#dc2626',
  MEDIUM: '#facc15',
  HARD: '#d4d4d8',
  INTERMEDIATE: '#22c55e',
  INTER: '#22c55e',
  WET: '#2563eb',
  FULLWET: '#2563eb',
  SUPERSOFT: '#e11d48',
  ULTRASOFT: '#7c3aed',
  HYPERSOFT: '#ec4899',
}

function toDriverKey(name: string | null, carNumber: string): string {
  return `${(name || 'Unknown').toLowerCase()}|${carNumber}`
}

function uniqueSorted(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b)
}

function buildStints(rows: LapTelemetryPoint[]): DriverStrategy | null {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => a.lapNumber - b.lapNumber)
  const first = sorted[0]
  const name = first.driverName || `Car ${first.carNumber}`
  const teamColor = first.teamColor || '#64748b'

  const laps = uniqueSorted(sorted.map(r => r.lapNumber).filter(Number.isFinite))
  if (!laps.length) return null

  const pitLaps = uniqueSorted(
    sorted
      .filter(r => Boolean(r.crossingPitFinishLane))
      .map(r => r.lapNumber)
      .filter(Number.isFinite)
  )

  const stints: Stint[] = []
  let stintStart = laps[0]
  for (let i = 1; i < laps.length; i += 1) {
    const prev = laps[i - 1]
    const current = laps[i]
    const hasGap = current > prev + 1
    const pitAtPrevLap = pitLaps.includes(prev)

    if (hasGap || pitAtPrevLap) {
      stints.push({ startLap: stintStart, endLap: prev })
      stintStart = current
    }
  }
  stints.push({ startLap: stintStart, endLap: laps[laps.length - 1] })

  return {
    key: toDriverKey(first.driverName || null, first.carNumber),
    name,
    teamColor,
    stints,
    pitLaps,
    completedLaps: laps[laps.length - 1],
  }
}

function lapsInStint(stint: Stint): number {
  return Math.max(0, stint.endLap - stint.startLap + 1)
}

function resolveCompoundColor(compound: string | null | undefined, fallbackIdx: number): string {
  if (!compound) return STINT_COLORS[fallbackIdx % STINT_COLORS.length]
  const normalized = compound.toUpperCase().replace(/\s+/g, '')
  return COMPOUND_COLORS[normalized] || STINT_COLORS[fallbackIdx % STINT_COLORS.length]
}

export default function TireStrategyCard({
  telemetry,
  tireStints = [],
  leaderboardOrder = [],
  maxDrivers = 8,
}: TireStrategyCardProps) {
  const strategies = useMemo(() => {
    if (tireStints.length > 0) {
      const byDriver = new Map<string, DriverStrategy>()
      for (const row of tireStints) {
        const name = row.driverName || `Car ${row.driverNumber ?? ''}`.trim()
        const key = `${name.toLowerCase()}|${row.driverNumber ?? ''}`
        if (!byDriver.has(key)) {
          byDriver.set(key, {
            key,
            name,
            teamColor: row.teamColor || '#64748b',
            stints: [],
            pitLaps: [],
            completedLaps: 0,
          })
        }
        const current = byDriver.get(key)!
        current.stints.push({
          startLap: row.lapStart,
          endLap: row.lapEnd,
          compound: row.compound || null,
          stintNumber: row.stintNumber,
        })
        current.completedLaps = Math.max(current.completedLaps, row.lapEnd || 0)
      }

      const orderIndex = new Map<string, number>()
      leaderboardOrder.forEach((entry, idx) => {
        orderIndex.set(`${entry.name.toLowerCase()}|${entry.carNumber ?? ''}`, idx)
      })

      return Array.from(byDriver.values())
        .map(strategy => ({
          ...strategy,
          stints: strategy.stints.sort((a, b) => a.startLap - b.startLap),
          pitLaps: strategy.stints.slice(0, -1).map(stint => stint.endLap),
        }))
        .sort((a, b) => {
          const aIdx = orderIndex.get(a.key) ?? Number.MAX_SAFE_INTEGER
          const bIdx = orderIndex.get(b.key) ?? Number.MAX_SAFE_INTEGER
          if (aIdx !== bIdx) return aIdx - bIdx
          return b.completedLaps - a.completedLaps
        })
        .slice(0, maxDrivers)
    }

    const byDriver = new Map<string, LapTelemetryPoint[]>()
    for (const row of telemetry) {
      const key = toDriverKey(row.driverName || null, row.carNumber)
      if (!byDriver.has(key)) byDriver.set(key, [])
      byDriver.get(key)!.push(row)
    }

    const orderIndex = new Map<string, number>()
    leaderboardOrder.forEach((entry, idx) => {
      const key = `${entry.name.toLowerCase()}|${entry.carNumber ?? ''}`
      orderIndex.set(key, idx)
    })

    const built = Array.from(byDriver.values())
      .map(buildStints)
      .filter((value): value is DriverStrategy => Boolean(value))
      .sort((a, b) => {
        const aIdx = orderIndex.get(`${a.name.toLowerCase()}|${a.key.split('|')[1]}`) ?? Number.MAX_SAFE_INTEGER
        const bIdx = orderIndex.get(`${b.name.toLowerCase()}|${b.key.split('|')[1]}`) ?? Number.MAX_SAFE_INTEGER
        if (aIdx !== bIdx) return aIdx - bIdx
        return b.completedLaps - a.completedLaps
      })
      .slice(0, maxDrivers)

    return built
  }, [leaderboardOrder, maxDrivers, telemetry, tireStints])

  const raceDistance = useMemo(
    () => strategies.reduce((max, strategy) => Math.max(max, strategy.completedLaps), 0),
    [strategies]
  )

  if (!strategies.length || raceDistance <= 0) return null

  return (
    <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden">
      <div className="px-3 py-2 border-b border-pitwall-border">
        <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
          Tire / Stint Strategy (Lite)
        </h4>
        <p className="text-[11px] text-pitwall-text-muted mt-1">
          {tireStints.length > 0
            ? 'Using stint and compound data.'
            : 'Derived from lap telemetry and pit crossings. Compound-level data will be added when available.'}
        </p>
      </div>

      <div className="divide-y divide-pitwall-border/50">
        {strategies.map(strategy => (
          <div key={strategy.key} className="px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-1 rounded-full shrink-0"
                  style={{ backgroundColor: strategy.teamColor }}
                />
                <p className="truncate text-sm font-medium text-pitwall-text">{strategy.name}</p>
              </div>
              <p className="text-xs text-pitwall-text-muted">
                {strategy.stints.length} stint{strategy.stints.length === 1 ? '' : 's'} · {strategy.pitLaps.length} pit
              </p>
            </div>

            <div className="h-5 w-full rounded-md bg-pitwall-surface border border-pitwall-border overflow-hidden flex">
              {strategy.stints.map((stint, idx) => {
                const width = `${(lapsInStint(stint) / raceDistance) * 100}%`
                return (
                  <div
                    key={`${stint.startLap}-${stint.endLap}-${idx}`}
                    className="h-full border-r border-pitwall-bg/80"
                    style={{
                      width,
                      backgroundColor: resolveCompoundColor(stint.compound, idx),
                    }}
                    title={`Stint ${idx + 1}: Laps ${stint.startLap}-${stint.endLap}${
                      stint.compound
                        ? ` · ${stint.compound}`
                        : ''
                    }`}
                  />
                )
              })}
            </div>

            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-pitwall-text-muted">
              {strategy.stints.map((stint, idx) => (
                <span key={`${strategy.key}-legend-${idx}`}>
                  S{idx + 1}: L{stint.startLap}-{stint.endLap}
                  {stint.compound ? ` · ${stint.compound}` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
