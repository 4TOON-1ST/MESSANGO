'use client'

/**
 * GroupVoiceBar — نوار تماس صوتی گروهی
 *
 * داخل چت گروه نمایش داده می‌شود:
 *  - اگر تماس گروهی در گروه فعال باشد (حتی وقتی من عضو تماس نیستم) → نوار دیده می‌شود
 *  - اگر من عضو تماس باشم → چیدن آواتار مشارکت‌کنندگان + کنترل میکروفون و خروج
 *  - اگر عضو نیستم → دکمه «پیوستن به تماس»
 */

import { useEffect, useState } from 'react'
import { useMessenger } from '@/store/messenger'
import { fmtDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import Avatar from './Avatar'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, PhoneOff, Phone, Volume2, Loader2 } from 'lucide-react'
import type { GroupVoiceEngine } from '@/lib/group-voice'

export default function GroupVoiceBar({
  gvEngine,
  convId,
}: {
  gvEngine: React.RefObject<GroupVoiceEngine | null>
  convId: string
}) {
  const me = useMessenger((s) => s.me)!
  const groupVoice = useMessenger((s) => s.groupVoice)
  const voiceCount = useMessenger((s) => s.voiceCounts[convId] || 0)
  const [seconds, setSeconds] = useState(0)
  const [joining, setJoining] = useState(false)

  const isActiveHere = groupVoice?.convId === convId

  /* call duration ticker */
  useEffect(() => {
    if (!isActiveHere) {
      setSeconds(0)
      return
    }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [isActiveHere])

  /* nothing to show when the call is dead */
  if (!isActiveHere && voiceCount === 0) return null

  const join = async () => {
    if (!gvEngine.current || joining) return
    setJoining(true)
    try {
      await gvEngine.current.join({ id: convId })
    } finally {
      setJoining(false)
    }
  }

  const leave = () => gvEngine.current?.leave()
  const toggleMute = () => gvEngine.current?.toggleMute()

  const participants = groupVoice?.participants || []
  const shown = participants.slice(0, 6)
  const extra = participants.length - shown.length

  return (
    <div
      className={cn(
        'shrink-0 z-10 flex items-center gap-3 px-3 sm:px-4 py-2 border-b bg-card',
        isActiveHere && 'bg-brand/[0.07] dark:bg-brand/10'
      )}
      role="status"
      aria-label="تماس صوتی گروهی"
    >
      <span
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
          isActiveHere ? 'bg-brand text-white' : 'bg-brand/15 text-brand'
        )}
      >
        <Volume2 className={cn('w-5 h-5', isActiveHere && 'animate-pulse')} />
      </span>

      <div className="min-w-0 flex-1">
        {isActiveHere ? (
          <>
            <p className="text-sm font-bold leading-5">
              تماس گروهی
              <span className="ms-2 text-xs font-medium text-brand" dir="ltr">{fmtDuration(seconds)}</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {participants.length.toLocaleString('fa-IR')} نفر در تماس
              {groupVoice?.muted ? ' · میکروفون خاموش' : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold leading-5">تماس صوتی گروهی فعال است</p>
            <p className="text-xs text-muted-foreground">
              {voiceCount.toLocaleString('fa-IR')} نفر در حال گفتگو
            </p>
          </>
        )}
      </div>

      {/* participants stack */}
      {isActiveHere && (
        <div className="hidden sm:flex items-center -space-x-2 rtl:space-x-reverse">
          {shown.map((p) => (
            <span key={p.socketId} className="relative" title={p.displayName + (p.muted ? ' (بی‌صدا)' : '')}>
              <Avatar
                name={p.displayName}
                avatar={p.avatar}
                size={30}
                className={cn('border-2 border-card', p.muted && 'opacity-60')}
              />
              {p.muted && (
                <MicOff className="absolute -bottom-0.5 -end-0.5 w-3 h-3 text-destructive bg-card rounded-full p-px" />
              )}
            </span>
          ))}
          {extra > 0 && (
            <span className="w-[30px] h-[30px] rounded-full border-2 border-card bg-muted text-[10px] font-bold flex items-center justify-center text-muted-foreground">
              +{extra.toLocaleString('fa-IR')}
            </span>
          )}
        </div>
      )}

      {isActiveHere ? (
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleMute}
            size="icon"
            variant="outline"
            className={cn(
              'w-10 h-10 rounded-full',
              groupVoice?.muted && 'border-destructive text-destructive'
            )}
            aria-label={groupVoice?.muted ? 'روشن کردن میکروفون' : 'بی‌صدا کردن میکروفون'}
            title={groupVoice?.muted ? 'روشن کردن میکروفون' : 'بی‌صدا کردن میکروفون'}
          >
            {groupVoice?.muted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
          </Button>
          <Button
            onClick={leave}
            size="icon"
            className="w-10 h-10 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/25"
            aria-label="خروج از تماس گروهی"
            title="خروج از تماس"
          >
            <PhoneOff className="w-4.5 h-4.5" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={join}
          disabled={joining}
          className="rounded-full bg-brand hover:bg-brand/90 text-white gap-1.5 h-9 px-4"
        >
          {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
          پیوستن
        </Button>
      )}
    </div>
  )
}
