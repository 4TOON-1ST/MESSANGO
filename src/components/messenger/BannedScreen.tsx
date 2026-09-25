'use client'

import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { useMessenger } from '@/store/messenger'

export default function BannedScreen() {
  const setBanned = useMessenger((s) => s.setBanned)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full bg-card border rounded-3xl shadow-xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-9 h-9 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">حساب شما مسدود شد</h1>
        <p className="text-muted-foreground text-sm leading-7">
          دسترسی شما به این پیام‌رسان توسط مدیر سیستم مسدود شده است.
          اگر فکر می‌کنید این موضوع اشتباهی است، با مدیر تماس بگیرید.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setBanned(false)
            useMessenger.getState().setAuthStatus('guest')
          }}
        >
          بازگشت به صفحه ورود
        </Button>
      </div>
    </div>
  )
}
