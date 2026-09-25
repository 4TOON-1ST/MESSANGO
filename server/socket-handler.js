/**
 * socket-handler.js — Shared Socket.IO logic (CommonJS)
 * Runs in two environments:
 *   1) Sandbox/Dev : mini-services/socket-service  (standalone process, port 3003)
 *   2) Production  : server.js (attached to the Next.js http server, same port)
 *
 * Handles: auth, presence, messaging, typing, read receipts, WebRTC voice-call
 * signaling, group/dm conversation events and an internal HTTP broadcast API
 * used by Next.js API routes to push events to connected sockets.
 */
const path = require('path')
const fs = require('fs')
const { verifyToken } = require('./auth-utils')

/* ---------- env fallback loader (so prisma/jwt always have their envs) ---------- */
function loadEnvFile() {
  const candidates = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env'),
  ]
  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue
      const txt = fs.readFileSync(envPath, 'utf8')
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
        if (!m) continue
        const k = m[1]
        const v = m[2].trim().replace(/^["']|["']$/g, '')
        if (['DATABASE_URL', 'INTERNAL_SECRET', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'PORT'].includes(k) && process.env[k] === undefined) {
          process.env[k] = v
        }
      }
    } catch (e) { /* ignore */ }
  }
}
loadEnvFile()

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'internal-dev-secret'

let db = null
function getDb() {
  if (db) return db
  const { PrismaClient } = require('@prisma/client')
  db = new PrismaClient({ log: ['error'] })
  return db
}

/* ---------- serializers ---------- */
const userPublic = (u) =>
  u && {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio,
    isAdmin: !!u.isAdmin,
    isBanned: !!u.isBanned,
    lastSeen: u.lastSeen,
    createdAt: u.createdAt,
  }

/* ---------- helpers ---------- */
async function isParticipant(convId, userId) {
  const p = await getDb().conversationParticipant.findUnique({
    where: { userId_conversationId: { userId, conversationId: convId } },
  })
  return !!p
}

async function buildMessage(id) {
  return getDb().message.findUnique({
    where: { id },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true } },
      replyTo: {
        include: { sender: { select: { id: true, displayName: true } } },
      },
    },
  })
}

/* ==================================================================== */

function attachSocket(io) {
  /* presence: userId -> Set<socketId> */
  const online = new Map()

  /* group voice rooms: convId -> Map<socketId, {userId, displayName, avatar, muted}> */
  const voiceRooms = new Map()

  const emitToUser = (userId, event, payload) => io.to(`user:${userId}`).emit(event, payload)

  const voiceParticipants = (room) =>
    room
      ? Array.from(room.entries()).map(([socketId, p]) => ({ socketId, ...p }))
      : []

  function leaveVoiceRoom(socket, convId) {
    const room = voiceRooms.get(convId)
    if (!room || !room.has(socket.id)) return false
    room.delete(socket.id)
    socket.leave(`gv:${convId}`)
    if (room.size === 0) voiceRooms.delete(convId)
    else io.to(`gv:${convId}`).emit('gv:state', { convId, participants: voiceParticipants(room) })
    /* notify everyone in the conversation (badges, join bar) */
    io.to(`conv:${convId}`).emit('gv:update', { convId, count: room.size })
    io.to(`gv:${convId}`).emit('gv:peer-left', { convId, socketId: socket.id })
    return true
  }

  function leaveAllVoiceRooms(socket) {
    for (const convId of Array.from(voiceRooms.keys())) {
      leaveVoiceRoom(socket, convId)
    }
  }

  /* ---------- auth middleware ---------- */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token
      const payload = verifyToken(token)
      if (!payload || !payload.sub) return next(new Error('unauthorized'))
      const user = await getDb().user.findUnique({ where: { id: payload.sub } })
      if (!user) return next(new Error('unauthorized'))
      if (user.isBanned) return next(new Error('banned'))
      socket.data.user = user
      next()
    } catch (e) {
      console.error('[socket-auth] middleware error:', e && e.message)
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', async (socket) => {
    const me = socket.data.user
    const uid = me.id

    /* join personal room + all conversation rooms */
    socket.join(`user:${uid}`)
    let myConvIds = []
    try {
      const parts = await getDb().conversationParticipant.findMany({
        where: { userId: uid },
        select: { conversationId: true },
      })
      myConvIds = parts.map((p) => p.conversationId)
      for (const convId of myConvIds) socket.join(`conv:${convId}`)
    } catch (e) {
      console.error('join rooms failed', e)
    }

    /* snapshot of already-active group voice rooms in my conversations */
    for (const convId of myConvIds) {
      const room = voiceRooms.get(convId)
      if (room && room.size > 0) {
        socket.emit('gv:update', {
          convId,
          count: new Set(Array.from(room.values()).map((p) => p.userId)).size,
          userIds: Array.from(new Set(Array.from(room.values()).map((p) => p.userId))),
        })
      }
    }

    /* presence */
    if (!online.has(uid)) online.set(uid, new Set())
    online.get(uid).add(socket.id)
    io.emit('presence', { userId: uid, online: true })
    socket.emit('presence:list', { userIds: Array.from(online.keys()) })

    /* ---------------- messaging ---------------- */
    socket.on('msg:send', async (data, ack) => {
      try {
        const { convId, tempId, type, content, mediaUrl, mediaName, mediaSize, mediaDuration, mediaPeaks, replyToId } = data || {}
        if (!convId) return
        if (!(await isParticipant(convId, uid))) return
        const conv = await getDb().conversation.findUnique({ where: { id: convId } })
        if (!conv) return
        const clean = typeof content === 'string' ? content.slice(0, 4000) : null
        const msg = await getDb().message.create({
          data: {
            conversationId: convId,
            senderId: uid,
            type: ['text', 'image', 'voice', 'file'].includes(type) ? type : 'text',
            content: clean,
            mediaUrl: mediaUrl || null,
            mediaName: mediaName || null,
            mediaSize: Number.isFinite(mediaSize) ? Math.floor(mediaSize) : null,
            mediaDuration: Number.isFinite(mediaDuration) ? Math.floor(mediaDuration) : null,
            mediaPeaks: typeof mediaPeaks === 'string' ? mediaPeaks.slice(0, 400) : null,
            replyToId: replyToId || null,
          },
        })
        const full = await buildMessage(msg.id)
        /* mark read for sender */
        await getDb().conversationParticipant.update({
          where: { userId_conversationId: { userId: uid, conversationId: convId } },
          data: { lastReadAt: new Date() },
        }).catch(() => {})
        const payload = { tempId: tempId || null, message: full }
        socket.emit('msg:sent', payload)
        socket.to(`conv:${convId}`).emit('msg:new', payload)
        if (ack) ack({ ok: true })
      } catch (e) {
        console.error('msg:send', e)
        if (ack) ack({ ok: false })
      }
    })

    socket.on('msg:typing', async (data) => {
      const { convId, isTyping } = data || {}
      if (!convId || !(await isParticipant(convId, uid))) return
      socket.to(`conv:${convId}`).emit('typing', {
        convId,
        userId: uid,
        displayName: me.displayName,
        isTyping: !!isTyping,
      })
    })

    socket.on('msg:edit', async (data) => {
      try {
        const { id, content } = data || {}
        const msg = await getDb().message.findUnique({ where: { id } })
        if (!msg || msg.senderId !== uid || msg.type !== 'text' || msg.deletedAt) return
        const updated = await getDb().message.update({
          where: { id },
          data: { content: String(content || '').slice(0, 4000), editedAt: new Date() },
        })
        const full = await buildMessage(updated.id)
        io.to(`conv:${updated.conversationId}`).emit('msg:updated', { message: full })
      } catch (e) { console.error('msg:edit', e) }
    })

    socket.on('msg:delete', async (data) => {
      try {
        const { id } = data || {}
        const msg = await getDb().message.findUnique({ where: { id } })
        if (!msg || (msg.senderId !== uid && !me.isAdmin)) return
        const updated = await getDb().message.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            content: null,
            mediaUrl: null,
            mediaName: null,
            mediaSize: null,
            mediaDuration: null,
            mediaPeaks: null,
          },
        })
        const full = await buildMessage(updated.id)
        io.to(`conv:${updated.conversationId}`).emit('msg:updated', { message: full })
      } catch (e) { console.error('msg:delete', e) }
    })

    socket.on('msg:read', async (data) => {
      try {
        const { convId } = data || {}
        if (!convId || !(await isParticipant(convId, uid))) return
        const now = new Date()
        await getDb().conversationParticipant.update({
          where: { userId_conversationId: { userId: uid, conversationId: convId } },
          data: { lastReadAt: now },
        })
        socket.to(`conv:${convId}`).emit('msg:read', { convId, userId: uid, lastReadAt: now })
      } catch (e) { console.error('msg:read', e) }
    })

    /* ---------------- voice call signaling (WebRTC) ---------------- */
    socket.on('call:offer', async (data) => {
      const { to, convId, sdp } = data || {}
      if (!to || !sdp) return
      if (to === uid) return
      const targetOnline = online.has(to)
      if (!targetOnline) {
        socket.emit('call:error', { to, reason: 'offline' })
        return
      }
      emitToUser(to, 'call:incoming', {
        from: { id: me.id, username: me.username, displayName: me.displayName, avatar: me.avatar },
        convId: convId || null,
        sdp,
      })
    })

    socket.on('call:answer', (data) => {
      const { to, sdp } = data || {}
      if (!to || !sdp) return
      emitToUser(to, 'call:answered', { from: uid, sdp })
    })

    socket.on('call:ice', (data) => {
      const { to, candidate } = data || {}
      if (!to || !candidate) return
      emitToUser(to, 'call:ice', { from: uid, candidate })
    })

    socket.on('call:reject', (data) => {
      const { to } = data || {}
      if (!to) return
      emitToUser(to, 'call:rejected', { from: uid })
    })

    socket.on('call:end', (data) => {
      const { to, reason } = data || {}
      if (!to) return
      emitToUser(to, 'call:ended', { from: uid, reason: reason || 'hangup' })
    })

    /* ---------------- group voice call (WebRTC mesh) ---------------- */
    /* join: adds caller to the voice room, returns current participants and
       the list of existing socket ids the joiner must send offers to. */
    socket.on('gv:join', async (data) => {
      try {
        const { convId } = data || {}
        if (!convId) return
        if (!(await isParticipant(convId, uid))) return
        let room = voiceRooms.get(convId)
        if (!room) {
          room = new Map()
          voiceRooms.set(convId, room)
        }
        /* if this socket somehow re-joins, replace its entry */
        room.delete(socket.id)
        room.set(socket.id, {
          userId: uid,
          displayName: me.displayName,
          avatar: me.avatar || null,
          muted: false,
        })
        socket.join(`gv:${convId}`)

        const participants = voiceParticipants(room)
        io.to(`gv:${convId}`).emit('gv:state', { convId, participants })
        io.to(`conv:${convId}`).emit('gv:update', {
          convId,
          count: new Set(participants.map((p) => p.userId)).size,
          userIds: Array.from(new Set(participants.map((p) => p.userId))),
        })
        /* the joiner initiates offers toward existing peers */
        const peers = participants.filter((p) => p.socketId !== socket.id).map((p) => p.socketId)
        socket.emit('gv:peers', { convId, peers })
      } catch (e) {
        console.error('gv:join', e)
      }
    })

    socket.on('gv:leave', (data) => {
      const { convId } = data || {}
      if (convId) leaveVoiceRoom(socket, convId)
    })

    /* offer/answer/ice are relayed 1:1 inside the voice room only */
    socket.on('gv:offer', (data) => {
      const { convId, to, sdp } = data || {}
      if (!convId || !to || !sdp) return
      const room = voiceRooms.get(convId)
      if (!room || !room.has(socket.id) || !room.has(to)) return
      io.to(to).emit('gv:offer', { convId, from: socket.id, fromUserId: uid, sdp })
    })

    socket.on('gv:answer', (data) => {
      const { convId, to, sdp } = data || {}
      if (!convId || !to || !sdp) return
      const room = voiceRooms.get(convId)
      if (!room || !room.has(socket.id) || !room.has(to)) return
      io.to(to).emit('gv:answer', { convId, from: socket.id, sdp })
    })

    socket.on('gv:ice', (data) => {
      const { convId, to, candidate } = data || {}
      if (!convId || !to || !candidate) return
      const room = voiceRooms.get(convId)
      if (!room || !room.has(socket.id) || !room.has(to)) return
      io.to(to).emit('gv:ice', { convId, from: socket.id, candidate })
    })

    socket.on('gv:mute', (data) => {
      const { convId, muted } = data || {}
      const room = voiceRooms.get(convId)
      if (!room || !room.has(socket.id)) return
      room.get(socket.id).muted = !!muted
      io.to(`gv:${convId}`).emit('gv:state', { convId, participants: voiceParticipants(room) })
    })

    /* ---------------- disconnect ---------------- */
    socket.on('disconnect', async () => {
      try {
        /* drop out of any group voice rooms */
        leaveAllVoiceRooms(socket)

        const set = online.get(uid)
        if (set) {
          set.delete(socket.id)
          if (set.size === 0) {
            online.delete(uid)
            const lastSeen = new Date()
            await getDb().user.update({ where: { id: uid }, data: { lastSeen } }).catch(() => {})
            io.emit('presence', { userId: uid, online: false, lastSeen })
          }
        }
      } catch (e) { console.error('disconnect', e) }
    })
  })

  return { online, emitToUser, voiceRooms }
}

/* ==================================================================== */

/**
 * Internal HTTP broadcast API — used by Next.js API routes (different process
 * in dev) to push events. In production (single process) it works the same.
 * POST /internal/broadcast  { secret, event, payload, rooms? }
 */
function isInternalRequest(req) {
  return req.method === 'POST' && (req.url || '').startsWith('/internal/broadcast')
}

function handleInternalRequest(req, res, io, body) {
  try {
    if (body.secret !== INTERNAL_SECRET) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'forbidden' }))
      return true
    }
    const { event, payload, rooms } = body || {}
    if (!event) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'no event' }))
      return true
    }
    if (Array.isArray(rooms) && rooms.length) {
      for (const r of rooms) io.to(r).emit(event, payload)
    } else {
      io.emit(event, payload)
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false }))
  }
  return true
}

/**
 * convenience for API routes (server-side).
 * SOCKET_INTERNAL_URL = base URL of the process that owns the io instance.
 *   - dev sandbox : http://127.0.0.1:3003
 *   - production  : unset → same process/port
 */
async function internalBroadcast(event, payload, rooms) {
  const base = process.env.SOCKET_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || '3000'}`
  try {
    await fetch(`${base}/internal/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: INTERNAL_SECRET, event, payload, rooms }),
    })
  } catch (e) {
    console.error('internalBroadcast failed', e.message)
  }
}

module.exports = {
  attachSocket,
  isInternalRequest,
  handleInternalRequest,
  internalBroadcast,
  userPublic,
}
