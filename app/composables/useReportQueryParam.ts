/**
 * useReportQueryParam
 *
 * Syncs a single filter value (string | string[] | number) with the URL query
 * string. Falls back to localStorage when the query param is absent.
 *
 * Priority: URL query param → localStorage → provided default
 *
 * Usage:
 *   const dateFrom = useReportQueryParam('from', '2026-04-01')
 *   const page     = useReportQueryParam('page', 1)
 *   const statuses = useReportQueryParam('statuses', [] as string[])
 */

const LS_KEY = 'autopro:report-params'
const EMPTY_ARRAY_SENTINEL = '__empty__'

type ParamValue = string | number | string[]

/** Read / write the shared localStorage object */
function lsGet(): Record<string, ParamValue> {
  if (!import.meta.client) return {}
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function lsSet(key: string, value: ParamValue) {
  if (!import.meta.client) return
  try {
    const obj = lsGet()
    obj[key] = value
    localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {
    return
  }
}

function lsRemove(key: string) {
  if (!import.meta.client) return
  try {
    const obj = lsGet()
    const next = Object.fromEntries(
      Object.entries(obj).filter(([entryKey]) => entryKey !== key)
    )
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    return
  }
}

/** Coerce a raw query param string to the same shape as `defaultValue` */
function coerce<T extends ParamValue>(raw: string | string[] | null | undefined, defaultValue: T): T {
  if (raw === null || raw === undefined) return defaultValue

  if (Array.isArray(defaultValue)) {
    if (raw === EMPTY_ARRAY_SENTINEL) {
      return [] as unknown as T
    }

    const arr = Array.isArray(raw) ? raw : raw.split(',').filter(Boolean)
    return arr as unknown as T
  }
  if (typeof defaultValue === 'number') {
    const n = Number(raw)
    return (isNaN(n) ? defaultValue : n) as T
  }
  return (Array.isArray(raw) ? raw[0] ?? defaultValue : raw) as T
}

/** Serialize to a query-param string (arrays → comma-separated) */
function serialize(value: ParamValue): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(',') : EMPTY_ARRAY_SENTINEL
  }
  return String(value)
}

/** True if the value is "empty" (equals default / empty array) */
function isEmpty<T extends ParamValue>(value: T, defaultValue: T): boolean {
  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    if (value.length !== defaultValue.length) return false
    return value.every((item, index) => item === defaultValue[index])
  }
  return value === defaultValue
}

export function useReportQueryParam<T extends ParamValue>(key: string, defaultValue: T) {
  const route = useRoute()
  const router = useRouter()

  // ── Determine initial value ──────────────────────────────────────────────
  // 1. URL query param
  const rawQuery = route.query[key] as string | string[] | undefined
  let initial: T = defaultValue

  if (rawQuery !== undefined && rawQuery !== '' && rawQuery !== null) {
    initial = coerce(rawQuery, defaultValue)
  } else {
    // 2. localStorage fallback
    const saved = lsGet()[key]
    if (saved !== undefined) {
      initial = coerce(
        Array.isArray(saved) ? saved : String(saved),
        defaultValue
      )
    }
  }

  const state = ref(initial) as Ref<T>

  // ── Keep URL in sync ─────────────────────────────────────────────────────
  watch(
    state,
    (value) => {
      if (!import.meta.client) return

      const queryWithoutKey = Object.fromEntries(
        Object.entries(route.query).filter(([entryKey]) => entryKey !== key)
      )
      const isExplicitEmptyArray = Array.isArray(value)
        && Array.isArray(defaultValue)
        && value.length === 0
        && defaultValue.length > 0

      if (isExplicitEmptyArray) {
        lsSet(key, value)
        router.replace({ query: queryWithoutKey })
      } else if (isEmpty(value, defaultValue)) {
        lsRemove(key)
        router.replace({ query: queryWithoutKey })
      } else {
        lsSet(key, value)
        router.replace({
          query: {
            ...queryWithoutKey,
            [key]: serialize(value)
          }
        })
      }
    },
    { deep: true }
  )

  // ── React to browser back/forward navigation ─────────────────────────────
  watch(
    () => route.query[key],
    (rawNew) => {
      if (rawNew === undefined || rawNew === '' || rawNew === null) {
        // URL cleared — leave as-is (don't reset to default on nav)
        return
      }
      const coerced = coerce(rawNew as string | string[], defaultValue)
      const serializedNew = serialize(coerced)
      const serializedCurrent = serialize(state.value)
      if (serializedNew !== serializedCurrent) {
        state.value = coerced
      }
    }
  )

  return state
}
