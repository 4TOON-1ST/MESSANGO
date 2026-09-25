import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, badRequest } from '@/lib/server-auth'
import { internalBroadcast } from '@server/socket-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ------------------------------ GET (list) ------------------------------ */
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()

  const parts = await prisma.conversationParticipant.findMany({
    where: { userId: me.id },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true, lastSeen: true } } },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const convIds = parts.map((p) => p.conversationId)

  const lastMessages = await Promise.all(
    convIds.map((cid) =>
      prisma.message.findFirst({
        where: { conversationId: cid },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { id: true, displayName: true } } },
      })
    )
  )
  const unreadCounts = await Promise.all(
    convIds.map((cid) => {
      const myRow = parts.find((p) => p.conversationId === cid)!
      return prisma.message.count({
        where: {
          conversationId: cid,
          senderId: { not: me.id },
          deletedAt: null,
          ...(myRow.lastReadAt ? { createdAt: { gt: myRow.lastReadAt } } : {}),
        },
      })
    })
  )

  const conversations = parts.map((p, i) => {
    const c = p.conversation
    const others = c.participants.filter((x) => x.userId !== me.id)
    const lm = lastMessages[i]
    return {
      id: c.id,
      type: c.type,
      name: c.type === 'group' ? c.name : others[0]?.user.displayName || 'کاربر ناشناس',
      avatar: c.type === 'group' ? c.avatar : others[0]?.user.avatar,
      createdById: c.createdById,
      createdAt: c.createdAt,
      lastReadAt: p.lastReadAt,
      participants: c.participants.map((x) => ({ ...x.user, lastReadAt: x.lastReadAt })),
      lastMessage: lm
        ? {
            id: lm.id,
            type: lm.type,
            content: lm.deletedAt ? 'این پیام حذف شد' : lm.content,
            mediaUrl: lm.deletedAt ? null : lm.mediaUrl,
            senderId: lm.senderId,
            senderName: lm.sender?.displayName || '',
            createdAt: lm.createdAt,
            deletedAt: lm.deletedAt,
          }
        : null,
      unreadCount: unreadCounts[i],
    }
  })

  conversations.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime()
    const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime()
    return tb - ta
  })

  return NextResponse.json({ conversations })
}

/* ---------------------------- POST (create) ----------------------------- */
export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  try {
    const body = await req.json()
    const type = body.type === 'group' ? 'group' : 'dm'

    if (type === 'dm') {
      const otherId = String(body.userId || '')
      if (!otherId || otherId === me.id) return badRequest('کاربر نامعتبر است')
      const other = await prisma.user.findUnique({ where: { id: otherId } })
      if (!other || other.isBanned) return badRequest('کاربر پیدا نشد')

      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'dm',
          AND: [
            { participants: { some: { userId: me.id } } },
            { participants: { some: { userId: otherId } } },
          ],
        },
      })
      if (existing) {
        return NextResponse.json({ conversation: await shapeConv(existing.id) })
      }

      const conv = await prisma.conversation.create({
        data: { type: 'dm', createdById: me.id },
      })
      await prisma.conversationParticipant.createMany({
        data: [
          { userId: me.id, conversationId: conv.id },
          { userId: otherId, conversationId: conv.id },
        ],
      })
      const shaped = await shapeConv(conv.id)
      await internalBroadcast('conversation:new', { conversation: shaped }, [`user:${otherId}`, `user:${me.id}`])
      return NextResponse.json({ conversation: shaped })
    }

    /* ---- group ---- */
    const name = String(body.name || '').trim()
    if (name.length < 1 || name.length > 50) return badRequest('نام گروه باید بین ۱ تا ۵۰ کاراکتر باشد')
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds.filter((x: unknown) => typeof x === 'string') : []
    const uniqueIds = Array.from(new Set(memberIds.filter((id) => id !== me.id)))
    if (uniqueIds.length < 1) return badRequest('حداقل یک عضو انتخاب کنید')

    const users = await prisma.user.findMany({ where: { id: { in: uniqueIds }, isBanned: false } })
    const conv = await prisma.conversation.create({
      data: { type: 'group', name, createdById: me.id },
    })
    await prisma.conversationParticipant.createMany({
      data: [me.id, ...users.map((u) => u.id)].map((userId) => ({ userId, conversationId: conv.id })),
    })
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: me.id,
        type: 'system',
        content: `گروه «${name}» ساخته شد`,
      },
    })
    const shaped = await shapeConv(conv.id)
    await internalBroadcast('conversation:new', { conversation: shaped }, [
      `user:${me.id}`,
      ...users.map((u) => `user:${u.id}`),
    ])
    return NextResponse.json({ conversation: shaped })
  } catch (e) {
    console.error(e)
    return badRequest('خطا در ساخت گفتگو')
  }
}

async function shapeConv(convId: string) {
  const c = await prisma.conversation.findUnique({
    where: { id: convId },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true, lastSeen: true } } },
      },
    },
  })
  if (!c) throw new Error('conv missing')
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    avatar: c.avatar,
    createdById: c.createdById,
    createdAt: c.createdAt,
    participants: c.participants.map((x) => ({ ...x.user, lastReadAt: x.lastReadAt })),
    lastMessage: null,
    unreadCount: 0,
    lastReadAt: null,
  }
}
