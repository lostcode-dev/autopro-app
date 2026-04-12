# AutoPro

AutoPro is a SaaS platform for automotive workshop management. It covers the full operational cycle of a repair shop: service orders, client and vehicle records, employee commission management, parts inventory, supplier purchasing, financial control, and fiscal document emission (NFS-e / NF-e), all within a multi-tenant architecture where each organization manages its own isolated data.

## Overview

- Frontend built with Nuxt 4, Vue 3, and TypeScript using `script setup`.
- UI based on `@nuxt/ui` and Tailwind CSS v4.
- Internal API under `server/api/**` with Nitro.
- Persistence and authentication handled through Supabase, always accessed server-side.
- Fiscal document emission (NFS-e and NF-e) via the Nuvem Fiscal API.
- Billing and subscription management powered by Stripe.
- PWA support configured with `@vite-pwa/nuxt`.
- Mobile packaging through Capacitor.

## Product Modules

- **Service Orders (OS)** — open, edit, close, cancel, and track all workshop service orders. Supports itemized products and services, applied taxes, installment payments, and commission breakdown per employee.
- **Clients and Vehicles** — full CRUD for clients (PF and PJ) and their vehicles, with history of service orders per vehicle.
- **Employees** — employee registration with configurable salary, PIX key, commission rules (percentage or fixed amount, based on revenue or profit), and per-category commission filters.
- **Financial Management** — income and expense transactions, installment tracking, bank account balances with statement history, recurring entries, bulk payment of commissions and financial entries.
- **Inventory (Parts)** — stock control for parts and consumables with minimum quantity alerts, cost/sale price, and supplier linkage.
- **Suppliers and Purchasing** — supplier registration, purchase orders with stock replenishment, purchase returns with financial credit generation.
- **Purchase Requests** — internal request flow from open request to authorization and purchasing.
- **Fiscal Documents** — NFS-e and NF-e emission, cancellation, carta de correção, and PDF download via Nuvem Fiscal integration. Sync status per organization.
- **Scheduling** — appointment booking linked to clients and vehicles, with status tracking and conversion to service order.
- **Reports** — sales, commissions, costs vs. profit, debtors, customers, suppliers, and purchases.
- **Organization Settings** — workshop profile, business registration (CNPJ/CPF), address, logo, IBGE municipality code, default bank account, and initial OS number.
- **User and Roles** — multi-tenant user management with per-organization role and action-based permission system. User profiles with display name, avatar, and employee linkage.
- **Subscriptions** — plan management and billing history backed by Stripe.

## Technical Stack

- Nuxt 4
- Vue 3
- TypeScript
- @nuxt/ui
- Tailwind CSS v4
- Supabase (Postgres, Auth, Storage, Edge Functions for webhooks)
- Stripe
- Nuvem Fiscal (NFS-e / NF-e)
- Capacitor
- Zod

## Project Structure

```text
.
|- app/
|  |- components/       # domain UI and shared components
|  |- composables/      # client-side state and integrations
|  |- layouts/          # public, auth, and app layouts
|  |- pages/            # marketing and authenticated app routes
|  `- types/            # frontend TypeScript contracts
|- public/              # icons, favicon, and public assets
|- server/
|  |- api/              # internal Nitro endpoints (migrated from Supabase Edge Functions)
|  `- utils/            # Supabase, auth, Stripe, and Nuvem Fiscal clients and helpers
|- supabase/
|  |- functions/        # edge functions kept only for external webhooks (Stripe, Nuvem Fiscal)
|  `- migrations/       # SQL migrations and migration documentation
`- capacitor.config.ts  # mobile configuration
```

## Requirements

- Node.js 20+
- pnpm 10+
- A configured Supabase project
- Stripe keys for subscription flows
- Nuvem Fiscal credentials for fiscal document emission

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment file:

```bash
cp .env.example .env
```

3. Fill in the required variables in `.env`.

4. Start the project:

```bash
pnpm dev
```

Local application: `http://localhost:3000`

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NUXT_PUBLIC_SITE_URL` | recommended | Public URL used for generation and metadata |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | Server-side anonymous auth and requests |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side administrative operations |
| `STRIPE_SECRET_KEY` | yes for billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | yes for billing | Stripe webhook signature verification |
| `STRIPE_ALLOWED_PRICE_IDS` | yes for billing | Comma-separated allowlist of accepted price IDs |
| `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` | optional | Custom Stripe billing portal configuration |
| `NUVEM_FISCAL_CLIENT_ID` | yes for fiscal | Nuvem Fiscal OAuth client ID |
| `NUVEM_FISCAL_CLIENT_SECRET` | yes for fiscal | Nuvem Fiscal OAuth client secret |
| `NUVEM_FISCAL_ENVIRONMENT` | yes for fiscal | `production` or `sandbox` |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Starts the development environment |
| `pnpm build` | Generates the production build |
| `pnpm preview` | Opens a local preview of the build |
| `pnpm lint` | Runs ESLint |
| `pnpm typecheck` | Validates types with Nuxt TypeCheck |
| `pnpm generate:icons` | Regenerates PWA icons and favicon from the brand SVG |
| `pnpm cap:sync` | Generates static output and syncs it with Capacitor |
| `pnpm cap:open:android` | Opens the native Android project |
| `pnpm cap:open:ios` | Opens the native iOS project |

## Data Flow and Architecture

- The client consumes only internal Nitro endpoints through `$fetch`, `useFetch`, or `useAsyncData`.
- Supabase, Stripe, and Nuvem Fiscal integrations stay exclusively on the server (`server/api/**`, `server/utils/**`).
- All database queries use the service role key server-side; the anon key is used only for authentication flows.
- Multi-tenancy is enforced at the query level: every table carries `organization_id` and all server handlers validate it from the authenticated session.
- Forms use `UForm` + Zod for validation.
- Visual feedback for actions uses `useToast()`.
- Large lists use server-side filtering and pagination.

## Important Conventions

- Never call Supabase directly from the client.
- Prefer Nuxt UI components before building custom UI.
- Avoid local CSS when utility classes are sufficient.
- Keep types explicit; avoid `any`.
- Financial values are stored as `numeric(15,2)` — never use JavaScript floats for monetary arithmetic.
- All enum values in the database are in English (snake_case). See `supabase/migrations/migrate_database_base44.md` for the PT → EN mapping used in the ETL.

## Database

Migrations live in `supabase/migrations/`. The file `migrate_database_base44.md` contains the full schema documentation including:

- Table name mapping (Base44 legacy → new schema)
- Column-level old/new name mapping with types and FK references
- JSONB column shapes for all complex fields
- Enum value tables (EN ↔ legacy PT) for every enum column
- Audit columns (`created_at/by`, `updated_at/by`, `deleted_at/by`) applied to all tables
- FK dependency order for safe migration

For new environments:

1. Create the project in Supabase.
2. Configure the variables in `.env`.
3. Apply migrations using the Supabase CLI.

## Supabase Edge Functions

Only webhook receivers are kept as Supabase Edge Functions. All other business logic runs as Nitro server routes under `server/api/`:

| Function | Reason kept |
|---|---|
| `stripeWebhook` | Must be a publicly reachable webhook endpoint for Stripe events |
| `stripe-webhook` | Legacy alias — same as above |

All other functions (service orders, financial, reports, fiscal, etc.) have been migrated to `server/api/**`.

## Fiscal Documents

NFS-e and NF-e emission requires a valid Nuvem Fiscal account. Before emitting documents for an organization:

1. Register the company (`CNPJ`) in the Nuvem Fiscal panel.
2. Upload the digital certificate via the settings screen.
3. Verify the sync status in **Settings → Fiscal Integration**.

The `sandbox` environment can be used for testing without emitting real documents.

## Billing

Subscription flows depend on:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ALLOWED_PRICE_IDS`
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` when a custom portal is configured

Without these variables the billing routes will not be operational.

## Mobile and PWA

- PWA manifest configured for standalone installation.
- Capacitor configured in `capacitor.config.ts` for Android and iOS packaging.
- Icons generated from the brand SVG in `public/icons/`.

## Quality

Before opening a PR or shipping changes:

```bash
pnpm lint
pnpm typecheck
```
