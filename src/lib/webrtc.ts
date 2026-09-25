'use client'

/* WebRTC voice-call engine (audio only) — full flow incl. socket signaling */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302'] },
]

export type CallPeer = {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

export type EngineState = {
  status: 'outgoing' | 'incoming' | 'active'
  peer: CallPeer
  convId: string | null
  startedAt: number | null
  muted: boolean
} | null

type Handlers = {
  onStateChange: (s: EngineState) => void
  onToast: (msg: string) => void
  /** extra busy check — e.g. when a group voice call is running */
  isBusy?: () => boolean
}

class CallEngine {
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private audioEl: HTMLAudioElement | null = null
  private socket: any = null
  private handlers: Handlers
  private incomingOffer: { peer: CallPeer; convId: string | null; sdp: RTCSessionDescriptionInit } | null = null
  state: EngineState = null

  constructor(handlers: Handlers) {
    this.handlers = handlers
  }

  bindSocket(socket: any) {
    this.socket = socket

    socket.on('call:incoming', ({ from, convId, sdp }: { from: CallPeer; convId: string | null; sdp: RTCSessionDescriptionInit }) => {
      if (this.state || this.handlers.isBusy?.()) {
        /* busy → auto reject */
        socket.emit('call:reject', { to: from.id })
        return
      }
      this.incomingOffer = { peer: from, convId, sdp }
      this.state = { status: 'incoming', peer: from, convId, startedAt: null, muted: false }
      this.handlers.onStateChange(this.state)
    })

    socket.on('call:answered', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (!this.pc || this.state?.status !== 'outgoing') return
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
        this.state = { ...this.state!, status: 'active', startedAt: Date.now() }
        this.handlers.onStateChange(this.state)
      } catch (e) {
        console.error('answer failed', e)
        this.hangup()
      }
    })

    socket.on('call:ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      try {
        if (this.pc) await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (e) {
        console.error('ice failed', e)
      }
    })

    socket.on('call:rejected', () => {
      this.cleanup()
      this.handlers.onToast('تماس رد شد')
      this.handlers.onStateChange(null)
    })

    socket.on('call:ended', () => {
      const wasActive = this.state?.status === 'active'
      this.cleanup()
      this.handlers.onToast(wasActive ? 'تماس پایان یافت' : 'تماس لغو شد')
      this.handlers.onStateChange(null)
    })

    socket.on('call:error', ({ reason }: { reason: string }) => {
      this.cleanup()
      this.handlers.onToast(reason === 'offline' ? 'کاربر آنلاین نیست' : 'تماس برقرار نشد')
      this.handlers.onStateChange(null)
    })
  }

  async startCall(peer: CallPeer, convId: string | null) {
    if (this.state) return
    this.state = { status: 'outgoing', peer, convId, startedAt: null, muted: false }
    this.handlers.onStateChange(this.state)
    try {
      await this.setup(peer.id)
      const offer = await this.pc!.createOffer()
      await this.pc!.setLocalDescription(offer)
      this.socket?.emit('call:offer', { to: peer.id, convId, sdp: offer })
    } catch (e) {
      console.error('startCall failed', e)
      this.cleanup()
      this.handlers.onToast('دسترسی به میکروفون ممکن نیست')
      this.handlers.onStateChange(null)
    }
  }

  async accept() {
    if (!this.incomingOffer) return
    const { peer, convId, sdp } = this.incomingOffer
    this.incomingOffer = null
    try {
      await this.setup(peer.id)
      await this.pc!.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await this.pc!.createAnswer()
      await this.pc!.setLocalDescription(answer)
      this.socket?.emit('call:answer', { to: peer.id, sdp: answer })
      this.state = { status: 'active', peer, convId, startedAt: Date.now(), muted: false }
      this.handlers.onStateChange(this.state)
    } catch (e) {
      console.error('accept failed', e)
      this.reject()
    }
  }

  private async setup(peerId: string) {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.localStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.localStream!))

    const remoteStream = new MediaStream()
    this.pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t))
      if (!this.audioEl) {
        this.audioEl = document.createElement('audio')
        this.audioEl.autoplay = true
        document.body.appendChild(this.audioEl)
      }
      this.audioEl.srcObject = remoteStream
      this.audioEl.play().catch(() => {})
    }

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.socket?.emit('call:ice', { to: peerId, candidate: e.candidate })
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'failed') {
        this.cleanup()
        this.handlers.onToast('ارتباط صوتی قطع شد')
        this.handlers.onStateChange(null)
      }
    }
  }

  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    const muted = !track.enabled
    if (this.state) {
      this.state = { ...this.state, muted }
      this.handlers.onStateChange(this.state)
    }
    return muted
  }

  reject() {
    if (this.incomingOffer) {
      this.socket?.emit('call:reject', { to: this.incomingOffer.peer.id })
      this.incomingOffer = null
    }
    this.cleanup()
    this.handlers.onStateChange(null)
  }

  hangup() {
    if (this.state?.peer) {
      this.socket?.emit('call:end', { to: this.state.peer.id, reason: 'hangup' })
    }
    this.cleanup()
    this.handlers.onStateChange(null)
  }

  private cleanup() {
    try {
      this.pc?.getSenders().forEach((s) => s.track?.stop())
      this.pc?.close()
    } catch { /* noop */ }
    this.pc = null
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    if (this.audioEl) this.audioEl.srcObject = null
    this.state = null
    this.incomingOffer = null
  }
}

export default CallEngine
