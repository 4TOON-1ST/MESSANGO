/**
 * server.js — Production server (Node.js) for Railway / VPS / any Node host
 * ---------------------------------------------------------------------------
 * One single process that serves:
 *   1) Next.js app (App Router + API routes)
 *   2) Socket.IO real-time service (path: /socket.io)
 *   3) Static uploaded media (/uploads/*)
 *   4) Internal broadcast endpoint used by API routes (/internal/broadcast)
 *
 * Start:  node server.js        (after `npm run build`)
 * Port:   process.env.PORT (Railway sets it automatically) or 3000
 */
const http = require('http')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

/* ---------- tiny .env loader (so local `node server.js` works without export) ---------- */
function loadDotenv(file) {
  try {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const k = m[1]
      const v = m[2].trim().replace(/^["']|["']$/g, '')
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch (e) { /* ignore */ }
}
loadDotenv(path.join(__dirname, '.env'))
loadDotenv(path.join(__dirname, '.env.production'))

const PORT = parseInt(process.env.PORT || '3000', 10)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads')

/* ---------- make sure upload dir exists ---------- */
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }) } catch (e) { /* ignore */ }

/* ---------- push DB schema (idempotent, safe for SQLite) ---------- */
if (process.env.DB_SCHEMA_PUSH !== '0') {
  try {
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      env: process.env,
      cwd: __dirname,
    })
  } catch (e) {
    console.error('[server] prisma db push failed (continuing — DB may already be up to date)')
  }
}

/* ---------- seed admin account ---------- */
const { PrismaClient } = require('@prisma/client')
const { hashPassword } = require('./server/auth-utils')
const prisma = new PrismaClient({ log: ['error'] })

async function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'Admin@1404'
  const existing = await prisma.user.findUnique({ where: { username } })
  if (!existing) {
    await prisma.user.create({
      data: {
        username,
        displayName: process.env.ADMIN_DISPLAY_NAME || 'مدیر سیستم',
        password: hashPassword(password),
        isAdmin: true,
        bio: 'مدیر این پیام‌رسان',
      },
    })
    console.log(`[server] admin account created → username: ${username} / password: ${password}`)
  } else if (!existing.isAdmin) {
    await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true } })
    console.log(`[server] existing user "${username}" promoted to admin`)
  }
}

/* ---------- upload static serving ---------- */
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.weba': 'audio/webm', '.webm': 'video/webm', '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.txt': 'text/plain',
}

function serveUpload(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const rel = decodeURIComponent(url.pathname.replace(/^\/uploads\//, ''))
  const file = path.join(UPLOAD_DIR, path.basename(rel)) /* basename prevents path traversal */
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404).end('Not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    })
    fs.createReadStream(file).pipe(res)
  })
}

/* ---------- boot ---------- */
const next = require('next')
const app = next({ dev: false, dir: __dirname })
const handle = app.getRequestHandler()

app.prepare()
  .then(ensureAdmin)
  .then(() => {
    const { Server } = require('socket.io')
    const { attachSocket, isInternalRequest, handleInternalRequest } = require('./server/socket-handler')

    const server = http.createServer((req, res) => {
      if (isInternalRequest(req)) {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try { body = JSON.parse(body || '{}') } catch { body = {} }
          handleInternalRequest(req, res, io, body)
        })
        return
      }
      if ((req.url || '').startsWith('/uploads/')) {
        serveUpload(req, res)
        return
      }
      handle(req, res)
    })

    const io = new Server(server, {
      path: '/socket.io',
      cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e7,
    })
    attachSocket(io)

    server.listen(PORT, () => {
      console.log(`[server] Messango running on port ${PORT} (Next.js + Socket.IO + uploads)`)
    })
  })
  .catch((e) => {
    console.error('[server] failed to start:', e)
    process.exit(1)
  })

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
