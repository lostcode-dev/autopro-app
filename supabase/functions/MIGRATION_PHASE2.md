# Migration Phase 2 — Supabase Edge Functions → Nuxt API Routes

> Generated automatically during Phase 2 migration.

## Summary

| Category | Functions Migrated | Status |
|---|---|---|
| Reports | 8 | ✅ Complete |
| Financial Entries | 1 | ✅ Complete |
| Export Reports | 3 | ✅ Complete |
| Pay Bulk | 2 | ✅ Complete |
| Scheduled / Admin | 4 | ✅ Complete |
| NuvemFiscal | 42 routes + 2 utility | ✅ Complete |
| **Total** | **62** | **✅ Complete** |

---

## Shared Utilities Created

### `server/utils/nuvem-fiscal.ts`
- `monitoredNuvemFiscalFetch()` — monitored fetch with logging to `fiscal_integration_logs`
- `resolveOrganizationIdByEmail()` — lookup org ID from user email
- `getNuvemFiscalApiToken()` — OAuth2 client_credentials token management with DB cache
- `resolveCompanyDocument()` — resolve company CPF/CNPJ from user's organization
- `getNuvemFiscalApiBaseUrl()` — API base URL from env
- `normalizeText()`, `parseBoolean()`, `sanitizeCpfCnpj()`, `extractFilename()` — helpers
- `NUVEM_FISCAL_OWNER_EMAIL` — access control constant

### `server/utils/report-export.ts`
- `buildTablePdfBase64()` — PDF report generation via pdf-lib
- `buildReportDownloadData()` — orchestrate PDF/CSV export
- `csvEscape()`, `textToBase64()`, `uint8ToBase64()`, `toLocalDateOnly()` — helpers

### `server/utils/organization.ts`
- `resolveOrganizationId()` — resolve org ID from request headers/query

---

## Route Mapping

### Reports (8)

| Original Function | New Route | Method |
|---|---|---|
| getCommissionsReportData | `server/api/reports/commissions.post.ts` | POST (complex filter) |
| getCostsProfitReportData | `server/api/reports/costs-profit.post.ts` | POST (complex filter) |
| getCustomersReportData | `server/api/reports/customers.post.ts` | POST (complex filter) |
| getDebtorsReportData | `server/api/reports/debtors.post.ts` | POST (complex filter) |
| getPurchasesReportData | `server/api/reports/purchases.post.ts` | POST (complex filter) |
| getReportsOverviewData | `server/api/reports/overview.post.ts` | POST (complex filter) |
| getSalesItemsReportData | `server/api/reports/sales-items.post.ts` | POST (complex filter) |
| getSuppliersReportData | `server/api/reports/suppliers.post.ts` | POST (complex filter) |

### Financial (1)

| Original Function | New Route | Method |
|---|---|---|
| getFinancialEntriesPage | `server/api/financial/entries.post.ts` | POST |

### Export Reports (3)

| Original Function | New Route | Method |
|---|---|---|
| exportCommissionsReport | `server/api/reports/export-commissions.post.ts` | POST |
| exportReportFile | `server/api/reports/export-file.post.ts` | POST |
| exportSalesItemsReport | `server/api/reports/export-sales-items.post.ts` | POST |

### Pay Bulk (2)

| Original Function | New Route | Method |
|---|---|---|
| payCommissionsBulk | `server/api/financial/pay-commissions-bulk.post.ts` | POST |
| payFinancialEntriesBulk | `server/api/financial/pay-entries-bulk.post.ts` | POST |

### Scheduled / Admin (4)

| Original Function | New Route | Method |
|---|---|---|
| verificarRecorrentes | `server/api/financial/check-recurring.post.ts` | POST |
| updateRecurringFinanceEntries | `server/api/financial/update-recurring.post.ts` | POST |
| seedServiceOrderItemCommissions | `server/api/service-orders/seed-commissions.post.ts` | POST |
| listServiceOrdersItemCommissionSeedStatus | `server/api/service-orders/commission-seed-status.post.ts` | POST |

### Fiscal — Company (8)

| Original Function | New Route | Method |
|---|---|---|
| createNuvemFiscalEmpresa | `server/api/fiscal/company/index.post.ts` | POST |
| getNuvemFiscalEmpresa | `server/api/fiscal/company/index.get.ts` | GET |
| updateNuvemFiscalEmpresa | `server/api/fiscal/company/index.put.ts` | PUT |
| deleteNuvemFiscalEmpresa | `server/api/fiscal/company/index.delete.ts` | DELETE |
| listNuvemFiscalEmpresas | `server/api/fiscal/company/list.get.ts` | GET |
| getNuvemFiscalCertificadoEmpresa | `server/api/fiscal/company/certificate.get.ts` | GET |
| upsertNuvemFiscalCertificadoEmpresa | `server/api/fiscal/company/certificate.put.ts` | PUT |
| deleteNuvemFiscalCertificadoEmpresa | `server/api/fiscal/company/certificate.delete.ts` | DELETE |

### Fiscal — Invoice / NF-e (19)

| Original Function | New Route | Method |
|---|---|---|
| createNuvemFiscalNfe | `server/api/fiscal/invoice/index.post.ts` | POST |
| getNuvemFiscalNfe | `server/api/fiscal/invoice/index.get.ts` | GET |
| listNuvemFiscalNfe | `server/api/fiscal/invoice/list.get.ts` | GET |
| syncNuvemFiscalNfe | `server/api/fiscal/invoice/sync.post.ts` | POST (action) |
| cancelNuvemFiscalNfe | `server/api/fiscal/invoice/cancel.post.ts` | POST (action) |
| getNuvemFiscalNfeCancelamento | `server/api/fiscal/invoice/cancellation.get.ts` | GET |
| downloadNuvemFiscalNfeCancelamentoPdf | `server/api/fiscal/invoice/cancellation-pdf.post.ts` | POST (binary) |
| createNuvemFiscalNfeCartaCorrecao | `server/api/fiscal/invoice/correction-letter.post.ts` | POST |
| getNuvemFiscalNfeCartaCorrecao | `server/api/fiscal/invoice/correction-letter.get.ts` | GET |
| downloadNuvemFiscalNfeCartaCorrecaoPdf | `server/api/fiscal/invoice/correction-letter-pdf.post.ts` | POST (binary) |
| createNuvemFiscalNfeInutilizacao | `server/api/fiscal/invoice/invalidation.post.ts` | POST |
| getNuvemFiscalNfeInutilizacao | `server/api/fiscal/invoice/invalidation.get.ts` | GET |
| downloadNuvemFiscalNfeInutilizacaoPdf | `server/api/fiscal/invoice/invalidation-pdf.post.ts` | POST (binary) |
| listNuvemFiscalNfeEventos | `server/api/fiscal/invoice/events.get.ts` | GET |
| getNuvemFiscalNfeEvento | `server/api/fiscal/invoice/event.get.ts` | GET |
| downloadNuvemFiscalNfeEventoPdf | `server/api/fiscal/invoice/event-pdf.post.ts` | POST (binary) |
| downloadNuvemFiscalNfeDanfePdf | `server/api/fiscal/invoice/pdf.post.ts` | POST (binary) |
| sendNuvemFiscalNfeEmail | `server/api/fiscal/invoice/email.post.ts` | POST (action) |
| getNuvemFiscalNfeContribuinte | `server/api/fiscal/invoice/taxpayer.get.ts` | GET |

### Fiscal — Service Invoice / NFS-e (11)

| Original Function | New Route | Method |
|---|---|---|
| createNuvemFiscalNfse | `server/api/fiscal/service-invoice/index.post.ts` | POST |
| getNuvemFiscalNfse | `server/api/fiscal/service-invoice/index.get.ts` | GET |
| listNuvemFiscalNfse | `server/api/fiscal/service-invoice/list.get.ts` | GET |
| updateNuvemFiscalNfse | `server/api/fiscal/service-invoice/index.put.ts` | PUT |
| deleteNuvemFiscalNfse | `server/api/fiscal/service-invoice/index.delete.ts` | DELETE |
| syncNuvemFiscalNfse | `server/api/fiscal/service-invoice/sync.post.ts` | POST (action) |
| cancelNuvemFiscalNfse | `server/api/fiscal/service-invoice/cancel.post.ts` | POST (action) |
| getNuvemFiscalNfseCancelamento | `server/api/fiscal/service-invoice/cancellation.get.ts` | GET |
| downloadNuvemFiscalNfsePdf | `server/api/fiscal/service-invoice/pdf.post.ts` | POST (binary) |
| listNuvemFiscalNfseCidades | `server/api/fiscal/service-invoice/cities.get.ts` | GET |
| getNuvemFiscalNfseCidadeMetadados | `server/api/fiscal/service-invoice/city-metadata.get.ts` | GET |

### Fiscal — Quotas (1)

| Original Function | New Route | Method |
|---|---|---|
| listNuvemFiscalCotas | `server/api/fiscal/quotas/index.get.ts` | GET |

### Fiscal — Special (3)

| Original Function | New Route | Method |
|---|---|---|
| listNuvemFiscalIntegrationLogs | `server/api/fiscal/integration-logs.get.ts` | GET |
| syncNuvemFiscalIntegrationEndpoints | `server/api/fiscal/sync-integration-endpoints.post.ts` | POST (action) |
| syncConfiguracaoNuvemFiscal | `server/api/fiscal/sync-config.post.ts` | POST (action) |

### Fiscal — Utility (merged into `server/utils/nuvem-fiscal.ts`)

| Original Function | Destination |
|---|---|
| nuvemFiscalAuth | `getNuvemFiscalApiToken()` in utility |
| getNuvemFiscalToken | `getNuvemFiscalApiToken()` in utility |

---

## Environment Variables Required

### NuvemFiscal
| Variable | Description | Default |
|---|---|---|
| `NUVEMFISCAL_AUTH_URL` | OAuth2 token endpoint | `https://auth.nuvemfiscal.com.br/oauth/token` |
| `NUVEMFISCAL_API_BASE_URL` | NuvemFiscal API base URL | `https://api.nuvemfiscal.com.br` |
| `NUVEMFISCAL_CLIENT_ID` | OAuth2 client ID | — |
| `NUVEMFISCAL_CLIENT_SECRET` | OAuth2 client secret | — |
| `NUVEMFISCAL_SCOPE` | OAuth2 scope | — |
| `NUVEMFISCAL_AMBIENTE` | `homologacao` or `producao` | — |
| `NUVEMFISCAL_OWNER_EMAIL` | Owner email for access control | `beenkoficial@gmail.com` |

---

## Database Tables Used

### NuvemFiscal Tables
| Table | Purpose |
|---|---|
| `oauth_tokens` | Cached OAuth2 access tokens |
| `fiscal_integration_logs` | API call monitoring/logging |
| `fiscal_integration_endpoints` | Endpoint catalog registry |
| `fiscal_sync_status` | Company sync status tracking |
| `user_profiles` | User → organization mapping |
| `organizations` | Company CPF/CNPJ lookup |

### Financial Tables
| Table | Purpose |
|---|---|
| `financial_transactions` | Financial entries (income/expense) |
| `bank_accounts` | Bank account balances |
| `bank_account_statements` | Bank statement records |
| `employee_financial_records` | Employee commission payment records |

### Report Tables
| Table | Purpose |
|---|---|
| `service_orders` | Service order data with items JSON |
| `clients` | Client information |
| `employees` | Employee data with commission config |
| `suppliers` | Supplier information |
| `products` | Product catalog |

---

## Dependencies Added
- `pdf-lib@1.17.1` — PDF report generation
- `date-fns@3.6.0` — Date manipulation for recurring entries

> Run `pnpm add pdf-lib date-fns` and `pnpm install && npx nuxt prepare` to finalize.

---

## Remaining Unmigrated Functions

| Function | Status |
|---|---|
| `cancelarNotaFiscalOS` | Not migrated (separate feature) |
| `emitirNotaFiscalOS` | Not migrated (separate feature) |
| `stripe-webhook` | Not migrated (separate feature) |
| `stripeWebhook` | Not migrated (separate feature) |
