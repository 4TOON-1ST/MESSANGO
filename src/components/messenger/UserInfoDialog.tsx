'use client'

import { useMessenger } from '@/store/messenger'
import { fmtLastSeen } from '@/lib/format'
import Avatar from './Avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Phone } from 'lucide-react'
import type { CallEngine } from '@/lib/webrtc'

export default function UserInfoDialog({ callEngine }: { callEngine: React.RefObject<CallEngine | null> }) {
  const infoConvId = useMessenger((s) => s.infoConvId)
  const setInfoConvId = useMessenger((s) => s.setInfoConvId)
  const conversations = useMessenger((s) => s.conversations)
  const onlineIds = useMessenger((s) => s.onlineIds)
  const me = useMessenger((s) => s.me)!

  const conv = conversations.find((c) => c.id === infoConvId)
  if (!conv) return <Dialog open={false} onOpenChange={() => {}} />

  const other = conv.participants.find((p) => p.id !== me.id)
  const title = conv.type === 'group' ? conv.name || 'گروه' : other?.displayName || 'کاربر'

  return (
    <Dialog open={!!infoConvId} onOpenChange={(o) => !o && setInfoConvId(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{conv.type === 'group' ? 'اطلاعات گروه' : 'اطلاعات کاربر'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-2">
          <Avatar
            name={title}
            avatar={conv.type === 'group' ? conv.avatar : other?.avatar}
            size={88}
            online={conv.type === 'dm' && other ? onlineIds.includes(other.id) : undefined}
          />
          <p className="text-lg font-bold">{title}</p>
          {conv.type === 'dm' && other && (
            <>
              <p className="text-sm text-muted-foreground" dir="ltr">@{other.username}</p>
              <p className="text-xs text-muted-foreground">{fmtLastSeen(other.lastSeen)}</p>
              {other.bio && <p className="text-sm text-center text-foreground/80 mt-1">{other.bio}</p>}
              {other.isAdmin && <Badge className="bg-brand text-white mt-1">مدیر سیستم</Badge>}
            </>
          )}
          {conv.type === 'group' && (
            <p className="text-xs text-muted-foreground">
              {conv.participants.length.toLocaleString('fa-IR')} عضو
            </p>
          )}
        </div>

        <Separator />

        {/* members (groups) */}
        {conv.type === 'group' && (
          <div className="max-h-52 overflow-y-auto nice-scroll space-y-0.5">
            <p className="text-xs font-bold text-muted-foreground mb-1">اعضا</p>
            {conv.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-accent">
                <Avatar name={p.displayName} avatar={p.avatar} size={34} online={onlineIds.includes(p.id)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {p.displayName} {p.id === me.id && <span className="text-xs text-muted-foreground">(شما)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground" dir="ltr">@{p.username}</p>
                </div>
                {p.isAdmin && <Badge variant="secondary" className="text-[10px]">ادمین</Badge>}
              </div>
            ))}
          </div>
        )}

        {conv.type === 'dm' && other && (
          <p className="text-[11px] text-muted-foreground text-center">
            پیام‌ها و تماس‌ها بین شما و این کاربر به‌صورت رمزگذاری‌شده انتقال پیدا می‌کنند.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
