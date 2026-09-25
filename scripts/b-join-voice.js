/* Simulate user B joining the group voice room (signaling only) */
const { io } = require('socket.io-client')

const API = 'http://127.0.0.1:3000'
const SOCK = 'http://127.0.0.1:3003'

async function api(path, opts = {}, token) {
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  return res.json()
}

async function main() {
  const action = process.argv[2] || 'join'
  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'gvtestb1', password: 'Test@1234' } })
  const convs = await api('/api/conversations', {}, login.token)
  const group = convs.conversations.find((c) => c.type === 'group' && c.name === 'گروه آزمون تماس')
  if (!group) throw new Error('group not found')
  console.log('group:', group.id)

  const s = io(SOCK, { path: '/socket.io', transports: ['polling'], auth: { token: login.token } })
  s.on('connect', () => {
    console.log('B connected:', s.id)
    if (action === 'join') s.emit('gv:join', { convId: group.id })
    else if (action === 'leave') s.emit('gv:leave', { convId: group.id })
    /* stay connected so the voice room persists (hold arg in ms) */
    const hold = Number(process.argv[3] || 1500)
    setTimeout(() => process.exit(0), hold)
  })
  s.on('connect_error', (e) => { console.error('connect_error:', e.message); process.exit(1) })
  setTimeout(() => process.exit(2), 8000)
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
