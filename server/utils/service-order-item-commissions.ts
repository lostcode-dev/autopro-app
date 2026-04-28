export type ServiceOrderCommissionEmployee = {
  id: string
  has_commission?: boolean | null
  commission_type?: string | null
  commission_amount?: number | string | null
  commission_base?: string | null
  commission_categories?: string[] | null
}

export type ServiceOrderCommissionItem = Record<string, unknown>

type ServiceOrderResponsibleEmployeeRef = {
  employee_id?: string | null
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function getItemQuantity(item: ServiceOrderCommissionItem) {
  return toNumber(item.quantity || 1) || 1
}

function getItemTotal(item: ServiceOrderCommissionItem) {
  const quantity = getItemQuantity(item)
  const rawTotal = item.total_price ?? item.total_amount
  return rawTotal != null
    ? toNumber(rawTotal)
    : toNumber(item.unit_price) * quantity
}

function getItemCost(item: ServiceOrderCommissionItem) {
  return toNumber(item.cost_price ?? item.cost_amount) * getItemQuantity(item)
}

export function computeServiceOrderItemsWithCommissionSnapshots({
  items,
  responsibleEmployees,
  employees,
  discount,
  totalTaxesAmount
}: {
  items: ServiceOrderCommissionItem[]
  responsibleEmployees: ServiceOrderResponsibleEmployeeRef[]
  employees: ServiceOrderCommissionEmployee[]
  discount: unknown
  totalTaxesAmount: unknown
}) {
  const itemEntries = items.map(item => ({
    ...item,
    commission_total: 0,
    total_commission: 0,
    commissions: [] as Record<string, unknown>[]
  }))
  const subtotal = itemEntries.reduce((sum, item) => sum + getItemTotal(item), 0)
  const discountAmount = toNumber(discount)
  const taxesAmount = toNumber(totalTaxesAmount)

  for (const responsible of responsibleEmployees) {
    const employee = employees.find(item => item.id === responsible.employee_id)
    if (!employee?.has_commission) continue

    const commissionType = employee.commission_type ?? null
    const commissionBase = employee.commission_base ?? null
    const commissionAmount = toNumber(employee.commission_amount)
    const commissionCategories = Array.isArray(employee.commission_categories) ? employee.commission_categories : []
    const eligibleEntries = itemEntries
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (commissionCategories.length === 0) return true

        const itemCategoryId = item.category_id
        return !itemCategoryId || commissionCategories.includes(String(itemCategoryId))
      })

    if (!eligibleEntries.length) continue

    const eligibleSale = eligibleEntries.reduce((sum, { item }) => sum + getItemTotal(item), 0)
    const eligibleRatio = subtotal > 0 ? eligibleSale / subtotal : 0
    const eligibleDiscount = discountAmount * eligibleRatio
    const eligibleTaxes = taxesAmount * eligibleRatio

    if (commissionType === 'percentage') {
      for (const { item } of eligibleEntries) {
        const itemTotal = getItemTotal(item)
        const fraction = eligibleSale > 0 ? itemTotal / eligibleSale : 1 / eligibleEntries.length
        const itemDiscount = eligibleDiscount * fraction
        const itemTaxes = eligibleTaxes * fraction
        let baseAmount = itemTotal - itemDiscount

        if (commissionBase === 'profit') {
          baseAmount = Math.max(0, baseAmount - getItemCost(item) - itemTaxes)
        }

        const amount = roundCurrency((baseAmount * commissionAmount) / 100)
        if (amount <= 0) continue

        item.commission_total = roundCurrency(toNumber(item.commission_total) + amount)
        item.total_commission = item.commission_total
        item.commissions.push({
          employee_id: employee.id,
          amount,
          commission_type: commissionType,
          commission_base: commissionBase,
          commission_percentage: commissionAmount
        })
      }
      continue
    }

    const perItem = roundCurrency(commissionAmount / eligibleEntries.length)
    const distributed = roundCurrency(perItem * eligibleEntries.length)
    const remainder = roundCurrency(commissionAmount - distributed)

    eligibleEntries.forEach(({ item }, index) => {
      const amount = index === 0 ? roundCurrency(perItem + remainder) : perItem
      if (amount <= 0) return

      item.commission_total = roundCurrency(toNumber(item.commission_total) + amount)
      item.total_commission = item.commission_total
      item.commissions.push({
        employee_id: employee.id,
        amount,
        commission_type: commissionType,
        commission_base: commissionBase,
        commission_percentage: null
      })
    })
  }

  return {
    items: itemEntries,
    commissionAmount: roundCurrency(itemEntries.reduce((sum, item) => sum + toNumber(item.commission_total), 0))
  }
}
