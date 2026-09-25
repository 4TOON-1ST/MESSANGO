'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { fmtDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const BARS = 32

export default function VoicePlayer({
  url,
  duration = 0,
  peaks,
  mine,
}: {
  url: string
  duration?: number
  peaks?: string | null
  mine?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [realDuration, setRealDuration] = useState(duration)

  const bars = (peaks ? peaks.split('').slice(0, BARS) : Array.from({ length: BARS }, () => '5')).map((v) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n > 0 ? n : 5
  })
  while (bars.length < BARS) bars.push(5)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      const d = el.duration
      if (Number.isFinite(d) && d > 0) {
        setProgress(el.currentTime / d)
        if (!realDuration || Math.abs(d - realDuration) > 1) setRealDuration(Math.round(d))
      }
    }
    const onEnd = () => {
      setPlaying(false)
      setProgress(0)
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnd)
    }
  }, [realDuration])

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    /* RTL aware: bars render right-to-left, but audio is LTR — map visually */
    const ratio = (e.clientX - rect.left) / rect.width
    if (Number.isFinite(el.duration)) el.currentTime = Math.max(0, Math.min(1, 1 - ratio)) * el.duration
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] sm:min-w-[260px]" dir="ltr">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95',
          mine ? 'bg-brand text-white' : 'bg-brand text-white'
        )}
        aria-label={playing ? 'توقف' : 'پخش'}
      >
        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-[1px]" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-7 cursor-pointer" onClick={seek}>
          {bars.map((b, i) => {
            const played = i / BARS <= progress
            return (
              <span
                key={i}
                className={cn(
                  'flex-1 rounded-full transition-colors',
                  played ? (mine ? 'bg-brand' : 'bg-brand') : mine ? 'bg-foreground/25' : 'bg-foreground/25'
                )}
                style={{ height: `${Math.max(18, (b / 9) * 100)}%` }}
              />
            )
          })}
        </div>
        <span className="text-[11px] text-muted-foreground/90 leading-none">
          {fmtDuration(progress > 0 ? (realDuration || duration) * progress : realDuration || duration)}
        </span>
      </div>
    </div>
  )
}
