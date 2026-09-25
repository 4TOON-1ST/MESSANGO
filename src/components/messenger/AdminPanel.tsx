'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMessenger } from '@/store/messenger'
import { fmtChatTime, fmtLastSeen, faNum } from '@/lib/format'
import Avatar from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  ArrowRight,
  Users,
  MessagesSquare,
  MessageCircle,
  ImageIcon,
  UserPlus,
  Activity,
  ShieldAlert,
  MoreVertical,
  Ban,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Trash2,
  Search,
  Send,
  Loader2,
  Megaphone,
} from 'lucide-react'
import type { UserBrief } from '@/lib/types'

type Stats = {
  users: number
  messages: number
  conversations: number
  mediaMessages: number
  newUsers: number
  activeMessages: number
  banned: number
}

type AdminUser = UserBrief & { isBanned: boolean; createdAt: string; _count: { messages: number } }

type AdminMessage = {
  id: string
  type: string
  content: string | null
  createdAt: string
  sender: { id: string; displayName: string; avatar: string | null; username: string } | null
  conversation: { id: string; type: string; name: string | null; participants: { user: { displayName: string } }[] }
}

export default function AdminPanel() {
  const [tab, setTab] = useState('dashboard')
  const closeAdmin = () => useMessenger.getState().setAdminOpen(false)
  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="h-16 border-b bg-sidebar flex items-center gap-3 px-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={closeAdmin} aria-label="بازگشت">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand" />
          <h1 className="font-black text-lg">پنل مدیریت</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 grid grid-cols-4 w-auto sm:w-max">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <Activity className="w-4 h-4" /> <span className="hidden sm:inline">داشبورد</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-4 h-4" /> <span className="hidden sm:inline">کاربران</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessagesSquare className="w-4 h-4" /> <span className="hidden sm:inline">پیام‌ها</span>
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-1.5">
            <Megaphone className="w-4 h-4" /> <span className="hidden sm:inline">همگانی</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto nice-scroll p-4">
          <TabsContent value="dashboard" className="mt-0">
            <Dashboard />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UsersAdmin />
          </TabsContent>
          <TabsContent value="messages" className="mt-0">
            <MessagesAdmin />
          </TabsContent>
          <TabsContent value="broadcast" className="mt-0">
            <Broadcast />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

/* ---------------- Dashboard ---------------- */
function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [chart, setChart] = useState<{ day: string; count: number }[]>([])

  useEffect(() => {
    api
      .get<{ stats: Stats; chart: { day: string; count: number }[] }>('/api/admin/stats')
      .then(({ stats, chart }) => {
        setStats(stats)
        setChart(
          chart.map((c) => ({
            day: new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(new Date(c.day)),
            count: c.count,
          }))
        )
      })
      .catch(() => {})
  }, [])

  if (!stats) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>

  const cards = [
    { label: 'کل کاربران', value: stats.users, icon: Users, color: 'text-brand bg-brand/10' },
    { label: 'کل پیام‌ها', value: stats.messages, icon: MessagesSquare, color: 'text-green-600 bg-green-500/10' },
    { label: 'گفتگوها', value: stats.conversations, icon: MessageCircle, color: 'text-purple-600 bg-purple-500/10' },
    { label: 'رسانه‌ها (عکس/ویس/فایل)', value: stats.mediaMessages, icon: ImageIcon, color: 'text-orange-600 bg-orange-500/10' },
    { label: 'کاربران جدید (۲۴ ساعت)', value: stats.newUsers, icon: UserPlus, color: 'text-teal-600 bg-teal-500/10' },
    { label: 'پیام‌ها (۲۴ ساعت)', value: stats.activeMessages, icon: Activity, color: 'text-pink-600 bg-pink-500/10' },
    { label: 'مسدودشده', value: stats.banned, icon: ShieldAlert, color: 'text-destructive bg-destructive/10' },
  ]

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border rounded-2xl p-4 flex flex-col gap-2">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </span>
            <p className="text-2xl font-black">{faNum(c.value)}</p>
            <p className="text-xs text-muted-foreground leading-4">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-2xl p-4">
        <p className="font-bold text-sm mb-4">پیام‌های ۷ روز گذشته</p>
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fontFamily: 'inherit' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={30} />
              <ReTooltip
                contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}
                formatter={(v) => [`${v}`, 'پیام']}
              />
              <Bar dataKey="count" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Users ---------------- */
function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const load = (query = '') => {
    setLoading(true)
    api
      .get<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`)
      .then(({ users }) => setUsers(users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const act = async (id: string, action: string, extra?: Record<string, unknown>) => {
    setBusy(true)
    try {
      await api.patch(`/api/admin/users/${id}`, { action, ...extra })
      load(q.trim())
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: 'انجام شد ✅' }))
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await api.del(`/api/admin/users/${id}`)
      load(q.trim())
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: 'کاربر حذف شد' }))
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setBusy(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="max-w-4xl space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کاربر…" className="ps-9 rounded-xl bg-card" />
      </div>

      {loading && users.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
      ) : (
        <div className="bg-card border rounded-2xl divide-y overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3">
              <Avatar name={u.displayName} avatar={u.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm truncate">{u.displayName}</p>
                  {u.isAdmin && <Badge className="bg-brand text-white text-[10px]">ادمین</Badge>}
                  {u.isBanned && <Badge variant="destructive" className="text-[10px]">مسدود</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  <span dir="ltr">@{u.username}</span> · {faNum(u._count.messages)} پیام · عضویت {fmtChatTime(u.createdAt)}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:block">{fmtLastSeen(u.lastSeen)}</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full" aria-label="عملیات">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {u.isBanned ? (
                    <DropdownMenuItem onClick={() => act(u.id, 'unban')} disabled={busy}>
                      <ShieldCheck className="w-4 h-4 text-green-600" /> رفع مسدودی
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => act(u.id, 'ban')} disabled={busy} className="text-destructive focus:text-destructive">
                      <Ban className="w-4 h-4" /> مسدودسازی
                    </DropdownMenuItem>
                  )}
                  {u.isAdmin ? (
                    <DropdownMenuItem onClick={() => act(u.id, 'demote')} disabled={busy}>
                      <ShieldOff className="w-4 h-4" /> سلب دسترسی ادمین
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => act(u.id, 'promote')} disabled={busy}>
                      <ShieldCheck className="w-4 h-4 text-brand" /> ارتقا به ادمین
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      setResetTarget(u)
                      setNewPassword('')
                    }}
                  >
                    <KeyRound className="w-4 h-4" /> تغییر رمز عبور
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleteTarget(u)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4" /> حذف حساب
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {!loading && users.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">کاربری یافت نشد</p>
          )}
        </div>
      )}

      {/* delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف حساب کاربری</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف حساب «{deleteTarget?.displayName}» مطمئن هستید؟ همه گفتگوها و پیام‌های او حذف خواهد شد و این عمل بازگشت‌پذیر نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove(deleteTarget.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
            >
              حذف قطعی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* reset password */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تغییر رمز {resetTarget?.displayName}</DialogTitle>
          </DialogHeader>
          <Input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="رمز عبور جدید (حداقل ۶ کاراکتر)"
            dir="ltr"
            className="text-left rounded-xl"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetTarget(null)}>انصراف</Button>
            <Button
              className="bg-brand hover:bg-brand/90 text-white"
              disabled={busy || newPassword.length < 6}
              onClick={async () => {
                await act(resetTarget!.id, 'resetPassword', { newPassword })
                setResetTarget(null)
              }}
            >
              ذخیره رمز جدید
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ---------------- Messages ---------------- */
function MessagesAdmin() {
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api
      .get<{ messages: AdminMessage[] }>('/api/admin/messages')
      .then(({ messages }) => setMessages(messages))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const removeMsg = async (id: string) => {
    try {
      await api.del(`/api/admin/messages/${id}`)
      load()
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: 'پیام حذف شد' }))
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>

  return (
    <div className="max-w-4xl space-y-2">
      <p className="text-xs text-muted-foreground">۸۰ پیام آخر — می‌توانید پیام‌های نامناسب را حذف کنید</p>
      <div className="bg-card border rounded-2xl divide-y overflow-hidden">
        {messages.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3">
            <Avatar name={m.sender?.displayName || '?'} avatar={m.sender?.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-bold">{m.sender?.displayName || 'کاربر حذف‌شده'}</span>{' '}
                <span className="text-xs text-muted-foreground">
                  در {m.conversation.type === 'group' ? `گروه ${m.conversation.name}` : 'گفتگوی خصوصی'}
                </span>
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {m.type === 'image' ? '🖼 عکس' : m.type === 'voice' ? '🎤 ویس' : m.type === 'file' ? '📎 فایل' : m.content}
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">{fmtChatTime(m.createdAt)}</span>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-destructive" onClick={() => removeMsg(m.id)} aria-label="حذف پیام">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">پیامی نیست</p>}
      </div>
    </div>
  )
}

/* ---------------- Broadcast ---------------- */
function Broadcast() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      const { sent } = await api.post<{ sent: number }>('/api/admin/broadcast', { text: text.trim() })
      setText('')
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: `پیام برای ${faNum(sent)} کاربر ارسال شد 📢` }))
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="bg-card border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </span>
          <div>
            <p className="font-bold text-sm">پیام همگانی</p>
            <p className="text-xs text-muted-foreground">به عنوان پیام سیستمی برای همه کاربران ارسال می‌شود</p>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="متن اطلاعیه… مثلاً: 🎉 نسخه جدید پیام‌رسان منتشر شد!"
          className="rounded-xl"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{faNum(text.length)} / ۲۰۰۰</span>
          <Button onClick={send} disabled={sending || !text.trim()} className="bg-brand hover:bg-brand/90 text-white gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -scale-x-100" />}
            ارسال به همه
          </Button>
        </div>
      </div>
    </div>
  )
}
