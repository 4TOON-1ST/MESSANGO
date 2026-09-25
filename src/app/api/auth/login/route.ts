import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { setAuthCookie, badRequest, forbidden } from '@/lib/server-auth'
import { verifyPassword, signToken } from '@server/auth-utils'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    if (!username || !password) return badRequest('نام کاربری و رمز عبور الزامی است')

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !verifyPassword(password, user.password)) {
      return badRequest('نام کاربری یا رمز عبور اشتباه است')
    }
    if (user.isBanned) {
      return forbidden('حساب شما توسط مدیر مسدود شده است')
    }

    const token = signToken({ sub: user.id, username: user.username })
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, bio: user.bio, isAdmin: user.isAdmin },
      token,
    })
    return setAuthCookie(res, token)
  } catch (e) {
    console.error(e)
    return badRequest('خطا در ورود، دوباره تلاش کنید')
  }
}
