const DEFAULT_START_OS_NUMBER = 4000
const VALID_OS_NUMBER_REGEX = /^OS(\d{4,})$/i

export function normalizeOsNumber(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const match = raw.match(/^\s*(?:OS)?\s*(\d{1,})\s*$/i)
  if (match) return `OS${match[1]}`
  return raw
}

export function computeNextOsNumber(orders: Array<{ number: string | null | undefined }>) {
  let highest: number | null = null

  for (const order of orders) {
    const raw = String(order.number || '').trim()
    const match = raw.match(VALID_OS_NUMBER_REGEX)
    if (!match) continue

    const numericPart = Number(match[1])
    if (!Number.isFinite(numericPart)) continue

    highest = highest === null ? numericPart : Math.max(highest, numericPart)
  }

  const next = highest === null ? DEFAULT_START_OS_NUMBER : highest + 1
  return `OS${next}`
}
