'use client'

/* Voice recorder with waveform peaks extraction */

export type RecordingResult = {
  blob: Blob
  durationSec: number
  peaks: string
  mime: string
}

function pickMime(): string | undefined {
  const list = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  if (typeof MediaRecorder === 'undefined') return undefined
  return list.find((m) => MediaRecorder.isTypeSupported(m))
}

/** compute normalized peaks string (0-9 per bucket) from a blob */
export async function computePeaks(blob: Blob, buckets = 40): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    const ctx = new Ctx()
    const audio = await ctx.decodeAudioData(arrayBuffer)
    const data = audio.getChannelData(0)
    const chunk = Math.floor(data.length / buckets) || 1
    const peaks: number[] = []
    let max = 0.0001
    for (let i = 0; i < buckets; i++) {
      let sum = 0
      const start = i * chunk
      const end = Math.min(start + chunk, data.length)
      for (let j = start; j < end; j++) sum += Math.abs(data[j])
      const avg = sum / Math.max(1, end - start)
      peaks.push(avg)
      if (avg > max) max = avg
    }
    ctx.close()
    return peaks.map((p) => Math.max(1, Math.round((p / max) * 9))).join('')
  } catch {
    /* fallback: pseudo-random waveform */
    return Array.from({ length: buckets }, () => 1 + Math.floor(Math.random() * 9)).join('')
  }
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private startedAt = 0
  private cancelled = false

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = pickMime()
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined)
    this.chunks = []
    this.cancelled = false
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.startedAt = Date.now()
    this.recorder.start(250)
  }

  cancel() {
    this.cancelled = true
    this.stopInternal()
  }

  async stop(): Promise<RecordingResult | null> {
    const result = await this.stopInternal()
    if (this.cancelled || !result || result.durationSec < 1) return null
    return result
  }

  private stopInternal(): Promise<RecordingResult | null> {
    return new Promise((resolve) => {
      const rec = this.recorder
      if (!rec || rec.state === 'inactive') return resolve(null)
      const durationSec = Math.round((Date.now() - this.startedAt) / 1000)
      rec.onstop = async () => {
        this.stream?.getTracks().forEach((t) => t.stop())
        const mime = rec.mimeType || 'audio/webm'
        const blob = new Blob(this.chunks, { type: mime })
        const peaks = await computePeaks(blob)
        resolve({ blob, durationSec, peaks, mime })
      }
      rec.stop()
      this.recorder = null
    })
  }
}
