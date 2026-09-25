import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/server-auth'
import { internalBroadcast } from '@server/socket-handler'

export const runtime = 'nodejs'

/** POST { text } — sends a system message to every user's DM with the admin */
export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  if (!me.isAdmin) return forbidden()

  const body = await req.json()
  const text = String(body.text || '').trim()
  if (text.length < 1 || text.length > 2000) return badRequest('متن پیام باید بین ۱ تا ۲۰۰۰ کاراکتر باشد')

  const users = await prisma.user.findMany({
    where: { id: { not: me.id }, isBanned: false },
    select: { id: true },
  })

  let sent = 0
  for (const u of users) {
    let conv = await prisma.conversation.findFirst({
      where: {
        type: 'dm',
        AND: [
          { participants: { some: { userId: me.id } } },
          { participants: { some: { userId: u.id } } },
        ],
      },
    })
    let isNew = false
    if (!conv) {
      conv = await prisma.conversation.create({ data: { type: 'dm', createdById: me.id } })
      await prisma.conversationParticipant.createMany({
        data: [
          { userId: me.id, conversationId: conv.id },
          { userId: u.id, conversationId: conv.id },
        ],
      })
      isNew = true
    }

    const msg = await prisma.message.create({
      data: { conversationId: conv.id, senderId: me.id, type: 'system', content: text },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true } },
      },
    })

    const rooms = [`user:${u.id}`]
    if (isNew) {
      const full = await prisma.conversation.findUnique({
        where: { id: conv.id },
        include: { participants: { include: { user: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true, lastSeen: true } } } } },
      })
      await internalBroadcast(
        'conversation:new',
        {
          conversation: full && {
            id: full.id,
            type: full.type,
            name: full.name,
            avatar: full.avatar,
            createdById: full.createdById,
            createdAt: full.createdAt,
            participants: full.participants.map((x) => ({ ...x.user, lastReadAt: x.lastReadAt })),
            lastMessage: null,
            unreadCount: 0,
            lastReadAt: null,
          },
        },
        rooms
      )
    }
    await internalBroadcast('msg:new', { tempId: null, message: msg }, rooms)
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
