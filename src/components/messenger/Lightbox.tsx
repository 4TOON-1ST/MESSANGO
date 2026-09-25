'use client'

import { useMessenger } from '@/store/messenger'
import { X } from 'lucide-react'

export default function Lightbox() {
  const lightbox = useMessenger((s) => s.lightbox)
  const setLightbox = useMessenger((s) => s.setLightbox)
  if (!lightbox) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={() => setLightbox(null)}
    >
      <button
        className="absolute top-4 end-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        aria-label="بستن"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="max-w-4xl max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img src={lightbox.url} alt={lightbox.caption || 'تصویر'} className="max-w-full max-h-[82vh] object-contain rounded-lg" />
        {lightbox.caption && <p className="text-white/90 text-sm">{lightbox.caption}</p>}
      </div>
    </div>
  )
}
