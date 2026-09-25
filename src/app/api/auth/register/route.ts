import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { setAuthCookie, badRequest } from '@/lib/server-auth'
import { hashPassword, signToken } from '@server/auth-utils'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const username = String(body.username || '').trim()
    const displayName = String(body.displayName || '').trim()
    const password = String(body.password || '')

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return badRequest('نام کاربری باید ۳ تا ۲۰ کاراکتر انگلیسی، عدد یا _ باشد')
    }
    if (displayName.length < 1 || displayName.length > 50) {
      return badRequest('نام نمایشی باید بین ۱ تا ۵۰ کاراکتر باشد')
    }
    if (password.length < 6) {
      return badRequest('رمز عبور باید حداقل ۶ کاراکتر باشد')
    }

    const exists = await prisma.user.findUnique({ where: { username } })
    if (exists) return badRequest('این نام کاربری قبلاً ثبت شده است')

    const user = await prisma.user.create({
      data: {
        username,
        displayName,
        password: hashPassword(password),
      },
    })

    const token = signToken({ sub: user.id, username: user.username })
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, bio: user.bio, isAdmin: user.isAdmin },
      token,
    })
    return setAuthCookie(res, token)
  } catch (e) {
    console.error(e)
    return badRequest('خطا در ثبت‌نام، دوباره تلاش کنید')
  }
}
