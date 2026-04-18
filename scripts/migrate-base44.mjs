/**
 * Base44 → AutoPro CSV Migration Script
 *
 * Usage:
 *   node scripts/migrate-base44.mjs --csv-dir ./exports --org-id <uuid> --migrator migration@autopro.local
 *
 * Outputs one .sql file per package in --out-dir (default: ./migration-output).
 * Run the .sql files in order: pkg0.sql → pkg1.sql → ... → pkg6.sql
 *
 * Prerequisites:
 *   - Export each Base44 entity as a separate CSV (UTF-8, comma-delimited, header row)
 *   - Expected filenames: clients.csv, vehicles.csv, employees.csv, suppliers.csv,
 *     service_orders.csv, service_order_installments.csv, financial_transactions.csv,
 *     employee_financial_records.csv, appointments.csv, purchases.csv,
 *     purchase_requests.csv, products.csv, parts.csv,
 *     bank_accounts.csv, financial_categories.csv, product_categories.csv, taxes.csv
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const get = (flag) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const CSV_DIR   = resolve(get('--csv-dir')  ?? './exports')
const OUT_DIR   = resolve(get('--out-dir')  ?? './migration-output')
const ORG_ID    = get('--org-id')   ?? '00000000-0000-0000-0000-000000000000'
const MIGRATOR  = get('--migrator') ?? 'migration@autopro.local'
const DRY_RUN   = args.includes('--dry-run')

if (!existsSync(CSV_DIR)) {
  console.error(`[error] CSV directory not found: ${CSV_DIR}`)
  console.error('  Create it and place exported Base44 CSV files inside.')
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })

console.log(`[migrate-base44]`)
console.log(`  CSV dir   : ${CSV_DIR}`)
console.log(`  Output dir: ${OUT_DIR}`)
console.log(`  Org ID    : ${ORG_ID}`)
console.log(`  Migrator  : ${MIGRATOR}`)
console.log(`  Dry run   : ${DRY_RUN}`)
console.log()

// ─── In-memory ID map (old Base44 id → new UUID) ────────────────────────────

/** @type {Map<string, Map<string, string>>} entity → (oldId → newUuid) */
const idMap = new Map()

function registerEntity(entity) {
  if (!idMap.has(entity)) idMap.set(entity, new Map())
}

function mapId(entity, oldId) {
  if (!oldId) return null
  const m = idMap.get(entity)
  if (!m) return null
  return m.get(String(oldId)) ?? null
}

function assignId(entity, oldId) {
  registerEntity(entity)
  const existing = mapId(entity, oldId)
  if (existing) return existing
  const newId = randomUUID()
  idMap.get(entity).set(String(oldId), newId)
  return newId
}

// ─── CSV parser ──────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180 CSV parser. Handles quoted fields, embedded commas/newlines.
 * @param {string} text
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
function parseCsv(text) {
  const lines = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else if (ch === '\r' && next === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
      i++
    } else {
      current += ch
    }
  }
  if (current) lines.push(current)

  const splitLine = (line) => {
    const fields = []
    let field = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      const nx = line[i + 1]
      if (ch === '"') {
        if (q && nx === '"') { field += '"'; i++ }
        else q = !q
      } else if (ch === ',' && !q) {
        fields.push(field)
        field = ''
      } else {
        field += ch
      }
    }
    fields.push(field)
    return fields
  }

  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const headers = splitLine(nonEmpty[0])
  const rows = nonEmpty.slice(1).map((line) => {
    const values = splitLine(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]))
  })

  return { headers, rows }
}

function loadCsv(filename) {
  const path = join(CSV_DIR, filename)
  if (!existsSync(path)) {
    console.warn(`  [skip] ${filename} not found — skipping entity`)
    return []
  }
  const text = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '') // strip BOM
  const { rows } = parseCsv(text)
  console.log(`  [load] ${filename}: ${rows.length} rows`)
  return rows
}

// ─── SQL helpers ─────────────────────────────────────────────────────────────

const NOW = 'NOW()'

/** Escape a string value for a SQL literal */
function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

function escUuid(v) {
  if (!v) return 'NULL'
  return `'${v}'::uuid`
}

function escNum(v) {
  if (v === null || v === undefined || v === '') return 'NULL'
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? 'NULL' : String(n)
}

function escBool(v) {
  if (v === null || v === undefined || v === '') return 'NULL'
  const s = String(v).toLowerCase()
  if (['true', '1', 'yes', 'sim', 's', 't'].includes(s)) return 'TRUE'
  if (['false', '0', 'no', 'nao', 'não', 'n', 'f'].includes(s)) return 'FALSE'
  return 'NULL'
}

function escDate(v) {
  if (!v) return 'NULL'
  // Accept DD/MM/YYYY or YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split('/')
    return `'${y}-${m}-${d}'`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return `'${v.slice(0, 10)}'`
  return 'NULL'
}

function escJson(v) {
  if (!v || v === '' || v === 'null' || v === '[]' || v === '{}') return "'{}'::jsonb"
  try {
    JSON.parse(v) // validate
    return `'${v.replace(/'/g, "''")}'::jsonb`
  } catch {
    return "'[]'::jsonb"
  }
}

function escJsonArray(v) {
  if (!v || v === '' || v === 'null') return "'[]'::jsonb"
  try {
    const parsed = JSON.parse(v)
    const s = JSON.stringify(Array.isArray(parsed) ? parsed : [parsed])
    return `'${s.replace(/'/g, "''")}'::jsonb`
  } catch {
    return "'[]'::jsonb"
  }
}

// ─── Enum maps ───────────────────────────────────────────────────────────────

const STATUS_OS = {
  orcamento: 'estimate',
  aberta: 'open',
  em_andamento: 'in_progress',
  aguardando_peca: 'waiting_for_part',
  concluida: 'completed',
  entregue: 'delivered',
  cancelada: 'cancelled',
  // English pass-through
  estimate: 'estimate', open: 'open', in_progress: 'in_progress',
  waiting_for_part: 'waiting_for_part', completed: 'completed',
  delivered: 'delivered', cancelled: 'cancelled'
}

const PAYMENT_METHOD = {
  pix: 'pix',
  dinheiro: 'cash',
  cartao_credito: 'credit_card',
  cartao_debito: 'debit_card',
  cheque: 'check',
  boleto: 'bank_slip',
  transferencia: 'transfer',
  sem_forma_pagamento: 'no_payment',
  sem_pagamento: 'no_payment',
  // English pass-through
  cash: 'cash', credit_card: 'credit_card', debit_card: 'debit_card',
  check: 'check', bank_slip: 'bank_slip', transfer: 'transfer', no_payment: 'no_payment'
}

const PAYMENT_STATUS = {
  pendente: 'pending', pago: 'paid', parcial: 'partial',
  pending: 'pending', paid: 'paid', partial: 'partial'
}

const FUEL_TYPE = {
  gasolina: 'gasoline', etanol: 'ethanol', diesel: 'diesel',
  flex: 'flex', gnv: 'cng', eletrico: 'electric', hibrido: 'hybrid',
  gasoline: 'gasoline', ethanol: 'ethanol', cng: 'cng', electric: 'electric', hybrid: 'hybrid'
}

const APPOINTMENT_STATUS = {
  agendado: 'scheduled', confirmado: 'confirmed',
  cancelado: 'cancelled', concluido: 'completed',
  scheduled: 'scheduled', confirmed: 'confirmed', cancelled: 'cancelled', completed: 'completed'
}

const APPOINTMENT_PRIORITY = {
  baixa: 'low', media: 'medium', alta: 'high',
  low: 'low', medium: 'medium', high: 'high'
}

const COMMISSION_TYPE = {
  percentual: 'percentage', fixo: 'fixed_amount',
  percentage: 'percentage', fixed_amount: 'fixed_amount'
}

const COMMISSION_BASE = {
  venda: 'revenue', receita: 'revenue', lucro: 'profit',
  revenue: 'revenue', profit: 'profit'
}

const SUPPLIER_CATEGORY = {
  pecas_automotivas: 'auto_parts', ferramentas: 'tools',
  equipamentos: 'equipment', servicos: 'services',
  consumiveis: 'consumables', outros: 'other',
  auto_parts: 'auto_parts', tools: 'tools', equipment: 'equipment',
  services: 'services', consumables: 'consumables', other: 'other'
}

const PARTS_CATEGORY = {
  motor: 'engine', suspensao: 'suspension', freios: 'brakes',
  transmissao: 'transmission', eletrica: 'electrical', carroceria: 'body',
  filtros: 'filters', oleos: 'oils', pneus: 'tires', outros: 'other',
  engine: 'engine', suspension: 'suspension', brakes: 'brakes',
  transmission: 'transmission', electrical: 'electrical', body: 'body',
  filters: 'filters', oils: 'oils', tires: 'tires', other: 'other'
}

const TRANSACTION_TYPE = {
  receita: 'income', despesa: 'expense', transferencia: 'transfer',
  income: 'income', expense: 'expense', transfer: 'transfer'
}

const EMPLOYEE_RECORD_TYPE = {
  salario: 'salary', comissao: 'commission', adiantamento: 'advance',
  bonus: 'bonus', desconto: 'deduction', outros: 'other',
  salary: 'salary', commission: 'commission', advance: 'advance',
  bonus: 'bonus', deduction: 'deduction', other: 'other'
}

function mapEnum(map, value, fallback = null) {
  if (!value) return fallback
  const v = String(value).toLowerCase().trim()
  return map[v] ?? fallback ?? v
}

// ─── ID map SQL block ────────────────────────────────────────────────────────

function idMapSetupSql() {
  return `-- Migration ID map (resolves Base44 string IDs → new UUIDs across packages)
CREATE TABLE IF NOT EXISTS migration_id_map (
  entity  text,
  old_id  text,
  new_id  uuid,
  PRIMARY KEY (entity, old_id)
);
`
}

function idMapInsertSql(entity, pairs) {
  if (pairs.length === 0) return ''
  const vals = pairs.map(([oldId, newId]) => `  ('${entity}', '${oldId}', '${newId}'::uuid)`).join(',\n')
  return `INSERT INTO migration_id_map (entity, old_id, new_id) VALUES\n${vals}\nON CONFLICT DO NOTHING;\n`
}

// ─── Package generators ──────────────────────────────────────────────────────

// ── Package 0: Foundation ──────────────────────────────────────────────────

function pkg0() {
  const lines = [
    '-- ============================================================',
    '-- Package 0: Foundation (bank_accounts, financial_categories,',
    '--            product_categories, taxes)',
    '-- ============================================================',
    '',
    idMapSetupSql(),
  ]

  // 0.2 bank_accounts
  const bankRows = loadCsv('bank_accounts.csv')
  if (bankRows.length) {
    lines.push('-- 0.2 bank_accounts')
    lines.push('INSERT INTO public.bank_accounts (id, organization_id, account_name, account_type, initial_balance, current_balance, bank_name, branch, account_number, is_active, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = bankRows.map((r) => {
      const newId = assignId('bank_account', r.id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome_conta ?? r.account_name)}, ${esc(r.tipo ?? r.account_type ?? 'checking')}, ${escNum(r.saldo_inicial ?? r.initial_balance ?? 0)}, ${escNum(r.saldo_atual ?? r.current_balance ?? 0)}, ${esc(r.banco ?? r.bank_name)}, ${esc(r.agencia ?? r.branch)}, ${esc(r.conta ?? r.account_number)}, ${escBool(r.ativa ?? r.is_active ?? 'true')}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('bank_account', bankRows.map((r) => [r.id, mapId('bank_account', r.id)])))
  }

  // 0.3 financial_categories
  const fcRows = loadCsv('financial_categories.csv')
  if (fcRows.length) {
    lines.push('-- 0.3 financial_categories')
    lines.push('INSERT INTO public.financial_categories (id, organization_id, name, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = fcRows.map((r) => {
      const newId = assignId('financial_category', r.id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome ?? r.name)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('financial_category', fcRows.map((r) => [r.id, mapId('financial_category', r.id)])))
  }

  // 0.4 product_categories
  const pcRows = loadCsv('product_categories.csv')
  if (pcRows.length) {
    lines.push('-- 0.4 product_categories')
    lines.push('INSERT INTO public.product_categories (id, organization_id, name, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = pcRows.map((r) => {
      const newId = assignId('product_category', r.id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome ?? r.name)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('product_category', pcRows.map((r) => [r.id, mapId('product_category', r.id)])))
  }

  // 0.5 taxes
  const taxRows = loadCsv('taxes.csv')
  if (taxRows.length) {
    lines.push('-- 0.5 taxes')
    lines.push('INSERT INTO public.taxes (id, organization_id, name, type, rate, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = taxRows.map((r) => {
      const newId = assignId('tax', r.id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome ?? r.name)}, ${esc(r.tipo ?? r.type)}, ${escNum(r.aliquota ?? r.rate)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('tax', taxRows.map((r) => [r.id, mapId('tax', r.id)])))
  }

  return lines.join('\n')
}

// ── Package 1: People ──────────────────────────────────────────────────────

function pkg1() {
  const lines = [
    '-- ============================================================',
    '-- Package 1: People (suppliers, employees, clients)',
    '-- ============================================================',
    '',
  ]

  // 1.1 suppliers
  const supRows = loadCsv('suppliers.csv')
  if (supRows.length) {
    lines.push('-- 1.1 suppliers')
    lines.push('INSERT INTO public.suppliers (id, organization_id, name, person_type, tax_id, phone, whatsapp, email, website, zip_code, street, address_number, address_complement, neighborhood, city, state, category, payment_term_days, credit_limit, is_active, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = supRows.map((r) => {
      const newId = assignId('supplier', r.id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome ?? r.name)}, ${esc(r.tipo_pessoa ?? r.person_type ?? 'pj')}, ${esc(r.cpf_cnpj ?? r.tax_id)}, ${esc(r.telefone ?? r.phone)}, ${esc(r.whatsapp)}, ${esc(r.email)}, ${esc(r.site ?? r.website)}, ${esc(r.cep ?? r.zip_code)}, ${esc(r.logradouro ?? r.street)}, ${esc(r.numero ?? r.address_number)}, ${esc(r.complemento ?? r.address_complement)}, ${esc(r.bairro ?? r.neighborhood)}, ${esc(r.cidade ?? r.city)}, ${esc(r.uf ?? r.state)}, ${esc(mapEnum(SUPPLIER_CATEGORY, r.categoria ?? r.category))}, ${escNum(r.prazo_pagamento_dias ?? r.payment_term_days)}, ${escNum(r.limite_credito ?? r.credit_limit)}, ${escBool(r.ativo ?? r.is_active ?? 'true')}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('supplier', supRows.map((r) => [r.id, mapId('supplier', r.id)])))
  }

  // 1.2 employees
  const empRows = loadCsv('employees.csv')
  if (empRows.length) {
    lines.push('-- 1.2 employees')
    lines.push('INSERT INTO public.employees (id, organization_id, name, person_type, tax_id, phone, email, zip_code, street, address_number, address_complement, neighborhood, city, state, has_salary, salary_amount, payment_day, has_commission, commission_type, commission_amount, commission_base, has_minimum_guarantee, minimum_guarantee_amount, pix_key_type, pix_key, termination_date, termination_reason, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = empRows.map((r) => {
      const newId = assignId('employee', r.id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome ?? r.name)}, ${esc(r.tipo_pessoa ?? r.person_type ?? 'pf')}, ${esc(r.cpf_cnpj ?? r.tax_id)}, ${esc(r.telefone ?? r.phone)}, ${esc(r.email)}, ${esc(r.cep ?? r.zip_code)}, ${esc(r.logradouro ?? r.street)}, ${esc(r.numero ?? r.address_number)}, ${esc(r.complemento ?? r.address_complement)}, ${esc(r.bairro ?? r.neighborhood)}, ${esc(r.cidade ?? r.city)}, ${esc(r.uf ?? r.state)}, ${escBool(r.tem_salario ?? r.has_salary)}, ${escNum(r.valor_salario ?? r.salary_amount)}, ${escNum(r.dia_pagamento ?? r.payment_day)}, ${escBool(r.tem_comissao ?? r.has_commission)}, ${esc(mapEnum(COMMISSION_TYPE, r.tipo_comissao ?? r.commission_type))}, ${escNum(r.valor_comissao ?? r.commission_amount)}, ${esc(mapEnum(COMMISSION_BASE, r.base_comissao ?? r.commission_base))}, ${escBool(r.tem_minimo_garantido ?? r.has_minimum_guarantee)}, ${escNum(r.valor_minimo_garantido ?? r.minimum_guarantee_amount)}, ${esc(r.tipo_chave_pix ?? r.pix_key_type)}, ${esc(r.chave_pix ?? r.pix_key)}, ${escDate(r.data_demissao ?? r.termination_date)}, ${esc(r.motivo_demissao ?? r.termination_reason)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('employee', empRows.map((r) => [r.id, mapId('employee', r.id)])))
  }

  // 1.3 clients
  const clientRows = loadCsv('clients.csv')
  if (clientRows.length) {
    lines.push('-- 1.3 clients')
    lines.push('INSERT INTO public.clients (id, organization_id, name, phone, person_type, tax_id, email, zip_code, street, address_number, address_complement, neighborhood, city, state, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = clientRows.map((r) => {
      const newId = assignId('client', r.id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome ?? r.name)}, ${esc(r.telefone ?? r.phone)}, ${esc(r.tipo_pessoa ?? r.person_type ?? 'pf')}, ${esc(r.cpf_cnpj ?? r.tax_id)}, ${esc(r.email)}, ${esc(r.cep ?? r.zip_code)}, ${esc(r.logradouro ?? r.street)}, ${esc(r.numero ?? r.address_number)}, ${esc(r.complemento ?? r.address_complement)}, ${esc(r.bairro ?? r.neighborhood)}, ${esc(r.cidade ?? r.city)}, ${esc(r.uf ?? r.state)}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('client', clientRows.map((r) => [r.id, mapId('client', r.id)])))
  }

  return lines.join('\n')
}

// ── Package 2: Vehicles ────────────────────────────────────────────────────

function pkg2() {
  const lines = [
    '-- ============================================================',
    '-- Package 2: Vehicles',
    '-- ============================================================',
    '',
  ]

  const rows = loadCsv('vehicles.csv')
  if (rows.length) {
    lines.push('INSERT INTO public.vehicles (id, organization_id, client_id, license_plate, brand, model, year, color, engine, fuel_type, mileage, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = rows.map((r) => {
      const newId = assignId('vehicle', r.id)
      const clientId = mapId('client', r.cliente_id ?? r.client_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(clientId)}, ${esc(r.placa ?? r.license_plate)}, ${esc(r.marca ?? r.brand)}, ${esc(r.modelo ?? r.model)}, ${escNum(r.ano ?? r.year)}, ${esc(r.cor ?? r.color)}, ${esc(r.motor ?? r.engine)}, ${esc(mapEnum(FUEL_TYPE, r.combustivel ?? r.fuel_type))}, ${escNum(r.quilometragem ?? r.mileage)}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('vehicle', rows.map((r) => [r.id, mapId('vehicle', r.id)])))
  }

  return lines.join('\n')
}

// ── Package 3: Products & Parts ────────────────────────────────────────────

function pkg3() {
  const lines = [
    '-- ============================================================',
    '-- Package 3: Products & Parts',
    '-- ============================================================',
    '',
  ]

  // 3.1 products
  const prodRows = loadCsv('products.csv')
  if (prodRows.length) {
    lines.push('-- 3.1 products')
    lines.push('INSERT INTO public.products (id, organization_id, name, code, type, category_id, track_inventory, initial_stock_quantity, unit_sale_price, unit_cost_price, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = prodRows.map((r) => {
      const newId = assignId('product', r.id)
      const catId = mapId('product_category', r.categoria_id ?? r.category_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.nome ?? r.name)}, ${esc(r.codigo ?? r.code)}, ${esc(r.tipo ?? r.type ?? 'unit')}, ${escUuid(catId)}, ${escBool(r.controlar_estoque ?? r.track_inventory)}, ${escNum(r.quantidade_inicial_estoque ?? r.initial_stock_quantity ?? 0)}, ${escNum(r.preco_venda_unitario ?? r.unit_sale_price)}, ${escNum(r.preco_custo_unitario ?? r.unit_cost_price)}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('product', prodRows.map((r) => [r.id, mapId('product', r.id)])))
  }

  // 3.2 parts
  const partRows = loadCsv('parts.csv')
  if (partRows.length) {
    lines.push('-- 3.2 parts')
    lines.push('INSERT INTO public.parts (id, organization_id, product_id, code, description, stock_quantity, sale_price, brand, category, minimum_quantity, cost_price, supplier_name, location, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = partRows.map((r) => {
      const newId = assignId('part', r.id)
      const productId = mapId('product', r.produto_id ?? r.product_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(productId)}, ${esc(r.codigo ?? r.code)}, ${esc(r.descricao ?? r.description)}, ${escNum(r.quantidade_estoque ?? r.stock_quantity ?? 0)}, ${escNum(r.preco_venda ?? r.sale_price)}, ${esc(r.marca ?? r.brand)}, ${esc(mapEnum(PARTS_CATEGORY, r.categoria ?? r.category))}, ${escNum(r.quantidade_minima ?? r.minimum_quantity)}, ${escNum(r.preco_custo ?? r.cost_price)}, ${esc(r.fornecedor ?? r.supplier_name)}, ${esc(r.localizacao ?? r.location)}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('part', partRows.map((r) => [r.id, mapId('part', r.id)])))
  }

  return lines.join('\n')
}

// ── Package 4: Service Orders ──────────────────────────────────────────────

/**
 * Transform items JSONB from Base44 format to AutoPro format.
 * Base44 stores: [{produto_id, descricao, quantidade, preco_unitario, preco_custo, ...}]
 * AutoPro expects: [{product_id, description, quantity, unit_price, cost_price, total_price, ...}]
 */
function transformItems(itemsJson) {
  if (!itemsJson || itemsJson === '' || itemsJson === 'null') return '[]'
  try {
    const items = JSON.parse(itemsJson)
    if (!Array.isArray(items)) return '[]'
    const mapped = items.map((it) => ({
      product_id: mapId('product', it.produto_id ?? it.product_id) ?? null,
      description: it.descricao ?? it.description ?? '',
      quantity: Number(it.quantidade ?? it.quantity ?? 1),
      unit_price: Number(it.preco_unitario ?? it.unit_price ?? 0),
      cost_price: Number(it.preco_custo ?? it.cost_price ?? 0),
      total_price: Number(it.preco_total ?? it.total_price ?? (it.quantidade ?? 1) * (it.preco_unitario ?? 0)),
    }))
    return JSON.stringify(mapped)
  } catch {
    return '[]'
  }
}

/**
 * Transform responsible_employees JSONB.
 * Base44: [{funcionario_id: "..."}, ...] or [{employee_id: "..."}, ...]
 * AutoPro: [{employee_id: "uuid"}]
 */
function transformResponsibles(json) {
  if (!json || json === '' || json === 'null') return '[]'
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return '[]'
    const mapped = arr.map((e) => {
      const oldId = e.funcionario_id ?? e.employee_id
      const newId = mapId('employee', oldId)
      return newId ? { employee_id: newId } : null
    }).filter(Boolean)
    return JSON.stringify(mapped)
  } catch {
    return '[]'
  }
}

function pkg4() {
  const lines = [
    '-- ============================================================',
    '-- Package 4: Service Orders & Installments',
    '-- ============================================================',
    '',
  ]

  // 4.1 service_orders
  const osRows = loadCsv('service_orders.csv')
  if (osRows.length) {
    lines.push('-- 4.1 service_orders')
    lines.push('INSERT INTO public.service_orders (id, organization_id, number, client_id, vehicle_id, employee_responsible_id, responsible_employees, status, payment_status, payment_method, entry_date, expected_date, completion_date, reported_defect, diagnosis, items, total_amount, total_cost_amount, discount, commission_amount, is_installment, installment_count, notes, apply_taxes, total_taxes_amount, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = osRows.map((r) => {
      const newId = assignId('service_order', r.id)
      const clientId = mapId('client', r.cliente_id ?? r.client_id)
      const vehicleId = mapId('vehicle', r.veiculo_id ?? r.vehicle_id)
      const empId = mapId('employee', r.funcionario_responsavel_id ?? r.employee_responsible_id)
      const itemsJson = transformItems(r.itens ?? r.items ?? r.itens_json)
      const responsiblesJson = transformResponsibles(r.responsaveis ?? r.responsible_employees)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${esc(r.numero ?? r.number)}, ${escUuid(clientId)}, ${escUuid(vehicleId)}, ${escUuid(empId)}, '${responsiblesJson.replace(/'/g, "''")}'::jsonb, ${esc(mapEnum(STATUS_OS, r.status, 'open'))}, ${esc(mapEnum(PAYMENT_STATUS, r.status_pagamento ?? r.payment_status, 'pending'))}, ${esc(mapEnum(PAYMENT_METHOD, r.forma_pagamento ?? r.payment_method))}, ${escDate(r.data_entrada ?? r.entry_date)}, ${escDate(r.data_prevista ?? r.expected_date)}, ${escDate(r.data_conclusao ?? r.completion_date)}, ${esc(r.defeito_relatado ?? r.reported_defect)}, ${esc(r.diagnostico ?? r.diagnosis)}, '${itemsJson.replace(/'/g, "''")}'::jsonb, ${escNum(r.valor_total ?? r.total_amount ?? 0)}, ${escNum(r.valor_custo_total ?? r.total_cost_amount ?? 0)}, ${escNum(r.desconto ?? r.discount ?? 0)}, ${escNum(r.valor_comissao ?? r.commission_amount ?? 0)}, ${escBool(r.parcelado ?? r.is_installment)}, ${escNum(r.numero_parcelas ?? r.installment_count)}, ${esc(r.observacoes ?? r.notes)}, ${escBool(r.aplicar_impostos ?? r.apply_taxes ?? 'false')}, ${escNum(r.valor_impostos_total ?? r.total_taxes_amount ?? 0)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('service_order', osRows.map((r) => [r.id, mapId('service_order', r.id)])))
  }

  // 4.2 service_order_installments
  const instRows = loadCsv('service_order_installments.csv')
  if (instRows.length) {
    lines.push('-- 4.2 service_order_installments')
    lines.push('INSERT INTO public.service_order_installments (id, organization_id, service_order_id, installment_number, amount, due_date, payment_date, payment_method, payment_status, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = instRows.map((r) => {
      const newId = assignId('service_order_installment', r.id)
      const soId = mapId('service_order', r.ordem_servico_id ?? r.service_order_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(soId)}, ${escNum(r.numero_parcela ?? r.installment_number ?? 1)}, ${escNum(r.valor ?? r.amount)}, ${escDate(r.data_vencimento ?? r.due_date)}, ${escDate(r.data_pagamento ?? r.payment_date)}, ${esc(mapEnum(PAYMENT_METHOD, r.forma_pagamento ?? r.payment_method))}, ${esc(mapEnum(PAYMENT_STATUS, r.status_pagamento ?? r.payment_status, 'pending'))}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
  }

  return lines.join('\n')
}

// ── Package 5: Financial ───────────────────────────────────────────────────

function pkg5() {
  const lines = [
    '-- ============================================================',
    '-- Package 5: Financial Transactions & Employee Records',
    '-- ============================================================',
    '',
  ]

  // 5.1 financial_transactions
  const ftRows = loadCsv('financial_transactions.csv')
  if (ftRows.length) {
    lines.push('-- 5.1 financial_transactions')
    lines.push('INSERT INTO public.financial_transactions (id, organization_id, bank_account_id, financial_category_id, service_order_id, type, description, amount, transaction_date, payment_method, payment_status, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = ftRows.map((r) => {
      const newId = assignId('financial_transaction', r.id)
      const bankId = mapId('bank_account', r.conta_bancaria_id ?? r.bank_account_id)
      const catId = mapId('financial_category', r.categoria_financeira_id ?? r.financial_category_id)
      const soId = mapId('service_order', r.ordem_servico_id ?? r.service_order_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(bankId)}, ${escUuid(catId)}, ${escUuid(soId)}, ${esc(mapEnum(TRANSACTION_TYPE, r.tipo ?? r.type, 'income'))}, ${esc(r.descricao ?? r.description)}, ${escNum(r.valor ?? r.amount)}, ${escDate(r.data_transacao ?? r.data_lancamento ?? r.transaction_date)}, ${esc(mapEnum(PAYMENT_METHOD, r.forma_pagamento ?? r.payment_method))}, ${esc(mapEnum(PAYMENT_STATUS, r.status_pagamento ?? r.payment_status, 'paid'))}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('financial_transaction', ftRows.map((r) => [r.id, mapId('financial_transaction', r.id)])))
  }

  // 5.2 employee_financial_records
  const efrRows = loadCsv('employee_financial_records.csv')
  if (efrRows.length) {
    lines.push('-- 5.2 employee_financial_records')
    lines.push('INSERT INTO public.employee_financial_records (id, organization_id, employee_id, service_order_id, bank_account_id, type, description, amount, reference_date, payment_date, payment_status, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = efrRows.map((r) => {
      const newId = assignId('employee_financial_record', r.id)
      const empId = mapId('employee', r.funcionario_id ?? r.employee_id)
      const soId = mapId('service_order', r.ordem_servico_id ?? r.service_order_id)
      const bankId = mapId('bank_account', r.conta_bancaria_id ?? r.bank_account_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(empId)}, ${escUuid(soId)}, ${escUuid(bankId)}, ${esc(mapEnum(EMPLOYEE_RECORD_TYPE, r.tipo ?? r.type, 'salary'))}, ${esc(r.descricao ?? r.description)}, ${escNum(r.valor ?? r.amount)}, ${escDate(r.data_referencia ?? r.reference_date)}, ${escDate(r.data_pagamento ?? r.payment_date)}, ${esc(mapEnum(PAYMENT_STATUS, r.status_pagamento ?? r.payment_status, 'pending'))}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
  }

  return lines.join('\n')
}

// ── Package 6: Auxiliary ───────────────────────────────────────────────────

function pkg6() {
  const lines = [
    '-- ============================================================',
    '-- Package 6: Appointments, Purchases, Purchase Requests',
    '-- ============================================================',
    '',
  ]

  // 6.1 appointments
  const apptRows = loadCsv('appointments.csv')
  if (apptRows.length) {
    lines.push('-- 6.1 appointments')
    lines.push('INSERT INTO public.appointments (id, organization_id, client_id, vehicle_id, appointment_date, time, service_type, priority, status, service_order_id, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = apptRows.map((r) => {
      const newId = assignId('appointment', r.id)
      const clientId = mapId('client', r.cliente_id ?? r.client_id)
      const vehicleId = mapId('vehicle', r.veiculo_id ?? r.vehicle_id)
      const soId = mapId('service_order', r.ordem_servico_id ?? r.service_order_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(clientId)}, ${escUuid(vehicleId)}, ${escDate(r.data_agendamento ?? r.appointment_date)}, ${esc(r.horario ?? r.time)}, ${esc(r.tipo_servico ?? r.service_type)}, ${esc(mapEnum(APPOINTMENT_PRIORITY, r.prioridade ?? r.priority, 'medium'))}, ${esc(mapEnum(APPOINTMENT_STATUS, r.status, 'scheduled'))}, ${escUuid(soId)}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('appointment', apptRows.map((r) => [r.id, mapId('appointment', r.id)])))
  }

  // 6.2 purchases
  const purRows = loadCsv('purchases.csv')
  if (purRows.length) {
    lines.push('-- 6.2 purchases')
    lines.push('INSERT INTO public.purchases (id, organization_id, supplier_id, purchase_date, total_amount, bank_account_id, payment_status, invoice_number, payment_date, due_date, items, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = purRows.map((r) => {
      const newId = assignId('purchase', r.id)
      const supId = mapId('supplier', r.fornecedor_id ?? r.supplier_id)
      const bankId = mapId('bank_account', r.conta_bancaria_id ?? r.bank_account_id)
      const itemsRaw = r.itens ?? r.items ?? r.itens_json
      let itemsJson = '[]'
      try {
        if (itemsRaw) {
          const arr = JSON.parse(itemsRaw)
          itemsJson = JSON.stringify((Array.isArray(arr) ? arr : []).map((it) => ({
            part_id: mapId('part', it.peca_id ?? it.part_id) ?? null,
            description: it.descricao ?? it.description ?? '',
            quantity: Number(it.quantidade ?? it.quantity ?? 1),
            unit_cost_price: Number(it.preco_custo_unitario ?? it.unit_cost_price ?? 0),
            unit_sale_price: Number(it.preco_venda_unitario ?? it.unit_sale_price ?? 0),
            total_item_price: Number(it.preco_total_item ?? it.total_item_price ?? 0),
            add_to_stock: Boolean(it.adicionar_estoque ?? it.add_to_stock ?? true),
          })))
        }
      } catch { /* keep '[]' */ }
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(supId)}, ${escDate(r.data_compra ?? r.purchase_date)}, ${escNum(r.valor_total ?? r.total_amount)}, ${escUuid(bankId)}, ${esc(mapEnum(PAYMENT_STATUS, r.status_pagamento ?? r.payment_status, 'pending'))}, ${esc(r.numero_nota_fiscal ?? r.invoice_number)}, ${escDate(r.data_pagamento ?? r.payment_date)}, ${escDate(r.data_vencimento ?? r.due_date)}, '${itemsJson.replace(/'/g, "''")}'::jsonb, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
    lines.push(idMapInsertSql('purchase', purRows.map((r) => [r.id, mapId('purchase', r.id)])))
  }

  // 6.3 purchase_requests
  const prRows = loadCsv('purchase_requests.csv')
  if (prRows.length) {
    lines.push('-- 6.3 purchase_requests')
    lines.push('INSERT INTO public.purchase_requests (id, organization_id, service_order_id, employee_id, supplier_id, status, notes, created_by, updated_by)')
    lines.push('VALUES')
    const inserts = prRows.map((r) => {
      const newId = assignId('purchase_request', r.id)
      const soId = mapId('service_order', r.ordem_servico_id ?? r.service_order_id)
      const empId = mapId('employee', r.funcionario_id ?? r.employee_id)
      const supId = mapId('supplier', r.fornecedor_id ?? r.supplier_id)
      return `  (${escUuid(newId)}, ${escUuid(ORG_ID)}, ${escUuid(soId)}, ${escUuid(empId)}, ${escUuid(supId)}, ${esc(r.status ?? 'pending')}, ${esc(r.observacoes ?? r.notes)}, ${esc(MIGRATOR)}, ${esc(MIGRATOR)})`
    })
    lines.push(inserts.join(',\n') + '\nON CONFLICT DO NOTHING;\n')
  }

  return lines.join('\n')
}

// ── Validation queries ─────────────────────────────────────────────────────

function validationSql() {
  return `-- ============================================================
-- Validation queries — run after all packages to verify counts
-- ============================================================

SELECT 'bank_accounts'              AS entity, COUNT(*) FROM public.bank_accounts             WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'financial_categories',       COUNT(*) FROM public.financial_categories                WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'product_categories',         COUNT(*) FROM public.product_categories                  WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'taxes',                      COUNT(*) FROM public.taxes                               WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'suppliers',                  COUNT(*) FROM public.suppliers                           WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'employees',                  COUNT(*) FROM public.employees                           WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'clients',                    COUNT(*) FROM public.clients                             WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'vehicles',                   COUNT(*) FROM public.vehicles                            WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'products',                   COUNT(*) FROM public.products                            WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'parts',                      COUNT(*) FROM public.parts                               WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'service_orders',             COUNT(*) FROM public.service_orders                      WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'service_order_installments', COUNT(*) FROM public.service_order_installments          WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'financial_transactions',     COUNT(*) FROM public.financial_transactions              WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'employee_financial_records', COUNT(*) FROM public.employee_financial_records          WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'appointments',               COUNT(*) FROM public.appointments                        WHERE organization_id = '${ORG_ID}'
UNION ALL
SELECT 'purchases',                  COUNT(*) FROM public.purchases                           WHERE organization_id = '${ORG_ID}'
ORDER BY entity;

-- Orphan check: service_orders with invalid client_id
SELECT COUNT(*) AS orphan_service_orders
FROM public.service_orders so
WHERE so.organization_id = '${ORG_ID}'
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = so.client_id);

-- Orphan check: vehicles with invalid client_id
SELECT COUNT(*) AS orphan_vehicles
FROM public.vehicles v
WHERE v.organization_id = '${ORG_ID}'
  AND v.client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = v.client_id);
`
}

// ─── Main ────────────────────────────────────────────────────────────────────

const packages = [
  { name: 'pkg0_foundation',     fn: pkg0 },
  { name: 'pkg1_people',         fn: pkg1 },
  { name: 'pkg2_vehicles',       fn: pkg2 },
  { name: 'pkg3_products_parts', fn: pkg3 },
  { name: 'pkg4_service_orders', fn: pkg4 },
  { name: 'pkg5_financial',      fn: pkg5 },
  { name: 'pkg6_auxiliary',      fn: pkg6 },
]

for (const pkg of packages) {
  console.log(`\n[package] ${pkg.name}`)
  const sql = pkg.fn()
  const outPath = join(OUT_DIR, `${pkg.name}.sql`)
  if (!DRY_RUN) {
    writeFileSync(outPath, sql, 'utf-8')
    console.log(`  → ${outPath}`)
  }
}

// Validation file
const valPath = join(OUT_DIR, 'validate.sql')
if (!DRY_RUN) {
  writeFileSync(valPath, validationSql(), 'utf-8')
  console.log(`\n[validation] → ${valPath}`)
}

console.log('\n✓ Done. Run the .sql files in order: pkg0 → pkg1 → ... → pkg6 → validate')
console.log('  Use: psql $DATABASE_URL -f migration-output/pkg0_foundation.sql')
