'use client'

/* Tiny WebAudio sound effects — no assets needed */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.06, type: OscillatorType = 'sine') {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02)
  g.gain.linearRampToValueAtTime(0, c.currentTime + start + dur)
  osc.connect(g).connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.05)
}

/** short pleasant ping for incoming message */
export function playMessageSound() {
  tone(880, 0, 0.12, 0.045)
  tone(1174, 0.09, 0.15, 0.045)
}

/** outgoing ringback tone (repeated by caller) */
export function playRingback() {
  tone(440, 0, 0.4, 0.05)
  tone(480, 0, 0.4, 0.05)
}

/** incoming ring tone (repeated by callee) */
export function playRingtone() {
  tone(660, 0, 0.25, 0.06)
  tone(660, 0.35, 0.25, 0.06)
  tone(880, 0.7, 0.3, 0.06)
}

export function playCallEnd() {
  tone(600, 0, 0.12, 0.04)
  tone(400, 0.1, 0.2, 0.04)
}
