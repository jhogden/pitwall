export type Pt = { x: number; y: number }

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pathFromPoints(points: Pt[]): string {
  if (!points.length) return ''
  return `M ${points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`
}

export function generateTrackPoints(
  seedText: string,
  options: {
    centerX?: number
    centerY?: number
    baseRadius?: number
    count?: number
  } = {}
): Pt[] {
  const {
    centerX = 500,
    centerY = 280,
    baseRadius = 185,
    count = 280,
  } = options

  const rand = mulberry32(hashString(seedText || 'pitwall'))
  const a1 = 2 + rand() * 1.8
  const a2 = 4 + rand() * 2.2
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  const p3 = rand() * Math.PI * 2
  const baseR = baseRadius + rand() * (baseRadius * 0.19)
  const squash = 0.52 + rand() * 0.18

  const rVariation = baseRadius * 0.19
  const wobbleScale = baseRadius * 0.12

  const points: Pt[] = []
  for (let i = 0; i <= count; i += 1) {
    const t = (i / count) * Math.PI * 2
    const r = baseR + rVariation * Math.sin(a1 * t + p1) + (rVariation * 0.63) * Math.sin(a2 * t + p2)
    const wobble = wobbleScale * Math.sin(3 * t + p3)
    points.push({
      x: centerX + r * Math.cos(t) + wobble,
      y: centerY + r * squash * Math.sin(t) - wobble * 0.25,
    })
  }
  return points
}

export function parseTrackGeometry(
  json: string,
  viewBox: { width: number; height: number; padding: number }
): Pt[] {
  const { x, y, rotation } = JSON.parse(json) as {
    x: number[]
    y: number[]
    rotation: number
  }

  if (!x || !y || x.length === 0 || x.length !== y.length) return []

  // Compute centroid
  let cx = 0
  let cy = 0
  for (let i = 0; i < x.length; i += 1) {
    cx += x[i]
    cy += y[i]
  }
  cx /= x.length
  cy /= y.length

  // Apply rotation around centroid
  const rad = ((rotation || 0) * Math.PI) / 180
  const cosR = Math.cos(rad)
  const sinR = Math.sin(rad)

  const rotated: Pt[] = []
  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i] - cx
    const dy = y[i] - cy
    rotated.push({
      x: dx * cosR - dy * sinR,
      y: dx * sinR + dy * cosR,
    })
  }

  // Find bounding box of rotated points
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const pt of rotated) {
    if (pt.x < minX) minX = pt.x
    if (pt.x > maxX) maxX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.y > maxY) maxY = pt.y
  }

  const rawW = maxX - minX || 1
  const rawH = maxY - minY || 1
  const availW = viewBox.width - viewBox.padding * 2
  const availH = viewBox.height - viewBox.padding * 2
  const scale = Math.min(availW / rawW, availH / rawH)

  const offsetX = viewBox.padding + (availW - rawW * scale) / 2
  const offsetY = viewBox.padding + (availH - rawH * scale) / 2

  // Flip Y axis: Multiviewer uses Y-up, SVG uses Y-down
  return rotated.map(pt => ({
    x: (pt.x - minX) * scale + offsetX,
    y: (maxY - pt.y) * scale + offsetY,
  }))
}
