import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized } from '@/lib/server-auth'
import { internalBroadcast } from '@server/socket-handler'

export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  const { id } = await ctx.params

  const member = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId: me.id, conversationId: id } },
  })
  if (!member) return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 })

  const now = new Date()
  await prisma.conversationParticipant.update({
    where: { userId_conversationId: { userId: me.id, conversationId: id } },
    data: { lastReadAt: now },
  })

  /* let other members update their read ticks */
  await internalBroadcast('msg:read', { convId: id, userId: me.id, lastReadAt: now }, [`conv:${id}`])

  return NextResponse.json({ ok: true, lastReadAt: now })
}
