# Server API Reference — Nuxt/Nitro (AutoPro)

## Overview

All server-side logic lives as **Nuxt/Nitro route handlers** under `server/api/`.  
They replaced both the legacy Base44 SDK calls and the original Supabase Edge Functions.

**Rule: every route must follow REST conventions.** No action-style POST-only routes.

---

## REST Conventions

### HTTP method semantics

| Method | When to use | Body | Response |
|--------|------------|------|----------|
| `GET` | Read / list / search | — | resource or `{ items, total, page }` |
| `POST` | Create a new resource | resource fields | created resource |
| `PUT` | Full or partial update of an existing resource | fields to update | updated resource |
| `DELETE` | Soft-delete an existing resource | — | `{ success: true }` |
| `POST /:id/action` | Trigger a side-effect that is not a plain CRUD (cancel, pay, generate) | action params | result |

### What is NOT allowed

- `POST /api/resource/list` — use `GET /api/resource`
- `POST /api/resource/save` — use `POST` (create) or `PUT /:id` (update)
- `POST /api/resource/delete` — use `DELETE /:id`
- `POST /api/resource/get` — use `GET /:id`
- Verb-based route segments (`/update-fields`, `/get-by-email`, `/list-organization`)

### Nitro file-system routing

Nitro maps filenames directly to routes. Use this naming convention:

```
server/api/
  resource/
    index.get.ts        → GET    /api/resource
    index.post.ts       → POST   /api/resource
    [id].get.ts         → GET    /api/resource/:id
    [id].put.ts         → PUT    /api/resource/:id
    [id].delete.ts      → DELETE /api/resource/:id
    [id]/
      action.post.ts    → POST   /api/resource/:id/action
      sub.get.ts        → GET    /api/resource/:id/sub
```

Always name files after the **resource or sub-resource**, never after the verb or action for CRUD routes.

### Query parameters for list endpoints

| Param | Type | Purpose |
|-------|------|---------|
| `search` | string | Full-text search |
| `page` | number | Page number (1-based) |
| `page_size` | number | Items per page (default 20) |
| `[field]` | string/bool | Filter by field value |

### Standard list response shape

```typescript
{
  items: T[]
  total: number
  page: number
  page_size: number
}
```

Single-resource responses return the object directly (no wrapper).

### Error handling

```typescript
throw createError({ statusCode: 404, statusMessage: 'Recurso não encontrado' })
throw createError({ statusCode: 403, statusMessage: 'Sem permissão' })
throw createError({ statusCode: 400, statusMessage: 'Campo X obrigatório' })
```

Never return `{ error: '...' }` with status 200.

---

## Authentication pattern

Every handler must authenticate and resolve the org before touching the database:

```typescript
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('email', authUser.email!)
    .maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id
  // ...
})
```

**Note:** use `.eq('email', authUser.email!)` — not `.eq('id', authUser.id)` — to stay consistent with `initial-data.post.ts`.

---

## Soft-delete convention

All tables have `deleted_at timestamptz`. Never hard-delete unless explicitly required.

```typescript
// DELETE /:id — soft delete
await supabase
  .from('table')
  .update({ deleted_at: new Date().toISOString(), deleted_by: authUser.email })
  .eq('id', id)
  .eq('organization_id', organizationId)

// All list/get queries must filter
.is('deleted_at', null)
```

---

## Audit columns

Populate on every write:

```typescript
// INSERT
{ created_by: authUser.email, created_at: new Date().toISOString() }

// UPDATE
{ updated_by: authUser.email }
```

---

## Current route inventory

### Auth (platform — not workshop-scoped)

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/auth/me` | `auth/me.get.ts` | Current auth session |
| `POST` | `/api/auth/login` | `auth/login.post.ts` | Email/password login |
| `POST` | `/api/auth/signup` | `auth/signup.post.ts` | Register |
| `POST` | `/api/auth/logout` | `auth/logout.post.ts` | Sign out |
| `GET` | `/api/auth/profile` | `auth/profile.get.ts` | Auth-layer profile (name, avatar) |
| `PUT` | `/api/auth/profile` | `auth/profile.put.ts` | Update auth-layer profile |
| `PUT` | `/api/auth/password` | `auth/password.put.ts` | Change password |
| `DELETE` | `/api/auth/account` | `auth/account.delete.ts` | Delete account |
| `GET` | `/api/auth/oauth/start` | `auth/oauth/start.get.ts` | OAuth redirect |
| `GET` | `/api/auth/oauth/callback` | `auth/oauth/callback.get.ts` | OAuth callback |

### Workshop profile (org-scoped user record)

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/profile` | `profile/index.get.ts` | Current user's `user_profiles` row |
| `PUT` | `/api/profile` | `profile/index.put.ts` | Update `display_name`, `profile_picture_url` |

### Organization

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/organizations` | `organizations/index.get.ts` | Current user's organization |
| `PUT` | `/api/organizations` | `organizations/index.put.ts` | Update organization fields |

### Users (org members)

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `POST` | `/api/users/initial-data` | `users/initial-data.post.ts` | Bootstrap: user + org + role + permissions |
| `GET` | `/api/users/list-organization` | `users/list-organization.post.ts` | ⚠ Legacy — list org users |
| `POST` | `/api/users/assign-organization` | `users/assign-organization.post.ts` | ⚠ Legacy — link user to org |
| `POST` | `/api/users/update-fields` | `users/update-fields.post.ts` | ⚠ Legacy — update user fields |
| `POST` | `/api/users/update-role` | `users/update-role.post.ts` | ⚠ Legacy — assign role to user |
| `POST` | `/api/users/get-by-email` | `users/get-by-email.post.ts` | ⚠ Legacy — lookup user by email |
| `POST` | `/api/users/employee-auth-status` | `users/employee-auth-status.post.ts` | ⚠ Legacy — employee/auth link check |

> ⚠ **Legacy routes** above must be refactored. See [Refactoring plan](#legacy-routes-refactoring-plan).

### Roles & permissions

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/roles` | `roles/index.get.ts` | List org roles + system roles |
| `POST` | `/api/roles` | `roles/index.post.ts` | Create role |
| `PUT` | `/api/roles/:id` | `roles/[id].put.ts` | Update role |
| `DELETE` | `/api/roles/:id` | `roles/[id].delete.ts` | Soft-delete role |
| `GET` | `/api/roles/:id/actions` | `roles/[id]/actions.get.ts` | Get all actions + role's grants |
| `POST` | `/api/roles/:id/actions` | `roles/[id]/actions.post.ts` | Upsert a permission grant |

### Clients

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/clients` | `clients/index.get.ts` | List clients (`search`, `person_type`, `page`, `page_size`) |
| `POST` | `/api/clients` | `clients/index.post.ts` | Create client |
| `PUT` | `/api/clients/:id` | `clients/[id].put.ts` | Update client |
| `DELETE` | `/api/clients/:id` | `clients/[id].delete.ts` | Soft-delete client |

### Vehicles

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/vehicles` | `vehicles/index.get.ts` | List vehicles (`search`, `client_id`) |
| `POST` | `/api/vehicles` | `vehicles/index.post.ts` | Create vehicle |
| `PUT` | `/api/vehicles/:id` | `vehicles/[id].put.ts` | Update vehicle |
| `DELETE` | `/api/vehicles/:id` | `vehicles/[id].delete.ts` | Soft-delete vehicle |

### Employees

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/employees` | `employees/index.get.ts` | List employees (`search`, `include_terminated`) |
| `POST` | `/api/employees` | `employees/index.post.ts` | Create employee |
| `PUT` | `/api/employees/:id` | `employees/[id].put.ts` | Update employee |
| `DELETE` | `/api/employees/:id` | `employees/[id].delete.ts` | Soft-delete employee |

### Products

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/products` | `products/index.get.ts` | List products (`search`, `is_service`) |
| `POST` | `/api/products` | `products/index.post.ts` | Create product |
| `PUT` | `/api/products/:id` | `products/[id].put.ts` | Update product |
| `DELETE` | `/api/products/:id` | `products/[id].delete.ts` | Soft-delete product |

### Product categories

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/product-categories` | `product-categories/index.get.ts` | List categories |
| `POST` | `/api/product-categories` | `product-categories/index.post.ts` | Create category |
| `PUT` | `/api/product-categories/:id` | `product-categories/[id].put.ts` | Update category |
| `DELETE` | `/api/product-categories/:id` | `product-categories/[id].delete.ts` | Delete category |

### Parts / inventory

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/parts` | `parts/index.get.ts` | List parts (`search`, `low_stock`) |
| `POST` | `/api/parts` | `parts/index.post.ts` | Create part |
| `PUT` | `/api/parts/:id` | `parts/[id].put.ts` | Update part |
| `DELETE` | `/api/parts/:id` | `parts/[id].delete.ts` | Soft-delete part |

### Suppliers

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/suppliers` | `suppliers/index.get.ts` | List suppliers (`search`) |
| `POST` | `/api/suppliers` | `suppliers/index.post.ts` | Create supplier |
| `PUT` | `/api/suppliers/:id` | `suppliers/[id].put.ts` | Update supplier |
| `DELETE` | `/api/suppliers/:id` | `suppliers/[id].delete.ts` | Soft-delete supplier |

### Taxes

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/taxes` | `taxes/index.get.ts` | List taxes |
| `POST` | `/api/taxes` | `taxes/index.post.ts` | Create tax |
| `PUT` | `/api/taxes/:id` | `taxes/[id].put.ts` | Update tax |
| `DELETE` | `/api/taxes/:id` | `taxes/[id].delete.ts` | Soft-delete tax |

### Bank accounts

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/bank-accounts` | `bank-accounts/index.get.ts` | List accounts |
| `POST` | `/api/bank-accounts` | `bank-accounts/index.post.ts` | Create account |
| `PUT` | `/api/bank-accounts/:id` | `bank-accounts/[id].put.ts` | Update account |
| `DELETE` | `/api/bank-accounts/:id` | `bank-accounts/[id].delete.ts` | Soft-delete account |

### Payment terminals

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/payment-terminals` | `payment-terminals/index.get.ts` | List terminals |
| `POST` | `/api/payment-terminals` | `payment-terminals/index.post.ts` | Create terminal |
| `PUT` | `/api/payment-terminals/:id` | `payment-terminals/[id].put.ts` | Update terminal |
| `DELETE` | `/api/payment-terminals/:id` | `payment-terminals/[id].delete.ts` | Soft-delete terminal |

### Service orders

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/service-orders` | `service-orders/index.get.ts` | List with filters, cursor pagination |
| `POST` | `/api/service-orders` | `service-orders/index.post.ts` | Create or update order |
| `GET` | `/api/service-orders/:id` | `service-orders/[id].get.ts` | Full order detail with related data |
| `DELETE` | `/api/service-orders/:id` | `service-orders/[id].delete.ts` | Soft-delete order |
| `GET` | `/api/service-orders/next-number` | `service-orders/next-number.get.ts` | Next available OS number |
| `GET` | `/api/service-orders/:id/edit-data` | `service-orders/[id]/edit-data.get.ts` | Lookups needed for edit form |
| `POST` | `/api/service-orders/:id/cancel` | `service-orders/[id]/cancel.post.ts` | Cancel order |
| `POST` | `/api/service-orders/:id/process-payment` | `service-orders/[id]/process-payment.post.ts` | Register payment + installments |
| `DELETE` | `/api/service-orders/:id/payment` | `service-orders/[id]/payment.delete.ts` | Cancel registered payment |
| `POST` | `/api/service-orders/:id/generate-commissions` | `service-orders/[id]/generate-commissions.post.ts` | Generate employee commissions |
| `POST` | `/api/service-orders/export-csv` | `service-orders/export-csv.post.ts` | Export filtered orders as CSV |
| `GET` | `/api/service-orders/commission-seed-status` | `service-orders/commission-seed-status.get.ts` | Commission seed progress |
| `POST` | `/api/service-orders/seed-commissions` | `service-orders/seed-commissions.post.ts` | Bulk-seed commissions |

### Financial

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `POST` | `/api/financial/entries` | `financial/entries.post.ts` | ⚠ Legacy — financial entries |
| `POST` | `/api/financial/pay-commissions-bulk` | `financial/pay-commissions-bulk.post.ts` | ⚠ Legacy — bulk pay commissions |
| `POST` | `/api/financial/pay-entries-bulk` | `financial/pay-entries-bulk.post.ts` | ⚠ Legacy — bulk pay entries |
| `POST` | `/api/financial/check-recurring` | `financial/check-recurring.post.ts` | ⚠ Legacy — check recurring entries |
| `POST` | `/api/financial/update-recurring` | `financial/update-recurring.post.ts` | ⚠ Legacy — update recurring entries |

### Reports

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/reports/overview` | `reports/overview.get.ts` | Dashboard overview aggregates |
| `GET` | `/api/reports/commissions` | `reports/commissions.get.ts` | Commissions report |
| `GET` | `/api/reports/costs-profit` | `reports/costs-profit.get.ts` | Costs & profit report |
| `GET` | `/api/reports/customers` | `reports/customers.get.ts` | Customers report |
| `GET` | `/api/reports/debtors` | `reports/debtors.get.ts` | Debtors report |
| `GET` | `/api/reports/sales-items` | `reports/sales-items.get.ts` | Sales items report |
| `GET` | `/api/reports/suppliers` | `reports/suppliers.get.ts` | Suppliers report |
| `GET` | `/api/reports/purchases` | `reports/purchases.get.ts` | Purchases report |
| `POST` | `/api/reports/export-file` | `reports/export-file.post.ts` | Export report as file |
| `POST` | `/api/reports/export-commissions` | `reports/export-commissions.post.ts` | Export commissions as file |
| `POST` | `/api/reports/export-sales-items` | `reports/export-sales-items.post.ts` | Export sales items as file |

### Billing (Stripe)

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/billing/status` | `billing/status.get.ts` | Subscription status |
| `POST` | `/api/billing/checkout` | `billing/checkout.post.ts` | Start Stripe checkout |
| `POST` | `/api/billing/cancel` | `billing/cancel.post.ts` | Cancel subscription at period end |
| `POST` | `/api/billing/portal` | `billing/portal.post.ts` | Open Stripe billing portal |
| `GET` | `/api/billing/invoices` | `billing/invoices.get.ts` | List billing invoices |

### Fiscal (NuvemFiscal)

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/fiscal/company` | `fiscal/company/index.get.ts` | Get fiscal company |
| `POST` | `/api/fiscal/company` | `fiscal/company/index.post.ts` | Create fiscal company |
| `PUT` | `/api/fiscal/company` | `fiscal/company/index.put.ts` | Update fiscal company |
| `DELETE` | `/api/fiscal/company` | `fiscal/company/index.delete.ts` | Delete fiscal company |
| `GET` | `/api/fiscal/company/list` | `fiscal/company/list.get.ts` | List fiscal companies |
| `GET` | `/api/fiscal/company/certificate` | `fiscal/company/certificate.get.ts` | Get certificate |
| `PUT` | `/api/fiscal/company/certificate` | `fiscal/company/certificate.put.ts` | Upload certificate |
| `DELETE` | `/api/fiscal/company/certificate` | `fiscal/company/certificate.delete.ts` | Remove certificate |
| `GET` | `/api/fiscal/invoice` | `fiscal/invoice/index.get.ts` | Get invoice |
| `POST` | `/api/fiscal/invoice` | `fiscal/invoice/index.post.ts` | Issue invoice |
| `GET` | `/api/fiscal/invoice/list` | `fiscal/invoice/list.get.ts` | List invoices |
| `POST` | `/api/fiscal/invoice/cancel` | `fiscal/invoice/cancel.post.ts` | Cancel invoice |
| `POST` | `/api/fiscal/invoice/sync` | `fiscal/invoice/sync.post.ts` | Sync invoice status |
| `POST` | `/api/fiscal/invoice/correction-letter` | `fiscal/invoice/correction-letter.post.ts` | Issue correction letter |
| `GET` | `/api/fiscal/invoice/correction-letter` | `fiscal/invoice/correction-letter.get.ts` | Get correction letter |
| `GET` | `/api/fiscal/invoice/cancellation` | `fiscal/invoice/cancellation.get.ts` | Get cancellation record |
| `GET` | `/api/fiscal/invoice/events` | `fiscal/invoice/events.get.ts` | List invoice events |
| `GET` | `/api/fiscal/invoice/taxpayer` | `fiscal/invoice/taxpayer.get.ts` | Taxpayer info |
| `POST` | `/api/fiscal/invoice/pdf` | `fiscal/invoice/pdf.post.ts` | Generate PDF |
| `POST` | `/api/fiscal/invoice/email` | `fiscal/invoice/email.post.ts` | Send invoice by email |
| `GET` | `/api/fiscal/quotas` | `fiscal/quotas/index.get.ts` | NuvemFiscal quota usage |
| `GET` | `/api/fiscal/integration-logs` | `fiscal/integration-logs.get.ts` | Integration logs |
| `POST` | `/api/fiscal/sync-config` | `fiscal/sync-config.post.ts` | Sync fiscal config |
| `POST` | `/api/fiscal/sync-integration-endpoints` | `fiscal/sync-integration-endpoints.post.ts` | Sync integration endpoints |
| `POST` | `/api/fiscal/service-invoice/cancel` | `fiscal/service-invoice/cancel.post.ts` | Cancel NFS-e |

### Infrastructure

| Method | Route | File | Description |
|--------|-------|------|-------------|
| `GET` | `/api/supabase/health` | `supabase/health.get.ts` | Supabase connectivity check |

---

## Legacy routes — refactoring plan

These routes were migrated from Base44 as-is (all POST, verb-based names) and must be refactored to REST before Phase 3 frontend work depends on them.

### `users/` routes

| Current (legacy) | Target REST | Notes |
|-----------------|-------------|-------|
| `POST /api/users/list-organization` | `GET /api/users` | Query params: `org_id` optional |
| `POST /api/users/assign-organization` | `PUT /api/users/:id/organization` | Body: `{ organization_id }` |
| `POST /api/users/update-fields` | `PUT /api/users/:id` | Body: changed fields |
| `POST /api/users/update-role` | `PUT /api/users/:id/role` | Body: `{ role_id }` |
| `POST /api/users/get-by-email` | `GET /api/users/by-email?email=...` | Move to query param |
| `POST /api/users/employee-auth-status` | `GET /api/users/:id/employee-status` | Rename + method |

`POST /api/users/initial-data` stays as POST — it is a session bootstrap that requires no URL param and returns a large composite payload. This is the accepted exception.

### `financial/` routes

| Current (legacy) | Target REST | Notes |
|-----------------|-------------|-------|
| `POST /api/financial/entries` | `GET /api/financial/entries` | Filters move to query params |
| `POST /api/financial/pay-entries-bulk` | `POST /api/financial/entries/pay` | Keep POST — side-effect action |
| `POST /api/financial/pay-commissions-bulk` | `POST /api/financial/commissions/pay` | Keep POST — side-effect action |
| `POST /api/financial/check-recurring` | `POST /api/financial/recurring/check` | Keep POST — triggers a job |
| `POST /api/financial/update-recurring` | `POST /api/financial/recurring/update` | Keep POST — triggers a job |

---

## Utilities (`server/utils/`)

| File | Exports | Purpose |
|------|---------|---------|
| `supabase.ts` | `getSupabaseAdminClient()` | Service-role Supabase client |
| `supabase-anon.ts` | `getSupabaseAnonClient()` | Anon Supabase client |
| `require-auth.ts` | `requireAuthUser(event)` | Verify JWT, return auth user |
| `organization.ts` | `resolveOrganizationId(event, userId)` | Org ID from `user_profiles` by auth UID |
| `stripe.ts` | `getStripe()` | Stripe client |

---

## Table name mapping (Base44 → Supabase)

| Base44 (PT) | Supabase (EN) |
|-------------|--------------|
| `OrdemServico` | `service_orders` |
| `Cliente` | `clients` |
| `Veiculo` | `vehicles` |
| `Funcionario` | `employees` |
| `Produto` / `ProdutoMaster` | `products` / `master_products` |
| `Estoque` / `Peca` | `parts` |
| `Fornecedor` | `suppliers` |
| `Imposto` | `taxes` |
| `ContaBancaria` | `bank_accounts` |
| `ExtratoContaBancaria` | `bank_account_statements` |
| `Maquininha` | `payment_terminals` |
| `CategoriaProduto` | `product_categories` |
| `Role` / `RoleAction` / `Action` | `roles` / `role_actions` / `actions` |
| `Agendamento` | `appointments` |
| `LancamentoFinanceiro` | `financial_transactions` |
| `RegistroFinanceiroFuncionario` | `employee_financial_records` |
| `ParcelaOrdemServico` | `service_order_installments` |
| `Organization` | `organizations` |
| `User` | `user_profiles` |
| `Assinatura` | `subscriptions` |
| `Fatura` | `billing_invoices` |

---

## Frontend usage

```typescript
// List with filters
const data = await $fetch('/api/clients', {
  query: { search: 'João', person_type: 'PF', page: 1, page_size: 20 }
})

// Create
const created = await $fetch('/api/clients', {
  method: 'POST',
  body: { name: 'João Silva', person_type: 'PF' }
})

// Update
const updated = await $fetch(`/api/clients/${id}`, {
  method: 'PUT',
  body: { phone: '(85) 99999-0000' }
})

// Delete
await $fetch(`/api/clients/${id}`, { method: 'DELETE' })

// Trigger action
await $fetch(`/api/service-orders/${id}/cancel`, {
  method: 'POST',
  body: { reason: 'Cliente desistiu' }
})
```

---

## Webhooks (kept as Supabase Edge Functions)

| Function | Reason |
|----------|--------|
| `stripeWebhook` | Receives Stripe callbacks — requires raw body for signature verification |
| `stripe-webhook` | Alternate Stripe webhook endpoint |

These cannot be Nuxt routes because Stripe webhook verification requires the raw, unparsed request body before H3 parses it.
