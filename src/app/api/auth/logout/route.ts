import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/server-auth'

export const runtime = 'nodejs'

export async function POST() {
  return clearAuthCookie(NextResponse.json({ ok: true }))
}
