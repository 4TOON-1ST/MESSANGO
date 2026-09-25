'use client'

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'صورتک‌ها',
    emojis: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖'.split(' '),
  },
  {
    label: 'دست‌ها و آدمک‌ها',
    emojis: '👋 🤚 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 💪 🦾 ✍️ 💅 🤳 💃 🕺 🧘 🚶 🏃 💑 👫 👍'.split(' '),
  },
  {
    label: 'قلب‌ها و علائم',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ 🌟 ⭐ 💫 🔥 💥 💯 ✅ ❌ ❗ ❓ 💬 🗯 💤 🎉 🎊 🎁 🏆 ⚽ 🏀 🎮 🎧 🎵 🎬 📱 💻 ⌚ 📷 ☕ 🍕 🍔 🌙 ☀️ 🌈'.split(' '),
  },
]

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Smile } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 transition-colors"
          aria-label="ایموجی"
          type="button"
        >
          <Smile className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <div className="flex border-b">
          {EMOJI_GROUPS.map((g, i) => (
            <button
              key={g.label}
              onClick={() => setTab(i)}
              className={cn(
                'flex-1 text-xs py-2 font-medium transition-colors',
                i === tab ? 'text-brand border-b-2 border-brand' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="h-56 overflow-y-auto nice-scroll p-2 grid grid-cols-8 gap-0.5">
          {EMOJI_GROUPS[tab].emojis.map((e, i) => (
            <button
              key={i}
              onClick={() => onPick(e)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-xl"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
