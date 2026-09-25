'use client'

import { useEffect, useRef, useState } from 'react'
import { useMessenger } from '@/store/messenger'
import { getExistingSocket } from '@/lib/socket'
import { api } from '@/lib/api'
import { VoiceRecorder } from '@/lib/recorder'
import { fmtDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import EmojiPicker from './EmojiPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Mic, Paperclip, Send, X, Trash2, Image as ImageIcon, File as FileIcon } from 'lucide-react'
import type { Message } from '@/lib/types'

export default function Composer({ convId }: { convId: string }) {
  const me = useMessenger((s) => s.me)!
  const replyTo = useMessenger((s) => s.replyTo)
  const editMessage = useMessenger((s) => s.editMessage)

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  /* recording */
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingEmit = useRef(0)

  /* edit mode fill */
  useEffect(() => {
    if (editMessage) {
      setText(editMessage.content || '')
      taRef.current?.focus()
    }
  }, [editMessage])

  /* auto-grow textarea */
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = '0px'
    ta.style.height = Math.min(140, ta.scrollHeight) + 'px'
  }, [text])

  const emitTyping = (isTyping: boolean) => {
    const socket = getExistingSocket()
    socket?.emit('msg:typing', { convId, isTyping })
  }

  const onTextChange = (v: string) => {
    setText(v)
    const now = Date.now()
    if (v && now - lastTypingEmit.current > 1500) {
      lastTypingEmit.current = now
      emitTyping(true)
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => emitTyping(false), 2500)
  }

  const buildMessagePayload = (extra: Record<string, unknown>, tempType: Message['type']) => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const optimistic: Message = {
      id: tempId,
      conversationId: convId,
      senderId: me.id,
      type: tempType,
      content: (extra.content as string) || null,
      mediaUrl: (extra.mediaUrl as string) || null,
      mediaName: (extra.mediaName as string) || null,
      mediaSize: (extra.mediaSize as number) || null,
      mediaDuration: (extra.mediaDuration as number) || null,
      mediaPeaks: (extra.mediaPeaks as string) || null,
      replyToId: replyTo?.id || null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      sender: { id: me.id, username: me.username, displayName: me.displayName, avatar: me.avatar, isAdmin: me.isAdmin },
      replyTo: replyTo
        ? { id: replyTo.id, type: replyTo.type, content: replyTo.content, mediaUrl: replyTo.mediaUrl, sender: { id: replyTo.sender?.id || '', displayName: replyTo.sender?.displayName || '' } }
        : null,
      pending: true,
      tempId,
    }
    return { tempId, optimistic, payload: { convId, tempId, replyToId: replyTo?.id || null, ...extra } }
  }

  const pushOptimistic = (optimistic: Message) => {
    const st = useMessenger.getState()
    st.addMessage(optimistic)
    const conv = st.conversations.find((c) => c.id === convId)
    if (conv) {
      st.patchConversation(convId, {
        lastMessage: {
          id: optimistic.id,
          type: optimistic.type,
          content: optimistic.content,
          mediaUrl: optimistic.mediaUrl,
          senderId: me.id,
          senderName: me.displayName,
          createdAt: optimistic.createdAt,
          deletedAt: null,
        },
      })
    }
  }

  const sendText = () => {
    const value = text.trim()
    if (!value || sending) return

    /* edit mode */
    if (editMessage) {
      const socket = getExistingSocket()
      socket?.emit('msg:edit', { id: editMessage.id, content: value })
      useMessenger.getState().setEditMessage(null)
      setText('')
      emitTyping(false)
      return
    }

    const { optimistic, payload } = buildMessagePayload({ type: 'text', content: value }, 'text')
    pushOptimistic(optimistic)
    setText('')
    useMessenger.getState().setReplyTo(null)
    emitTyping(false)
    getExistingSocket()?.emit('msg:send', payload)
  }

  const sendImage = async () => {
    if (!imagePreview || uploading) return
    setUploading(true)
    try {
      const up = await api.upload(imagePreview.file)
      const { optimistic, payload } = buildMessagePayload(
        { type: 'image', content: caption.trim() || null, mediaUrl: up.url, mediaName: up.name, mediaSize: up.size },
        'image'
      )
      pushOptimistic(optimistic)
      setImagePreview(null)
      setCaption('')
      useMessenger.getState().setReplyTo(null)
      getExistingSocket()?.emit('msg:send', payload)
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message || 'آپلود ناموفق بود' }))
    } finally {
      setUploading(false)
    }
  }

  const sendFile = async (file: File) => {
    if (uploading) return
    setUploading(true)
    try {
      const up = await api.upload(file)
      const { optimistic, payload } = buildMessagePayload(
        { type: 'file', content: null, mediaUrl: up.url, mediaName: up.name, mediaSize: up.size },
        'file'
      )
      pushOptimistic(optimistic)
      useMessenger.getState().setReplyTo(null)
      getExistingSocket()?.emit('msg:send', payload)
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message || 'آپلود ناموفق بود' }))
    } finally {
      setUploading(false)
    }
  }

  /* ---------- voice recording ---------- */
  const startRecording = async () => {
    try {
      recorderRef.current = new VoiceRecorder()
      await recorderRef.current.start()
      setRecording(true)
      setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    } catch {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: 'دسترسی به میکروفون ممکن نیست' }))
    }
  }

  const stopRecording = async (send: boolean) => {
    if (recTimerRef.current) clearInterval(recTimerRef.current)
    const rec = recorderRef.current
    recorderRef.current = null
    setRecording(false)
    if (!rec) return
    if (!send) {
      rec.cancel()
      return
    }
    setSending(true)
    try {
      const result = await rec.stop()
      if (!result) return
      setUploading(true)
      const ext = result.blob.type.includes('mp4') ? 'm4a' : result.blob.type.includes('ogg') ? 'ogg' : 'weba'
      const file = new File([result.blob], `voice-${Date.now()}.${ext}`, { type: result.blob.type })
      const up = await api.upload(file)
      const { optimistic, payload } = buildMessagePayload(
        { type: 'voice', content: null, mediaUrl: up.url, mediaName: up.name, mediaSize: up.size, mediaDuration: result.durationSec, mediaPeaks: result.peaks },
        'voice'
      )
      pushOptimistic(optimistic)
      useMessenger.getState().setReplyTo(null)
      getExistingSocket()?.emit('msg:send', payload)
    } catch (e) {
      import('@/hooks/use-toast').then(({ toast }) => toast({ description: (e as Error).message || 'ارسال ویس ناموفق بود' }))
    } finally {
      setUploading(false)
      setSending(false)
    }
  }

  /* ---------- attach menu ---------- */
  const [attachOpen, setAttachOpen] = useState(false)

  return (
    <div className="border-t bg-sidebar">
      {/* reply / edit preview */}
      {(replyTo || editMessage) && (
        <div className="mx-3 mt-2 rounded-xl bg-brand/5 border-s-2 border-brand px-3 py-2 flex items-center gap-2">
          {replyTo && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand">پاسخ به {replyTo.sender?.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {replyTo.type === 'image' ? '🖼 عکس' : replyTo.type === 'voice' ? '🎤 پیام صوتی' : replyTo.type === 'file' ? '📎 فایل' : replyTo.content}
                </p>
              </div>
              <button onClick={() => useMessenger.getState().setReplyTo(null)} aria-label="لغو پاسخ">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          )}
          {editMessage && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand">ویرایش پیام</p>
                <p className="text-xs text-muted-foreground truncate">{editMessage.content}</p>
              </div>
              <button
                onClick={() => {
                  useMessenger.getState().setEditMessage(null)
                  setText('')
                }}
                aria-label="لغو ویرایش"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          )}
        </div>
      )}

      {/* main composer row */}
      {recording ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => stopRecording(false)} className="text-destructive hover:scale-110 transition" aria-label="حذف ویس">
            <Trash2 className="w-5 h-5" />
          </button>
          <span className="w-3 h-3 rounded-full bg-destructive rec-pulse" />
          <span className="font-mono text-sm text-muted-foreground" dir="ltr">
            {fmtDuration(recSeconds)}
          </span>
          <span className="text-sm text-muted-foreground flex-1">در حال ضبط…</span>
          <Button onClick={() => stopRecording(true)} className="rounded-full bg-brand hover:bg-brand/90 text-white h-10 px-5 gap-2" disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -scale-x-100" />}
            ارسال ویس
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-1 p-2.5">
          {/* attach */}
          <div className="relative">
            <button
              onClick={() => setAttachOpen((o) => !o)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 transition-colors"
              aria-label="پیوست فایل"
              type="button"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
            </button>
            {attachOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAttachOpen(false)} />
                <div className="absolute bottom-11 start-0 z-20 bg-popover border rounded-xl shadow-xl p-1.5 w-44">
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-accent"
                    onClick={() => {
                      setAttachOpen(false)
                      imageInputRef.current?.click()
                    }}
                  >
                    <ImageIcon className="w-4 h-4 text-brand" /> عکس / ویدیو
                  </button>
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-accent"
                    onClick={() => {
                      setAttachOpen(false)
                      fileInputRef.current?.click()
                    }}
                  >
                    <FileIcon className="w-4 h-4 text-brand" /> فایل
                  </button>
                </div>
              </>
            )}
          </div>

          <EmojiPicker onPick={(e) => onTextChange(text + e)} />

          <Textarea
            ref={taRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendText()
              }
            }}
            rows={1}
            placeholder="پیام بنویسید…"
            className="flex-1 min-h-[40px] max-h-[140px] resize-none rounded-2xl bg-background border-input focus-visible:ring-brand py-2.5"
          />

          {text.trim() ? (
            <Button
              onClick={sendText}
              size="icon"
              className="w-10 h-10 rounded-full bg-brand hover:bg-brand/90 text-white shrink-0 shadow-md shadow-brand/30"
              aria-label="ارسال"
              disabled={sending}
            >
              <Send className="w-5 h-5 -scale-x-100" />
            </Button>
          ) : (
            <button
              onClick={startRecording}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 transition-colors shrink-0"
              aria-label="ضبط پیام صوتی"
              type="button"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* hidden inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) setImagePreview({ file: f, url: URL.createObjectURL(f) })
          e.target.value = ''
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) sendFile(f)
          e.target.value = ''
        }}
      />

      {/* image preview dialog */}
      <Dialog open={!!imagePreview} onOpenChange={(o) => !o && setImagePreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ارسال عکس</DialogTitle>
          </DialogHeader>
          {imagePreview && (
            <img src={imagePreview.url} alt="پیش‌نمایش" className="rounded-xl max-h-72 w-full object-contain bg-muted" />
          )}
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="توضیح (اختیاری)…"
            rows={2}
            className="rounded-xl"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImagePreview(null)}>
              انصراف
            </Button>
            <Button onClick={sendImage} className="bg-brand hover:bg-brand/90 text-white gap-2" disabled={uploading}>
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              ارسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
