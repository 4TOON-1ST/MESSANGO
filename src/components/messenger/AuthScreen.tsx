'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, MessageCircle, Mic, Image as ImageIcon, ShieldCheck, Zap } from 'lucide-react'
import { useMessenger } from '@/store/messenger'
import { api } from '@/lib/api'
import type { Me } from '@/lib/types'

export default function AuthScreen() {
  const [loginData, setLoginData] = useState({ username: '', password: '' })
  const [regData, setRegData] = useState({ username: '', displayName: '', password: '', password2: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!loginData.username || !loginData.password) {
      setError('نام کاربری و رمز عبور را وارد کنید')
      return
    }
    setLoading(true)
    try {
      const { user, token } = await api.post<{ user: Me; token: string }>('/api/auth/login', loginData)
      localStorage.setItem('mtoken', token)
      document.cookie = `mtoken_c=${token}; path=/; max-age=2592000; SameSite=Lax`
      useMessenger.getState().setMe(user)
      useMessenger.getState().setToken(token)
      useMessenger.getState().setAuthStatus('authed')
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(regData.username)) {
      setError('نام کاربری باید ۳ تا ۲۰ کاراکتر انگلیسی، عدد یا _ باشد')
      return
    }
    if (regData.displayName.trim().length < 1) {
      setError('نام نمایشی را وارد کنید')
      return
    }
    if (regData.password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد')
      return
    }
    if (regData.password !== regData.password2) {
      setError('تکرار رمز عبور مطابقت ندارد')
      return
    }
    setLoading(true)
    try {
      const { user, token } = await api.post<{ user: Me; token: string }>('/api/auth/register', {
        username: regData.username,
        displayName: regData.displayName.trim(),
        password: regData.password,
      })
      localStorage.setItem('mtoken', token)
      document.cookie = `mtoken_c=${token}; path=/; max-age=2592000; SameSite=Lax`
      useMessenger.getState().setMe(user)
      useMessenger.getState().setToken(token)
      useMessenger.getState().setAuthStatus('authed')
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 chat-bg">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Brand side */}
        <div className="hidden lg:flex flex-col items-center text-center gap-6">
          <div className="w-24 h-24 rounded-3xl bg-brand shadow-xl shadow-brand/30 flex items-center justify-center rotate-3">
            <MessageCircle className="w-14 h-14 text-white -rotate-3" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-foreground">مِسنجیو</h1>
            <p className="text-muted-foreground mt-2 text-lg">پیام‌رسان سریع، امن و حرفه‌ای</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { icon: Zap, text: 'پیام‌های لحظه‌ای' },
              { icon: Mic, text: 'تماس صوتی و ویس' },
              { icon: ImageIcon, text: 'ارسال عکس و فایل' },
              { icon: ShieldCheck, text: 'پنل مدیریت کامل' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-card/80 backdrop-blur border rounded-xl px-4 py-3 shadow-sm">
                <f.icon className="w-4 h-4 text-brand" />
                <span className="text-foreground/90">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form side */}
        <div className="bg-card rounded-3xl shadow-2xl border p-6 sm:p-8">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black">مِسنجیو</h1>
          </div>

          <Tabs defaultValue="login" dir="rtl">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="login">ورود</TabsTrigger>
              <TabsTrigger value="register">ثبت‌نام</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">نام کاربری</Label>
                  <Input
                    id="login-username"
                    dir="ltr"
                    className="text-left"
                    placeholder="username"
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">رمز عبور</Label>
                  <Input
                    id="login-password"
                    type="password"
                    dir="ltr"
                    className="text-left"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full bg-brand hover:bg-brand/90 text-white" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  ورود به حساب
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">نام کاربری (انگلیسی)</Label>
                  <Input
                    id="reg-username"
                    dir="ltr"
                    className="text-left"
                    placeholder="my_username"
                    value={regData.username}
                    onChange={(e) => setRegData({ ...regData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-display">نام نمایشی</Label>
                  <Input
                    id="reg-display"
                    placeholder="مثلاً: علی رضایی"
                    value={regData.displayName}
                    onChange={(e) => setRegData({ ...regData, displayName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass">رمز عبور</Label>
                    <Input
                      id="reg-pass"
                      type="password"
                      dir="ltr"
                      className="text-left"
                      placeholder="حداقل ۶ کاراکتر"
                      value={regData.password}
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass2">تکرار رمز</Label>
                    <Input
                      id="reg-pass2"
                      type="password"
                      dir="ltr"
                      className="text-left"
                      placeholder="••••••••"
                      value={regData.password2}
                      onChange={(e) => setRegData({ ...regData, password2: e.target.value })}
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full bg-brand hover:bg-brand/90 text-white" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  ساخت حساب جدید
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
