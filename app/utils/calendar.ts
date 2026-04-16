export type CalendarView = 'month' | 'week' | 'day'

export const HOUR_START = 7
export const HOUR_END = 20
/** 1 pixel per minute — container height in px */
export const GRID_HEIGHT = (HOUR_END - HOUR_START) * 60 // 780

/** Formats a Date to YYYY-MM-DD using local time (avoids UTC offset issues) */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function isToday(d: Date): boolean {
  const t = new Date()
  return (
    d.getFullYear() === t.getFullYear()
    && d.getMonth() === t.getMonth()
    && d.getDate() === t.getDate()
  )
}

export function getMonthRange(d: Date): { from: string; to: string } {
  const y = d.getFullYear()
  const m = d.getMonth()
  return { from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) }
}

export function getWeekRange(d: Date): { from: string; to: string } {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: toISO(mon), to: toISO(sun) }
}

export function getDayRange(d: Date): { from: string; to: string } {
  const iso = toISO(d)
  return { from: iso, to: iso }
}

/** Returns 42 Date objects covering 6 weeks for the month containing d (Mon-first) */
export function buildMonthGrid(d: Date): Date[] {
  const y = d.getFullYear()
  const m = d.getMonth()
  const first = new Date(y, m, 1)
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1
  const start = new Date(first)
  start.setDate(1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

/** Returns the 7 days (Mon–Sun) of the week containing d */
export function buildWeekDays(d: Date): Date[] {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(mon)
    wd.setDate(mon.getDate() + i)
    return wd
  })
}

/** Returns time slot labels every 30 min from HOUR_START to HOUR_END */
export function buildTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = HOUR_START; h < HOUR_END; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

/** Converts a HH:MM time string to pixel offset from top of the event grid */
export function minuteFromStart(time: string): number {
  const [hh, mm] = time.split(':').map(Number)
  const minutes = (hh - HOUR_START) * 60 + (mm ?? 0)
  return Math.max(0, Math.min(minutes, GRID_HEIGHT - 1))
}

/** Current time pixel offset (for the now-indicator) */
export function getCurrentMinuteFromStart(): number {
  const now = new Date()
  return (now.getHours() - HOUR_START) * 60 + now.getMinutes()
}

export function isCurrentTimeVisible(): boolean {
  const h = new Date().getHours()
  return h >= HOUR_START && h < HOUR_END
}

/** Short weekday name for a date (Mon, Ter, Qua…) */
export function formatDayShort(d: Date): string {
  return d
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '')
    .toLowerCase()
}

export function formatCalendarTitle(d: Date, view: CalendarView): string {
  if (view === 'month') {
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
  }
  if (view === 'week') {
    const { from, to } = getWeekRange(d)
    const f = new Date(`${from}T00:00:00`)
    const t = new Date(`${to}T00:00:00`)
    if (f.getMonth() === t.getMonth()) {
      return `${f.getDate()}–${t.getDate()} de ${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(f)}`
    }
    const fStr = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(f)
    const tStr = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(t)
    return `${fStr} – ${tStr}`
  }
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
