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
| getCommissionsReportData | `server/api/reports/commissions.post.ts` | POST |
| getCostsProfitReportData | `server/api/reports/costs-profit.post.ts` | POST |
| getCustomersReportData | `server/api/reports/customers.post.ts` | POST |
| getDebtorsReportData | `server/api/reports/debtors.post.ts` | POST |
| getPurchasesReportData | `server/api/reports/purchases.post.ts` | POST |
| getReportsOverviewData | `server/api/reports/overview.post.ts` | POST |
| getSalesItemsReportData | `server/api/reports/sales-items.post.ts` | POST |
| getSuppliersReportData | `server/api/reports/suppliers.post.ts` | POST |

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

### NuvemFiscal — Empresa (8)

| Original Function | New Route | Method |
|---|---|---|
| createNuvemFiscalEmpresa | `server/api/nuvem-fiscal/empresa/create.post.ts` | POST |
| getNuvemFiscalEmpresa | `server/api/nuvem-fiscal/empresa/get.post.ts` | POST |
| updateNuvemFiscalEmpresa | `server/api/nuvem-fiscal/empresa/update.post.ts` | POST |
| deleteNuvemFiscalEmpresa | `server/api/nuvem-fiscal/empresa/delete.post.ts` | POST |
| listNuvemFiscalEmpresas | `server/api/nuvem-fiscal/empresa/list.post.ts` | POST |
| getNuvemFiscalCertificadoEmpresa | `server/api/nuvem-fiscal/empresa/certificado-get.post.ts` | POST |
| upsertNuvemFiscalCertificadoEmpresa | `server/api/nuvem-fiscal/empresa/certificado-upsert.post.ts` | POST |
| deleteNuvemFiscalCertificadoEmpresa | `server/api/nuvem-fiscal/empresa/certificado-delete.post.ts` | POST |

### NuvemFiscal — NF-e (19)

| Original Function | New Route | Method |
|---|---|---|
| createNuvemFiscalNfe | `server/api/nuvem-fiscal/nfe/create.post.ts` | POST |
| getNuvemFiscalNfe | `server/api/nuvem-fiscal/nfe/get.post.ts` | POST |
| listNuvemFiscalNfe | `server/api/nuvem-fiscal/nfe/list.post.ts` | POST |
| syncNuvemFiscalNfe | `server/api/nuvem-fiscal/nfe/sync.post.ts` | POST |
| cancelNuvemFiscalNfe | `server/api/nuvem-fiscal/nfe/cancel.post.ts` | POST |
| getNuvemFiscalNfeCancelamento | `server/api/nuvem-fiscal/nfe/cancelamento-get.post.ts` | POST |
| downloadNuvemFiscalNfeCancelamentoPdf | `server/api/nuvem-fiscal/nfe/cancelamento-download-pdf.post.ts` | POST |
| createNuvemFiscalNfeCartaCorrecao | `server/api/nuvem-fiscal/nfe/carta-correcao-create.post.ts` | POST |
| getNuvemFiscalNfeCartaCorrecao | `server/api/nuvem-fiscal/nfe/carta-correcao-get.post.ts` | POST |
| downloadNuvemFiscalNfeCartaCorrecaoPdf | `server/api/nuvem-fiscal/nfe/carta-correcao-download-pdf.post.ts` | POST |
| createNuvemFiscalNfeInutilizacao | `server/api/nuvem-fiscal/nfe/inutilizacao-create.post.ts` | POST |
| getNuvemFiscalNfeInutilizacao | `server/api/nuvem-fiscal/nfe/inutilizacao-get.post.ts` | POST |
| downloadNuvemFiscalNfeInutilizacaoPdf | `server/api/nuvem-fiscal/nfe/inutilizacao-download-pdf.post.ts` | POST |
| listNuvemFiscalNfeEventos | `server/api/nuvem-fiscal/nfe/eventos-list.post.ts` | POST |
| getNuvemFiscalNfeEvento | `server/api/nuvem-fiscal/nfe/evento-get.post.ts` | POST |
| downloadNuvemFiscalNfeEventoPdf | `server/api/nuvem-fiscal/nfe/evento-download-pdf.post.ts` | POST |
| downloadNuvemFiscalNfeDanfePdf | `server/api/nuvem-fiscal/nfe/danfe-download-pdf.post.ts` | POST |
| sendNuvemFiscalNfeEmail | `server/api/nuvem-fiscal/nfe/send-email.post.ts` | POST |
| getNuvemFiscalNfeContribuinte | `server/api/nuvem-fiscal/nfe/contribuinte-get.post.ts` | POST |

### NuvemFiscal — NFS-e (11)

| Original Function | New Route | Method |
|---|---|---|
| createNuvemFiscalNfse | `server/api/nuvem-fiscal/nfse/create.post.ts` | POST |
| getNuvemFiscalNfse | `server/api/nuvem-fiscal/nfse/get.post.ts` | POST |
| listNuvemFiscalNfse | `server/api/nuvem-fiscal/nfse/list.post.ts` | POST |
| updateNuvemFiscalNfse | `server/api/nuvem-fiscal/nfse/update.post.ts` | POST |
| deleteNuvemFiscalNfse | `server/api/nuvem-fiscal/nfse/delete.post.ts` | POST |
| syncNuvemFiscalNfse | `server/api/nuvem-fiscal/nfse/sync.post.ts` | POST |
| cancelNuvemFiscalNfse | `server/api/nuvem-fiscal/nfse/cancel.post.ts` | POST |
| getNuvemFiscalNfseCancelamento | `server/api/nuvem-fiscal/nfse/cancelamento-get.post.ts` | POST |
| downloadNuvemFiscalNfsePdf | `server/api/nuvem-fiscal/nfse/download-pdf.post.ts` | POST |
| listNuvemFiscalNfseCidades | `server/api/nuvem-fiscal/nfse/cidades-list.post.ts` | POST |
| getNuvemFiscalNfseCidadeMetadados | `server/api/nuvem-fiscal/nfse/cidade-metadados-get.post.ts` | POST |

### NuvemFiscal — Cotas (1)

| Original Function | New Route | Method |
|---|---|---|
| listNuvemFiscalCotas | `server/api/nuvem-fiscal/cotas/list.post.ts` | POST |

### NuvemFiscal — Special (3)

| Original Function | New Route | Method |
|---|---|---|
| listNuvemFiscalIntegrationLogs | `server/api/nuvem-fiscal/integration-logs.post.ts` | POST |
| syncNuvemFiscalIntegrationEndpoints | `server/api/nuvem-fiscal/sync-integration-endpoints.post.ts` | POST |
| syncConfiguracaoNuvemFiscal | `server/api/nuvem-fiscal/sync-configuracao.post.ts` | POST |

### NuvemFiscal — Utility (merged into `server/utils/nuvem-fiscal.ts`)

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
