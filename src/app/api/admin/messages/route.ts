import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, forbidden } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  if (!me.isAdmin) return forbidden()

  const messages = await prisma.message.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 80,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatar: true } },
      conversation: {
        select: { id: true, type: true, name: true, participants: { select: { user: { select: { displayName: true } } } } },
      },
    },
  })

  return NextResponse.json({ messages })
}
