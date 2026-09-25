import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, forbidden } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  if (!me.isAdmin) return forbidden()

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000)

  const [users, messages, conversations, mediaMessages, newUsers, activeMessages, banned] = await Promise.all([
    prisma.user.count(),
    prisma.message.count({ where: { deletedAt: null } }),
    prisma.conversation.count(),
    prisma.message.count({ where: { deletedAt: null, type: { in: ['image', 'voice', 'file'] } } }),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.message.count({ where: { deletedAt: null, createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { isBanned: true } }),
  ])

  /* messages per day (last 7 days) for chart */
  const chart: { day: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now.getTime() - i * 24 * 3600 * 1000)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 24 * 3600 * 1000)
    const count = await prisma.message.count({ where: { createdAt: { gte: start, lt: end }, deletedAt: null } })
    chart.push({ day: start.toISOString(), count })
  }

  return NextResponse.json({
    stats: { users, messages, conversations, mediaMessages, newUsers, activeMessages, banned },
    chart,
  })
}
