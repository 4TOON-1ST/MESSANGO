/**
 * auth-utils.js — Shared auth utilities (CommonJS)
 * Used by both the Socket.IO mini-service and the production server.js
 * Zero external dependencies: uses node:crypto for hashing & JWT (HS256)
 */
const crypto = require('crypto')

/* read lazily so env files loaded after require() still apply */
function getJwtSecret() {
  return process.env.JWT_SECRET || 'gp9Km2xQ7vR4wZ8tYs3Jf6Lh1Nc5Bd0AeXu2Vn8'
  // note: fallback secret is for development only; set JWT_SECRET in production
}

/* ---------------- Password hashing (scrypt) ---------------- */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':')
    if (!salt || !hash) return false
    const check = crypto.scryptSync(String(password), salt, 64)
    const expected = Buffer.from(hash, 'hex')
    if (check.length !== expected.length) return false
    return crypto.timingSafeEqual(check, expected)
  } catch {
    return false
  }
}

/* ---------------- JWT (HS256) ---------------- */

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signToken(payload, expiresInSec = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresInSec }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const sig = b64url(crypto.createHmac('sha256', getJwtSecret()).update(`${h}.${p}`).digest())
  return `${h}.${p}.${sig}`
}

function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [h, p, sig] = parts
    const expected = crypto.createHmac('sha256', getJwtSecret()).update(`${h}.${p}`).digest()
    const given = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
    const body = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null
    return body
  } catch {
    return null
  }
}

/* ---------------- Cookie helper ---------------- */

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

module.exports = { getJwtSecret, hashPassword, verifyPassword, signToken, verifyToken, parseCookies }
