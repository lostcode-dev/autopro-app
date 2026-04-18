const STORAGE_KEY = 'autopro:report-filters'

function defaultFrom(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function defaultTo(): string {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

export function useReportDateRange() {
  const dateFrom = useState<string>('report:dateFrom', defaultFrom)
  const dateTo = useState<string>('report:dateTo', defaultTo)
  const orderStatusFilters = useState<string[]>('report:orderStatusFilters', () => [])
  const paymentStatusFilters = useState<string[]>('report:paymentStatusFilters', () => [])
  const selectedEmployees = useState<string[]>('report:selectedEmployees', () => [])

  // Restore from localStorage once per client session
  if (import.meta.client) {
    const initialized = useState('report:filters:init', () => false)
    if (!initialized.value) {
      initialized.value = true
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.from) dateFrom.value = parsed.from
          if (parsed.to) dateTo.value = parsed.to
          if (Array.isArray(parsed.orderStatusFilters)) orderStatusFilters.value = parsed.orderStatusFilters
          if (Array.isArray(parsed.paymentStatusFilters)) paymentStatusFilters.value = parsed.paymentStatusFilters
          if (Array.isArray(parsed.selectedEmployees)) selectedEmployees.value = parsed.selectedEmployees
        }
      } catch {}
    }
  }

  // Persist changes to localStorage
  watch([dateFrom, dateTo, orderStatusFilters, paymentStatusFilters, selectedEmployees], ([from, to, osf, psf, se]) => {
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ from, to, orderStatusFilters: osf, paymentStatusFilters: psf, selectedEmployees: se }))
      } catch {}
    }
  }, { deep: true })

  return { dateFrom, dateTo, orderStatusFilters, paymentStatusFilters, selectedEmployees }
}
