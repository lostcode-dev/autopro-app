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
  installments_progress: { paid: number; total: number } | null
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
    items?: { name?: string; description?: string; quantity: number; unit_price: number }[]
  }
  client: { name: string; phone?: string | null } | null
  vehicle: { brand: string | null; model: string | null; license_plate: string | null } | null
  installments?: unknown[]
}
