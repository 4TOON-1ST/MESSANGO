import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** global search: users + my conversations + messages inside my conversations */
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 1) return NextResponse.json({ users: [], chats: [], messages: [] })

  const users = await prisma.user.findMany({
    where: {
      isBanned: false,
      id: { not: me.id },
      OR: [{ username: { contains: q } }, { displayName: { contains: q } }],
    },
    select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true, lastSeen: true },
    take: 10,
  })

  const myConvs = await prisma.conversationParticipant.findMany({
    where: { userId: me.id },
    include: { conversation: { include: { participants: true } } },
  })

  const convIds = myConvs.map((p) => p.conversationId)

  const matchedConvs = await prisma.conversation.findMany({
    where: { id: { in: convIds }, type: 'group', name: { contains: q } },
    take: 8,
  })

  const msgs = await prisma.message.findMany({
    where: {
      conversationId: { in: convIds },
      deletedAt: null,
      type: 'text',
      content: { contains: q },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      sender: { select: { id: true, displayName: true } },
      conversation: { select: { id: true, type: true, name: true } },
    },
  })

  /* shape chats with display name like sidebar */
  const chats = matchedConvs.map((c) => ({ id: c.id, type: c.type, name: c.name }))

  return NextResponse.json({ users, chats, messages: msgs })
}
