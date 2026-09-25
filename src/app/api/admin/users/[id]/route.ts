import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db-bridge'
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/server-auth'
import { hashPassword } from '@server/auth-utils'
import { internalBroadcast, userPublic } from '@server/socket-handler'

export const runtime = 'nodejs'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  if (!me.isAdmin) return forbidden()
  const { id } = await ctx.params

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return badRequest('کاربر پیدا نشد')

  const body = await req.json()
  const action = String(body.action || '')

  switch (action) {
    case 'ban': {
      if (target.id === me.id) return badRequest('نمی‌توانید خودتان را مسدود کنید')
      if (target.isAdmin && target.username === (process.env.ADMIN_USERNAME || 'admin')) {
        return badRequest('ادمین اصلی قابل مسدودسازی نیست')
      }
      await prisma.user.update({ where: { id }, data: { isBanned: true } })
      await internalBroadcast('account:banned', { userId: id }, [`user:${id}`])
      break
    }
    case 'unban': {
      await prisma.user.update({ where: { id }, data: { isBanned: false } })
      break
    }
    case 'promote': {
      await prisma.user.update({ where: { id }, data: { isAdmin: true } })
      break
    }
    case 'demote': {
      if (target.id === me.id) return badRequest('نمی‌توانید سطح دسترسی خودتان را کم کنید')
      await prisma.user.update({ where: { id }, data: { isAdmin: false } })
      break
    }
    case 'resetPassword': {
      const newPassword = String(body.newPassword || '')
      if (newPassword.length < 6) return badRequest('رمز جدید باید حداقل ۶ کاراکتر باشد')
      await prisma.user.update({ where: { id }, data: { password: hashPassword(newPassword) } })
      break
    }
    default:
      return badRequest('عملیات نامعتبر است')
  }

  const updated = await prisma.user.findUnique({ where: { id } })
  return NextResponse.json({ user: userPublic(updated) })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()
  if (!me.isAdmin) return forbidden()
  const { id } = await ctx.params

  if (id === me.id) return badRequest('نمی‌توانید حساب خودتان را حذف کنید')
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return badRequest('کاربر پیدا نشد')
  if (target.username === (process.env.ADMIN_USERNAME || 'admin')) {
    return badRequest('ادمین اصلی قابل حذف نیست')
  }

  await internalBroadcast('account:deleted', { userId: id }, [`user:${id}`])
  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
