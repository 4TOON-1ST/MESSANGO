import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/server-auth'
import { internalBroadcast } from '@server/socket-handler'

export const runtime = 'nodejs'

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  if (!me.isAdmin) return forbidden()
  const { id } = await ctx.params

  const msg = await prisma.message.findUnique({ where: { id } })
  if (!msg) return badRequest('پیام پیدا نشد')

  const now = new Date()
  const updated = await prisma.message.update({
    where: { id },
    data: { deletedAt: now, content: null, mediaUrl: null, mediaName: null, mediaSize: null, mediaDuration: null, mediaPeaks: null },
  })

  const full = await prisma.message.findUnique({
    where: { id },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatar: true, isAdmin: true } },
      replyTo: { include: { sender: { select: { id: true, displayName: true } } } },
    },
  })

  await internalBroadcast('msg:updated', { message: full }, [`conv:${updated.conversationId}`])

  return NextResponse.json({ ok: true })
}
