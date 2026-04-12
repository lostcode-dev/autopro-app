# Migration Documentation: Supabase Edge Functions → Nuxt API Routes

## Overview

This document describes the migration of Supabase Edge Functions to Nuxt server API routes (H3 handlers).  
The migration converts functions from the legacy **Base44 SDK** (`npm:@base44/sdk`) with **Deno runtime** to **Nuxt/H3 event handlers** using **Supabase JS client** directly.

**Migration Date:** 2026-04-12  
**Phase:** 1 — Essential Functions (User, Organization, Service Orders, Stripe)

---

## Architecture Changes

### Before (Supabase Edge Functions)
```
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req)
  const authUser = await base44.auth.me()
  const data = await base44.asServiceRole.entities.TABLE_PT_NAME.filter({...})
  return Response.json({ data })
})
```

### After (Nuxt API Routes)
```typescript
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.from('table_en_name').select('*').eq(...)
  return { data }
})
```

### Key Differences
| Aspect | Supabase Edge Function | Nuxt API Route |
|--------|----------------------|----------------|
| Runtime | Deno | Node.js |
| Auth | `base44.auth.me()` | `requireAuthUser(event)` (server/utils) |
| DB Client | `base44.asServiceRole.entities` | `getSupabaseAdminClient()` (server/utils) |
| Stripe | `new Stripe(Deno.env.get('STRIPE_API_KEY'))` | `getStripe()` (server/utils) |
| Response | `Response.json(...)` | `return { ... }` (auto-serialized by H3) |
| Errors | `Response.json({error}, {status})` | `throw createError({statusCode, statusMessage})` |
| Body | `req.json()` | `readBody(event)` |

---

## New Server Utility

### `server/utils/organization.ts`
Shared helpers for resolving organization context:
- `resolveOrganizationId(event, userId)` — Gets `organization_id` from `user_profiles`
- `getUserProfile(userId)` — Full profile by ID
- `getUserProfileByEmail(email)` — Full profile by email

---

## Table Name Mapping (Base44 → Supabase)

| Base44 Entity (PT) | Supabase Table (EN) |
|---------------------|---------------------|
| `User` | `user_profiles` |
| `Organization` | `organizations` |
| `OrdemServico` | `service_orders` |
| `Cliente` | `clients` |
| `Veiculo` | `vehicles` |
| `Funcionario` | `employees` |
| `ProdutoMaster` | `master_products` |
| `Produto` | `products` |
| `ParcelaOrdemServico` | `service_order_installments` |
| `RegistroFinanceiroFuncionario` | `employee_financial_records` |
| `LancamentoFinanceiro` | `financial_transactions` |
| `ContaBancaria` | `bank_accounts` |
| `ExtratoContaBancaria` | `bank_account_statements` |
| `Assinatura` | `subscriptions` |
| `Fatura` | `billing_invoices` |
| `Role` | `roles` |
| `RoleAction` | `role_actions` |
| `Action` | `actions` |
| `Agendamento` | `appointments` |
| `Imposto` | `taxes` |
| `CategoriaProduto` | `product_categories` |
| `Maquininha` | `payment_terminals` |

---

## Column Name Mapping (Main Columns)

| Old (PT) | New (EN) | Notes |
|----------|----------|-------|
| `numero` | `number` | Service order number |
| `cliente_id` | `client_id` | |
| `veiculo_id` | `vehicle_id` | |
| `funcionario_responsavel_id` | `employee_responsible_id` | |
| `responsaveis` | `responsible_employees` | |
| `data_entrada` | `entry_date` | |
| `data_conclusao` | `completion_date` | |
| `data_prevista` | `expected_date` | |
| `defeito_relatado` | `reported_defect` | |
| `diagnostico` | `diagnosis` | |
| `valor_total` | `total_amount` | |
| `valor_custo_total` | `total_cost_amount` | |
| `valor_comissao` | `commission_amount` | |
| `valor_taxa_maquininha` | `terminal_fee_amount` | |
| `forma_pagamento` | `payment_method` | |
| `parcelado` | `is_installment` | |
| `numero_parcelas` | `installment_count` | |
| `status_pagamento` | `payment_status` | |
| `observacoes` | `notes` | |
| `nome` | `name` | |
| `nome_exibicao` | `display_name` | |
| `tipo_registro` | `record_type` | |
| `ordem_servico_id` | `service_order_id` | |
| `lancamento_financeiro_id` | `financial_transaction_id` | |
| `conta_bancaria_id` | `bank_account_id` | |
| `saldo_atual` | `current_balance` | |
| `saldo_anterior` | `previous_balance` | |
| `created_date` | `created_at` | |
| `placa` | `license_plate` | |
| `marca` | `brand` | |
| `modelo` | `model` | |

---

## Migrated Functions

### User & Organization (7 functions)

| # | Old Supabase Function | New Nuxt API Route | Method |
|---|----------------------|-------------------|--------|
| 1 | `assignOrganizationToUser` | `/api/users/assign-organization` | POST |
| 2 | `listOrganizationUsers` | `/api/users/list-organization` | POST |
| 3 | `updateUserFields` | `/api/users/update-fields` | POST |
| 4 | `updateUserRole` | `/api/users/update-role` | POST |
| 5 | `getUserIdByEmail` | `/api/users/get-by-email` | POST |
| 6 | `getEmployeeAuthStatus` | `/api/users/employee-auth-status` | POST |
| 7 | `getInitialUserData` | `/api/users/initial-data` | POST |

### Service Orders (11 functions)

| # | Old Supabase Function | New Nuxt API Route | Method |
|---|----------------------|-------------------|--------|
| 8 | `listServiceOrders` | `/api/service-orders/list` | POST |
| 9 | `saveServiceOrder` | `/api/service-orders/save` | POST |
| 10 | `getNextOSNumber` | `/api/service-orders/next-number` | POST |
| 11 | `getServiceOrderDetailsData` | `/api/service-orders/details` | POST |
| 12 | `getServiceOrderEditData` | `/api/service-orders/edit-data` | POST |
| 13 | `cancelServiceOrder` | `/api/service-orders/cancel` | POST |
| 14 | `deleteServiceOrder` | `/api/service-orders/delete` | POST |
| 15 | `processServiceOrderPayment` | `/api/service-orders/process-payment` | POST |
| 16 | `cancelServiceOrderPayment` | `/api/service-orders/cancel-payment` | POST |
| 17 | `generateServiceOrderCommissions` | `/api/service-orders/generate-commissions` | POST |
| 18 | `exportServiceOrdersCsv` | `/api/service-orders/export-csv` | POST |

### Stripe (2 functions)

| # | Old Supabase Function | New Nuxt API Route | Method |
|---|----------------------|-------------------|--------|
| 19 | `stripeCheckout` | `/api/stripe/checkout` | POST |
| 20 | `cancelarAssinatura` | `/api/stripe/cancel-subscription` | POST |

---

## Kept as Supabase Functions (Webhooks)

| Function | Reason |
|----------|--------|
| `stripeWebhook` | Receives external Stripe webhook callbacks with signature verification |
| `stripe-webhook` | Alternative Stripe webhook using direct Supabase client |

---

## Remaining Supabase Functions (Phase 2+)

### NuvemFiscal Integration (~35 functions)
All NuvemFiscal-related functions remain as Supabase Edge Functions pending Phase 2 migration:
- `nuvemFiscalAuth`, `getNuvemFiscalToken`
- `createNuvemFiscalEmpresa`, `getNuvemFiscalEmpresa`, `updateNuvemFiscalEmpresa`, `deleteNuvemFiscalEmpresa`
- `createNuvemFiscalNfe`, `cancelNuvemFiscalNfe`, `getNuvemFiscalNfe`, `listNuvemFiscalNfe`, `syncNuvemFiscalNfe`
- `createNuvemFiscalNfse`, `cancelNuvemFiscalNfse`, `getNuvemFiscalNfse`, `listNuvemFiscalNfse`, `syncNuvemFiscalNfse`
- All NFe/NFS-e download, correction, cancellation, and inutilization functions
- Certificate management functions
- `syncConfiguracaoNuvemFiscal`, `syncNuvemFiscalIntegrationEndpoints`
- `listNuvemFiscalCotas`, `listNuvemFiscalEmpresas`, `listNuvemFiscalIntegrationLogs`
- `emitirNotaFiscalOS`, `cancelarNotaFiscalOS`
- `sendNuvemFiscalNfeEmail`

### Reports & Financial (~15 functions)
- `getCommissionsReportData`, `getCostsProfitReportData`, `getCustomersReportData`
- `getDebtorsReportData`, `getPurchasesReportData`, `getReportsOverviewData`
- `getSalesItemsReportData`, `getSuppliersReportData`
- `getFinancialEntriesPage`
- `exportCommissionsReport`, `exportReportFile`, `exportSalesItemsReport`
- `payCommissionsBulk`, `payFinancialEntriesBulk`

### Scheduled / Admin (~5 functions)
- `verificarRecorrentes`, `updateRecurringFinanceEntries`
- `seedServiceOrderItemCommissions`, `listServiceOrdersItemCommissionSeedStatus`

### Utilities
- `_utils/` — Shared report PDF/CSV generation utilities (keep for Phase 2)

---

## File Structure After Migration

```
server/
├── api/
│   ├── auth/             (existing)
│   ├── billing/          (existing)
│   ├── feedback/         (existing)
│   ├── notifications/    (existing)
│   ├── supabase/         (existing)
│   ├── users/            ← NEW
│   │   ├── assign-organization.post.ts
│   │   ├── employee-auth-status.post.ts
│   │   ├── get-by-email.post.ts
│   │   ├── initial-data.post.ts
│   │   ├── list-organization.post.ts
│   │   ├── update-fields.post.ts
│   │   └── update-role.post.ts
│   ├── service-orders/   ← NEW
│   │   ├── cancel.post.ts
│   │   ├── cancel-payment.post.ts
│   │   ├── delete.post.ts
│   │   ├── details.post.ts
│   │   ├── edit-data.post.ts
│   │   ├── export-csv.post.ts
│   │   ├── generate-commissions.post.ts
│   │   ├── list.post.ts
│   │   ├── next-number.post.ts
│   │   ├── process-payment.post.ts
│   │   └── save.post.ts
│   └── stripe/           ← NEW
│       ├── checkout.post.ts
│       └── cancel-subscription.post.ts
└── utils/
    ├── organization.ts   ← NEW
    ├── require-auth.ts   (existing)
    ├── stripe.ts         (existing)
    ├── supabase.ts       (existing)
    └── supabase-anon.ts  (existing)
```

---

## Frontend Migration Checklist

When updating the frontend to use the new Nuxt API routes, replace:

```typescript
// Before (Base44 SDK)
await base44.functions.listServiceOrders({ ... })

// After (Nuxt API / $fetch)
await $fetch('/api/service-orders/list', { method: 'POST', body: { ... } })
```

### Endpoint Mapping for Frontend

| Old SDK Call | New $fetch URL |
|-------------|----------------|
| `base44.functions.assignOrganizationToUser(...)` | `$fetch('/api/users/assign-organization', { method: 'POST', body })` |
| `base44.functions.listOrganizationUsers()` | `$fetch('/api/users/list-organization', { method: 'POST' })` |
| `base44.functions.updateUserFields(...)` | `$fetch('/api/users/update-fields', { method: 'POST', body })` |
| `base44.functions.updateUserRole(...)` | `$fetch('/api/users/update-role', { method: 'POST', body })` |
| `base44.functions.getUserIdByEmail(...)` | `$fetch('/api/users/get-by-email', { method: 'POST', body })` |
| `base44.functions.getEmployeeAuthStatus(...)` | `$fetch('/api/users/employee-auth-status', { method: 'POST', body })` |
| `base44.functions.getInitialUserData()` | `$fetch('/api/users/initial-data', { method: 'POST' })` |
| `base44.functions.listServiceOrders(...)` | `$fetch('/api/service-orders/list', { method: 'POST', body })` |
| `base44.functions.saveServiceOrder(...)` | `$fetch('/api/service-orders/save', { method: 'POST', body })` |
| `base44.functions.getNextOSNumber()` | `$fetch('/api/service-orders/next-number', { method: 'POST' })` |
| `base44.functions.getServiceOrderDetailsData(...)` | `$fetch('/api/service-orders/details', { method: 'POST', body })` |
| `base44.functions.getServiceOrderEditData(...)` | `$fetch('/api/service-orders/edit-data', { method: 'POST', body })` |
| `base44.functions.cancelServiceOrder(...)` | `$fetch('/api/service-orders/cancel', { method: 'POST', body })` |
| `base44.functions.deleteServiceOrder(...)` | `$fetch('/api/service-orders/delete', { method: 'POST', body })` |
| `base44.functions.processServiceOrderPayment(...)` | `$fetch('/api/service-orders/process-payment', { method: 'POST', body })` |
| `base44.functions.cancelServiceOrderPayment(...)` | `$fetch('/api/service-orders/cancel-payment', { method: 'POST', body })` |
| `base44.functions.generateServiceOrderCommissions(...)` | `$fetch('/api/service-orders/generate-commissions', { method: 'POST', body })` |
| `base44.functions.exportServiceOrdersCsv(...)` | `$fetch('/api/service-orders/export-csv', { method: 'POST', body })` |
| `base44.functions.stripeCheckout(...)` | `$fetch('/api/stripe/checkout', { method: 'POST', body })` |
| `base44.functions.cancelarAssinatura()` | `$fetch('/api/stripe/cancel-subscription', { method: 'POST' })` |

---

## Security Improvements

1. **Authentication**: All routes use `requireAuthUser(event)` which verifies JWT tokens and handles refresh
2. **Organization isolation**: `resolveOrganizationId()` ensures users can only access their own organization's data
3. **Soft deletes**: All queries filter `deleted_at IS NULL` to respect soft-delete convention
4. **Audit columns**: `created_by` and `updated_by` are populated automatically from `authUser.email`
5. **Input validation**: Required parameters are validated with proper HTTP error codes
6. **Cross-org protection**: `updateUserRole` verifies target user belongs to same organization

---

## Notes

- The `stripe-webhook` and `stripeWebhook` functions remain as Supabase Edge Functions because they receive external HTTP callbacks from Stripe and require webhook signature verification against the raw request body
- All new API routes use the existing `server/utils/supabase.ts` admin client (service role key) for database operations
- The migration follows the column/table naming conventions defined in `supabase/migrations/migrate_database_base44.md`
