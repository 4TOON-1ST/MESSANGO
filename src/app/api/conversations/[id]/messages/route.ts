import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE = 50

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  const { id } = await ctx.params

  const member = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId: me.id, conversationId: id } },
  })
  if (!member) return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 })

  const url = new URL(req.url)
  const cursor = url.searchParams.get('before')

  const messages = await prisma.message.findMany({
    where: { conversationId: id, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: PAGE,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true } },
      replyTo: { include: { sender: { select: { id: true, displayName: true } } } },
    },
  })

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true, lastSeen: true } } },
      },
    },
  })

  return NextResponse.json({
    messages: messages.reverse(),
    participants: conv?.participants.map((x) => ({ ...x.user, lastReadAt: x.lastReadAt })) || [],
    hasMore: messages.length === PAGE,
  })
}
