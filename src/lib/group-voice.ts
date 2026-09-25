'use client'

/**
 * GroupVoiceEngine — تماس صوتی گروهی (WebRTC mesh)
 *
 * هر عضو گروه که به تماس می‌پیوندد با تک‌تک اعضای موجود یک RTCPeerConnection
 * برقرار می‌کند (mesh). سیگنالینگ از طریق سوکت انجام می‌شود:
 *   gv:join / gv:leave / gv:offer / gv:answer / gv:ice / gv:mute
 * و وضعیت اتاق با gv:state و gv:update به همه اعضا منتقل می‌شود.
 *
 * جهت جلوگیری از glare، همیشه «عضو جدید» به سمت اعضای قبلی offer می‌فرستد
 * (سرور لیست peers را به joiner می‌دهد). یک tie-break ایمن هم بر اساس
 * socket.id پیاده شده تا در حالت‌های خاص هرگز دو offer همزمان رخ ندهد.
 */

import { useMessenger } from '@/store/messenger'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302'] },
]

type Handlers = {
  onToast: (msg: string) => void
}

class GroupVoiceEngine {
  private socket: any = null
  private handlers: Handlers

  /* peer connections by remote socketId */
  private pcs = new Map<string, RTCPeerConnection>()
  private pendingIce = new Map<string, RTCIceCandidateInit[]>()
  private audioEls = new Map<string, HTMLAudioElement>()
  private localStream: MediaStream | null = null
  private convId: string | null = null
  private muted = false
  private joining = false

  constructor(handlers: Handlers) {
    this.handlers = handlers
  }

  get activeConvId(): string | null {
    return this.convId
  }

  bindSocket(socket: any) {
    this.socket = socket

    /* joiner must initiate offers toward existing peers */
    socket.on('gv:peers', ({ convId, peers }: { convId: string; peers: string[] }) => {
      if (convId !== this.convId) return
      for (const peerSid of peers) {
        if (!this.pcs.has(peerSid)) this.createPeer(peerSid, true)
      }
    })

    socket.on('gv:offer', async ({ convId, from, sdp }: { convId: string; from: string; sdp: RTCSessionDescriptionInit }) => {
      if (convId !== this.convId) return
      try {
        let pc = this.pcs.get(from)
        if (!pc) pc = this.createPeer(from, false)

        /* glare safety: if we also have a local offer, lower id yields & answers */
        if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
          const mySid = String(socket.id || '')
          if (mySid < from) {
            /* keep our offer; the remote side will adopt it */
            return
          }
          try {
            await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit)
          } catch { /* older browsers */ }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        await this.flushIce(from)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        this.socket?.emit('gv:answer', { convId, to: from, sdp: answer })
      } catch (e) {
        console.error('gv:offer failed', e)
      }
    })

    socket.on('gv:answer', async ({ convId, from, sdp }: { convId: string; from: string; sdp: RTCSessionDescriptionInit }) => {
      if (convId !== this.convId) return
      const pc = this.pcs.get(from)
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        await this.flushIce(from)
      } catch (e) {
        console.error('gv:answer failed', e)
      }
    })

    socket.on('gv:ice', ({ convId, from, candidate }: { convId: string; from: string; candidate: RTCIceCandidateInit }) => {
      if (convId !== this.convId) return
      const pc = this.pcs.get(from)
      /* queue candidates that arrive before the remote description */
      if (!pc || !pc.remoteDescription) {
        const q = this.pendingIce.get(from) || []
        q.push(candidate)
        this.pendingIce.set(from, q)
        return
      }
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { /* non-fatal */ })
    })

    socket.on('gv:state', ({ convId, participants }: { convId: string; participants: import('@/lib/types').GroupVoiceParticipant[] }) => {
      if (convId !== this.convId) return
      const st = useMessenger.getState()
      if (st.groupVoice && st.groupVoice.convId === convId) {
        st.setGroupVoice({ ...st.groupVoice, participants })
      }
    })

    socket.on('gv:peer-left', ({ convId, socketId }: { convId: string; socketId: string }) => {
      if (convId !== this.convId) return
      this.dropPeer(socketId)
    })
  }

  /* ---------- public API ---------- */

  async join(conv: { id: string }) {
    if (this.convId || this.joining) {
      this.handlers.onToast('در حال حاضر در یک تماس گروهی هستید')
      return
    }
    const st = useMessenger.getState()
    if (st.call) {
      this.handlers.onToast('برای تماس گروهی، ابتدا تماس فعلی را پایان دهید')
      return
    }
    this.joining = true
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      this.convId = conv.id
      this.muted = false
      st.setGroupVoice({ convId: conv.id, participants: [], muted: false })
      this.socket?.emit('gv:join', { convId: conv.id })
    } catch (e) {
      console.error('gv join failed', e)
      this.cleanup()
      useMessenger.getState().setGroupVoice(null)
      this.handlers.onToast('دسترسی به میکروفون ممکن نیست')
    } finally {
      this.joining = false
    }
  }

  leave() {
    if (this.convId) this.socket?.emit('gv:leave', { convId: this.convId })
    this.cleanup()
    useMessenger.getState().setGroupVoice(null)
  }

  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return this.muted
    track.enabled = !track.enabled
    this.muted = !track.enabled
    if (this.convId) this.socket?.emit('gv:mute', { convId: this.convId, muted: this.muted })
    const st = useMessenger.getState()
    if (st.groupVoice) st.setGroupVoice({ ...st.groupVoice, muted: this.muted })
    return this.muted
  }

  /** re-join after socket reconnect (socket.id changes) */
  rejoin() {
    if (!this.convId) return
    this.dropAllPeers()
    this.socket?.emit('gv:join', { convId: this.convId })
  }

  /** full teardown — used on logout */
  reset() {
    if (this.convId) {
      try { this.socket?.emit('gv:leave', { convId: this.convId }) } catch { /* noop */ }
    }
    this.cleanup()
    useMessenger.getState().setGroupVoice(null)
  }

  /* ---------- internals ---------- */

  private createPeer(peerSid: string, initiator: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pcs.set(peerSid, pc)

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream)
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && this.convId) {
        this.socket?.emit('gv:ice', { convId: this.convId, to: peerSid, candidate: e.candidate })
      }
    }

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track])
      let el = this.audioEls.get(peerSid)
      if (!el) {
        el = document.createElement('audio')
        el.autoplay = true
        el.dataset.peer = peerSid
        document.body.appendChild(el)
        this.audioEls.set(peerSid, el)
      }
      el.srcObject = stream
      el.play().catch(() => { /* autoplay guard */ })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.dropPeer(peerSid)
      }
    }

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (this.convId && pc.localDescription) {
            this.socket?.emit('gv:offer', { convId: this.convId, to: peerSid, sdp: pc.localDescription })
          }
        })
        .catch((e) => console.error('gv offer failed', e))
    }

    return pc
  }

  private async flushIce(peerSid: string) {
    const queued = this.pendingIce.get(peerSid)
    if (!queued || !queued.length) return
    const pc = this.pcs.get(peerSid)
    if (!pc) return
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch { /* non-fatal */ }
    }
    this.pendingIce.delete(peerSid)
  }

  private dropPeer(peerSid: string) {
    const pc = this.pcs.get(peerSid)
    if (pc) {
      try { pc.close() } catch { /* noop */ }
      this.pcs.delete(peerSid)
    }
    this.pendingIce.delete(peerSid)
    const el = this.audioEls.get(peerSid)
    if (el) {
      try { el.srcObject = null; el.remove() } catch { /* noop */ }
      this.audioEls.delete(peerSid)
    }
  }

  private dropAllPeers() {
    for (const sid of Array.from(this.pcs.keys())) this.dropPeer(sid)
  }

  private cleanup() {
    this.dropAllPeers()
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.convId = null
    this.muted = false
  }
}

export default GroupVoiceEngine
