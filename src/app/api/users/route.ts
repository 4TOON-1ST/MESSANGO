import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()

  const users = await prisma.user.findMany({
    where: {
      isBanned: false,
      id: { not: me.id },
      ...(q
        ? {
            OR: [{ username: { contains: q } }, { displayName: { contains: q } }],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true, lastSeen: true, bio: true },
    take: 15,
  })

  return NextResponse.json({ users })
}
