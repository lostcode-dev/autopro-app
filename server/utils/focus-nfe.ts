import { monitoredNuvemFiscalFetch, sanitizeCpfCnpj, normalizeText } from './nuvem-fiscal'

// ─── Constants ────────────────────────────────────────────────────────────────

export const FOCUS_NFE_OWNER_EMAIL =
  process.env.FOCUSNFE_OWNER_EMAIL ||
  process.env.NUVEMFISCAL_OWNER_EMAIL ||
  'beenkoficial@gmail.com'

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Builds the Basic Auth header for Focus NFe.
 * The API token is used as the username and the password is left empty,
 * as required by RFC 7617: Authorization: Basic base64("TOKEN:")
 */
export function getFocusNfeBasicAuthHeader(): string {
  const token = process.env.FOCUSNFE_API_TOKEN
  if (!token) {
    throw new Error('FOCUSNFE_API_TOKEN não configurado')
  }
  const encoded = Buffer.from(`${token}:`).toString('base64')
  return `Basic ${encoded}`
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

export function getFocusNfeApiBaseUrl(): string {
  return process.env.FOCUSNFE_API_BASE_URL || 'https://api.focusnfe.com.br'
}

// ─── Server-side cache ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export function createServerCache<T>(ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>()
  return {
    get(key: string): T | undefined {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() > entry.expiresAt) {
        store.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key: string, value: T): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
    }
  }
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { monitoredNuvemFiscalFetch as monitoredFocusNfeFetch, sanitizeCpfCnpj, normalizeText }
