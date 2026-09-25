import { NextResponse } from 'next/server'
import { getSessionUser, unauthorized, badRequest } from '@/lib/server-auth'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/webm': '.weba',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'text/plain': '.txt',
}

export function uploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
}

export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return unauthorized()

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return badRequest('فایلی ارسال نشده است')
    if (file.size > MAX_SIZE) return badRequest('حجم فایل حداکثر ۲۵ مگابایت است')

    const mime = file.type || 'application/octet-stream'
    const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'file'
    const ext = EXT_BY_MIME[mime] || path.extname(file.name || '') || '.bin'

    const dir = uploadDir()
    await mkdir(dir, { recursive: true })
    const filename = `${randomUUID()}${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, filename), buf)

    return NextResponse.json({
      url: `/uploads/${filename}`,
      name: file.name || filename,
      size: file.size,
      mime,
      kind,
    })
  } catch (e) {
    console.error(e)
    return badRequest('خطا در آپلود فایل')
  }
}
