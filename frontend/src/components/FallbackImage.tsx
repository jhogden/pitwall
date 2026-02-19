'use client'

import { useMemo, useState } from 'react'

type FallbackImageProps = {
  candidates: string[]
  alt: string
  className?: string
}

export default function FallbackImage({ candidates, alt, className }: FallbackImageProps) {
  const validCandidates = useMemo(
    () => candidates.filter((value): value is string => typeof value === 'string' && value.length > 0),
    [candidates]
  )
  const [index, setIndex] = useState(0)

  if (validCandidates.length === 0 || index >= validCandidates.length) {
    return <div className={className} />
  }

  return (
    <img
      src={validCandidates[index]}
      alt={alt}
      className={className}
      onError={() => setIndex(prev => prev + 1)}
    />
  )
}
