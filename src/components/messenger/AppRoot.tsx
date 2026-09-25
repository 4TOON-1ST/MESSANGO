'use client'

import { useEffect, useRef } from 'react'
import { useMessenger } from '@/store/messenger'
import { getSocket, destroySocket } from '@/lib/socket'
import { api } from '@/lib/api'
import CallEngine from '@/lib/webrtc'
import GroupVoiceEngine from '@/lib/group-voice'
import { playMessageSound } from '@/lib/sound'
import type { Conversation, Me, Message } from '@/lib/types'
import AuthScreen from './AuthScreen'
import Messenger from './Messenger'
import BannedScreen from './BannedScreen'

export const ACCENTS = [
  { name: 'آبی تلگرام', value: '#3390ec' },
  { name: 'سبز', value: '#00b86b' },
  { name: 'بنفش', value: '#8774e1' },
  { name: 'نارنجی', value: '#f28b30' },
  { name: 'صورتی', value: '#e8528e' },
  { name: 'فیروزه‌ای', value: '#00a8a8' },
]

export function applyAccent(value: string) {
  document.documentElement.style.setProperty('--brand', value)
}

export default function AppRoot() {
  const authStatus = useMessenger((s) => s.authStatus)
  const banned = useMessenger((s) => s.banned)
  const engineRef = useRef<CallEngine | null>(null)
  const gvEngineRef = useRef<GroupVoiceEngine | null>(null)

  /* ---------- theme & accent boot ---------- */
  useEffect(() => {
    const accent = localStorage.getItem('accent') || ACCENTS[0].value
    applyAccent(accent)
    const theme = localStorage.getItem('theme')
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  /* ---------- auth boot ---------- */
  useEffect(() => {
    ;(async () => {
      try {
        const { user } = await api.get<{ user: Me }>('/api/auth/me')
        const token =
          localStorage.getItem('mtoken') ||
          document.cookie.match(/mtoken_c=([^;]+)/)?.[1] ||
          ''
        localStorage.setItem('mtoken', token)
        useMessenger.getState().setMe(user)
        useMessenger.getState().setToken(token)
        useMessenger.getState().setAuthStatus('authed')
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission()
        }
      } catch {
        localStorage.removeItem('mtoken')
        useMessenger.getState().setAuthStatus('guest')
      }
    })()
  }, [])

  /* ---------- socket lifecycle ---------- */
  useEffect(() => {
    if (authStatus !== 'authed') return
    const token = useMessenger.getState().token
    if (!token) return

    const socket = getSocket(token)

    /* --- call engine (1:1 voice calls) --- */
    if (!engineRef.current) {
      engineRef.current = new CallEngine({
        onStateChange: (s) => useMessenger.getState().setCall(s),
        onToast: (msg) => {
          import('@/hooks/use-toast').then(({ toast }) => toast({ description: msg }))
        },
        /* busy when a group voice call is running */
        isBusy: () => !!useMessenger.getState().groupVoice,
      })
    }
    engineRef.current.bindSocket(socket)

    /* --- group voice engine (WebRTC mesh) --- */
    if (!gvEngineRef.current) {
      gvEngineRef.current = new GroupVoiceEngine({
        onToast: (msg) => {
          import('@/hooks/use-toast').then(({ toast }) => toast({ description: msg }))
        },
      })
    }
    gvEngineRef.current.bindSocket(socket)

    const loadConversations = async () => {
      try {
        const { conversations } = await api.get<{ conversations: Conversation[] }>('/api/conversations')
        useMessenger.getState().setConversations(conversations)
      } catch { /* noop */ }
    }
    loadConversations()

    const markRead = (convId: string) => {
      api.post(`/api/conversations/${convId}/read`).then(() => {
        const st = useMessenger.getState()
        st.patchConversation(convId, { unreadCount: 0 })
        const conv = st.conversations.find((c) => c.id === convId)
        const myId = st.me?.id
        if (conv && myId) {
          st.upsertConversation({
            ...conv,
            participants: conv.participants.map((p) => (p.id === myId ? { ...p, lastReadAt: new Date().toISOString() } : p)),
          })
        }
      }).catch(() => {})
    }

    const notifyMessage = (m: Message) => {
      const st = useMessenger.getState()
      const isActive = st.activeConvId === m.conversationId && !document.hidden
      const senderName = m.type === 'system' ? 'اطلاعیه' : m.sender?.displayName || 'پیام جدید'
      const body = m.type === 'text' ? m.content || '' : m.type === 'image' ? '🖼 عکس' : m.type === 'voice' ? '🎤 پیام صوتی' : '📎 فایل'

      if (!isActive) {
        if (localStorage.getItem('sound') !== 'off') playMessageSound()
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          try {
            new Notification(senderName, { body, icon: '/icon.svg' })
          } catch { /* noop */ }
        }
      } else if (st.activeConvId === m.conversationId) {
        markRead(m.conversationId)
      }
    }

    socket.on('connect', () => {
      /* re-sync presence + conversations after reconnect */
      loadConversations()
      /* re-join the active group voice room under the new socket id */
      gvEngineRef.current?.rejoin()
    })

    socket.on('gv:update', ({ convId, count }: { convId: string; count: number }) => {
      useMessenger.getState().setVoiceCount(convId, count)
    })

    socket.on('presence:list', ({ userIds }: { userIds: string[] }) => {
      useMessenger.getState().setOnlineIds(userIds)
    })

    socket.on('presence', ({ userId, online, lastSeen }: { userId: string; online: boolean; lastSeen?: string }) => {
      useMessenger.getState().setOnline(userId, online, lastSeen)
    })

    socket.on('msg:sent', ({ tempId, message }: { tempId: string; message: Message }) => {
      const st = useMessenger.getState()
      if (tempId) st.replaceTemp(message.conversationId, tempId, message)
      else st.addMessage(message)

      const conv = st.conversations.find((c) => c.id === message.conversationId)
      if (conv) {
        st.patchConversation(message.conversationId, {
          lastMessage: {
            id: message.id,
            type: message.type,
            content: message.content,
            mediaUrl: message.mediaUrl,
            senderId: message.senderId,
            senderName: message.sender?.displayName || '',
            createdAt: message.createdAt,
            deletedAt: message.deletedAt,
          },
        })
      }
    })

    socket.on('msg:new', ({ message }: { message: Message }) => {
      const st = useMessenger.getState()
      const exists = (st.messages[message.conversationId] || []).some((x) => x.id === message.id)
      if (!exists) st.addMessage(message)

      const conv = st.conversations.find((c) => c.id === message.conversationId)
      if (conv) {
        st.patchConversation(message.conversationId, {
          lastMessage: {
            id: message.id,
            type: message.type,
            content: message.content,
            mediaUrl: message.mediaUrl,
            senderId: message.senderId,
            senderName: message.sender?.displayName || '',
            createdAt: message.createdAt,
            deletedAt: message.deletedAt,
          },
          unreadCount: st.activeConvId === message.conversationId && !document.hidden ? 0 : conv.unreadCount + 1,
        })
      }
      notifyMessage(message)
    })

    socket.on('msg:updated', ({ message }: { message: Message }) => {
      const st = useMessenger.getState()
      st.updateMessage(message)
      const conv = st.conversations.find((c) => c.id === message.conversationId)
      if (conv?.lastMessage?.id === message.id) {
        st.patchConversation(message.conversationId, {
          lastMessage: {
            id: message.id,
            type: message.type,
            content: message.deletedAt ? 'این پیام حذف شد' : message.content,
            mediaUrl: message.deletedAt ? null : message.mediaUrl,
            senderId: message.senderId,
            senderName: message.sender?.displayName || '',
            createdAt: message.createdAt,
            deletedAt: message.deletedAt,
          },
        })
      }
    })

    socket.on('msg:read', ({ convId, userId, lastReadAt }: { convId: string; userId: string; lastReadAt: string }) => {
      const st = useMessenger.getState()
      const conv = st.conversations.find((c) => c.id === convId)
      if (conv) {
        st.upsertConversation({
          ...conv,
          participants: conv.participants.map((p) => (p.id === userId ? { ...p, lastReadAt } : p)),
        })
      }
    })

    socket.on('typing', ({ convId, userId, displayName, isTyping }: { convId: string; userId: string; displayName: string; isTyping: boolean }) => {
      useMessenger.getState().setTyping(convId, userId, displayName, isTyping)
    })

    socket.on('conversation:new', ({ conversation }: { conversation: Conversation }) => {
      useMessenger.getState().upsertConversation(conversation)
    })

    socket.on('user:updated', ({ user }: { user: Me }) => {
      const st = useMessenger.getState()
      if (st.me?.id === user.id) st.setMe({ ...st.me, ...user })
      st.setConversations(
        st.conversations.map((c) => ({
          ...c,
          name: c.type === 'dm' && c.participants.some((p) => p.id === user.id) ? user.displayName : c.name,
          avatar: c.type === 'dm' && c.participants.some((p) => p.id === user.id) ? user.avatar : c.avatar,
          participants: c.participants.map((p) => (p.id === user.id ? { ...p, ...user } : p)),
        }))
      )
      st.setMessages(
        Object.fromEntries(
          Object.entries(st.messages).map(([cid, msgs]) => [
            cid,
            msgs.map((m) => (m.sender?.id === user.id ? { ...m, sender: { ...m.sender, ...user } } : m)),
          ])
        ) as Record<string, Message[]>
      )
    })

    socket.on('account:banned', () => {
      destroySocket()
      gvEngineRef.current?.reset()
      useMessenger.getState().reset()
      useMessenger.getState().setBanned(true)
      useMessenger.getState().setAuthStatus('guest')
    })

    socket.on('account:deleted', () => {
      destroySocket()
      gvEngineRef.current?.reset()
      localStorage.removeItem('mtoken')
      useMessenger.getState().reset()
      useMessenger.getState().setAuthStatus('guest')
    })

    /* read active conversation on window focus */
    const onFocus = () => {
      const st = useMessenger.getState()
      if (st.activeConvId) markRead(st.activeConvId)
    }
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('focus', onFocus)
      socket.off('connect')
      socket.off('presence:list')
      socket.off('presence')
      socket.off('msg:sent')
      socket.off('msg:new')
      socket.off('msg:updated')
      socket.off('msg:read')
      socket.off('typing')
      socket.off('conversation:new')
      socket.off('user:updated')
      socket.off('account:banned')
      socket.off('account:deleted')
      socket.off('gv:update')
    }
  }, [authStatus])

  /* ---------- unread badge in title ---------- */
  const conversations = useMessenger((s) => s.conversations)
  useEffect(() => {
    const total = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
    document.title = total > 0 ? `(${total}) پیام‌رسان` : 'پیام‌رسان | Messango'
  }, [conversations])

  /* ---------- cleanup on logout ---------- */
  useEffect(() => {
    if (authStatus === 'guest') {
      destroySocket()
      gvEngineRef.current?.reset()
    }
  }, [authStatus])

  if (authStatus === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand/15 flex items-center justify-center">
            <svg viewBox="0 0 64 64" className="w-9 h-9 animate-pulse">
              <circle cx="32" cy="32" r="30" fill="var(--brand)" opacity="0.9" />
              <path d="M18 22.5c0-1.9 1.6-3.5 3.5-3.5h21c1.9 0 3.5 1.6 3.5 3.5v13c0 1.9-1.6 3.5-3.5 3.5H27l-6.6 5.4c-.8.7-2.4.2-2.4-1.1V22.5z" fill="#fff" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">در حال بارگذاری پیام‌رسان…</p>
        </div>
      </div>
    )
  }

  if (authStatus === 'guest') {
    return banned ? <BannedScreen /> : <AuthScreen />
  }

  return <Messenger callEngine={engineRef} gvEngine={gvEngineRef} />
}
