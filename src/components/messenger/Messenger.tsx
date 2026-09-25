'use client'

import { useEffect } from 'react'
import { useMessenger } from '@/store/messenger'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Message } from '@/lib/types'
import type { CallEngine } from '@/lib/webrtc'
import type { GroupVoiceEngine } from '@/lib/group-voice'
import Sidebar from './Sidebar'
import ChatArea from './ChatArea'
import ProfileDialog from './ProfileDialog'
import NewChatDialog from './NewChatDialog'
import ForwardDialog from './ForwardDialog'
import UserInfoDialog from './UserInfoDialog'
import CallOverlay from './CallOverlay'
import Lightbox from './Lightbox'
import AdminPanel from './AdminPanel'
import { MessageCircle } from 'lucide-react'

export default function Messenger({
  callEngine,
  gvEngine,
}: {
  callEngine: React.RefObject<CallEngine | null>
  gvEngine: React.RefObject<GroupVoiceEngine | null>
}) {
  const activeConvId = useMessenger((s) => s.activeConvId)
  const mobileChatOpen = useMessenger((s) => s.mobileChatOpen)
  const adminOpen = useMessenger((s) => s.adminOpen)

  /* load messages when opening a conversation */
  useEffect(() => {
    if (!activeConvId) return
    const st = useMessenger.getState()
    if (st.messages[activeConvId]?.length) return
    api
      .get<{ messages: Message[]; hasMore: boolean }>(`/api/conversations/${activeConvId}/messages`)
      .then(({ messages, hasMore }) => {
        useMessenger.getState().setMessages(activeConvId, messages, hasMore)
        api.post(`/api/conversations/${activeConvId}/read`).catch(() => {})
        useMessenger.getState().patchConversation(activeConvId, { unreadCount: 0 })
      })
      .catch(() => {})
  }, [activeConvId])

  if (adminOpen) {
    return (
      <>
        <AdminPanel />
        <CallOverlay callEngine={callEngine} />
      </>
    )
  }

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-background">
      {/* Sidebar (right in RTL) */}
      <div
        className={cn(
          'w-full md:w-[350px] lg:w-[390px] shrink-0 flex flex-col border-e bg-sidebar',
          mobileChatOpen && 'hidden md:flex'
        )}
      >
        <Sidebar />
      </div>

      {/* Chat area */}
      <div className={cn('flex-1 min-w-0 flex flex-col', !mobileChatOpen && 'hidden md:flex')}>
        {activeConvId ? (
          <ChatArea callEngine={callEngine} gvEngine={gvEngine} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 chat-bg">
            <div className="w-20 h-20 rounded-full bg-card shadow-lg flex items-center justify-center">
              <MessageCircle className="w-10 h-10 text-brand" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">مِسنجیو وب</p>
              <p className="text-sm text-muted-foreground mt-1">
                برای شروع گفتگو، یک چت را انتخاب کنید یا چت جدید بسازید
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs & overlays */}
      <ProfileDialog />
      <NewChatDialog />
      <ForwardDialog />
      <UserInfoDialog callEngine={callEngine} />
      <CallOverlay callEngine={callEngine} />
      <Lightbox />
    </div>
  )
}
