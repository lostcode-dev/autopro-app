export type ServiceOrder = {
  id: string
  number: string | null
  status: string
  payment_status: string | null
  is_installment: boolean
  client_id: string | null
  client_name: string | null
  vehicle_id: string | null
  vehicle_label: string | null
  entry_date: string | null
  reported_defect: string | null
  total_amount: number | null
  responsible_name: string | null
  has_commissions: boolean
  installments_progress: { paid: number, total: number } | null
}

export type ServiceOrderDetail = {
  order: {
    id: string
    number: string | null
    status: string
    payment_status: string | null
    entry_date: string | null
    reported_defect: string | null
    diagnosis: string | null
    notes: string | null
    total_amount: number | null
    discount: number | null
    payment_method: string | null
    items?: { name?: string, description?: string, quantity: number, unit_price: number }[]
  }
  client: { name: string, phone?: string | null } | null
  vehicle: { brand: string | null, model: string | null, license_plate: string | null } | null
  installments?: unknown[]
}

// ─── Full detail (used in DetailModal) ────────────────────────────────────────

export type ServiceOrderItem = {
  name?: string | null
  description?: string | null
  quantity: number
  unit_price: number
  total_price?: number | null
  cost_price?: number | null
  commission_total?: number | null
}

export type ServiceOrderInstallment = {
  id: string
  service_order_id: string
  number?: number | null
  amount: number
  due_date: string | null
  payment_date: string | null
  status: string
}

export type ServiceOrderCommission = {
  id: string
  employee_id: string | null
  amount: number | null
  status: string | null
  service_order_id: string
}

export type ServiceOrderEmployee = {
  id: string
  name: string
  commission_type?: string | null
  commission_value?: number | null
  commission_base?: string | null
  has_commission?: boolean | null
}

export type ServiceOrderRaw = {
  id: string
  number: string | null
  status: string
  payment_status: string | null
  entry_date: string | null
  expected_date?: string | null
  reported_defect: string | null
  diagnosis: string | null
  notes: string | null
  total_amount: number | null
  discount: number | null
  commission_amount: number | null
  payment_method: string | null
  items: ServiceOrderItem[] | null
  apply_taxes: boolean
  is_installment: boolean
  installment_count: number | null
  responsible_employees: { employee_id: string }[] | null
  employee_responsible_id: string | null
  client_id: string | null
  vehicle_id: string | null
  master_product_id: string | null
  organization_id: string
  created_at: string
  updated_at: string | null
}

export type ServiceOrderDetailFull = {
  order: ServiceOrderRaw
  client: {
    id: string
    name: string
    phone?: string | null
    mobile_phone?: string | null
    email?: string | null
  } | null
  vehicle: {
    id: string
    brand: string | null
    model: string | null
    license_plate: string | null
    year?: number | null
    color?: string | null
    fuel_type?: string | null
  } | null
  employees: ServiceOrderEmployee[]
  installments: ServiceOrderInstallment[]
  commissions: ServiceOrderCommission[]
  editLogs: {
    id: string
    created_at: string
    action?: string | null
    changed_by?: string | null
    changes?: Record<string, unknown> | null
  }[]
  responsibleNames: { employee_id: string; name: string | null }[]
}
