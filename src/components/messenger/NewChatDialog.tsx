'use client'

import { useEffect, useState } from 'react'
import { useMessenger } from '@/store/messenger'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import Avatar from './Avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Users, MessageCircle, Loader2, Check } from 'lucide-react'
import type { Conversation, UserBrief } from '@/lib/types'

export default function NewChatDialog() {
  const open = useMessenger((s) => s.newChatOpen)
  const setOpen = useMessenger((s) => s.setNewChatOpen)
  const onlineIds = useMessenger((s) => s.onlineIds)
  const setActiveConv = useMessenger((s) => s.setActiveConv)

  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserBrief[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = setTimeout(() => {
      api
        .get<{ users: UserBrief[] }>(`/api/users?q=${encodeURIComponent(q.trim())}`)
        .then(({ users }) => setUsers(users))
        .catch(() => setUsers([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q, open])

  const close = () => {
    setOpen(false)
    setQ('')
    setSelected([])
    setGroupName('')
  }

  const startDm = async (userId: string) => {
    setCreating(true)
    try {
      const { conversation } = await api.post<{ conversation: Conversation }>('/api/conversations', {
        type: 'dm',
        userId,
      })
      useMessenger.getState().upsertConversation(conversation)
      setActiveConv(conversation.id)
      close()
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setCreating(false)
    }
  }

  const createGroup = async () => {
    if (!groupName.trim() || selected.length < 1) return
    setCreating(true)
    try {
      const { conversation } = await api.post<{ conversation: Conversation }>('/api/conversations', {
        type: 'group',
        name: groupName.trim(),
        memberIds: selected,
      })
      useMessenger.getState().upsertConversation(conversation)
      setActiveConv(conversation.id)
      close()
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setCreating(false)
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3">
          <DialogTitle>شروع گفتگوی جدید</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dm">
          <TabsList className="grid grid-cols-2 w-[calc(100%-2.5rem)] mx-5">
            <TabsTrigger value="dm" className="gap-1.5">
              <MessageCircle className="w-4 h-4" /> گفتگوی خصوصی
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-1.5">
              <Users className="w-4 h-4" /> گروه جدید
            </TabsTrigger>
          </TabsList>

          {/* DM */}
          <TabsContent value="dm" className="p-5 pt-4">
            <div className="relative mb-3">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کاربر…" className="ps-9 rounded-xl" />
            </div>
            <div className="max-h-72 overflow-y-auto nice-scroll space-y-0.5">
              {loading && users.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">در حال بارگذاری…</p>
              )}
              {!loading && users.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">کاربری پیدا نشد</p>
              )}
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startDm(u.id)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent text-start transition-colors"
                >
                  <Avatar name={u.displayName} avatar={u.avatar} size={44} online={onlineIds.includes(u.id)} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Group */}
          <TabsContent value="group" className="p-5 pt-4 space-y-3">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="نام گروه…"
              maxLength={50}
              className="rounded-xl"
            />
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="افزودن اعضا…" className="ps-9 rounded-xl" />
            </div>
            <div className="max-h-60 overflow-y-auto nice-scroll space-y-0.5">
              {users.map((u) => {
                const sel = selected.includes(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-xl text-start transition-colors',
                      sel ? 'bg-brand/10 border border-brand/40' : 'hover:bg-accent border border-transparent'
                    )}
                  >
                    <Avatar name={u.displayName} avatar={u.avatar} size={40} online={onlineIds.includes(u.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">@{u.username}</p>
                    </div>
                    {sel && (
                      <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <Button
              onClick={createGroup}
              disabled={creating || !groupName.trim() || selected.length < 1}
              className="w-full bg-brand hover:bg-brand/90 text-white gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              ساخت گروه ({selected.length.toLocaleString('fa-IR')} عضو)
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
