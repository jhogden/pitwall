'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { LapTelemetryPoint } from '@/lib/api'
import { hashString, generateTrackPoints, parseTrackGeometry, pathFromPoints } from '@/lib/track'
import type { Pt } from '@/lib/track'

interface RaceReplayCardProps {
  telemetry: LapTelemetryPoint[]
  trackMapUrl?: string | null
  trackGeometry?: string | null
  trackSeed?: string
}

interface DriverState {
  key: string
  name: string
  teamName: string
  teamColor: string
  driverColor: string
  samples: Array<{
    lapNumber: number
    elapsedSec: number
    position: number | null
  }>
}

function shortNameLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Driver'
  return parts[parts.length - 1]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'DR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 10]
const FALLBACK_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF',
  '#EC4899', '#F43F5E',
]

function parseDurationToSeconds(raw: string | null): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':')
  if (parts.length === 3) {
    const h = Number(parts[0])
    const m = Number(parts[1])
    const s = Number(parts[2])
    if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const m = Number(parts[0])
    const s = Number(parts[1])
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null
    return m * 60 + s
  }
  const s = Number(parts[0])
  return Number.isFinite(s) ? s : null
}

function looksPlaceholderColor(color: string | null | undefined): boolean {
  if (!color) return true
  const normalized = color.trim().toLowerCase()
  return normalized === '#4d4d4d' || normalized === '#64748b' || normalized === '#888888'
}

function colorFromKey(key: string): string {
  const idx = hashString(key) % FALLBACK_COLORS.length
  return FALLBACK_COLORS[idx]
}

function polylineLength(points: Pt[]): { lengths: number[]; total: number } {
  const lengths: number[] = [0]
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    total += Math.hypot(dx, dy)
    lengths.push(total)
  }
  return { lengths, total }
}

function pointAtProgress(points: Pt[], lengths: number[], total: number, progress: number): Pt {
  if (!points.length || total <= 0) return { x: 500, y: 280 }
  const wrapped = ((progress % 1) + 1) % 1
  const target = wrapped * total
  let idx = 1
  while (idx < lengths.length && lengths[idx] < target) idx += 1
  const i = clamp(idx, 1, lengths.length - 1)
  const l0 = lengths[i - 1]
  const l1 = lengths[i]
  const ratio = l1 > l0 ? (target - l0) / (l1 - l0) : 0
  return {
    x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
    y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio,
  }
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatGap(gapSec: number, lapsBehind: number): string {
  if (lapsBehind >= 1) {
    const fullLaps = Math.floor(lapsBehind)
    return `+${fullLaps} Lap${fullLaps > 1 ? 's' : ''}`
  }
  if (gapSec >= 60) {
    const minutes = Math.floor(gapSec / 60)
    const remainder = gapSec - minutes * 60
    return `+${minutes}m ${remainder.toFixed(1)}s`
  }
  return `+${gapSec.toFixed(1)}s`
}

export default function RaceReplayCard({
  telemetry,
  trackMapUrl = null,
  trackGeometry = null,
  trackSeed = 'pitwall-track',
}: RaceReplayCardProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const driverStates = useMemo<DriverState[]>(() => {
    const byDriver = new Map<string, LapTelemetryPoint[]>()
    for (const row of telemetry) {
      const name = row.driverName || `Car ${row.carNumber}`
      const key = `${name.toLowerCase()}|${row.carNumber}`
      if (!byDriver.has(key)) byDriver.set(key, [])
      byDriver.get(key)!.push(row)
    }

    const built = Array.from(byDriver.entries()).map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.lapNumber - b.lapNumber)
      const teamName = sorted[0]?.teamName || 'Unknown Team'
      const rawTeamColor = sorted[0]?.teamColor || null
      const teamColor = looksPlaceholderColor(rawTeamColor)
        ? colorFromKey(`team|${teamName.toLowerCase()}`)
        : (rawTeamColor as string)
      const driverName = sorted[0]?.driverName || `Car ${sorted[0]?.carNumber || ''}`.trim()
      const driverColor = colorFromKey(`driver|${driverName.toLowerCase()}|${sorted[0]?.carNumber || ''}`)
      // Check if this dataset has real sessionElapsed values
      const hasRealElapsed = sorted.some(row => row.sessionElapsed !== null && row.sessionElapsed !== '')
      let fallbackElapsed = 0
      const samples = sorted.map((row, idx) => {
        const parsedElapsed = parseDurationToSeconds(row.sessionElapsed)
        let elapsed = parsedElapsed
        if (elapsed === null) {
          const lapTime = parseDurationToSeconds(row.lapTime)
          if (!hasRealElapsed && idx === 0) {
            // Lap 1 includes formation/out lap — don't count it as racing time.
            // Start everyone at 0 so the replay begins immediately.
            fallbackElapsed = 0
          } else {
            fallbackElapsed += lapTime ?? 90
          }
          elapsed = fallbackElapsed
        } else {
          fallbackElapsed = elapsed
        }
        return {
          lapNumber: row.lapNumber,
          elapsedSec: elapsed,
          position: row.position,
        }
      })
      for (let i = 1; i < samples.length; i += 1) {
        if (samples[i].elapsedSec < samples[i - 1].elapsedSec) {
          samples[i].elapsedSec = samples[i - 1].elapsedSec
        }
      }
      return {
        key,
        name: driverName,
        teamName,
        teamColor,
        driverColor,
        samples,
      }
    })
    // Filter out drivers with no movement (e.g. DNS — single lap with no time)
    const meaningful = built.filter(driver => {
      const last = driver.samples[driver.samples.length - 1]
      return last && last.elapsedSec > 0
    })

    const globalStart = meaningful.reduce(
      (min, driver) => Math.min(min, driver.samples[0]?.elapsedSec ?? Number.POSITIVE_INFINITY),
      Number.POSITIVE_INFINITY
    )
    if (!Number.isFinite(globalStart) || globalStart <= 0) return meaningful
    return meaningful.map(driver => ({
      ...driver,
      samples: driver.samples.map(sample => ({
        ...sample,
        elapsedSec: Math.max(0, sample.elapsedSec - globalStart),
      })),
    }))
  }, [telemetry])

  const maxTimeSec = useMemo(
    () => driverStates.reduce((max, driver) => Math.max(max, driver.samples[driver.samples.length - 1]?.elapsedSec || 0), 0),
    [driverStates]
  )
  const maxLapOverall = useMemo(
    () => driverStates.reduce((max, driver) => Math.max(max, driver.samples[driver.samples.length - 1]?.lapNumber || 0), 0),
    [driverStates]
  )

  useEffect(() => {
    if (!maxTimeSec) return
    setCurrentTimeSec(prev => clamp(prev, 0, maxTimeSec))
  }, [maxTimeSec])

  useEffect(() => {
    if (!isPlaying || maxTimeSec <= 1) return
    const intervalMs = 100
    // Middle-ground baseline for long races; speed buttons handle fine tuning.
    const baseReplayRate = Math.max(maxTimeSec / 4800, 0.75)
    const timer = window.setInterval(() => {
      setCurrentTimeSec(prev => {
        const next = prev + (intervalMs / 1000) * baseReplayRate * speed
        if (next >= maxTimeSec) {
          setIsPlaying(false)
          return maxTimeSec
        }
        return next
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [isPlaying, maxTimeSec, speed])

  const frameDrivers = useMemo(() => {
    const active = driverStates.map(driver => {
      if (!driver.samples.length) {
        return { ...driver, completedLapsFloat: 0, position: 999, lapLabel: 0, gapText: '' }
      }
      const samples = driver.samples
      const firstSample = samples[0]
      if (currentTimeSec < firstSample.elapsedSec) {
        return {
          ...driver,
          completedLapsFloat: 0,
          position: firstSample.position ?? 999,
          lapLabel: 0,
          gapText: '',
        }
      }
      let idx = 0
      while (idx < samples.length - 1 && samples[idx + 1].elapsedSec <= currentTimeSec) idx += 1
      const current = samples[idx]
      const next = samples[Math.min(idx + 1, samples.length - 1)]
      const window = Math.max(0.001, next.elapsedSec - current.elapsedSec)
      const frac = clamp((currentTimeSec - current.elapsedSec) / window, 0, 1)
      const lapsFloat = (current.lapNumber - 1) + (idx < samples.length - 1 ? frac : 1)

      let pos = current.position ?? 999
      if (pos === 999) {
        for (let i = idx; i >= 0; i -= 1) {
          if (samples[i].position !== null) {
            pos = samples[i].position as number
            break
          }
        }
      }
      return {
        ...driver,
        completedLapsFloat: Math.max(0, lapsFloat),
        position: pos,
        lapLabel: Math.max(1, Math.floor(lapsFloat) + 1),
        gapText: '',
      }
    })

    const sorted = active.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      return b.completedLapsFloat - a.completedLapsFloat
    })

    if (sorted.length > 0) {
      const leader = sorted[0]
      const leaderLaps = leader.completedLapsFloat
      const leaderSamples = leader.samples
      const leaderAvgLapTime = leaderSamples.length >= 2
        ? (leaderSamples[leaderSamples.length - 1].elapsedSec - leaderSamples[0].elapsedSec) /
          Math.max(1, leaderSamples[leaderSamples.length - 1].lapNumber - leaderSamples[0].lapNumber)
        : 90

      sorted[0] = { ...sorted[0], gapText: 'LEADER' }
      for (let i = 1; i < sorted.length; i += 1) {
        const lapsBehind = leaderLaps - sorted[i].completedLapsFloat
        const gapSec = lapsBehind * leaderAvgLapTime
        sorted[i] = { ...sorted[i], gapText: formatGap(gapSec, lapsBehind) }
      }
    }

    return sorted
  }, [currentTimeSec, driverStates])

  const currentLap = Math.max(...frameDrivers.map(driver => Math.floor(driver.completedLapsFloat || 0)), 0)
  const trackPoints = useMemo(() => {
    if (trackGeometry) {
      try {
        return parseTrackGeometry(trackGeometry, { width: 1000, height: 560, padding: 40 })
      } catch {
        // fall through to procedural generation
      }
    }
    return generateTrackPoints(trackSeed)
  }, [trackGeometry, trackSeed])
  const { lengths: trackLengths, total: trackTotalLength } = useMemo(() => polylineLength(trackPoints), [trackPoints])
  const trackPath = useMemo(() => pathFromPoints(trackPoints), [trackPoints])

  if (!driverStates.length || maxTimeSec <= 0) return null

  return (
    <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden">
      <div className="px-3 py-2 border-b border-pitwall-border flex items-center justify-between">
        <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
          Race Replay (Beta)
        </h4>
        <span className="text-xs text-pitwall-text-muted">
          Lap {currentLap} / {maxLapOverall} · {formatClock(currentTimeSec)} / {formatClock(maxTimeSec)}
        </span>
      </div>

      <div className="px-3 py-3 border-b border-pitwall-border flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying(prev => !prev)}
          className="inline-flex items-center gap-1 rounded border border-pitwall-border px-2 py-1 text-xs text-pitwall-text hover:bg-pitwall-surface"
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false)
            setCurrentTimeSec(0)
          }}
          className="inline-flex items-center gap-1 rounded border border-pitwall-border px-2 py-1 text-xs text-pitwall-text hover:bg-pitwall-surface"
        >
          <RotateCcw size={12} />
          Reset
        </button>
        <div className="ml-1 flex items-center gap-1">
          {SPEEDS.map(value => (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              className={`rounded px-2 py-1 text-xs border ${
                speed === value
                  ? 'border-pitwall-accent text-pitwall-accent bg-pitwall-accent/10'
                  : 'border-pitwall-border text-pitwall-text-muted hover:text-pitwall-text'
              }`}
            >
              {value}x
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(maxTimeSec))}
          step={1}
          value={Math.floor(currentTimeSec)}
          onChange={(e) => {
            setIsPlaying(false)
            setCurrentTimeSec(Number(e.target.value))
          }}
          className="ml-auto w-full sm:w-64"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-3">
        <div className="rounded-lg border border-pitwall-border bg-pitwall-surface p-3 min-h-[320px] relative overflow-hidden">
          {trackMapUrl && !trackGeometry && (
            <img
              src={trackMapUrl}
              alt=""
              className="pointer-events-none absolute inset-0 w-full h-full object-contain opacity-25 p-4"
            />
          )}
          <svg viewBox="0 0 1000 560" className="w-full h-full">
            <path
              d={trackPath}
              fill="none"
              stroke="rgba(148,163,184,0.25)"
              strokeWidth="16"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {frameDrivers.map((driver, idx) => {
              const progress = driver.completedLapsFloat - Math.floor(driver.completedLapsFloat)
              const basePt = pointAtProgress(trackPoints, trackLengths, trackTotalLength, progress)
              const angle = ((idx % 8) / 8) * Math.PI * 2
              const x = basePt.x + Math.cos(angle) * 13
              const y = basePt.y + Math.sin(angle) * 13
              return (
                <g key={driver.key}>
                  <circle cx={x} cy={y} r="11" fill={driver.driverColor} stroke={driver.teamColor} strokeWidth="3" />
                  <text
                    x={x + 14}
                    y={y + 4}
                    fontSize="13"
                    fill="#dbe4ff"
                    style={{ paintOrder: 'stroke', stroke: '#0b1020', strokeWidth: 3 }}
                  >
                    {initials(driver.name)}
                  </text>
                  <text
                    x={x + 32}
                    y={y + 4}
                    fontSize="12"
                    fill="#e5e7eb"
                    style={{ paintOrder: 'stroke', stroke: '#0b1020', strokeWidth: 3 }}
                  >
                    {shortNameLabel(driver.name)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="rounded-lg border border-pitwall-border bg-pitwall-surface overflow-hidden">
          <div className="grid grid-cols-[2rem,1fr,5rem,3rem] gap-2 px-3 py-2 border-b border-pitwall-border text-[10px] uppercase tracking-wide text-pitwall-text-muted">
            <span className="text-right">Pos</span>
            <span>Driver</span>
            <span className="text-right">Gap</span>
            <span className="text-right">Lap</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {frameDrivers.slice(0, 20).map((driver, idx) => (
              <div
                key={driver.key}
                className={`grid grid-cols-[2rem,1fr,5rem,3rem] gap-2 items-center px-3 py-1.5 text-sm ${
                  idx % 2 === 1 ? 'bg-pitwall-bg/60' : ''
                }`}
              >
                <span className="font-mono text-right text-pitwall-text-muted">{idx + 1}</span>
                <div className="min-w-0 flex items-center gap-2">
                  <span className="h-2.5 w-1 rounded-full shrink-0" style={{ backgroundColor: driver.teamColor }} />
                  <span
                    className="h-2 w-2 rounded-full shrink-0 border border-pitwall-bg"
                    style={{ backgroundColor: driver.driverColor }}
                    title={`${driver.name} driver color`}
                  />
                  <span className="truncate text-pitwall-text">{driver.name}</span>
                </div>
                <span className="font-mono text-right text-pitwall-text-muted text-xs truncate">{driver.gapText}</span>
                <span className="font-mono text-right text-pitwall-text-muted">{Math.floor(driver.completedLapsFloat)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
