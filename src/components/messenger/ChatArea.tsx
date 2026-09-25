'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMessenger } from '@/store/messenger'
import { api } from '@/lib/api'
import { fmtDaySeparator, fmtLastSeen } from '@/lib/format'
import { cn } from '@/lib/utils'
import Avatar from './Avatar'
import MessageBubble from './MessageBubble'
import Composer from './Composer'
import GroupVoiceBar from './GroupVoiceBar'
import { Button } from '@/components/ui/button'
import { ArrowDown, ArrowRight, Phone, PhoneOff, Info, Loader2, Volume2 } from 'lucide-react'
import type { Message } from '@/lib/types'
import type { CallEngine } from '@/lib/webrtc'
import type { GroupVoiceEngine } from '@/lib/group-voice'

export default function ChatArea({
  callEngine,
  gvEngine,
}: {
  callEngine: React.RefObject<CallEngine | null>
  gvEngine: React.RefObject<GroupVoiceEngine | null>
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <ChatAreaInner callEngine={callEngine} gvEngine={gvEngine} />
    </div>
  )
}

function ChatAreaInner({
  callEngine,
  gvEngine,
}: {
  callEngine: React.RefObject<CallEngine | null>
  gvEngine: React.RefObject<GroupVoiceEngine | null>
}) {
  const me = useMessenger((s) => s.me)!
  const activeConvId = useMessenger((s) => s.activeConvId)!
  const conversations = useMessenger((s) => s.conversations)
  const messagesMap = useMessenger((s) => s.messages)
  const hasMoreMap = useMessenger((s) => s.hasMore)
  const onlineIds = useMessenger((s) => s.onlineIds)
  const typing = useMessenger((s) => s.typing)
  const setMobileChatOpen = useMessenger((s) => s.setMobileChatOpen)
  const setInfoConvId = useMessenger((s) => s.setInfoConvId)

  const conv = conversations.find((c) => c.id === activeConvId)
  const messages = messagesMap[activeConvId] || []
  const hasMore = hasMoreMap[activeConvId] || false

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [callStarting, setCallStarting] = useState(false)
  const [gvJoining, setGvJoining] = useState(false)
  const groupVoice = useMessenger((s) => s.groupVoice)
  const voiceCount = useMessenger((s) => s.voiceCounts[activeConvId] || 0)

  const other = conv?.participants.find((p) => p.id !== me.id)
  const convTyping = typing[activeConvId] || {}
  const typingNames = Object.entries(convTyping)
    .filter(([uid, t]) => uid !== me.id && Date.now() - t.at < 5000)
    .map(([, t]) => t.name)

  /* auto scroll to bottom on new messages when at bottom, or on conv switch */
  useEffect(() => {
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: messages.length > 30 ? 'auto' : 'smooth' })
    }
  }, [messages.length, activeConvId])

  /* force scroll on conversation change */
  useEffect(() => {
    setAtBottom(true)
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView())
  }, [activeConvId])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    setAtBottom(near)
  }

  const loadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return
    setLoadingMore(true)
    const el = scrollRef.current
    const prevHeight = el?.scrollHeight || 0
    try {
      const oldest = messages[0]
      const { messages: older, hasMore: hm } = await api.get<{ messages: Message[]; hasMore: boolean }>(
        `/api/conversations/${activeConvId}/messages?before=${encodeURIComponent(oldest.createdAt)}`
      )
      useMessenger.getState().prependMessages(activeConvId, older)
      useMessenger.getState().setHasMore(activeConvId, hm)
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight
      })
    } catch { /* noop */ } finally {
      setLoadingMore(false)
    }
  }

  const scrollToMessage = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const startCall = async () => {
    if (!other || !callEngine.current || callStarting) return
    setCallStarting(true)
    try {
      await callEngine.current.startCall(
        { id: other.id, username: other.username, displayName: other.displayName, avatar: other.avatar },
        conv!.id
      )
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setCallStarting(false)
    }
  }

  const toggleGroupVoice = async () => {
    if (!gvEngine.current || gvJoining) return
    if (groupVoice?.convId === activeConvId) {
      gvEngine.current.leave()
      return
    }
    setGvJoining(true)
    try {
      await gvEngine.current.join({ id: activeConvId })
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setGvJoining(false)
    }
  }

  /* grouped date separators */
  const rendered = useMemo(() => {
    const out: React.ReactNode[] = []
    let lastDay = ''
    let prev: Message | null = null
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString()
      if (day !== lastDay) {
        lastDay = day
        out.push(
          <div key={`sep-${day}`} className="flex justify-center my-3">
            <span className="text-xs bg-card border shadow-sm rounded-full px-3.5 py-1.5 text-muted-foreground">
              {fmtDaySeparator(m.createdAt)}
            </span>
          </div>
        )
        prev = null
      }
      const showAvatar = !prev || prev.senderId !== m.senderId || prev.type === 'system'
      out.push(<MessageBubble key={m.id} message={m} conv={conv!} showAvatar={showAvatar} onReplyClick={scrollToMessage} />)
      prev = m
    }
    return out
  }, [messages, conv])

  if (!conv) return null

  const isOnline = other && onlineIds.includes(other.id)
  const gvActive = conv.type === 'group' && voiceCount > 0
  const statusLine = typingNames.length
    ? `${typingNames.join('، ')} در حال نوشتن…`
    : gvActive
      ? `تماس گروهی فعال · ${voiceCount.toLocaleString('fa-IR')} نفر`
      : conv.type === 'group'
        ? `${conv.participants.length.toLocaleString('fa-IR')} عضو`
        : isOnline
          ? 'آنلاین'
          : fmtLastSeen(other?.lastSeen)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* header */}
      <div className="h-16 shrink-0 border-b bg-sidebar flex items-center gap-3 px-3 sm:px-4">
        <button
          onClick={() => setMobileChatOpen(false)}
          className="md:hidden text-muted-foreground hover:text-foreground"
          aria-label="بازگشت"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <button
          className="flex items-center gap-3 flex-1 min-w-0 text-start"
          onClick={() => setInfoConvId(conv.id)}
        >
          <Avatar
            name={conv.type === 'group' ? conv.name || 'G' : other?.displayName || '?'}
            avatar={conv.type === 'group' ? conv.avatar : other?.avatar}
            size={42}
            online={conv.type === 'dm' ? isOnline : undefined}
          />
          <div className="min-w-0">
            <p className="font-bold truncate">{conv.type === 'group' ? conv.name : other?.displayName}</p>
            <p className={cn('text-xs truncate', typingNames.length || gvActive ? 'text-brand font-medium' : 'text-muted-foreground')}>
              {statusLine}
            </p>
          </div>
        </button>
        {conv.type === 'dm' && other && (
          <Button
            onClick={startCall}
            size="icon"
            variant="ghost"
            className="text-brand hover:text-brand hover:bg-brand/10 rounded-full w-10 h-10"
            aria-label="تماس صوتی"
            disabled={callStarting}
          >
            {callStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
          </Button>
        )}
        {conv.type === 'group' && (
          <Button
            onClick={toggleGroupVoice}
            size="icon"
            variant="ghost"
            className={cn(
              'rounded-full w-10 h-10',
              groupVoice?.convId === activeConvId
                ? 'bg-brand text-white hover:bg-brand/90'
                : 'text-brand hover:text-brand hover:bg-brand/10'
            )}
            aria-label={groupVoice?.convId === activeConvId ? 'خروج از تماس گروهی' : 'تماس صوتی گروهی'}
            title={groupVoice?.convId === activeConvId ? 'خروج از تماس گروهی' : 'تماس صوتی گروهی'}
            disabled={gvJoining}
          >
            {gvJoining ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : groupVoice?.convId === activeConvId ? (
              <PhoneOff className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>
        )}
        <Button
          onClick={() => setInfoConvId(conv.id)}
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground rounded-full w-10 h-10"
          aria-label="اطلاعات"
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>

      {/* group voice bar */}
      {conv.type === 'group' && <GroupVoiceBar gvEngine={gvEngine} convId={conv.id} />}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto nice-scroll chat-bg px-2 sm:px-6 py-4">
        {hasMore && (
          <div className="flex justify-center mb-3">
            <Button onClick={loadMore} variant="outline" size="sm" className="rounded-full gap-2 bg-card/80" disabled={loadingMore}>
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4 rotate-180" />}
              پیام‌های قدیمی‌تر
            </Button>
          </div>
        )}
        <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
          {messages.length === 0 && (
            <div className="flex justify-center py-10">
              <span className="text-sm bg-card/90 border shadow-sm rounded-full px-4 py-2 text-muted-foreground">
                هیچ پیامی نیست — اولین پیام را بفرستید 👋
              </span>
            </div>
          )}
          {rendered}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* scroll to bottom */}
      {!atBottom && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            setAtBottom(true)
          }}
          className="absolute bottom-24 left-6 w-10 h-10 rounded-full bg-card border shadow-lg flex items-center justify-center text-muted-foreground hover:text-brand z-20"
          aria-label="برو به پایین"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      {/* composer */}
      <Composer convId={activeConvId} />
    </div>
  )
}
