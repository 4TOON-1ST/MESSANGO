'use client'

import { io, type Socket } from 'socket.io-client'

/* Socket URL:
 *  - sandbox dev: NEXT_PUBLIC_SOCKET_URL = "/?XTransformPort=3003" (via gateway)
 *  - production : unset → same origin "/"
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '/'

let socket: Socket | null = null

export function getSocket(token: string | null): Socket {
  if (socket) return socket
  socket = io(SOCKET_URL, {
    /* polling first (works everywhere), then upgrade to websocket when possible;
       if the upgrade fails the connection gracefully stays on polling */
    transports: ['polling', 'websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 15000,
  })
  return socket
}

export function destroySocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/** currently-bound socket (may be null) — for direct emit from components */
export function getExistingSocket(): Socket | null {
  return socket
}
