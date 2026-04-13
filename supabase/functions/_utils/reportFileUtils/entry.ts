// @ts-nocheck

export function jsonError(status: number, payload: Record<string, unknown>) {
  return Response.json(payload, { status })
}

export function csvEscape(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ')
  return `"${text.replace(/"/g, '""')}"`
}

export function uint8ToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x2000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export function textToBase64(text: string) {
  return uint8ToBase64(new TextEncoder().encode(text))
}

export function toLocalDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
