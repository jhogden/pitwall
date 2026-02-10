'use client'

import { Check, Radio } from 'lucide-react'
import { format, parseISO, isPast, isFuture } from 'date-fns'
import type { Session } from '@/lib/api'
import { SESSION_TYPE_LABELS } from '@/lib/constants'

interface SessionTimelineProps {
  sessions: Session[]
}

function sessionStatusStyle(session: Session) {
  if (session.status === 'live') {
    return { dot: 'live', text: 'text-green-400', label: 'LIVE' }
  }
  if (session.status === 'completed') {
    return { dot: 'completed', text: 'text-pitwall-text-muted', label: 'Completed' }
  }
  return { dot: 'upcoming', text: 'text-pitwall-text', label: 'Upcoming' }
}

function formatSessionTime(timeStr: string): string {
  try {
    const date = parseISO(timeStr)
    return format(date, 'EEE, MMM d · HH:mm')
  } catch {
    return timeStr
  }
}

export default function SessionTimeline({ sessions }: SessionTimelineProps) {
  return (
    <div className="space-y-0">
      {sessions.map((session, i) => {
        const style = sessionStatusStyle(session)
        const isLast = i === sessions.length - 1
        const typeLabel = SESSION_TYPE_LABELS[session.type] || session.type

        return (
          <div key={session.id} className="relative flex gap-4">
            {/* Timeline column */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              {style.dot === 'live' ? (
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                </span>
              ) : style.dot === 'completed' ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pitwall-text-muted/20">
                  <Check size={10} className="text-pitwall-text-muted" />
                </span>
              ) : (
                <span className="h-4 w-4 rounded-full border-2 border-pitwall-border bg-pitwall-bg" />
              )}

              {/* Connecting line */}
              {!isLast && (
                <div className="w-px flex-1 min-h-[24px] bg-pitwall-border" />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 ${style.dot === 'completed' ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${style.text}`}>
                  {session.name || typeLabel}
                </span>
                {style.dot === 'live' && (
                  <span className="text-[10px] font-bold tracking-wider text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-pitwall-text-muted font-mono mt-0.5">
                {formatSessionTime(session.startTime)}
                {session.endTime && (
                  <>
                    {' — '}
                    {format(parseISO(session.endTime), 'HH:mm')}
                  </>
                )}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
