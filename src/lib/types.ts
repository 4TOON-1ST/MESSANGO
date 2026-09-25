/* Shared types for the messenger client */

export type Me = {
  id: string
  username: string
  displayName: string
  avatar: string | null
  bio: string | null
  isAdmin: boolean
}

export type UserBrief = {
  id: string
  username: string
  displayName: string
  avatar: string | null
  isAdmin?: boolean
  lastSeen?: string | null
  bio?: string | null
  lastReadAt?: string | null
}

export type LastMessage = {
  id: string
  type: string
  content: string | null
  mediaUrl: string | null
  senderId: string | null
  senderName: string
  createdAt: string
  deletedAt: string | null
} | null

export type Conversation = {
  id: string
  type: 'dm' | 'group'
  name: string | null
  avatar: string | null
  createdById: string | null
  createdAt: string
  lastReadAt: string | null
  participants: UserBrief[]
  lastMessage: LastMessage
  unreadCount: number
}

export type Message = {
  id: string
  conversationId: string
  senderId: string | null
  type: 'text' | 'image' | 'voice' | 'file' | 'system'
  content: string | null
  mediaUrl: string | null
  mediaName: string | null
  mediaSize: number | null
  mediaDuration: number | null
  mediaPeaks: string | null
  replyToId: string | null
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  sender?: { id: string; username: string; displayName: string; avatar: string | null; isAdmin?: boolean } | null
  replyTo?: {
    id: string
    type: string
    content: string | null
    mediaUrl?: string | null
    sender?: { id: string; displayName: string } | null
  } | null
  /* client-side only */
  pending?: boolean
  tempId?: string
}

export type CallPeer = {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

export type CallStatus = 'outgoing' | 'incoming' | 'active'

export type CallState = {
  status: CallStatus
  peer: CallPeer
  convId: string | null
  startedAt: number | null
  muted: boolean
}

/* ---------- group voice call ---------- */

export type GroupVoiceParticipant = {
  socketId: string
  userId: string
  displayName: string
  avatar: string | null
  muted: boolean
}

export type GroupVoiceState = {
  convId: string
  participants: GroupVoiceParticipant[]
  muted: boolean
}
