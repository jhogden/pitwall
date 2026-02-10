interface SeriesBadgeProps {
  name: string
  color: string
  size?: 'sm' | 'md'
}

export default function SeriesBadge({ name, color, size = 'md' }: SeriesBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-xs px-2 py-0.5 gap-1.5'

  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide uppercase ${sizeClasses}`}
      style={{
        backgroundColor: `${color}26`,
        color: color,
      }}
    >
      <span
        className={`${dotSize} rounded-full shrink-0`}
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  )
}
