'use client'

import { useEffect, useRef, useState } from 'react'
import { useMessenger } from '@/store/messenger'
import { fmtDuration } from '@/lib/format'
import { playRingback, playRingtone, playCallEnd } from '@/lib/sound'
import Avatar from './Avatar'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, PhoneOff, Phone } from 'lucide-react'
import type { CallEngine } from '@/lib/webrtc'

export default function CallOverlay({ callEngine }: { callEngine: React.RefObject<CallEngine | null> }) {
  const call = useMessenger((s) => s.call)
  const [seconds, setSeconds] = useState(0)
  const ringTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ring sounds */
  useEffect(() => {
    if (ringTimer.current) clearInterval(ringTimer.current)
    if (call?.status === 'incoming') {
      playRingtone()
      ringTimer.current = setInterval(playRingtone, 2200)
    } else if (call?.status === 'outgoing') {
      playRingback()
      ringTimer.current = setInterval(playRingback, 3000)
    }
    return () => {
      if (ringTimer.current) clearInterval(ringTimer.current)
    }
  }, [call?.status])

  /* active duration ticker */
  useEffect(() => {
    if (call?.status !== 'active') return
    const t = setInterval(() => {
      if (call.startedAt) setSeconds(Math.floor((Date.now() - call.startedAt) / 1000))
      else setSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [call?.status, call?.startedAt])

  /* end sound */
  const prevStatus = useRef<string | null>(null)
  useEffect(() => {
    if (prevStatus.current && prevStatus.current !== 'active' && !call) playCallEnd()
    prevStatus.current = call?.status || null
  }, [call])

  if (!call) return null

  const engine = callEngine.current
  const isRinging = call.status === 'incoming' || call.status === 'outgoing'

  return (
    <>
      {/* mini panel for outgoing/active — bottom corner */}
      {call.status !== 'incoming' && (
        <div className="fixed bottom-4 start-4 z-50 w-72 rounded-2xl bg-card border shadow-2xl overflow-hidden">
          <div className="bg-brand/10 px-4 py-3 flex items-center gap-3">
            <Avatar name={call.peer.displayName} avatar={call.peer.avatar} size={44} ring={isRinging} className={isRinging ? 'ring-pulse rounded-full' : ''} />
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate text-sm">{call.peer.displayName}</p>
              <p className="text-xs text-brand font-medium" dir="ltr">
                {call.status === 'outgoing' ? 'در حال زنگ زدن…' : fmtDuration(seconds)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 p-4">
            <Button
              onClick={() => engine?.toggleMute()}
              variant="outline"
              size="icon"
              className={call.muted ? 'w-12 h-12 rounded-full border-destructive text-destructive' : 'w-12 h-12 rounded-full'}
              aria-label={call.muted ? 'روشن کردن میکروفون' : 'بی‌صدا'}
            >
              {call.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              onClick={() => engine?.hangup()}
              size="icon"
              className="w-12 h-12 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/30"
              aria-label="پایان تماس"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* incoming call modal */}
      {call.status === 'incoming' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl shadow-2xl border p-8 w-full max-w-sm flex flex-col items-center gap-4 text-center">
            <Avatar name={call.peer.displayName} avatar={call.peer.avatar} size={110} className="ring-pulse rounded-full" ring />
            <div>
              <p className="text-lg font-bold">{call.peer.displayName}</p>
              <p className="text-sm text-muted-foreground mt-1">تماس صوتی ورودی…</p>
            </div>
            <div className="flex items-center gap-8 mt-4">
              <button
                onClick={() => engine?.reject()}
                className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:scale-105 transition"
                aria-label="رد تماس"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <button
                onClick={() => engine?.accept()}
                className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition ring-pulse"
                aria-label="پذیرش تماس"
              >
                <Phone className="w-7 h-7" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
