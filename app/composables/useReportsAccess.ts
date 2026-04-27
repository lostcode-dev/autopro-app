import { ActionCode } from '~/constants/action-codes'

export interface ReportAccessItem {
  label: string
  icon: string
  to: string
  permission: ActionCode
}

export const reportAccessItems: ReportAccessItem[] = [
  { label: 'Visão geral', icon: 'i-lucide-layout-dashboard', to: '/app/reports', permission: ActionCode.REPORTS_VIEW },
  { label: 'Clientes', icon: 'i-lucide-users', to: '/app/reports/customers', permission: ActionCode.REPORTS_CUSTOMERS },
  { label: 'Comissões', icon: 'i-lucide-hand-coins', to: '/app/reports/commissions', permission: ActionCode.REPORTS_COMMISSIONS },
  { label: 'Compras', icon: 'i-lucide-shopping-cart', to: '/app/reports/purchases', permission: ActionCode.REPORTS_PURCHASES },
  { label: 'Custos', icon: 'i-lucide-badge-dollar-sign', to: '/app/reports/costs', permission: ActionCode.REPORTS_COSTS },
  { label: 'Devedores', icon: 'i-lucide-badge-alert', to: '/app/reports/debtors', permission: ActionCode.REPORTS_DEBTORS },
  { label: 'Fornecedores', icon: 'i-lucide-truck', to: '/app/reports/suppliers', permission: ActionCode.REPORTS_SUPPLIERS },
  { label: 'Lucro', icon: 'i-lucide-trending-up', to: '/app/reports/profit', permission: ActionCode.REPORTS_PROFIT },
  { label: 'Itens vendidos', icon: 'i-lucide-package-search', to: '/app/reports/sales-items', permission: ActionCode.REPORTS_SALES }
]

export function useReportsAccess() {
  const workshop = useWorkshopPermissions()

  const allowedReportItems = computed(() =>
    reportAccessItems.filter(report => workshop.can(report.permission))
  )

  const hasReportsAccess = computed(() => allowedReportItems.value.length > 0)
  const firstReportPath = computed(() => allowedReportItems.value[0]?.to ?? '/app/reports')

  return {
    allowedReportItems,
    hasReportsAccess,
    firstReportPath
  }
}
