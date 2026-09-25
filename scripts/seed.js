/**
 * seed.js — ensure admin account exists (idempotent)
 * Run: DATABASE_URL=... node scripts/seed.js
 */
const path = require('path')
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db'

const { PrismaClient } = require('@prisma/client')
const { hashPassword } = require('../server/auth-utils')

const db = new PrismaClient()

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1404'

async function main() {
  const existing = await db.user.findUnique({ where: { username: ADMIN_USERNAME } })
  if (existing) {
    if (!existing.isAdmin) {
      await db.user.update({ where: { id: existing.id }, data: { isAdmin: true } })
      console.log('existing user promoted to admin:', ADMIN_USERNAME)
    } else {
      console.log('admin already exists:', ADMIN_USERNAME)
    }
    return
  }
  const admin = await db.user.create({
    data: {
      username: ADMIN_USERNAME,
      displayName: 'مدیر سیستم',
      password: hashPassword(ADMIN_PASSWORD),
      isAdmin: true,
      bio: 'مدیر این پیام‌رسان',
    },
  })
  console.log('admin created:', admin.username)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
