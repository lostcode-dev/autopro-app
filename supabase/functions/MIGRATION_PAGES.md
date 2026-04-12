# Migration Plan: Pages and Legacy Modules -> Nuxt App

## Overview

This document defines the phased migration plan for the legacy pages in `old_project/src/pages` to the current Nuxt application.

Current status already completed:
- Database migrated from Base44 naming/model to the new PostgreSQL schema
- Phase 1 backend migration completed for users, organizations, service orders, and Stripe/billing flows
- Supabase Edge Functions for Nuvem Fiscal are still partially pending

Important conclusion from this analysis:

Migrating the pages is not only a UI port. Most legacy pages depend on:
- `@/entities/all` for direct Base44 CRUD
- `@/api/base44Client`
- React Router + `pages.config.js`
- `AuthContext` + `UserContext`
- `@tanstack/react-query`
- page-specific React hooks under `old_project/src/hooks`

Because of that, the next migration phase must include:
- new Nuxt routes
- new server API routes for domains that were previously using Base44 entities directly
- new Vue/Nuxt composables for auth, organization, permissions, and data access
- selective port of business components and utilities from the old project

---

## Key Findings

### 1. The current Nuxt app still does not represent the workshop backoffice

The current authenticated app shell in `app/layouts/app.vue` still reflects another product/navigation model. Before migrating modules, we need a workshop-oriented shell and route map.

### 1.1. `/app` and `/admin` must remain separate flows

To avoid new confusion during migration, the project must keep two distinct authenticated flows:
- `/app/*` = workshop/user flow
- `/admin/*` = global administration flow

Rules for this separation:
- `app/layouts/app.vue` is only for the operational workshop experience
- `app/layouts/admin.vue` is only for global/admin pages
- admin routes must not be nested as first-class pages inside `/app`
- `/app/admin/*` may exist only as temporary redirects for backward compatibility, not as the canonical destination
- navigation, middleware, and permission rules must be defined independently for each flow

Practical implication:
- workshop modules such as service orders, customers, vehicles, financial, reports, and settings stay under `/app`
- global admin modules such as organizations, system admin, and fiscal admin stay under `/admin`

### 2. Backend Phase 1 is necessary, but not sufficient for most pages

The migration documented in:
- `supabase/functions/MIGRATION_PHASE1.md`
- `supabase/migrations/migrate_database_base44.md`

covered:
- users
- organizations
- service orders
- Stripe

But many pages do not use Edge Functions as their main dependency. They read/write directly through Base44 entities. So those pages still need server routes/composables for domain CRUD.

### 3. There is a contract mismatch in user bootstrap

The old `UserContext.jsx` expects a payload closer to:
- `currentUser`
- `userRole`
- `organization`
- `roles`
- `permissions` as a boolean map
- `roleActions`
- `organizationId`

The new `server/api/users/initial-data.post.ts` currently returns a different shape:
- `user`
- `organization`
- `role`
- `employee`
- `permissions` as records
- `actions`
- `terminated`

Before migrating permission-based pages, we must either:
- normalize the API response on the server, or
- create a Nuxt composable adapter that converts the response to the shape the new app will use

### 4. Billing callback routes still need alignment

Legacy checkout still points to:
- `/PagamentoSucesso`
- `/PagamentoCancelado`

The newer billing route already supports configurable success/cancel paths. During page migration we should:
- define the canonical Nuxt billing callback routes
- keep temporary redirects/aliases for the legacy paths

### 5. Fiscal modules remain blocked by backend Phase 2+

The following groups still depend on the remaining Nuvem Fiscal migration:
- `pages/admin/invoices`
- `pages/admin/nuvemfiscal`
- `pages/invoices/service_invoice`
- `pages/invoices/product_invoice`
- parts of `pages/configs/overview` fiscal sync

These should stay in the final migration phase.

---

## Migration Principles

1. Do not port React architecture as-is.
   Replace React Router, `pages.config.js`, `UserContext`, and `react-query` patterns with Nuxt routes, composables, `useAsyncData`/`$fetch`, and Vue state.

2. Migrate by business capability, not by file order.
   A page only moves when its required API, auth, permissions, and shared components are ready.

3. Reuse business rules, not framework glue.
   Old hooks and components are reference material for rules, filters, payload shapes, validations, and states. They should not be copied blindly.

4. Keep temporary compatibility where needed.
   Legacy route aliases and callback redirects are acceptable during transition.

5. Leave Nuvem Fiscal admin/fiscal pages for the end.
   They depend on the remaining backend migration and should not block the operational modules.

---

## What Must Be Migrated Besides the Pages

### Shared foundation
- Auth/session bootstrap for Nuxt
- Current user, organization, role, employee, permissions composables
- Route access guard for permission-based pages
- Workshop navigation/sidebar and authenticated layout
- Shared page state patterns for list/form/details flows

### Data access layer
- Nuxt server API routes for domains still using `@/entities/all`
- domain composables such as `useCustomers`, `useVehicles`, `useEmployees`, `useProducts`, `useFinancialEntries`
- DTO mapping between old PT payloads and new EN schema/table names

### Business utilities
- formatters, masks, date helpers, currency helpers
- action code constants
- CSV import/export helpers
- upload helpers for logo/documents/certificates

### UI modules
- shared cards, filters, tables, dialogs, skeletons, badges, stats blocks
- page-local components that contain real business behavior

### Storage/uploads
- replace `base44.integrations.Core.UploadFile`
- define Supabase Storage or Nuxt upload endpoints for:
  - organization logo
  - fiscal certificate files
  - import files if needed

---

## What Should Not Be Migrated As-Is

Do not carry these layers directly into the new app:
- `old_project/src/App.jsx`
- `old_project/src/pages.config.js`
- `old_project/src/lib/AuthContext.jsx`
- `old_project/src/contexts/UserContext.jsx`
- `@/entities/all`
- `@/api/base44Client`
- generic React Query hooks that only wrap Base44 CRUD

These files are useful as migration reference, not as direct implementation targets.

---

## Recommended Target Route Map

Suggested canonical route structure in Nuxt:

| Legacy page/module | Suggested Nuxt route | Notes |
|---|---|---|
| `Dashboard` | `/app/dashboard` | Main authenticated home for workshop |
| `service-orders` | `/app/service-orders` | Core operational module |
| `Agendamentos` | `/app/appointments` | Appointments |
| `Clientes` | `/app/customers` | Customers |
| `Veiculos` | `/app/vehicles` | Vehicles |
| `Produtos` | `/app/products` | Products/catalog |
| `Estoque` | `/app/inventory` | Inventory/parts |
| `Fornecedores` | `/app/suppliers` | Suppliers |
| `Compras` | `/app/purchases` | Purchases |
| `Devolucoes` | `/app/purchase-returns` | Purchase returns |
| `Autorizacoes` | `/app/purchase-requests` | Purchase request approvals |
| `financial/overview` | `/app/financial` | Financial entries |
| `financial/accounts` | `/app/financial/accounts` | Bank accounts |
| `financial/machines` | `/app/financial/machines` | Payment terminals |
| `financial/taxes` | `/app/financial/taxes` | Taxes |
| `configs/overview` | `/app/settings/company` | Organization/company settings |
| `configs/profile` | `/app/settings/profile` | User profile |
| `configs/employees` | `/app/settings/employees` | Employees |
| `configs/roles` | `/app/settings/roles` | Roles and permissions |
| `subscriptions/Index` and `GerenciarAssinatura` | `/app/settings/subscription` | Consolidate in one module |
| `PagamentoSucesso` | `/app/billing/success` | Keep legacy alias temporarily |
| `PagamentoCancelado` | `/app/billing/cancel` | Keep legacy alias temporarily |
| `error/403` | `/app/forbidden` | Internal forbidden page |
| `reports/*` | `/app/reports/*` | Reports domain |
| `DashboardAdmin` | `/admin/dashboard` | Admin-only, separate from `/app` |
| `admin/organizations` | `/admin/organizations` | Admin-only, separate from `/app` |
| `configs/admin` | `/admin/system` | Admin-only, separate from `/app` |
| `admin/invoices` | `/admin/fiscal/companies` | Admin-only, blocked by fiscal backend |
| `admin/nuvemfiscal` | `/admin/fiscal/logs` | Admin-only, blocked by fiscal backend |
| `invoices/service_invoice` | `/app/fiscal/service-invoices` | Blocked by fiscal backend |
| `invoices/product_invoice` | `/app/fiscal/product-invoices` | Blocked by fiscal backend |
| `Consulta` | `/consulta` | Public/isolated route, not under `/app` |
| `Consultoria` | `/app/consulting` | Migrate only after analytics data is stable |

Legacy top-level pages that should be treated as aliases or retired, not first-class migrations:
- `ContasBancarias` -> replace with `financial/accounts`
- `Financeiro` -> replace with `financial/overview`
- `Impostos` -> replace with `financial/taxes`
- `Maquininhas` -> replace with `financial/machines`

---

## Phased Migration Plan

## Phase 0 - Shared Foundation

Goal:
Create the minimum platform needed so the workshop modules can be migrated safely.

Scope:
- create the new workshop app shell in Nuxt
- create the separate admin shell in Nuxt
- define canonical routes and temporary legacy redirects
- implement a Nuxt bootstrap composable for:
  - authenticated user
  - organization
  - role
  - employee
  - permissions
- normalize the `/api/users/initial-data` contract for frontend use
- create permission-aware route/page guard helpers
- create separate route protection for `/app/*` and `/admin/*`
- define a domain API pattern for CRUD and list endpoints
- define shared PT -> EN field mapping utilities where needed
- define upload/storage strategy

Deliverables:
- `app/layouts/app.vue` dedicated to the workshop/user flow
- `app/layouts/admin.vue` dedicated to the admin flow
- composables for auth/bootstrap/permissions
- route aliases for billing callbacks and forbidden page
- temporary compatibility redirects from `/app/admin/*` to `/admin/*` when needed
- documented API conventions for upcoming modules

Exit criteria:
- app can resolve current user, organization, and permissions without the old React contexts
- workshop navigation exists under `/app`
- admin navigation exists under `/admin`
- legacy payment callbacks do not break checkout flow

---

## Phase 1 - Access, Subscription, and Bootstrap Pages

Goal:
Migrate the pages that depend mostly on the already migrated backend and unblock app entry.

Pages/modules:
- `subscriptions/Index`
- `GerenciarAssinatura`
- `PagamentoSucesso`
- `PagamentoCancelado`
- `error/403`

Also include:
- route/redirect handling from old paths
- checkout success/cancel path update in billing usage

Why this phase comes first:
- it uses the backend that already exists
- it finishes the access/subscription flow before operational modules
- it gives a working authenticated shell for the next phases

Notes:
- consolidate subscription management into one Nuxt page
- legacy success/cancel pages should remain available as aliases during transition

Exit criteria:
- user can authenticate, access the workshop shell, manage subscription, and complete checkout callbacks

---

## Phase 2 - Settings and Core Master Data

Goal:
Migrate the settings and master-data modules that other pages depend on.

Pages/modules:
- `configs/overview` (company/general settings)
- `configs/profile`
- `configs/employees`
- `configs/roles`
- `Produtos`
- `Estoque`
- `Fornecedores`
- `financial/taxes`
- `financial/accounts`
- `financial/machines`
- `Clientes`
- `Veiculos`

Required backend/API work:
- CRUD for organizations/company settings
- CRUD for employees
- CRUD for roles, actions, role_actions membership operations
- CRUD for products, categories, parts/inventory
- CRUD for suppliers
- CRUD for taxes
- CRUD for bank accounts and statements
- CRUD for payment terminals
- CRUD for customers
- CRUD for vehicles

Important notes:
- `configs/overview` currently uses Base44 upload for logo. Replace this with Supabase Storage or Nuxt upload endpoint.
- `Clientes` includes extra business behavior like imports, vehicle/order history, and client scoring. The scoring feature should be reviewed separately; it can be deferred if it still depends on old AI integrations.
- `configs/roles` is not a blocker for reading permissions, but it is important for complete admin self-service.

Why this phase is critical:
- service orders depend on employees, customers, vehicles, products, taxes, bank accounts, and organization settings

Exit criteria:
- all master data required by operations can be created and edited in the new app
- permission checks work with the new bootstrap layer

---

## Phase 3 - Core Workshop Operations

Goal:
Migrate the operational heart of the product after the prerequisite master data is ready.

Pages/modules:
- `service_order/Index`
- `Agendamentos`
- `Dashboard`
- `Compras`
- `Devolucoes`
- `Autorizacoes`

Required backend/API work beyond already migrated service-order endpoints:
- appointments CRUD
- purchases CRUD and payment confirmation
- purchase returns CRUD
- purchase requests/authorizations CRUD
- read endpoints for dashboard aggregates
- any missing list/lookups for service order form/detail/payment flows

Important notes:
- `service_order/Index` already references migrated server functions for several actions, but it still depends on many legacy lookup hooks and caches. Migrate the full surrounding data layer, not just the page shell.
- `Dashboard` should come after service orders, appointments, customers, vehicles, and inventory data are available.
- `Autorizacoes` should likely be implemented as purchase request approvals, not as a standalone legacy concept.

Exit criteria:
- workshop can run day-to-day operations in Nuxt without fallback to Base44 pages

---

## Phase 4 - Financial Operations and Reports

Goal:
Migrate the analytical and financial modules once transactional data is already running in Nuxt.

Pages/modules:
- `financial/overview`
- `reports/overview`
- `reports/customers`
- `reports/commissions`
- `reports/purchases`
- `reports/costs`
- `reports/debtors`
- `reports/suppliers`
- `reports/profit`
- `reports/sales-items`
- `Consulta`
- `Consultoria`

Required backend/API work:
- financial entry CRUD and status transitions
- bulk payment/update endpoints where applicable
- report aggregation endpoints
- employee public consultation endpoint for `/consulta`
- AI/analysis endpoint review for `Consultoria`

Important notes:
- `Consulta` should be isolated from `/app` because it behaves like a public/self-service page.
- `Consultoria` should be migrated only after reports and financial data are stable, since it depends on aggregate business intelligence and possibly AI generation.

Exit criteria:
- financial team and management reports no longer depend on the old React app

---

## Phase 5 - Admin and Fiscal Advanced Modules

Goal:
Finish the platform migration with admin-only and fiscal modules.

Pages/modules:
- `admin/dashboard`
- `admin/organizations`
- `configs/admin`
- `admin/invoices`
- `admin/nuvemfiscal`
- `invoices/service_invoice`
- `invoices/product_invoice`

Blockers:
- remaining Nuvem Fiscal functions from backend Phase 2+
- certificate upload/storage flow
- fiscal sync/log/query APIs
- NF-e/NFS-e issue/cancel/download/event flows

Strategy:
- migrate admin pages that do not depend on Nuvem Fiscal first
- only migrate fiscal pages after the remaining backend migration is completed and validated

Important routing rule:
- even in this late phase, admin pages remain in `/admin/*`
- they must not be folded into `/app/*`

Exit criteria:
- no fiscal/admin workflow depends on legacy Base44 or old React pages

---

## Module Priority Summary

| Priority | Modules |
|---|---|
| Immediate | Foundation, subscription/access pages |
| High | company settings, employees, customers, vehicles, products, inventory, taxes, bank accounts |
| High | service orders, appointments, dashboard |
| Medium | purchases, returns, purchase requests |
| Medium | financial overview and reports |
| Low / Last | admin fiscal, Nuvem Fiscal, product/service invoices, consulting AI |

---

## Suggested Execution Order Inside the Codebase

Recommended implementation order:

1. Shared workshop shell and user bootstrap adapter
2. Subscription and callback pages
3. Organization/profile/employees/permissions foundation
4. Core master data APIs and pages
5. Service orders and appointments
6. Dashboard and remaining operational flows
7. Financial/reporting
8. Admin/fiscal advanced

This order minimizes rework because each later module reuses the previous shared layer.

---

## Practical Migration Rules

For each module/page:

1. Map legacy route -> new Nuxt route
2. List required tables and server endpoints
3. Replace Base44 CRUD with Nuxt server APIs
4. Replace old React hook with a Nuxt composable
5. Port only the business components that still add value
6. Validate permissions and organization scoping
7. Add temporary redirect from old route if needed
8. Only then remove dependency on the old module

---

## Recommended First Sprint

If the migration starts now, the safest first sprint is:

1. Phase 0 foundation
2. Phase 1 subscription/access pages
3. Start Phase 2 with:
   - `configs/overview`
   - `configs/profile`
   - `configs/employees`
   - `Clientes`
   - `Veiculos`

Reason:
- this establishes the authenticated workshop shell
- aligns user/org/bootstrap contracts early
- unlocks the data dependencies required by service orders

---

## Final Recommendation

The migration should not be executed as "copy pages from React to Vue". It should be treated as:
- shared foundation migration
- domain API migration
- page migration by business capability

The most important dependency chain is:

Foundation -> Settings/Master Data -> Service Orders/Appointments -> Financial/Reports -> Fiscal/Admin

If we respect this order, we avoid porting pages that still depend on Base44 internals or backend pieces that are not ready yet.
