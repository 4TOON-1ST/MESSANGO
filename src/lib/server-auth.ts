import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@server/auth-utils'
import type { PrismaClient } from '@prisma/client'
import { prisma } from './db-bridge'

export const TOKEN_COOKIE = 'mtoken'

export type SessionUser = {
  id: string
  username: string
  displayName: string
  avatar: string | null
  bio: string | null
  isAdmin: boolean
  isBanned: boolean
  createdAt: Date
  lastSeen: Date | null
}

/** reads token from cookie or Authorization header and loads the user */
export async function getSessionUser(req?: Request): Promise<SessionUser | null> {
  let token: string | undefined | null
  const authHeader = req?.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    try {
      const store = await cookies()
      token = store.get(TOKEN_COOKIE)?.value
    } catch {
      token = undefined
    }
  }
  const payload = verifyToken(token)
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub as string } })
  if (!user || user.isBanned) return null
  return user as SessionUser
}

export function unauthorized(msg = 'ابتدا وارد حساب خود شوید') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

export function forbidden(msg = 'دسترسی مجاز نیست') {
  return NextResponse.json({ error: msg }, { status: 403 })
}

export function badRequest(msg = 'درخواست نامعتبر است') {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}

export { prisma as db }
