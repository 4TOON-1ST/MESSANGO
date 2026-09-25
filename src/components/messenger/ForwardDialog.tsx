'use client'

import { useMessenger } from '@/store/messenger'
import { getExistingSocket } from '@/lib/socket'
import Avatar from './Avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Forward } from 'lucide-react'

export default function ForwardDialog() {
  const message = useMessenger((s) => s.forwardMessage)
  const setMessage = useMessenger((s) => s.setForwardMessage)
  const conversations = useMessenger((s) => s.conversations)
  const me = useMessenger((s) => s.me)!
  const setActiveConv = useMessenger((s) => s.setActiveConv)

  if (!message) return <Dialog open={false} onOpenChange={() => {}} />

  const forward = (convId: string) => {
    const socket = getExistingSocket()
    socket?.emit('msg:send', {
      convId,
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: message.type === 'system' ? 'text' : message.type,
      content: message.content,
      mediaUrl: message.mediaUrl,
      mediaName: message.mediaName,
      mediaSize: message.mediaSize,
      mediaDuration: message.mediaDuration,
      mediaPeaks: message.mediaPeaks,
      replyToId: null,
    })
    setMessage(null)
    setActiveConv(convId)
    import('@/hooks/use-toast').then(({ toast }) => toast({ description: 'پیام فوروارد شد' }))
  }

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && setMessage(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="w-5 h-5 text-brand" /> فوروارد پیام
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto nice-scroll space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">گفتگویی موجود نیست</p>
          )}
          {conversations.map((c) => {
            const other = c.participants.find((p) => p.id !== me.id)
            return (
              <button
                key={c.id}
                onClick={() => forward(c.id)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent text-start"
              >
                <Avatar
                  name={c.type === 'group' ? c.name || 'G' : other?.displayName || '?'}
                  avatar={c.type === 'group' ? c.avatar : other?.avatar}
                  size={40}
                />
                <span className="font-medium truncate text-sm">{c.type === 'group' ? c.name : other?.displayName}</span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
