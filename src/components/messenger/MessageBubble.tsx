'use client'

import { useMessenger } from '@/store/messenger'
import { fmtTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getExistingSocket } from '@/lib/socket'
import Avatar from './Avatar'
import VoicePlayer from './VoicePlayer'
import {
  Check,
  CheckCheck,
  Clock,
  MoreVertical,
  Reply,
  Pencil,
  Trash2,
  Copy,
  Forward,
  FileText,
  Download,
  Mic,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Conversation, Message } from '@/lib/types'

export default function MessageBubble({
  message: m,
  conv,
  showAvatar,
  onReplyClick,
}: {
  message: Message
  conv: Conversation
  showAvatar: boolean
  onReplyClick: (id: string) => void
}) {
  const me = useMessenger((s) => s.me)!
  const mine = m.senderId === me.id

  if (m.type === 'system') {
    return (
      <div className="flex justify-center my-2 msg-in">
        <span className="text-xs bg-black/20 dark:bg-white/10 backdrop-blur text-white dark:text-foreground rounded-full px-3.5 py-1.5 shadow-sm">
          {m.content}
        </span>
      </div>
    )
  }

  const isDeleted = !!m.deletedAt

  /* read receipts */
  const others = conv.participants.filter((p) => p.id !== me.id)
  const isRead = others.some((p) => p.lastReadAt && new Date(p.lastReadAt) >= new Date(m.createdAt))

  const senderName = conv.type === 'group' && !mine ? m.sender?.displayName : null

  return (
    <div
      id={`msg-${m.id}`}
      className={cn('flex items-end gap-2 msg-in group', mine ? 'justify-start flex-row-reverse' : 'justify-end flex-row-reverse')}
      data-mine={mine}
    >
      {/* avatar for groups */}
      {!mine && conv.type === 'group' ? (
        showAvatar ? (
          <Avatar name={m.sender?.displayName || '?'} avatar={m.sender?.avatar} size={30} className="mb-0.5" />
        ) : (
          <div className="w-[30px] shrink-0" />
        )
      ) : null}

      <div className={cn('relative max-w-[78%] sm:max-w-[65%]', mine ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'px-2.5 py-2 shadow-sm',
            mine ? 'bubble-out' : 'bubble-in',
            isDeleted && 'opacity-70',
            m.pending && 'opacity-60'
          )}
        >
          {senderName && showAvatar && (
            <p className="text-xs font-bold text-brand mb-1">{senderName}</p>
          )}

          {/* reply quote */}
          {m.replyTo && !isDeleted && (
            <button
              onClick={() => onReplyClick(m.replyTo!.id)}
              className="w-full text-start border-s-2 border-brand bg-brand/5 rounded-md px-2.5 py-1.5 mb-1.5 hover:bg-brand/10 transition-colors"
            >
              <p className="text-xs font-bold text-brand truncate">{m.replyTo.sender?.displayName || 'کاربر'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {m.replyTo.type === 'image'
                  ? '🖼 عکس'
                  : m.replyTo.type === 'voice'
                    ? '🎤 پیام صوتی'
                    : m.replyTo.type === 'file'
                      ? '📎 فایل'
                      : m.replyTo.content || ''}
              </p>
            </button>
          )}

          {/* body */}
          {isDeleted ? (
            <p className="text-sm italic text-muted-foreground py-0.5">این پیام حذف شد</p>
          ) : m.type === 'image' && m.mediaUrl ? (
            <div className="space-y-1.5">
              <img
                src={m.mediaUrl}
                alt={m.content || 'عکس'}
                onClick={() => useMessenger.getState().setLightbox({ url: m.mediaUrl!, caption: m.content })}
                className="rounded-lg max-h-80 w-auto max-w-full object-cover cursor-pointer hover:brightness-95 transition"
                loading="lazy"
                draggable={false}
              />
              {m.content && <p className="text-sm leading-6 whitespace-pre-wrap break-words">{m.content}</p>}
            </div>
          ) : m.type === 'voice' && m.mediaUrl ? (
            <VoicePlayer url={m.mediaUrl} duration={m.mediaDuration || 0} peaks={m.mediaPeaks} mine={mine} />
          ) : m.type === 'file' && m.mediaUrl ? (
            <a
              href={m.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 min-w-[200px] py-1"
            >
              <span className="w-10 h-10 rounded-full bg-brand/15 text-brand flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{m.mediaName || 'فایل'}</span>
                <span className="block text-xs text-muted-foreground flex items-center gap-1">
                  <Download className="w-3 h-3 inline" /> دانلود
                </span>
              </span>
            </a>
          ) : (
            <p className="text-sm leading-6 whitespace-pre-wrap break-words">{m.content}</p>
          )}

          {/* footer: time + ticks */}
          <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
            {m.editedAt && !isDeleted && <span className="text-[10px] text-muted-foreground/70">ویرایش شده</span>}
            <span className="text-[10px] text-muted-foreground/80">{fmtTime(m.createdAt)}</span>
            {mine &&
              (m.pending ? (
                <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
              ) : isRead ? (
                <CheckCheck className="w-4 h-4 text-brand" />
              ) : (
                <Check className="w-3.5 h-3.5 text-muted-foreground/80" />
              ))}
          </div>
        </div>

        {/* hover actions */}
        {!isDeleted && (
          <div
            className={cn(
              'absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10',
              mine ? '-start-9' : '-end-9'
            )}
          >
            <BubbleMenu message={m} mine={mine} />
          </div>
        )}
      </div>
    </div>
  )
}

function BubbleMenu({ message: m, mine }: { message: Message; mine: boolean }) {
  const me = useMessenger((s) => s.me)!

  const canEdit = mine && m.type === 'text' && !m.deletedAt
  const canDelete = (mine || me.isAdmin) && !m.deletedAt

  const actions = [
    {
      label: 'پاسخ',
      icon: Reply,
      onClick: () => useMessenger.getState().setReplyTo(m),
    },
    {
      label: 'کپی متن',
      icon: Copy,
      show: m.type === 'text' && !!m.content,
      onClick: () => {
        navigator.clipboard?.writeText(m.content || '')
        import('@/hooks/use-toast').then(({ toast }) => toast({ description: 'متن کپی شد' }))
      },
    },
    {
      label: 'فوروارد',
      icon: Forward,
      onClick: () => useMessenger.getState().setForwardMessage(m),
    },
    {
      label: 'ویرایش',
      icon: Pencil,
      show: canEdit,
      onClick: () => {
        useMessenger.getState().setEditMessage(m)
        useMessenger.getState().setReplyTo(null)
      },
    },
    {
      label: 'حذف',
      icon: Trash2,
      danger: true,
      show: canDelete,
      onClick: () => getExistingSocket()?.emit('msg:delete', { id: m.id }),
    },
  ].filter((a) => a.show !== false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-7 h-7 rounded-full bg-card border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="عملیات پیام"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={mine ? 'start' : 'end'} className="w-40">
        {actions.map((a, i) => (
          <DropdownMenuItem
            key={i}
            onClick={a.onClick}
            className={a.danger ? 'text-destructive focus:text-destructive focus:bg-destructive/10' : ''}
          >
            <a.icon className="w-4 h-4" /> {a.label}
          </DropdownMenuItem>
        ))}
        {m.type === 'voice' && (
          <DropdownMenuItem onClick={() => useMessenger.getState().setReplyTo(m)}>
            <Mic className="w-4 h-4" /> پاسخ به ویس
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
