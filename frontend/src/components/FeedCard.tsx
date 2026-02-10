'use client'

import { Trophy, Calendar, Play, BarChart3 } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import type { FeedItem } from '@/lib/api'
import SeriesBadge from '@/components/SeriesBadge'
import Link from 'next/link'

interface FeedCardProps {
  item: FeedItem
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'race_result':
      return <Trophy size={16} className="text-amber-400" />
    case 'preview':
      return <Calendar size={16} className="text-blue-400" />
    case 'highlight':
      return <Play size={16} className="text-green-400" />
    case 'analysis':
      return <BarChart3 size={16} className="text-purple-400" />
    default:
      return null
  }
}

function relativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

export default function FeedCard({ item }: FeedCardProps) {
  const accentColor = item.seriesColor || '#6366f1'
  const isRaceResult = item.type === 'race_result'
  const isHighlight = item.type === 'highlight'

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group relative flex overflow-hidden rounded-lg bg-pitwall-surface border border-pitwall-border hover:border-pitwall-text-muted transition-all duration-200 hover:scale-[1.01]"
    >
      {/* Left accent strip */}
      <div
        className="w-1 shrink-0"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex-1 min-w-0 p-4">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          {item.seriesName && item.seriesColor && (
            <SeriesBadge name={item.seriesName} color={item.seriesColor} size="sm" />
          )}
          <span className="flex items-center gap-1 ml-auto text-xs text-pitwall-text-muted shrink-0">
            {getTypeIcon(item.type)}
            <span>{relativeTime(item.publishedAt)}</span>
          </span>
        </div>

        {/* Title */}
        <h3 className={`text-pitwall-text group-hover:text-white transition-colors line-clamp-2 mb-1.5 ${isRaceResult ? 'text-base font-bold' : 'text-sm font-semibold'}`}>
          {isRaceResult && (
            <Trophy size={14} className="inline-block mr-1.5 text-amber-400 -translate-y-px" />
          )}
          {item.title}
        </h3>

        {/* Summary */}
        <p className="text-sm text-pitwall-text-muted line-clamp-3 leading-relaxed">
          {item.summary}
        </p>
      </div>

      {/* Thumbnail for highlights */}
      {isHighlight && item.thumbnailUrl && (
        <div className="relative w-32 shrink-0 hidden sm:block">
          <img
            src={item.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-pitwall-surface/80 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={14} className="text-white ml-0.5" />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )

  if (item.contentUrl) {
    return (
      <a href={item.contentUrl} target="_blank" rel="noopener noreferrer" className="block">
        {cardContent}
      </a>
    )
  }

  if (item.eventSlug) {
    return (
      <Link href={`/events/${item.eventSlug}`} className="block">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}
