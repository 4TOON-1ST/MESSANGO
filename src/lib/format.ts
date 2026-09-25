/* Persian date/time formatting helpers */

const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' })
const dateFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' })

export function fmtTime(d: string | Date): string {
  return timeFmt.format(new Date(d))
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** "12:34" for today, "دیروز" , "شنبه" , "۱۲ فروردین" */
export function fmtChatTime(d: string | Date): string {
  const date = new Date(d)
  const today = startOfDay(new Date())
  const that = startOfDay(date)
  const diff = (today.getTime() - that.getTime()) / 86400000
  if (diff < 1) return timeFmt.format(date)
  if (diff < 2) return 'دیروز'
  if (diff < 7) return dayFmt.format(date)
  return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(date)
}

/** Date separator label: امروز / دیروز / weekday / full date */
export function fmtDaySeparator(d: string | Date): string {
  const date = new Date(d)
  const today = startOfDay(new Date())
  const that = startOfDay(date)
  const diff = (today.getTime() - that.getTime()) / 86400000
  if (diff < 1) return 'امروز'
  if (diff < 2) return 'دیروز'
  if (diff < 7) return dayFmt.format(date)
  return dateFmt.format(date)
}

export function fmtLastSeen(lastSeen: string | null | undefined): string {
  if (!lastSeen) return 'آفلاین'
  const d = new Date(lastSeen)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'آخرین بازدید همین حالا'
  if (mins < 60) return `آخرین بازدید ${new Intl.NumberFormat('fa-IR').format(mins)} دقیقه پیش`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `آخرین بازدید ${new Intl.NumberFormat('fa-IR').format(hours)} ساعت پیش`
  return `آخرین بازدید ${fmtChatTime(lastSeen)}`
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} بایت`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} کیلوبایت`
  return `${(bytes / 1024 / 1024).toFixed(1)} مگابایت`
}

export function faNum(n: number | string): string {
  return new Intl.NumberFormat('fa-IR').format(n)
}
