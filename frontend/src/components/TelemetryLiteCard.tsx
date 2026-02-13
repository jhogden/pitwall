'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { LapTelemetryPoint } from '@/lib/api'

interface TelemetryLiteCardProps {
  telemetry: LapTelemetryPoint[]
  eventName: string
}

interface DriverOption {
  key: string
  label: string
  teamColor: string
}

function parseLapTimeToSeconds(value: string | null): number | null {
  if (!value) return null
  const parts = value.split(':')
  if (parts.length === 1) {
    const sec = Number(parts[0])
    return Number.isFinite(sec) ? sec : null
  }
  if (parts.length === 2) {
    const min = Number(parts[0])
    const sec = Number(parts[1])
    if (!Number.isFinite(min) || !Number.isFinite(sec)) return null
    return min * 60 + sec
  }
  return null
}

function formatSeconds(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = seconds - min * 60
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`
}

export default function TelemetryLiteCard({ telemetry, eventName }: TelemetryLiteCardProps) {
  const driverOptions = useMemo<DriverOption[]>(() => {
    const map = new Map<string, DriverOption>()
    for (const row of telemetry) {
      const key = `${row.carNumber}|${row.driverName || 'Unknown'}`
      if (map.has(key)) continue
      map.set(key, {
        key,
        label: `${row.driverName || 'Unknown'} (#${row.carNumber})`,
        teamColor: row.teamColor || '#4D4D4D',
      })
    }
    return Array.from(map.values())
  }, [telemetry])

  const [selectedKey, setSelectedKey] = useState<string>(driverOptions[0]?.key || '')

  useEffect(() => {
    if (!driverOptions.length) {
      setSelectedKey('')
      return
    }
    setSelectedKey(prev =>
      driverOptions.some(d => d.key === prev) ? prev : driverOptions[0].key
    )
  }, [driverOptions])

  const selectedRows = useMemo(() => {
    if (!selectedKey) return []
    const [carNumber, driverName] = selectedKey.split('|')
    return telemetry
      .filter(r => r.carNumber === carNumber && (r.driverName || 'Unknown') === driverName)
      .sort((a, b) => a.lapNumber - b.lapNumber)
  }, [telemetry, selectedKey])

  const chartData = useMemo(() => {
    return selectedRows
      .map(r => ({
        lap: r.lapNumber,
        lapSeconds: parseLapTimeToSeconds(r.lapTime),
        position: r.position,
      }))
      .filter(r => r.lapSeconds !== null)
  }, [selectedRows])

  const latest = selectedRows[selectedRows.length - 1]
  const bestLap = chartData.length ? Math.min(...chartData.map(r => r.lapSeconds as number)) : null

  if (!driverOptions.length) {
    return null
  }

  return (
    <div className="rounded-lg bg-pitwall-bg border border-pitwall-border overflow-hidden mt-6">
      <div className="px-3 py-2 border-b border-pitwall-border flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold text-pitwall-text-muted uppercase tracking-wide">
          {eventName} — Telemetry Lite
        </h4>
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="bg-pitwall-surface border border-pitwall-border rounded px-2 py-1 text-xs text-pitwall-text"
        >
          {driverOptions.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 py-3 border-b border-pitwall-border">
        <div className="bg-pitwall-surface rounded p-2">
          <p className="text-[10px] text-pitwall-text-muted uppercase">Laps</p>
          <p className="text-sm font-semibold text-pitwall-text">{selectedRows.length}</p>
        </div>
        <div className="bg-pitwall-surface rounded p-2">
          <p className="text-[10px] text-pitwall-text-muted uppercase">Best Lap</p>
          <p className="text-sm font-semibold text-pitwall-text">{bestLap !== null ? formatSeconds(bestLap) : '-'}</p>
        </div>
        <div className="bg-pitwall-surface rounded p-2">
          <p className="text-[10px] text-pitwall-text-muted uppercase">Last Position</p>
          <p className="text-sm font-semibold text-pitwall-text">{latest?.position ?? '-'}</p>
        </div>
        <div className="bg-pitwall-surface rounded p-2">
          <p className="text-[10px] text-pitwall-text-muted uppercase">Top Speed</p>
          <p className="text-sm font-semibold text-pitwall-text">{latest?.topSpeedKph || '-'}{latest?.topSpeedKph ? ' km/h' : ''}</p>
        </div>
      </div>

      <div className="h-64 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="lap" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              tickFormatter={(v) => formatSeconds(v)}
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
            />
            <Tooltip
              formatter={(value: number) => formatSeconds(value)}
              labelFormatter={(label) => `Lap ${label}`}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="lapSeconds"
              stroke={driverOptions.find(d => d.key === selectedKey)?.teamColor || '#3b82f6'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
