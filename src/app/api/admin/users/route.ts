import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, forbidden } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  if (!me.isAdmin) return forbidden()

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()

  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ username: { contains: q } }, { displayName: { contains: q } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      bio: true,
      isAdmin: true,
      isBanned: true,
      lastSeen: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({ users })
}
