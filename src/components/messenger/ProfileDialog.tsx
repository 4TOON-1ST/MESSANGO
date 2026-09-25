'use client'

import { useRef, useState } from 'react'
import { useMessenger } from '@/store/messenger'
import { ACCENTS, applyAccent } from '@/components/messenger/AppRoot'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import Avatar from './Avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Loader2, Moon, Sun, Volume2, VolumeX, Camera, Trash2 } from 'lucide-react'
import type { Me } from '@/lib/types'

export default function ProfileDialog() {
  const open = useMessenger((s) => s.profileOpen)
  const setOpen = useMessenger((s) => s.setProfileOpen)
  const me = useMessenger((s) => s.me)!

  const [displayName, setDisplayName] = useState(me.displayName)
  const [bio, setBio] = useState(me.bio || '')
  const [avatar, setAvatar] = useState(me.avatar)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const isDark = () => document.documentElement.classList.contains('dark')
  const soundOn = () => localStorage.getItem('sound') !== 'off'
  const [, force] = useState(0)

  const save = async () => {
    setSaving(true)
    try {
      const { user } = await api.patch<{ user: Me }>('/api/profile', {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar,
      })
      useMessenger.getState().setMe(user)
      setOpen(false)
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: 'پروفایل ذخیره شد ✅' }))
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    setUploading(true)
    try {
      const up = await api.upload(file)
      setAvatar(up.url)
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message }))
    } finally {
      setUploading(false)
    }
  }

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    force((x) => x + 1)
  }

  const toggleSound = () => {
    const next = soundOn() ? 'off' : 'on'
    localStorage.setItem('sound', next)
    force((x) => x + 1)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle>پروفایل و تنظیمات</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <Avatar name={displayName || me.displayName} avatar={avatar} size={96} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 end-0 w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shadow-lg hover:scale-105 transition"
              aria-label="تغییر عکس پروفایل"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar(null)}
                className="absolute top-0 end-0 w-7 h-7 rounded-full bg-destructive text-white flex items-center justify-center shadow"
                aria-label="حذف عکس"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadAvatar(f)
              e.target.value = ''
            }}
          />
          <p className="text-xs text-muted-foreground" dir="ltr">@{me.username}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">نام نمایشی</Label>
            <Input id="pf-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-bio">بیوگرافی</Label>
            <Textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={2} placeholder="درباره خودتان…" className="rounded-xl" />
          </div>
        </div>

        <Separator />

        {/* appearance */}
        <section className="space-y-3">
          <p className="text-sm font-bold">ظاهر و شخصی‌سازی</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">تم رنگی</span>
            <div className="flex gap-1.5">
              <Button onClick={toggleTheme} variant="outline" size="sm" className="gap-1.5 rounded-full">
                <Sun className="w-4 h-4 hidden dark:block" />
                <Moon className="w-4 h-4 dark:hidden" />
                {isDark() ? 'تیره' : 'روشن'}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">رنگ اکسنت</span>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  title={a.name}
                  onClick={() => {
                    localStorage.setItem('accent', a.value)
                    applyAccent(a.value)
                    force((x) => x + 1)
                  }}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform hover:scale-110 ring-offset-2 ring-offset-card',
                    localStorage.getItem('accent') === a.value && 'ring-2 ring-brand'
                  )}
                  style={{ background: a.value }}
                  aria-label={a.name}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">صدای اعلان پیام</span>
            <Button onClick={toggleSound} variant="outline" size="sm" className="gap-1.5 rounded-full">
              {soundOn() ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {soundOn() ? 'روشن' : 'خاموش'}
            </Button>
          </div>
        </section>

        <Button onClick={save} disabled={saving} className="w-full bg-brand hover:bg-brand/90 text-white gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          ذخیره تغییرات
        </Button>
      </DialogContent>
    </Dialog>
  )
}
