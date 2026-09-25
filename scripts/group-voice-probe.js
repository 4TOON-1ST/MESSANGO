/**
 * Group-voice signaling probe — verifies the full server-side gv:* flow
 * with two authenticated socket clients (no WebRTC media needed).
 *
 * Steps:
 *  1. register/login two users via REST
 *  2. create a group with both members
 *  3. A joins gv → expects gv:state(1) + gv:peers([])
 *  4. B joins gv → both get gv:state(2) + gv:update(2); B gets gv:peers([A])
 *  5. B --gv:offer--> A ; A --gv:answer--> B ; A --gv:ice--> B
 *  6. A --gv:mute--> both get gv:state with muted=true for A
 *  7. B leaves → A gets gv:peer-left + gv:state(1) + gv:update(1)
 *  8. A leaves → gv:update(0)
 */
const { io } = require('socket.io-client')

const API = 'http://127.0.0.1:3000'
const SOCK = 'http://127.0.0.1:3003'

const results = []
function ok(name, cond) {
  results.push([name, !!cond])
  console.log(`${cond ? '✔' : '✘'} ${name}`)
}

async function api(path, opts = {}, token) {
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`)
  return json
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(SOCK, { path: '/socket.io', transports: ['polling'], auth: { token } })
    s.on('connect', () => resolve(s))
    s.on('connect_error', (e) => reject(new Error('connect_error: ' + e.message)))
    setTimeout(() => reject(new Error('socket connect timeout')), 8000)
  })
}

/* wait for a specific event on a socket (with timeout) */
function waitFor(socket, event, timeout = 6000, filter = () => true) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, h)
      reject(new Error(`timeout waiting for ${event}`))
    }, timeout)
    const h = (data) => {
      if (!filter(data)) return
      clearTimeout(t)
      socket.off(event, h)
      resolve(data)
    }
    socket.on(event, h)
  })
}

async function main() {
  const stamp = Date.now().toString(36)

  /* 1 — create two fresh users */
  const u1 = await api('/api/auth/register', {
    method: 'POST',
    body: { username: 'gv' + stamp + 'a', displayName: 'کاربر آ', password: 'Test@1234' },
  })
  const u2 = await api('/api/auth/register', {
    method: 'POST',
    body: { username: 'gv' + stamp + 'b', displayName: 'کاربر ب', password: 'Test@1234' },
  })
  console.log('users ready:', u1.user.id, u2.user.id)

  /* 2 — group with both members */
  const { conversation } = await api(
    '/api/conversations',
    { method: 'POST', body: { type: 'group', name: 'گروه تست تماس ' + stamp, memberIds: [u2.user.id] } },
    u1.token
  )
  console.log('group ready:', conversation.id)

  /* sockets */
  const A = await connect(u1.token)
  const B = await connect(u2.token)
  console.log('sockets:', A.id, B.id)

  /* 3 — A joins */
  const aState1 = waitFor(A, 'gv:state')
  A.emit('gv:join', { convId: conversation.id })
  const s1 = await aState1
  ok('A: gv:state after join (1 participant)', s1.participants.length === 1 && s1.participants[0].userId === u1.user.id)
  const aPeers = await waitFor(A, 'gv:peers')
  ok('A: gv:peers empty (first joiner)', Array.isArray(aPeers.peers) && aPeers.peers.length === 0)

  /* 4 — B joins; B should receive peers=[A.socketId], A should get state(2) */
  const aState2 = waitFor(A, 'gv:state', 6000, (d) => d.participants.length === 2)
  const bState2 = waitFor(B, 'gv:state', 6000, (d) => d.participants.length === 2)
  const aUpd = waitFor(A, 'gv:update', 6000, (d) => d.count === 2)
  B.emit('gv:join', { convId: conversation.id })
  const [sa2, sb2, aup] = await Promise.all([aState2, bState2, aUpd])
  ok('A: gv:state(2) after B joined', sa2.participants.length === 2)
  ok('B: gv:state(2) after join', sb2.participants.length === 2)
  ok('A: gv:update count=2', aup.count === 2 && Array.isArray(aup.userIds))
  const bPeers = await waitFor(B, 'gv:peers')
  ok('B: gv:peers contains A socket', bPeers.peers.length === 1 && bPeers.peers[0] === A.id)

  /* 5 — signaling relay: B offers → A answers → A sends ice */
  const aOffer = waitFor(A, 'gv:offer')
  B.emit('gv:offer', { convId: conversation.id, to: A.id, sdp: { type: 'offer', sdp: 'v=0-fake' } })
  const off = await aOffer
  ok('A: gv:offer relayed from B', off.from === B.id && off.sdp?.sdp === 'v=0-fake')

  const bAnswer = waitFor(B, 'gv:answer')
  A.emit('gv:answer', { convId: conversation.id, to: B.id, sdp: { type: 'answer', sdp: 'v=0-answer' } })
  const ans = await bAnswer
  ok('B: gv:answer relayed from A', ans.from === A.id && ans.sdp?.sdp === 'v=0-answer')

  const bIce = waitFor(B, 'gv:ice')
  A.emit('gv:ice', { convId: conversation.id, to: B.id, candidate: { candidate: 'candidate:1', sdpMid: '0' } })
  const ice = await bIce
  ok('B: gv:ice relayed from A', ice.from === A.id && !!ice.candidate?.candidate)

  /* relay must be rejected for sockets outside the voice room */
  const C = await connect(u1.token) /* same user, other tab, NOT in voice room */
  let relayBlocked = false
  C.on('gv:offer', () => { relayBlocked = true })
  C.emit('gv:offer', { convId: conversation.id, to: A.id, sdp: { type: 'offer', sdp: 'intruder' } })
  await new Promise((r) => setTimeout(r, 700))
  ok('relay blocked for socket outside voice room', relayBlocked === false)
  C.disconnect()

  /* 6 — mute */
  const aMuted = waitFor(A, 'gv:state', 6000, (d) => d.participants.some((p) => p.userId === u1.user.id && p.muted))
  A.emit('gv:mute', { convId: conversation.id, muted: true })
  const sm = await aMuted
  ok('gv:mute broadcast (A muted=true)', sm.participants.some((p) => p.userId === u1.user.id && p.muted))

  /* 7 — B leaves */
  const aLeft = waitFor(A, 'gv:peer-left', 6000, (d) => d.socketId === B.id)
  const aState3 = waitFor(A, 'gv:state', 6000, (d) => d.participants.length === 1)
  const aUpd1 = waitFor(A, 'gv:update', 6000, (d) => d.count === 1)
  B.emit('gv:leave', { convId: conversation.id })
  const [, s3, u1v] = await Promise.all([aLeft, aState3, aUpd1])
  ok('A: gv:state(1) after B left', s3.participants.length === 1)
  ok('A: gv:update count=1 after B left', u1v.count === 1)

  /* 8 — A leaves → count 0 */
  const aUpd0 = waitFor(A, 'gv:update', 6000, (d) => d.count === 0)
  A.emit('gv:leave', { convId: conversation.id })
  const s0 = await aUpd0
  ok('gv:update count=0 after A left (room destroyed)', s0.count === 0)

  /* reconnect snapshot: fresh socket of user u1 gets gv:update if room active */
  const D = await connect(u2.token)
  const E = await connect(u1.token)
  const eUpd = waitFor(E, 'gv:update', 6000, (d) => d.count === 1)
  D.emit('gv:join', { convId: conversation.id })
  const snap = await eUpd
  ok('newly connected user receives gv:update snapshot', snap.count === 1)
  D.disconnect()
  E.disconnect()

  A.disconnect()
  B.disconnect()

  const failed = results.filter(([, okv]) => !okv)
  console.log(`\n===== RESULT: ${results.length - failed.length}/${results.length} passed =====`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('PROBE FAILED:', e.message)
  process.exit(1)
})
