'use client'

import { cn } from '@/lib/utils'

const COLORS = [
  ['#ff8a65', '#f4511e'],
  ['#4fc3f7', '#0288d1'],
  ['#aed581', '#689f38'],
  ['#ffba60', '#f57c00'],
  ['#9575cd', '#512da8'],
  ['#f06292', '#c2185b'],
  ['#4db6ac', '#00796b'],
  ['#7986cb', '#303f9f'],
  ['#e57373', '#d32f2f'],
  ['#a1887f', '#5d4037'],
]

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function Avatar({
  name,
  avatar,
  size = 48,
  online,
  className,
  ring = false,
}: {
  name: string
  avatar?: string | null
  size?: number
  online?: boolean
  className?: string
  ring?: boolean
}) {
  const [c1, c2] = COLORS[hashName(name || '?') % COLORS.length]
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className={cn(
            'w-full h-full rounded-full object-cover bg-muted',
            ring && 'ring-2 ring-brand/60'
          )}
          draggable={false}
        />
      ) : (
        <div
          className={cn('w-full h-full rounded-full flex items-center justify-center text-white font-bold select-none', ring && 'ring-2 ring-brand/60')}
          style={{
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            fontSize: size * 0.38,
          }}
        >
          {initials}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 start-0 rounded-full border-2 border-background bg-green-500"
          style={{ width: Math.max(10, size * 0.24), height: Math.max(10, size * 0.24) }}
          title="آنلاین"
        />
      )}
    </div>
  )
}
