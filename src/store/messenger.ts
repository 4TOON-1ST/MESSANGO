'use client'

import { create } from 'zustand'
import type { Me, Conversation, Message, CallState, CallPeer, GroupVoiceState } from '@/lib/types'

export type AuthStatus = 'loading' | 'guest' | 'authed'

type TypingMap = Record<string, Record<string, { name: string; at: number }>>

type Store = {
  /* auth */
  authStatus: AuthStatus
  me: Me | null
  token: string | null
  banned: boolean

  /* data */
  conversations: Conversation[]
  messages: Record<string, Message[]>
  hasMore: Record<string, boolean>
  activeConvId: string | null
  onlineIds: string[]
  typing: TypingMap

  /* call */
  call: CallState | null

  /* group voice call */
  groupVoice: GroupVoiceState | null
  /* convId -> number of distinct users in an active group voice call */
  voiceCounts: Record<string, number>

  /* ui */
  adminOpen: boolean
  profileOpen: boolean
  newChatOpen: boolean
  forwardMessage: Message | null
  lightbox: { url: string; caption?: string | null } | null
  infoConvId: string | null
  replyTo: Message | null
  editMessage: Message | null
  mobileChatOpen: boolean

  setAuthStatus: (s: AuthStatus) => void
  setMe: (me: Me | null) => void
  setToken: (t: string | null) => void
  setBanned: (b: boolean) => void

  setConversations: (c: Conversation[]) => void
  upsertConversation: (c: Conversation) => void
  patchConversation: (id: string, patch: Partial<Conversation>) => void
  removeConversation?: (id: string) => void

  setActiveConv: (id: string | null) => void
  setMessages: (convId: string, msgs: Message[], hasMore?: boolean) => void
  setHasMore: (convId: string, hasMore: boolean) => void
  prependMessages: (convId: string, msgs: Message[]) => void
  addMessage: (m: Message) => void
  replaceTemp: (convId: string, tempId: string, m: Message) => void
  updateMessage: (m: Message) => void

  setOnlineIds: (ids: string[]) => void
  setOnline: (userId: string, online: boolean, lastSeen?: string | null) => void
  setTyping: (convId: string, userId: string, name: string, isTyping: boolean) => void

  setCall: (c: CallState | null) => void

  setGroupVoice: (gv: GroupVoiceState | null) => void
  setVoiceCount: (convId: string, count: number) => void

  setAdminOpen: (b: boolean) => void
  setProfileOpen: (b: boolean) => void
  setNewChatOpen: (b: boolean) => void
  setForwardMessage: (m: Message | null) => void
  setLightbox: (l: { url: string; caption?: string | null } | null) => void
  setInfoConvId: (id: string | null) => void
  setReplyTo: (m: Message | null) => void
  setEditMessage: (m: Message | null) => void
  setMobileChatOpen: (b: boolean) => void

  reset: () => void
}

const initialState = {
  authStatus: 'loading' as AuthStatus,
  me: null,
  token: null,
  banned: false,
  conversations: [] as Conversation[],
  messages: {} as Record<string, Message[]>,
  hasMore: {} as Record<string, boolean>,
  activeConvId: null as string | null,
  onlineIds: [] as string[],
  typing: {} as TypingMap,
  call: null as CallState | null,
  groupVoice: null as GroupVoiceState | null,
  voiceCounts: {} as Record<string, number>,
  adminOpen: false,
  profileOpen: false,
  newChatOpen: false,
  forwardMessage: null as Message | null,
  lightbox: null as { url: string; caption?: string | null } | null,
  infoConvId: null as string | null,
  replyTo: null as Message | null,
  editMessage: null as Message | null,
  mobileChatOpen: false,
}

export const useMessenger = create<Store>((set, get) => ({
  ...initialState,

  setAuthStatus: (authStatus) => set({ authStatus }),
  setMe: (me) => set({ me }),
  setToken: (token) => set({ token }),
  setBanned: (banned) => set({ banned }),

  setConversations: (conversations) => set({ conversations }),

  upsertConversation: (c) =>
    set((s) => {
      const idx = s.conversations.findIndex((x) => x.id === c.id)
      const conversations = [...s.conversations]
      if (idx >= 0) conversations[idx] = { ...conversations[idx], ...c }
      else conversations.unshift(c)
      return { conversations }
    }),

  patchConversation: (id, patch) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  setActiveConv: (activeConvId) =>
    set((s) => ({
      activeConvId,
      mobileChatOpen: !!activeConvId,
      typing: activeConvId
        ? {
            ...s.typing,
            [activeConvId]: {},
          }
        : s.typing,
    })),

  setMessages: (convId, msgs, hasMore = false) =>
    set((s) => ({
      messages: { ...s.messages, [convId]: msgs },
      hasMore: { ...s.hasMore, [convId]: hasMore },
    })),

  setHasMore: (convId, hasMore) =>
    set((s) => ({ hasMore: { ...s.hasMore, [convId]: hasMore } })),

  prependMessages: (convId, msgs) =>
    set((s) => ({
      messages: { ...s.messages, [convId]: [...msgs, ...(s.messages[convId] || [])] },
      hasMore: { ...s.hasMore, [convId]: msgs.length >= 50 },
    })),

  addMessage: (m) =>
    set((s) => {
      const list = s.messages[m.conversationId] || []
      if (list.some((x) => x.id === m.id)) return {}
      return { messages: { ...s.messages, [m.conversationId]: [...list, m] } }
    }),

  replaceTemp: (convId, tempId, m) =>
    set((s) => {
      const list = s.messages[convId] || []
      const idx = list.findIndex((x) => x.tempId === tempId || x.id === tempId)
      if (idx === -1) {
        if (list.some((x) => x.id === m.id)) return {}
        return { messages: { ...s.messages, [convId]: [...list, m] } }
      }
      const next = [...list]
      next[idx] = m
      return { messages: { ...s.messages, [convId]: next } }
    }),

  updateMessage: (m) =>
    set((s) => {
      const list = s.messages[m.conversationId] || []
      const idx = list.findIndex((x) => x.id === m.id)
      if (idx === -1) return {}
      const next = [...list]
      next[idx] = m
      return { messages: { ...s.messages, [m.conversationId]: next } }
    }),

  setOnlineIds: (onlineIds) => set({ onlineIds }),
  setOnline: (userId, online, lastSeen) =>
    set((s) => {
      const onlineIds = online
        ? Array.from(new Set([...s.onlineIds, userId]))
        : s.onlineIds.filter((x) => x !== userId)
      /* update participants lastSeen in conversations */
      const conversations = s.conversations.map((c) => ({
        ...c,
        participants: c.participants.map((p) =>
          p.id === userId ? { ...p, lastSeen: online ? null : lastSeen || p.lastSeen } : p
        ),
      }))
      return { onlineIds, conversations }
    }),

  setTyping: (convId, userId, name, isTyping) =>
    set((s) => {
      const convTyping = { ...(s.typing[convId] || {}) }
      if (isTyping) convTyping[userId] = { name, at: Date.now() }
      else delete convTyping[userId]
      return { typing: { ...s.typing, [convId]: convTyping } }
    }),

  setCall: (call) => set({ call }),

  setGroupVoice: (groupVoice) => set({ groupVoice }),
  setVoiceCount: (convId, count) =>
    set((s) => {
      const voiceCounts = { ...s.voiceCounts }
      if (count > 0) voiceCounts[convId] = count
      else delete voiceCounts[convId]
      return { voiceCounts }
    }),

  setAdminOpen: (adminOpen) => set({ adminOpen }),
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  setNewChatOpen: (newChatOpen) => set({ newChatOpen }),
  setForwardMessage: (forwardMessage) => set({ forwardMessage }),
  setLightbox: (lightbox) => set({ lightbox }),
  setInfoConvId: (infoConvId) => set({ infoConvId }),
  setReplyTo: (replyTo) => set({ replyTo }),
  setEditMessage: (editMessage) => set({ editMessage }),
  setMobileChatOpen: (mobileChatOpen) => set({ mobileChatOpen }),

  reset: () => set({ ...initialState, authStatus: 'guest' }),
}))

/* -------- selectors / helpers -------- */

export function getOtherUser(c: Conversation, meId: string): CallPeer | null {
  const other = c.participants.find((p) => p.id !== meId)
  return other ? { id: other.id, username: other.username, displayName: other.displayName, avatar: other.avatar } : null
}

export function messagePreviewText(m: NonNullable<Conversation['lastMessage']>): string {
  if (m.deletedAt) return 'این پیام حذف شد'
  switch (m.type) {
    case 'image': return '🖼 عکس' + (m.content ? ` ${m.content}` : '')
    case 'voice': return '🎤 پیام صوتی'
    case 'file': return '📎 فایل' + (m.mediaName ? ` ${m.mediaName}` : '')
    case 'system': return m.content || ''
    default: return m.content || ''
  }
}
