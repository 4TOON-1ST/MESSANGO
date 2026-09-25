'use client'

import { useEffect, useRef, useState } from 'react'
import { useMessenger, messagePreviewText } from '@/store/messenger'
import { api } from '@/lib/api'
import { fmtChatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import Avatar from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  Settings,
  LogOut,
  ShieldCheck,
  Moon,
  Sun,
  X,
  MessageSquare,
  Volume2,
} from 'lucide-react'
import type { Conversation, UserBrief } from '@/lib/types'

type SearchResults = {
  users: UserBrief[]
  chats: { id: string; type: string; name: string | null }[]
  messages: { id: string; content: string; createdAt: string; sender: { displayName: string } | null; conversation: { id: string; type: string; name: string | null } }[]
}

export default function Sidebar() {
  const me = useMessenger((s) => s.me)!
  const conversations = useMessenger((s) => s.conversations)
  const activeConvId = useMessenger((s) => s.activeConvId)
  const onlineIds = useMessenger((s) => s.onlineIds)
  const typing = useMessenger((s) => s.typing)
  const voiceCounts = useMessenger((s) => s.voiceCounts)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)

  /* debounced global search */
  useEffect(() => {
    const q = query.trim()
    const t = setTimeout(() => {
      if (!q) {
        setResults(null)
        setSearching(false)
        return
      }
      setSearching(true)
      api
        .get<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`)
        .then(setResults)
        .catch(() => setResults(null))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const openConv = (id: string) => {
    useMessenger.getState().setActiveConv(id)
    setQuery('')
  }

  const startDm = async (userId: string) => {
    try {
      const { conversation } = await api.post<{ conversation: Conversation }>('/api/conversations', {
        type: 'dm',
        userId,
      })
      useMessenger.getState().upsertConversation(conversation)
      openConv(conversation.id)
    } catch { /* noop */ }
  }

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch { /* noop */ }
    localStorage.removeItem('mtoken')
    useMessenger.getState().reset()
    useMessenger.getState().setAuthStatus('guest')
  }

  const isTypingIn = (convId: string) => {
    const t = typing[convId] || {}
    const names = Object.values(t).filter((x) => Date.now() - x.at < 5000)
    return names.length ? names.map((n) => n.name).join('، ') : null
  }

  return (
    <>
      {/* header */}
      <div className="p-2.5 flex items-center gap-2 border-b bg-sidebar">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="منو حساب">
              <Avatar name={me.displayName} avatar={me.avatar} size={42} online />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar name={me.displayName} avatar={me.avatar} size={40} />
                <div className="min-w-0">
                  <p className="font-bold truncate">{me.displayName}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">@{me.username}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => useMessenger.getState().setProfileOpen(true)}>
              <Settings className="w-4 h-4" /> تنظیمات و پروفایل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              <span className="flex items-center gap-2">
                <Sun className="w-4 h-4 hidden dark:block" />
                <Moon className="w-4 h-4 dark:hidden" />
                تغییر تم {''}
                <span className="text-xs text-muted-foreground">(روشن/تیره)</span>
              </span>
            </DropdownMenuItem>
            {me.isAdmin && (
              <DropdownMenuItem onClick={() => useMessenger.getState().setAdminOpen(true)}>
                <ShieldCheck className="w-4 h-4 text-brand" /> پنل مدیریت
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4" /> خروج از حساب
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در پیام‌رسان…"
            className="ps-9 pe-8 h-10 rounded-full bg-background"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute top-1/2 -translate-y-1/2 end-2 text-muted-foreground hover:text-foreground"
              aria-label="پاک کردن جستجو"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto nice-scroll">
        {query.trim() ? (
          <div className="p-2 space-y-4">
            {searching && !results && <p className="text-center text-xs text-muted-foreground py-4">در حال جستجو…</p>}
            {/* chats */}
            {results?.chats.length ? (
              <section>
                <p className="text-xs font-bold text-muted-foreground px-2 mb-1">گروه‌ها</p>
                {results.chats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConv(c.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent text-start"
                  >
                    <Avatar name={c.name || 'G'} size={40} />
                    <span className="font-medium truncate">{c.name}</span>
                  </button>
                ))}
              </section>
            ) : null}
            {/* users */}
            {results?.users.length ? (
              <section>
                <p className="text-xs font-bold text-muted-foreground px-2 mb-1">کاربران</p>
                {results.users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startDm(u.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent text-start"
                  >
                    <Avatar name={u.displayName} avatar={u.avatar} size={40} online={onlineIds.includes(u.id)} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">@{u.username}</p>
                    </div>
                  </button>
                ))}
              </section>
            ) : null}
            {/* messages */}
            {results?.messages.length ? (
              <section>
                <p className="text-xs font-bold text-muted-foreground px-2 mb-1">پیام‌ها</p>
                {results.messages.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => openConv(m.conversation.id)}
                    className="w-full flex items-start gap-3 p-2 rounded-xl hover:bg-accent text-start"
                  >
                    <MessageSquare className="w-5 h-5 text-brand mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {m.sender?.displayName || 'کاربر'}{' '}
                        <span className="text-xs text-muted-foreground">
                          در {m.conversation.type === 'group' ? m.conversation.name : 'گفتگوی خصوصی'}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{m.content}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{fmtChatTime(m.createdAt)}</span>
                  </button>
                ))}
              </section>
            ) : null}
            {!searching && results && !results.users.length && !results.chats.length && !results.messages.length && (
              <p className="text-center text-sm text-muted-foreground py-8">نتیجه‌ای یافت نشد</p>
            )}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
              <Plus className="w-8 h-8 text-brand" />
            </div>
            <p className="font-bold">هنوز گفتگویی ندارید</p>
            <p className="text-sm text-muted-foreground leading-6">
              دکمه «چت جدید» را بزنید و با دوستانتان گفتگو را شروع کنید
            </p>
          </div>
        ) : (
          conversations.map((c) => {
            const other = c.participants.find((p) => p.id !== me.id)
            const isActive = c.id === activeConvId
            const typingNames = isTypingIn(c.id)
            const lm = c.lastMessage
            return (
              <button
                key={c.id}
                onClick={() => openConv(c.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors',
                  isActive ? 'bg-brand text-white' : 'hover:bg-accent'
                )}
              >
                <Avatar
                  name={c.type === 'group' ? c.name || 'G' : other?.displayName || '?'}
                  avatar={c.avatar || (c.type === 'dm' ? other?.avatar : null)}
                  size={52}
                  online={c.type === 'dm' && other ? onlineIds.includes(other.id) : undefined}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('font-bold truncate text-[15px]', isActive ? 'text-white' : '')}>
                      {c.type === 'group' ? c.name : other?.displayName}
                    </p>
                    <span className={cn('text-[11px] shrink-0', isActive ? 'text-white/70' : 'text-muted-foreground')}>
                      {lm ? fmtChatTime(lm.createdAt) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={cn('text-[13px] truncate', isActive ? 'text-white/80' : 'text-muted-foreground')}>
                      {typingNames ? (
                        <span className={isActive ? 'text-white' : 'text-brand'}>{typingNames} در حال نوشتن…</span>
                      ) : lm ? (
                        <>
                          {c.type === 'group' && lm.senderId && lm.type !== 'system' && (
                            <span className={isActive ? 'text-white/90' : ''}>
                              {lm.senderId === me.id ? 'شما: ' : `${lm.senderName}: `}
                            </span>
                          )}
                          {lm.senderId === me.id && c.type === 'dm' && <span>شما: </span>}
                          {messagePreviewText(lm)}
                        </>
                      ) : (
                        'شروع گفتگو…'
                      )}
                    </p>
                    {c.type === 'group' && (voiceCounts[c.id] || 0) > 0 && (
                      <span
                        className={cn(
                          'flex items-center gap-0.5 text-[11px] font-bold shrink-0',
                          isActive ? 'text-white' : 'text-brand'
                        )}
                        title="تماس صوتی گروهی فعال است"
                      >
                        <Volume2 className="w-4 h-4 animate-pulse" />
                        {voiceCounts[c.id].toLocaleString('fa-IR')}
                      </span>
                    )}
                    {c.unreadCount > 0 && (
                      <span
                        className={cn(
                          'min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0',
                          isActive ? 'bg-white text-brand' : 'bg-brand text-white'
                        )}
                      >
                        {c.unreadCount > 99 ? '99+' : c.unreadCount.toLocaleString('fa-IR')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* new chat FAB */}
      <div className="p-3">
        <Button
          onClick={() => useMessenger.getState().setNewChatOpen(true)}
          className="w-full h-11 rounded-2xl bg-brand hover:bg-brand/90 text-white shadow-lg shadow-brand/25 gap-2"
        >
          <Plus className="w-5 h-5" />
          چت جدید
        </Button>
      </div>
    </>
  )
}
