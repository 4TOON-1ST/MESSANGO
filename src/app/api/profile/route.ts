import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, badRequest } from '@/lib/server-auth'
import { internalBroadcast, userPublic } from '@server/socket-handler'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  try {
    const body = await req.json()
    const data: Record<string, string | null> = {}

    if (body.displayName !== undefined) {
      const v = String(body.displayName).trim()
      if (v.length < 1 || v.length > 50) return badRequest('نام نمایشی باید بین ۱ تا ۵۰ کاراکتر باشد')
      data.displayName = v
    }
    if (body.bio !== undefined) {
      const v = String(body.bio).trim()
      if (v.length > 200) return badRequest('بیوگرافی حداکثر ۲۰۰ کاراکتر است')
      data.bio = v
    }
    if (body.avatar !== undefined) {
      data.avatar = body.avatar ? String(body.avatar) : null
    }

    const user = await prisma.user.update({ where: { id: me.id }, data })

    /* notify everyone so chats/avatars refresh live */
    await internalBroadcast('user:updated', { user: userPublic(user) })

    return NextResponse.json({
      user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, bio: user.bio, isAdmin: user.isAdmin },
    })
  } catch (e) {
    console.error(e)
    return badRequest('خطا در بروزرسانی پروفایل')
  }
}
