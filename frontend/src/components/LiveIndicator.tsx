interface LiveIndicatorProps {
  size?: 'sm' | 'md'
}

export default function LiveIndicator({ size = 'sm' }: LiveIndicatorProps) {
  const dotSize = size === 'md' ? 'h-3 w-3' : 'h-2 w-2'

  return (
    <span className={`relative flex ${dotSize}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75`} />
      <span className={`relative inline-flex rounded-full ${dotSize} bg-green-500`} />
    </span>
  )
}
