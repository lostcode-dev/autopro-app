# Database Migration Documentation: Base44 → New Schema

## Overview

This document describes the migration from the legacy Base44 system to the new PostgreSQL schema.
All table and column names are now in English following database best practices.

### Conventions
- All tables use `snake_case` in English
- Monetary values: `numeric(15,2)`
- Identifiers: `uuid` (replace legacy `string` IDs)
- JSON arrays/objects: `jsonb`
- FKs are marked in the **FK Reference** column

### Audit Columns (all tables)

Every table must have these 7 standard columns:

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid DEFAULT gen_random_uuid()` | ✅ | Primary key |
| `created_at` | `timestamptz DEFAULT now()` | ✅ | When the record was created |
| `created_by` | `varchar(200)` | | User/email who created the record |
| `updated_at` | `timestamptz DEFAULT now()` | ✅ | When the record was last updated |
| `updated_by` | `varchar(200)` | | User/email who last updated the record |
| `deleted_at` | `timestamptz` | | Soft delete timestamp — queries must filter `WHERE deleted_at IS NULL` |
| `deleted_by` | `varchar(200)` | | User/email who soft-deleted the record |

> Tables that already had some of these columns in the legacy system show them as old→new mappings. New columns are marked `*(new)*`.

---

## Table Name Mapping (Quick Reference)

| # | Old Name (PT) | New Name (EN) |
|---|---|---|
| 1 | `OrdemServico` | `service_orders` |
| 2 | `Cliente` | `clients` |
| 3 | `Funcionario` | `employees` |
| 4 | `Veiculo` | `vehicles` |
| 5 | `Agendamento` | `appointments` |
| 6 | `Produto` | `products` |
| 7 | `Peca` | `parts` |
| 8 | `Fornecedor` | `suppliers` |
| 9 | `Compra` | `purchases` |
| 10 | `Devolucao` | `purchase_returns` |
| 11 | `SolicitacaoCompra` | `purchase_requests` |
| 12 | `LancamentoFinanceiro` | `financial_transactions` |
| 13 | `ContaBancaria` | `bank_accounts` |
| 14 | `ExtratoContaBancaria` | `bank_account_statements` |
| 15 | `ParcelaOrdemServico` | `service_order_installments` |
| 16 | `RegistroFinanceiroFuncionario` | `employee_financial_records` |
| 17 | `Maquininha` | `payment_terminals` |
| 18 | `Imposto` | `taxes` |
| 19 | `Configuracao` | ~~`settings`~~ → **MERGED INTO `organizations`** |
| 20 | `ProdutoMaster` | `master_products` |
| 21 | `CategoriaProduto` | `product_categories` |
| 22 | `CategoriaFinanceira` | `financial_categories` |
| 23 | `Consultoria` | `business_analyses` |
| 24 | `Assinatura` | `subscriptions` |
| 25 | `Fatura` *(billing)* | `billing_invoices` |
| 26 | `Organization` | `organizations` |
| 27 | `Role` | `roles` |
| 28 | `Action` | `actions` |
| 29 | `RoleAction` | `role_actions` |
| 30 | `Invoice` *(NFS-e legacy)* | ~~`nfse_legacy_invoices`~~ → **DEPRECATED** (replaced by `service_order_nfse`) |
| 31 | `ServiceOrderNfe` | `service_order_nfe` |
| 32 | `ServiceOrderNfse` | `service_order_nfse` |
| 33 | `NuvemFiscalSyncStatus` | `fiscal_sync_status` |
| 34 | `NuvemFiscalIntegrationEndpoint` | `fiscal_integration_endpoints` |
| 35 | `NuvemFiscalIntegrationLog` | `fiscal_integration_logs` |
| 36 | `OAuthToken` | `oauth_tokens` |
| 37 | `OSEditLog` | `service_order_edit_logs` |
| 38 | `SolicitacaoCorrecaoOS` | `service_order_correction_requests` |
| 39 | `users` *(Base44 user fields)* | `user_profiles` |

---

## Detailed Column Mapping

### 1. `OrdemServico` → `service_orders`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | Primary key |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | Organization reference |
| `numero` | `number` | `varchar(50)` | ✅ | | Service order number |
| `cliente_id` | `client_id` | `uuid` | ✅ | FK → `clients.id` | Client reference |
| `data_entrada` | `entry_date` | `date` | ✅ | | Vehicle entry date |
| `veiculo_id` | `vehicle_id` | `uuid` | | FK → `vehicles.id` | Vehicle reference |
| `produto_master_id` | `master_product_id` | `uuid` | | FK → `master_products.id` | Master product reference |
| `funcionario_responsavel_id` | `employee_responsible_id` | `uuid` | | FK → `employees.id` *(deprecated)* | Legacy responsible employee |
| `responsaveis` | `responsible_employees` | `jsonb` | | | `[{employee_id: uuid}]` — commission is NOT stored here, computed separately |
| `agendamento_id` | `appointment_id` | `uuid` | | FK → `appointments.id` | Source appointment |
| `status` | `status` | `varchar(30)` | | | `estimate / open / in_progress / waiting_for_part / completed / delivered / cancelled` |
| `status_pagamento` | `payment_status` | `varchar(20)` | | | `pending / paid / partial` |
| `data_prevista` | `expected_date` | `date` | | | Expected completion date |
| `data_prevista_pagamento` | `expected_payment_date` | `date` | | | Expected payment date |
| `data_conclusao` | `completion_date` | `date` | | | Actual completion date |
| `defeito_relatado` | `reported_defect` | `text` | | | Client-reported problem |
| `diagnostico` | `diagnosis` | `text` | | | Technical diagnosis |
| `itens` | `items` | `jsonb` | | | See column details below |
| `aplicar_impostos` | `apply_taxes` | `boolean` | | | Whether taxes apply |
| `impostos_selecionados` | `selected_taxes` | `jsonb` | | | `[{tax_id, name, type, rate, calculated_amount}]` |
| `valor_impostos_total` | `total_taxes_amount` | `numeric(15,2)` | | | Total taxes amount |
| `valor_total` | `total_amount` | `numeric(15,2)` | | | Total order amount |
| `valor_custo_total` | `total_cost_amount` | `numeric(15,2)` | | | Total cost amount |
| `desconto` | `discount` | `numeric(15,2)` | | | Applied discount |
| `valor_comissao` | `commission_amount` | `numeric(15,2)` | | | Commission amount |
| `valor_taxa_maquininha` | `terminal_fee_amount` | `numeric(15,2)` | | | Payment terminal fee |
| `forma_pagamento` | `payment_method` | `varchar(30)` | | | `pix / cash / credit_card / debit_card / check / bank_slip / transfer / no_payment` |
| `parcelado` | `is_installment` | `boolean` | | | Whether payment is installment |
| `numero_parcelas` | `installment_count` | `int` | | | Number of installments |
| `observacoes` | `notes` | `text` | | | General notes |
| `nfse_active_id` | `active_nfse_id` | `uuid` | | FK → `service_order_nfse.id` | Active NFS-e reference |
| `nfse_ids` | `nfse_ids` | `text` | | | JSON with NFS-e ID history |
| `nfe_active_id` | `active_nfe_id` | `uuid` | | FK → `service_order_nfe.id` | Active NF-e reference |
| `nfe_ids` | `nfe_ids` | `text` | | | JSON with NF-e ID history |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**`responsible_employees`** (`jsonb`)
```jsonc
[{ "employee_id": "uuid" }]
// commission_percentage is NOT stored here — computed by generateServiceOrderCommissions
// and written to items[].commissions and employee_financial_records
```

**`items`** (`jsonb`)
```jsonc
[
  {
    "product_id": "uuid | null",      // null for free-text items
    "description": "string",
    "quantity": 1,
    "unit_price": 100.00,
    "cost_price": 60.00,              // item-level cost override
    "total_price": 100.00,            // quantity * unit_price
    "total_commission": 10.00,        // sum of commissions[]
    "commissions": [                  // populated by generateServiceOrderCommissions
      {
        "employee_id": "uuid",
        "amount": 10.00,
        "type": "percentage | fixed_amount",
        "base": "revenue | profit",
        "percentage": 10.0            // only when type = "percentage"
      }
    ]
  }
]
```

**`selected_taxes`** (`jsonb`)
```jsonc
[
  {
    "tax_id": "uuid",
    "name": "ISS",
    "type": "municipal | state | federal",
    "rate": 5.0,
    "calculated_amount": 50.00    // total_amount * rate / 100
  }
]
```

**Enum: `status`**

| New (EN) | Legacy Base44 (PT) |
|---|---|
| `estimate` | `orcamento` |
| `open` | `aberta` |
| `in_progress` | `em_andamento` |
| `waiting_for_part` | `aguardando_peca` |
| `completed` | `concluida` |
| `delivered` | `entregue` |
| `cancelled` | `cancelada` |

**Enum: `payment_method`** (also used in `service_order_installments`)

| New (EN) | Legacy Base44 (PT) |
|---|---|
| `pix` | `pix` |
| `cash` | `dinheiro` |
| `credit_card` | `cartao_credito` |
| `debit_card` | `cartao_debito` |
| `check` | `cheque` |
| `bank_slip` | `boleto` |
| `transfer` | `transferencia` |
| `no_payment` | `sem_forma_pagamento` |

---

### 2. `Cliente` → `clients`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(200)` | ✅ | | Full name |
| `telefone` | `phone` | `varchar(20)` | ✅ | | Contact phone |
| `tipo_pessoa` | `person_type` | `varchar(2)` | ✅ | | `pf / pj` |
| `cpf_cnpj` | `tax_id` | `varchar(18)` | | | CPF or CNPJ |
| `email` | `email` | `varchar(200)` | | | Email |
| `cep` | `zip_code` | `varchar(9)` | | | ZIP code |
| `logradouro` | `street` | `varchar(200)` | | | Street address |
| `numero` | `address_number` | `varchar(10)` | | | Address number |
| `complemento` | `address_complement` | `varchar(100)` | | | Address complement |
| `bairro` | `neighborhood` | `varchar(100)` | | | Neighborhood |
| `cidade` | `city` | `varchar(100)` | | | City |
| `uf` | `state` | `char(2)` | | | State (UF) |
| `funcionario_responsavel_id` | `employee_responsible_id` | `uuid` | | FK → `employees.id` *(deprecated)* | |
| `funcionarios_responsaveis` | `responsible_employees` | `jsonb` | | | `[{employee_id: uuid}]` |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 3. `Funcionario` → `employees`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(200)` | ✅ | | Full name |
| `tipo_pessoa` | `person_type` | `varchar(2)` | ✅ | | `pf / pj` |
| `cpf_cnpj` | `tax_id` | `varchar(18)` | ✅ | | CPF or CNPJ |
| `telefone` | `phone` | `varchar(20)` | ✅ | | Phone |
| `email` | `email` | `varchar(200)` | | | Email |
| `cep` | `zip_code` | `varchar(9)` | | | ZIP code |
| `logradouro` | `street` | `varchar(200)` | | | Street |
| `numero` | `address_number` | `varchar(10)` | | | Address number |
| `complemento` | `address_complement` | `varchar(100)` | | | Address complement |
| `bairro` | `neighborhood` | `varchar(100)` | | | Neighborhood |
| `cidade` | `city` | `varchar(100)` | | | City |
| `uf` | `state` | `char(2)` | | | State (UF) |
| `tem_salario` | `has_salary` | `boolean` | | | Has fixed salary |
| `valor_salario` | `salary_amount` | `numeric(15,2)` | | | Salary amount |
| `dia_pagamento` | `payment_day` | `int` | | | Payment day (1–31) |
| `parcelas_salario` | `salary_installments` | `jsonb` | | | `[{day: int, amount: numeric}]` |
| `tem_comissao` | `has_commission` | `boolean` | | | Receives commission |
| `tipo_comissao` | `commission_type` | `varchar(20)` | | | `percentage / fixed_amount` (PT: `percentual / fixo`) |
| `valor_comissao` | `commission_amount` | `numeric(15,2)` | | | Commission value/percentage |
| `base_comissao` | `commission_base` | `varchar(10)` | | | `revenue / profit` ⚠️ PT uses both `venda` and `receita` for revenue — ETL must map both to `revenue` |
| `categorias_comissao` | `commission_categories` | `jsonb` | | | `string[]` — array of `product_categories.id` |
| `tem_minimo_garantido` | `has_minimum_guarantee` | `boolean` | | | Has minimum guarantee |
| `valor_minimo_garantido` | `minimum_guarantee_amount` | `numeric(15,2)` | | | Minimum guarantee value |
| `parcelas_minimo_garantido` | `minimum_guarantee_installments` | `jsonb` | | | `[{day: int, amount: numeric}]` |
| `tipo_chave_pix` | `pix_key_type` | `varchar(20)` | | | `cpf / cnpj / email / phone / random_key` |
| `chave_pix` | `pix_key` | `varchar(150)` | | | PIX key |
| `data_demissao` | `termination_date` | `date` | | | Termination date |
| `motivo_demissao` | `termination_reason` | `text` | | | Termination reason |
| `deleted_at` | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `commission_type`**

| New (EN) | Legacy (PT) |
|---|---|
| `percentage` | `percentual` |
| `fixed_amount` | `fixo` |

**Enum: `commission_base`**

| New (EN) | Legacy (PT) |
|---|---|
| `revenue` | `venda` *or* `receita` ⚠️ both exist in code |
| `profit` | `lucro` |

---

### 4. `Veiculo` → `vehicles`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `cliente_id` | `client_id` | `uuid` | ✅ | FK → `clients.id` | Owner client |
| `placa` | `license_plate` | `varchar(10)` | | | License plate |
| `marca` | `brand` | `varchar(100)` | | | Brand |
| `modelo` | `model` | `varchar(100)` | | | Model |
| `ano` | `year` | `int` | | | Year |
| `cor` | `color` | `varchar(50)` | | | Color |
| `motor` | `engine` | `varchar(100)` | | | Engine spec |
| `combustivel` | `fuel_type` | `varchar(20)` | | | `gasoline / ethanol / diesel / flex / cng / electric / hybrid` |
| `quilometragem` | `mileage` | `int` | | | Current mileage |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `fuel_type`**

| New (EN) | Legacy (PT) |
|---|---|
| `gasoline` | `gasolina` |
| `ethanol` | `etanol` |
| `diesel` | `diesel` |
| `flex` | `flex` |
| `cng` | `gnv` |
| `electric` | `eletrico` |
| `hybrid` | `hibrido` |

---

### 5. `Agendamento` → `appointments`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `cliente_id` | `client_id` | `uuid` | ✅ | FK → `clients.id` | |
| `veiculo_id` | `vehicle_id` | `uuid` | ✅ | FK → `vehicles.id` | |
| `data_agendamento` | `appointment_date` | `date` | ✅ | | Appointment date |
| `horario` | `time` | `varchar(5)` | ✅ | | Time (HH:MM) |
| `tipo_servico` | `service_type` | `varchar(200)` | ✅ | | Service description |
| `prioridade` | `priority` | `varchar(10)` | | | `low / medium / high` |
| `status` | `status` | `varchar(20)` | | | `scheduled / confirmed / cancelled / completed` |
| `ordem_servico_id` | `service_order_id` | `uuid` | | FK → `service_orders.id` | Linked service order |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 6. `Produto` → `products`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(200)` | ✅ | | Product/service name |
| `codigo` | `code` | `varchar(50)` | ✅ | | Internal code |
| `tipo` | `type` | `varchar(10)` | ✅ | | `unit / group` |
| `categoria_id` | `category_id` | `uuid` | | FK → `product_categories.id` | Product category |
| `controlar_estoque` | `track_inventory` | `boolean` | | | Whether to track stock |
| `quantidade_inicial_estoque` | `initial_stock_quantity` | `int` | | | Initial stock quantity |
| `observacoes` | `notes` | `text` | | | |
| `preco_venda_unitario` | `unit_sale_price` | `numeric(15,2)` | | | Unit sale price |
| `preco_custo_unitario` | `unit_cost_price` | `numeric(15,2)` | | | Unit cost price |
| `itens_grupo` | `group_items` | `jsonb` | | | See column details below |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**`group_items`** (`jsonb`) — only when `type = group`
```jsonc
[
  {
    "description": "string",
    "quantity": 1,
    "unit": "un | kg | m | hr",
    "cost_price": 10.00,
    "sale_price": 15.00,
    "track_inventory": true,
    "initial_stock_quantity": 10
  }
]
```

---

### 7. `Peca` → `parts`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `produto_id` | `product_id` | `uuid` | | FK → `products.id` | Source product |
| `codigo` | `code` | `varchar(50)` | ✅ | | Part code |
| `descricao` | `description` | `varchar(200)` | ✅ | | Description |
| `quantidade_estoque` | `stock_quantity` | `int` | ✅ | | Quantity in stock |
| `preco_venda` | `sale_price` | `numeric(15,2)` | ✅ | | Sale price |
| `marca` | `brand` | `varchar(100)` | | | Brand |
| `categoria` | `category` | `varchar(30)` | | | `engine / suspension / brakes / transmission / electrical / body / filters / oils / tires / other` |
| `quantidade_minima` | `minimum_quantity` | `int` | | | Minimum stock quantity |
| `preco_custo` | `cost_price` | `numeric(15,2)` | | | Cost price |
| `fornecedor` | `supplier_name` | `varchar(200)` | | | Supplier name (denormalized) |
| `localizacao` | `location` | `varchar(100)` | | | Stock location |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `category`**

| New (EN) | Legacy (PT) |
|---|---|
| `engine` | `motor` |
| `suspension` | `suspensao` |
| `brakes` | `freios` |
| `transmission` | `transmissao` |
| `electrical` | `eletrica` |
| `body` | `carroceria` |
| `filters` | `filtros` |
| `oils` | `oleos` |
| `tires` | `pneus` |
| `other` | `outros` |

---

### 8. `Fornecedor` → `suppliers`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(200)` | ✅ | | Legal name |
| `tipo_pessoa` | `person_type` | `varchar(2)` | ✅ | | `pf / pj` |
| `telefone` | `phone` | `varchar(20)` | ✅ | | Phone |
| `nome_fantasia` | `trade_name` | `varchar(200)` | | | Trade name |
| `cpf_cnpj` | `tax_id` | `varchar(18)` | | | CPF/CNPJ |
| `inscricao_estadual` | `state_registration` | `varchar(20)` | | | State registration |
| `whatsapp` | `whatsapp` | `varchar(20)` | | | WhatsApp |
| `email` | `email` | `varchar(200)` | | | Email |
| `site` | `website` | `varchar(200)` | | | Website |
| `cep` | `zip_code` | `varchar(9)` | | | ZIP code |
| `logradouro` | `street` | `varchar(200)` | | | Street |
| `numero` | `address_number` | `varchar(10)` | | | Address number |
| `complemento` | `address_complement` | `varchar(100)` | | | Address complement |
| `bairro` | `neighborhood` | `varchar(100)` | | | Neighborhood |
| `cidade` | `city` | `varchar(100)` | | | City |
| `uf` | `state` | `char(2)` | | | State (UF) |
| `contato_nome` | `contact_name` | `varchar(200)` | | | Contact person name |
| `contato_cargo` | `contact_role` | `varchar(100)` | | | Contact person role |
| `contato_telefone` | `contact_phone` | `varchar(20)` | | | Contact phone |
| `contato_email` | `contact_email` | `varchar(200)` | | | Contact email |
| `categoria` | `category` | `varchar(30)` | | | `auto_parts / tools / equipment / services / consumables / other` |
| `prazo_pagamento_dias` | `payment_term_days` | `int` | | | Default payment term (days) |
| `limite_credito` | `credit_limit` | `numeric(15,2)` | | | Credit limit |
| `ativo` | `is_active` | `boolean` | | | Whether active |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `category`**

| New (EN) | Legacy (PT) |
|---|---|
| `auto_parts` | `pecas_automotivas` |
| `tools` | `ferramentas` |
| `equipment` | `equipamentos` |
| `services` | `servicos` |
| `consumables` | `consumiveis` |
| `other` | `outros` |

---

### 9. `Compra` → `purchases`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `fornecedor_id` | `supplier_id` | `uuid` | ✅ | FK → `suppliers.id` | |
| `data_compra` | `purchase_date` | `date` | ✅ | | |
| `valor_total` | `total_amount` | `numeric(15,2)` | ✅ | | |
| `conta_bancaria_id` | `bank_account_id` | `uuid` | ✅ | FK → `bank_accounts.id` | |
| `status_pagamento` | `payment_status` | `varchar(20)` | ✅ | | `paid / pending` |
| `numero_nota_fiscal` | `invoice_number` | `varchar(50)` | | | Invoice number |
| `lancamento_financeiro_id` | `financial_transaction_id` | `uuid` | | FK → `financial_transactions.id` | Generated transaction |
| `data_pagamento` | `payment_date` | `date` | | | |
| `data_vencimento` | `due_date` | `date` | | | |
| `observacoes` | `notes` | `text` | | | |
| `itens` | `items` | `jsonb` | | | See column details below |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**`items`** (`jsonb`)
```jsonc
[
  {
    "part_id": "uuid | null",
    "description": "string",
    "quantity": 2,
    "unit_cost_price": 50.00,
    "unit_sale_price": 80.00,
    "total_item_price": 100.00,   // quantity * unit_cost_price
    "add_to_stock": true          // whether to increment parts.stock_quantity
  }
]
```

---

### 10. `Devolucao` → `purchase_returns`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `compra_id` | `purchase_id` | `uuid` | ✅ | FK → `purchases.id` | Original purchase |
| `fornecedor_id` | `supplier_id` | `uuid` | ✅ | FK → `suppliers.id` | |
| `data_devolucao` | `return_date` | `date` | ✅ | | |
| `motivo` | `reason` | `varchar(40)` | ✅ | | `warranty / wrong_part / manufacturing_defect / damaged_product / incompatible / other` |
| `status` | `status` | `varchar(20)` | ✅ | | `pending / completed` |
| `valor_total_devolvido` | `total_returned_amount` | `numeric(15,2)` | ✅ | | |
| `itens_devolvidos` | `returned_items` | `jsonb` | ✅ | | See column details below |
| `gerou_credito_financeiro` | `generated_financial_credit` | `boolean` | | | Whether it generated a financial credit |
| `lancamento_financeiro_id` | `financial_transaction_id` | `uuid` | | FK → `financial_transactions.id` | Entry transaction |
| `conta_bancaria_id` | `bank_account_id` | `uuid` | | FK → `bank_accounts.id` | Account where credit was received |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**`returned_items`** (`jsonb`)
```jsonc
[
  {
    "part_id": "uuid",
    "description": "string",
    "quantity": 1,
    "unit_cost_price": 50.00,
    "total_item_price": 50.00
  }
]
```

**Enum: `reason`**

| New (EN) | Legacy (PT) |
|---|---|
| `warranty` | `garantia` |
| `wrong_part` | `peca_errada` |
| `manufacturing_defect` | `defeito_fabricacao` |
| `damaged_product` | `produto_danificado` |
| `incompatible` | `nao_compativel` |
| `other` | `outros` |

---

### 11. `SolicitacaoCompra` → `purchase_requests`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `numero_solicitacao` | `request_number` | `varchar(50)` | ✅ | | Unique request number |
| `data_solicitacao` | `request_date` | `timestamptz` | ✅ | | |
| `fornecedor_id` | `supplier_id` | `uuid` | ✅ | FK → `suppliers.id` | |
| `status` | `status` | `varchar(20)` | ✅ | | `waiting / authorized / rejected / purchased` |
| `itens` | `items` | `jsonb` | ✅ | | `[{description, code, vehicle_id, quantity, estimated_unit_price, estimated_total_price, notes}]` |
| `valor_total_solicitacao` | `total_request_amount` | `numeric(15,2)` | ✅ | | |
| `solicitante` | `requester` | `varchar(200)` | ✅ | | Requester name/email |
| `ordem_servico_id` | `service_order_id` | `uuid` | | FK → `service_orders.id` | Related service order |
| `justificativa` | `justification` | `text` | | | |
| `observacoes` | `notes` | `text` | | | |
| `data_autorizacao` | `authorization_date` | `timestamptz` | | | |
| `autorizado_por` | `authorized_by` | `varchar(200)` | | | Who authorized |
| `motivo_recusa` | `rejection_reason` | `text` | | | |
| `compra_id` | `purchase_id` | `uuid` | | FK → `purchases.id` | Generated purchase |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `status`**

| New (EN) | Legacy (PT) |
|---|---|
| `waiting` | `aguardando` |
| `authorized` | `autorizado` |
| `rejected` | `recusado` |
| `purchased` | `comprado` |

---

### 12. `LancamentoFinanceiro` → `financial_transactions`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `descricao` | `description` | `varchar(300)` | ✅ | | |
| `valor` | `amount` | `numeric(15,2)` | ✅ | | |
| `data_vencimento` | `due_date` | `date` | ✅ | | |
| `tipo` | `type` | `varchar(10)` | ✅ | | `income / expense` (PT: `entrada / saida`) |
| `status` | `status` | `varchar(20)` | ✅ | | `paid / pending / cancelled` (PT: `pago / pendente / cancelado`) |
| `categoria` | `category` | `varchar(30)` | ✅ | | `sales / services / rent / salaries / suppliers / taxes / marketing / other` |
| `recorrencia` | `recurrence` | `varchar(20)` | | | `non_recurring / monthly / annual` (PT: `nao_recorrente / mensal / anual`) |
| `data_encerramento_recorrencia` | `recurrence_end_date` | `date` | | | |
| `id_lancamento_recorrente_pai` | `parent_recurrence_id` | `uuid` | | FK → `financial_transactions.id` | Parent of recurring series |
| `observacoes` | `notes` | `text` | | | |
| `registro_funcionario_id` | `employee_financial_record_id` | `uuid` | | FK → `employee_financial_records.id` | |
| `parcelado` | `is_installment` | `boolean` | | | |
| `numero_parcelas` | `installment_count` | `int` | | | Total installments |
| `parcela_atual` | `current_installment` | `int` | | | Current installment number |
| `id_lancamento_pai` | `parent_transaction_id` | `uuid` | | FK → `financial_transactions.id` | Parent to group installments |
| `conta_bancaria_id` | `bank_account_id` | `uuid` | | FK → `bank_accounts.id` | |
| `parcela_ordem_servico_id` | `service_order_installment_id` | `uuid` | | FK → `service_order_installments.id` | |
| `compra_id` | `purchase_id` | `uuid` | | FK → `purchases.id` | Source purchase |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `type`** (also `bank_account_statements.transaction_type`)

| New (EN) | Legacy (PT) |
|---|---|
| `income` | `entrada` |
| `expense` | `saida` |
| `transfer_in` | `transferencia_entrada` |
| `transfer_out` | `transferencia_saida` |

**Enum: `category`**

| New (EN) | Legacy (PT) |
|---|---|
| `sales` | `vendas` |
| `services` | `servicos` |
| `rent` | `aluguel` |
| `salaries` | `salarios` |
| `suppliers` | `fornecedores` |
| `taxes` | `impostos` |
| `marketing` | `marketing` |
| `other` | `outros` |

---

### 13. `ContaBancaria` → `bank_accounts`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome_conta` | `account_name` | `varchar(100)` | ✅ | | Account display name |
| `tipo_conta` | `account_type` | `varchar(30)` | ✅ | | `checking / savings / salary / investment / cash` |
| `saldo_inicial` | `initial_balance` | `numeric(15,2)` | ✅ | | |
| `forma_pagamento_preferida` | `preferred_payment_method` | `varchar(30)` | | | `pix / cash / credit_card / debit_card / check / transfer / bank_slip` |
| `banco` | `bank_name` | `varchar(100)` | | | Bank name |
| `agencia` | `branch` | `varchar(20)` | | | Branch number |
| `numero_conta` | `account_number` | `varchar(20)` | | | Account number |
| `saldo_atual` | `current_balance` | `numeric(15,2)` | | | Computed current balance |
| `ativa` | `is_active` | `boolean` | | | |
| `observacoes` | `notes` | `text` | | | |
| `historico_alteracoes` | `change_history` | `jsonb` | | | Change history log |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 14. `ExtratoContaBancaria` → `bank_account_statements`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `conta_bancaria_id` | `bank_account_id` | `uuid` | ✅ | FK → `bank_accounts.id` | |
| `data_movimentacao` | `transaction_date` | `date` | ✅ | | |
| `descricao` | `description` | `varchar(300)` | ✅ | | |
| `tipo_movimentacao` | `transaction_type` | `varchar(30)` | ✅ | | `income / expense / transfer_in / transfer_out` |
| `valor` | `amount` | `numeric(15,2)` | ✅ | | |
| `saldo_anterior` | `previous_balance` | `numeric(15,2)` | ✅ | | Balance before |
| `saldo_posterior` | `new_balance` | `numeric(15,2)` | ✅ | | Balance after |
| `lancamento_financeiro_id` | `financial_transaction_id` | `uuid` | | FK → `financial_transactions.id` | Source transaction |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 15. `ParcelaOrdemServico` → `service_order_installments`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `ordem_servico_id` | `service_order_id` | `uuid` | ✅ | FK → `service_orders.id` | |
| `numero_parcela` | `installment_number` | `int` | ✅ | | |
| `valor_parcela` | `installment_amount` | `numeric(15,2)` | ✅ | | |
| `data_vencimento` | `due_date` | `date` | ✅ | | |
| `data_pagamento` | `payment_date` | `date` | | | Actual payment date |
| `status` | `status` | `varchar(20)` | | | `pending / paid / overdue` |
| `forma_pagamento` | `payment_method` | `varchar(30)` | | | `pix / cash / credit_card / debit_card / check / bank_slip / transfer` |
| `lancamento_financeiro_id` | `financial_transaction_id` | `uuid` | | FK → `financial_transactions.id` | |
| `observacoes` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 16. `RegistroFinanceiroFuncionario` → `employee_financial_records`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `funcionario_id` | `employee_id` | `uuid` | ✅ | FK → `employees.id` | |
| `tipo_registro` | `record_type` | `varchar(20)` | ✅ | | `salary / commission / advance / bonus / discount` |
| `descricao` | `description` | `varchar(300)` | ✅ | | |
| `valor` | `amount` | `numeric(15,2)` | ✅ | | |
| `data_referencia` | `reference_date` | `date` | ✅ | | Competency date |
| `status` | `status` | `varchar(20)` | ✅ | | `paid / pending` |
| `ordem_servico_id` | `service_order_id` | `uuid` | | FK → `service_orders.id` | Source service order |
| `parcela_ordem_servico_id` | `service_order_installment_id` | `uuid` | | FK → `service_order_installments.id` | Specific installment |
| `data_pagamento` | `payment_date` | `date` | | | Actual payment date |
| `lancamento_financeiro_id` | `financial_transaction_id` | `uuid` | | FK → `financial_transactions.id` | Synced transaction |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `record_type`**

| New (EN) | Legacy (PT) |
|---|---|
| `salary` | `salario` |
| `commission` | `comissao` |
| `advance` | `adiantamento` |
| `bonus` | `bonus` |
| `discount` | `desconto` |

---

### 17. `Maquininha` → `payment_terminals`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome_maquininha` | `terminal_name` | `varchar(100)` | ✅ | | Display name |
| `empresa_fornecedora` | `provider_company` | `varchar(100)` | | | Provider company |
| `conta_bancaria_id` | `bank_account_id` | `uuid` | | FK → `bank_accounts.id` | Linked bank account |
| `prazo_recebimento_dias` | `payment_receipt_days` | `int` | | | Receipt delay (D+X) |
| `ativa` | `is_active` | `boolean` | | | Whether in use |
| `taxas` | `rates` | `jsonb` | | | See column details below |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**`rates`** (`jsonb`)
```jsonc
[
  {
    "installment_number": 1,  // 1 = debit/à vista, 2+ = credit installment
    "rate_percentage": 2.5    // fee deducted from received amount
  }
]
```

---

### 18. `Imposto` → `taxes`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(50)` | ✅ | | Tax name (e.g., ISS, ICMS) |
| `tipo` | `type` | `varchar(20)` | ✅ | | `municipal / state / federal` |
| `aliquota` | `rate` | `numeric(8,4)` | ✅ | | Rate percentage |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 19. `Configuracao` → ~~`settings`~~ **MERGED INTO `organizations`**

> **Reason:** `Configuracao` had a strict 1:1 relationship with `Organization` (one row per organization). Keeping them as separate tables created redundancy: workshop name, phone, email, and logo were duplicated. All business profile fields from `Configuracao` are now columns on `organizations`. See table 26 for the full merged column mapping.
>
> **Migration:** ETL must read from both `Configuracao` and `Organization` and write a single row into the new `organizations` table per tenant. See column-level mapping in table 26.

---

### 20. `ProdutoMaster` → `master_products`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(200)` | ✅ | | |
| `descricao` | `description` | `text` | | | Detailed description |
| `observacoes` | `notes` | `text` | | | |
| `updated_at` | `updated_at` | `timestamptz` | | | |
| `updated_by` | `updated_by` | `varchar(200)` | | | Last updated by (user) |
| `deleted_at` | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| `deleted_by` | `deleted_by` | `varchar(200)` | | | Deleted by (user) |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |

---

### 21. `CategoriaProduto` → `product_categories`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(100)` | ✅ | | Category name |
| `descricao` | `description` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 22. `CategoriaFinanceira` → `financial_categories`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome` | `name` | `varchar(100)` | ✅ | | Category name |
| `tipo` | `type` | `varchar(10)` | ✅ | | `income / expense` |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 23. `Consultoria` → `business_analyses`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `titulo` | `title` | `varchar(200)` | ✅ | | Analysis title |
| `data_analise` | `analysis_date` | `timestamptz` | ✅ | | Date/time of analysis |
| `score_negocio` | `business_score` | `int` | ✅ | | Score 0–100 |
| `resumo_executivo` | `executive_summary` | `text` | ✅ | | |
| `pontos_fortes` | `strengths` | `jsonb` | | | Array of strings |
| `areas_melhoria` | `improvement_areas` | `jsonb` | | | Array of strings |
| `estrategias_crescimento` | `growth_strategies` | `jsonb` | | | `[{title, description}]` |
| `analise_financeira` | `financial_analysis` | `text` | | | |
| `analise_clientes` | `customer_analysis` | `text` | | | |
| `dados_base` | `base_data` | `jsonb` | | | Snapshot of data used |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 24. `Assinatura` → `subscriptions`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `user_email` | `user_email` | `varchar(200)` | ✅ | | User email |
| `status` | `status` | `varchar(20)` | ✅ | | `active / cancelled / suspended / trial` |
| `stripe_customer_id` | `stripe_customer_id` | `varchar(100)` | | | Stripe customer ID |
| `stripe_subscription_id` | `stripe_subscription_id` | `varchar(100)` | | | Stripe subscription ID |
| `plano` | `plan_name` | `varchar(100)` | | | Plan name |
| `valor_mensal` | `monthly_amount` | `numeric(15,2)` | | | Monthly amount |
| `data_inicio` | `start_date` | `timestamptz` | | | |
| `data_proximo_pagamento` | `next_payment_date` | `timestamptz` | | | |
| `data_cancelamento` | `cancellation_date` | `timestamptz` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 25. `Fatura` *(billing)* → `billing_invoices`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `user_email` | `user_email` | `varchar(200)` | ✅ | | |
| `stripe_invoice_id` | `stripe_invoice_id` | `varchar(100)` | ✅ | | Stripe invoice ID |
| `valor` | `amount` | `numeric(15,2)` | ✅ | | |
| `status` | `status` | `varchar(20)` | ✅ | | `paid / pending / failed / cancelled` |
| `assinatura_id` | `subscription_id` | `uuid` | | FK → `subscriptions.id` | |
| `stripe_subscription_id` | `stripe_subscription_id` | `varchar(100)` | | | |
| `numero_fatura` | `invoice_number` | `varchar(50)` | | | |
| `data_emissao` | `issue_date` | `timestamptz` | | | |
| `data_vencimento` | `due_date` | `timestamptz` | | | |
| `data_pagamento` | `payment_date` | `timestamptz` | | | |
| `url_pdf` | `pdf_url` | `varchar(500)` | | | |
| `descricao` | `description` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 26. `Organization` + `Configuracao` → `organizations` *(merged)*

> This table absorbs both `Organization` and `Configuracao`. The **Source** column indicates which legacy table each field came from. Fields present in both (name, phone, email, logo) are unified into a single column — the ETL should prefer the `Configuracao` value as it is user-maintained. The old `Organization.profile_picture_url` is renamed `logo_url` to match `Configuracao.logo_url`.
>
> **Note:** `display_name` and `profile_picture_url` from Base44's `Organization` object were actually user-level fields (user's display name and user's avatar), not organization-level. These fields have been moved to `user_profiles`. See table 39.

| Old Column | New Column (EN) | Type | Required | FK Reference | Source | Description |
|---|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | | |
| `name` / `nome_oficina` | `name` | `varchar(200)` | ✅ | | Organization + Configuracao | Workshop/organization name |
| `business_type` | `business_type` | `varchar(100)` | | | Organization | Type of business (e.g., Mecânica, Retífica) |
| `active` | `is_active` | `boolean` | | | Organization | |
| `tipo_pessoa` | `person_type` | `varchar(2)` | ✅ | | Configuracao | `pf / pj` |
| `cpf_cnpj` | `tax_id` | `varchar(18)` | | | Configuracao | CPF or CNPJ |
| `inscricao_estadual` | `state_registration` | `varchar(20)` | | | Configuracao | |
| `telefone` / `phone` | `phone` | `varchar(20)` | | | Organization + Configuracao | Prefer Configuracao value |
| `whatsapp` | `whatsapp` | `varchar(20)` | | | Configuracao | |
| `email` / `contact_email` | `email` | `varchar(200)` | | | Organization + Configuracao | Prefer Configuracao value |
| `site` | `website` | `varchar(200)` | | | Configuracao | |
| `logo_url` | `logo_url` | `varchar(500)` | | | Configuracao | Organization logo |
| `cep` | `zip_code` | `varchar(9)` | | | Configuracao | |
| `logradouro` | `street` | `varchar(200)` | | | Configuracao | |
| `numero` | `address_number` | `varchar(10)` | | | Configuracao | |
| `complemento` | `address_complement` | `varchar(100)` | | | Configuracao | |
| `bairro` | `neighborhood` | `varchar(100)` | | | Configuracao | |
| `cidade` | `city` | `varchar(100)` | | | Configuracao | |
| `uf` | `state` | `char(2)` | | | Configuracao | State (UF) |
| `codigo_municipio` | `municipality_code` | `varchar(10)` | | | Configuracao | IBGE municipality code |
| `numero_inicial_os` | `initial_service_order_number` | `int` | | | Configuracao | Starting service order number |
| `conta_bancaria_padrao_id` | `default_bank_account_id` | `uuid` | | FK → `bank_accounts.id` | Configuracao | Default bank account |
| `observacoes` | `notes` | `text` | | | Configuracao | |
| `created_at` | `created_at` | `timestamptz` | ✅ | | Organization | |
| `updated_at` | `updated_at` | `timestamptz` | ✅ | | Organization | |
| `created_by` | `created_by` | `varchar(200)` | | | Organization | Original owner email |
| *(new)* | `updated_by` | `varchar(200)` | | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | | User/email who deleted the record |

---

### 27. `Role` → `roles`

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `name` | `name` | `varchar(100)` | ✅ | | Unique role name |
| `display_name` | `display_name` | `varchar(100)` | ✅ | | |
| `description` | `description` | `text` | | | |
| `is_system_role` | `is_system_role` | `boolean` | | | System-defined role |
| `created_at` | `created_at` | `timestamptz` | ✅ | | |
| `updated_at` | `updated_at` | `timestamptz` | ✅ | | |
| `created_by` | `created_by` | `varchar(200)` | | | Creator email |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 28. `Action` → `actions`

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `code` | `code` | `varchar(100)` | ✅ | | Unique code (e.g., `customers.create`) |
| `name` | `name` | `varchar(100)` | ✅ | | |
| `resource` | `resource` | `varchar(100)` | ✅ | | Resource (e.g., `customers`) |
| `action_type` | `action_type` | `varchar(20)` | ✅ | | `create / read / update / delete / manage / view` |
| `description` | `description` | `text` | | | |
| `created_at` | `created_at` | `timestamptz` | ✅ | | |
| `updated_at` | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 29. `RoleAction` → `role_actions`

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `role_id` | `role_id` | `uuid` | ✅ | FK → `roles.id` | |
| `action_id` | `action_id` | `uuid` | ✅ | FK → `actions.id` | |
| `granted` | `is_granted` | `boolean` | | | Whether permission is granted |
| `created_at` | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 30. `Invoice` *(NFS-e legacy)* → `nfse_legacy_invoices`

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `varchar(100)` | ✅ | FK → `organizations.id` | |
| `service_order_id` | `service_order_id` | `varchar(100)` | ✅ | FK → `service_orders.id` | |
| `status` | `status` | `varchar(20)` | ✅ | | `pending / processing / issued / cancelled / error` |
| `service_order_number` | `service_order_number` | `varchar(50)` | | | |
| `client_id` | `client_id` | `varchar(100)` | | FK → `clients.id` | |
| `tipo_documento` | `document_type` | `varchar(10)` | | | `nfse` |
| `nuvem_fiscal_id` | `nuvem_fiscal_id` | `varchar(100)` | | | ID in Nuvem Fiscal |
| `numero` | `number` | `varchar(20)` | | | |
| `serie` | `series` | `varchar(10)` | | | |
| `codigo_verificacao` | `verification_code` | `varchar(50)` | | | |
| `link_url` | `link_url` | `varchar(500)` | | | City hall link |
| `ambiente` | `environment` | `varchar(20)` | | | `sandbox / production` |
| `valor_total` | `total_amount` | `numeric(15,2)` | | | |
| `descricao_servico` | `service_description` | `text` | | | |
| `payload_enviado_json` | `sent_payload_json` | `text` | | | Integration payload |
| `resposta_nuvem_fiscal_json` | `nuvem_fiscal_response_json` | `text` | | | |
| `error_message` | `error_message` | `text` | | | |
| `issued_at` | `issued_at` | `timestamptz` | | | |
| `cancelled_at` | `cancelled_at` | `timestamptz` | | | |
| `cancel_reason` | `cancel_reason` | `text` | | | |
| `issued_by` | `issued_by` | `varchar(200)` | | | |
| `cancelled_by` | `cancelled_by` | `varchar(200)` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 31. `ServiceOrderNfe` → `service_order_nfe` *(already English)*

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `service_order_id` | `service_order_id` | `varchar(100)` | ✅ | FK → `service_orders.id` | |
| `organization_id` | `organization_id` | `varchar(100)` | ✅ | FK → `organizations.id` | |
| `status` | `status` | `varchar(20)` | ✅ | | `draft / issued / error / canceled` |
| `service_order_number` | `service_order_number` | `varchar(50)` | | | |
| `payload_json` | `payload_json` | `text` | | | |
| `os_snapshot_json` | `os_snapshot_json` | `text` | | | Service order snapshot |
| `client_snapshot_json` | `client_snapshot_json` | `text` | | | Client snapshot |
| `vehicle_snapshot_json` | `vehicle_snapshot_json` | `text` | | | Vehicle snapshot |
| `nuvemfiscal_nfe_id` | `nuvemfiscal_nfe_id` | `varchar(100)` | | | |
| `nuvemfiscal_status` | `nuvemfiscal_status` | `varchar(50)` | | | |
| `nuvemfiscal_ambiente` | `nuvemfiscal_ambiente` | `varchar(20)` | | | |
| `nuvemfiscal_serie` | `nuvemfiscal_serie` | `varchar(10)` | | | |
| `nuvemfiscal_numero` | `nuvemfiscal_numero` | `varchar(20)` | | | |
| `nuvemfiscal_valor_total` | `nuvemfiscal_valor_total` | `varchar(20)` | | | |
| `nuvemfiscal_chave_acesso` | `nuvemfiscal_chave_acesso` | `varchar(100)` | | | Access key |
| `nuvemfiscal_autorizacao_json` | `nuvemfiscal_autorizacao_json` | `text` | | | |
| `nuvemfiscal_response_json` | `nuvemfiscal_response_json` | `text` | | | |
| `last_error_message` | `last_error_message` | `text` | | | |
| `last_error_json` | `last_error_json` | `text` | | | |
| `last_error_at` | `last_error_at` | `timestamptz` | | | |
| `pdf_base64` | `pdf_base64` | `text` | | | DANFE PDF |
| `pdf_file_name` | `pdf_file_name` | `varchar(200)` | | | |
| `pdf_content_type` | `pdf_content_type` | `varchar(50)` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 32. `ServiceOrderNfse` → `service_order_nfse` *(already English)*

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `service_order_id` | `service_order_id` | `varchar(100)` | ✅ | FK → `service_orders.id` | |
| `organization_id` | `organization_id` | `varchar(100)` | ✅ | FK → `organizations.id` | |
| `status` | `status` | `varchar(20)` | ✅ | | `draft / issued / error / canceled` |
| `service_order_number` | `service_order_number` | `varchar(50)` | | | |
| `payload_json` | `payload_json` | `text` | | | |
| `os_snapshot_json` | `os_snapshot_json` | `text` | | | |
| `client_snapshot_json` | `client_snapshot_json` | `text` | | | |
| `vehicle_snapshot_json` | `vehicle_snapshot_json` | `text` | | | |
| `nuvemfiscal_nfse_id` | `nuvemfiscal_nfse_id` | `varchar(100)` | | | |
| `nuvemfiscal_status` | `nuvemfiscal_status` | `varchar(50)` | | | |
| `nuvemfiscal_numero` | `nuvemfiscal_numero` | `varchar(20)` | | | |
| `nuvemfiscal_codigo_verificacao` | `nuvemfiscal_codigo_verificacao` | `varchar(50)` | | | |
| `nuvemfiscal_data_emissao` | `nuvemfiscal_data_emissao` | `varchar(50)` | | | |
| `nuvemfiscal_ambiente` | `nuvemfiscal_ambiente` | `varchar(20)` | | | `sandbox / production` |
| `nuvemfiscal_referencia` | `nuvemfiscal_referencia` | `varchar(100)` | | | |
| `nuvemfiscal_dps_serie` | `nuvemfiscal_dps_serie` | `varchar(10)` | | | |
| `nuvemfiscal_dps_numero` | `nuvemfiscal_dps_numero` | `varchar(20)` | | | |
| `nuvemfiscal_mensagens_json` | `nuvemfiscal_mensagens_json` | `text` | | | |
| `nuvemfiscal_cancelamento_json` | `nuvemfiscal_cancelamento_json` | `text` | | | |
| `nuvemfiscal_response_json` | `nuvemfiscal_response_json` | `text` | | | |
| `nuvemfiscal_link_url` | `nuvemfiscal_link_url` | `varchar(500)` | | | NFS-e link |
| `last_error_message` | `last_error_message` | `text` | | | |
| `last_error_json` | `last_error_json` | `text` | | | |
| `last_error_at` | `last_error_at` | `timestamptz` | | | |
| `pdf_base64` | `pdf_base64` | `text` | | | NFS-e PDF |
| `pdf_file_name` | `pdf_file_name` | `varchar(200)` | | | |
| `pdf_content_type` | `pdf_content_type` | `varchar(50)` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 33. `NuvemFiscalSyncStatus` → `fiscal_sync_status`

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` / `configuracao_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | `configuracao_id` collapsed here — settings merged into organizations |
| `nuvem_fiscal_cpf_cnpj` | `nuvem_fiscal_tax_id` | `varchar(18)` | | | CPF/CNPJ in Nuvem Fiscal |
| `integration_status` | `integration_status` | `varchar(20)` | | | `active / inactive / error / not_configured` |
| `empresa_sincronizada` | `is_company_synced` | `boolean` | | | Whether company is synced |
| `sync_status` | `sync_status` | `varchar(20)` | | | `synced / pending / error / never` |
| `sync_error_message` | `sync_error_message` | `text` | | | |
| `sync_error_code` | `sync_error_code` | `varchar(50)` | | | |
| `last_synced_at` | `last_synced_at` | `timestamptz` | | | |
| `last_sync_attempt_at` | `last_sync_attempt_at` | `timestamptz` | | | |
| `is_region_supported` | `is_region_supported` | `boolean` | | | Whether state (UF) is supported |
| `selected_uf` | `selected_state` | `char(2)` | | | Verified state (UF) |
| `last_validation_at` | `last_validation_at` | `timestamptz` | | | Last regional validation |
| `nuvem_fiscal_response_json` | `nuvem_fiscal_response_json` | `text` | | | Last response |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 34. `NuvemFiscalIntegrationEndpoint` → `fiscal_integration_endpoints`

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `varchar(100)` | | FK → `organizations.id` | |
| `function_name` | `function_name` | `varchar(100)` | | | |
| `method` | `method` | `varchar(10)` | | | HTTP method |
| `path` | `path` | `varchar(300)` | | | Endpoint path |
| `integration` | `integration` | `varchar(50)` | | | Integration type |
| `description` | `description` | `text` | | | |
| `is_active` | `is_active` | `boolean` | | | |
| `source` | `source` | `varchar(100)` | | | Origin |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 35. `NuvemFiscalIntegrationLog` → `fiscal_integration_logs`

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `varchar(100)` | | FK → `organizations.id` | |
| `integration` | `integration` | `varchar(50)` | | | Integration type |
| `function_name` | `function_name` | `varchar(100)` | | | |
| `request_method` | `request_method` | `varchar(10)` | | | HTTP method |
| `request_url` | `request_url` | `text` | | | |
| `request_path` | `request_path` | `varchar(300)` | | | |
| `query_params_json` | `query_params_json` | `text` | | | |
| `request_headers_json` | `request_headers_json` | `text` | | | |
| `request_body_json` | `request_body_json` | `text` | | | |
| `response_status` | `response_status` | `int` | | | HTTP status code |
| `response_ok` | `response_ok` | `boolean` | | | Whether successful |
| `response_headers_json` | `response_headers_json` | `text` | | | |
| `response_body_json` | `response_body_json` | `text` | | | |
| `duration_ms` | `duration_ms` | `int` | | | Duration in ms |
| `success` | `is_success` | `boolean` | | | |
| `error_message` | `error_message` | `text` | | | |
| `error_stack` | `error_stack` | `text` | | | |
| `user_email` | `user_email` | `varchar(200)` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 36. `OAuthToken` → `oauth_tokens` *(already English)*

| Old Column | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `provider` | `provider` | `varchar(50)` | ✅ | | Provider name (e.g., `nuvemfiscal`) |
| `access_token` | `access_token` | `text` | ✅ | | Access token |
| `expires_at` | `expires_at` | `timestamptz` | ✅ | | Token expiration |
| `token_type` | `token_type` | `varchar(50)` | | | Token type |
| `expires_in` | `expires_in` | `int` | | | Expiry in seconds |
| `scope` | `scope` | `varchar(300)` | | | Granted scopes |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 37. `OSEditLog` → `service_order_edit_logs`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `varchar(100)` | ✅ | FK → `organizations.id` | |
| `ordem_servico_id` | `service_order_id` | `varchar(100)` | ✅ | FK → `service_orders.id` | Edited service order |
| `tipo_operacao` | `operation_type` | `varchar(20)` | ✅ | | `creation / edit / correction / cancellation` |
| `usuario_email` | `user_email` | `varchar(200)` | ✅ | | |
| `numero_os` | `service_order_number` | `varchar(50)` | | | |
| `usuario_nome` | `user_name` | `varchar(200)` | | | |
| `dados_antes` | `data_before` | `text` | | | JSON snapshot before |
| `dados_depois` | `data_after` | `text` | | | JSON snapshot after |
| `campos_alterados` | `changed_fields` | `text` | | | JSON with changed fields |
| `correcao_id` | `correction_id` | `uuid` | | FK → `service_order_correction_requests.id` | Related correction |
| `observacao` | `notes` | `text` | | | |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

#### Column details

**Enum: `operation_type`**

| New (EN) | Legacy (PT) |
|---|---|
| `creation` | `criacao` |
| `edit` | `edicao` |
| `correction` | `correcao` |
| `cancellation` | `cancelamento` |

---

### 38. `SolicitacaoCorrecaoOS` → `service_order_correction_requests`

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `ordem_servico_id` | `service_order_id` | `varchar(100)` | ✅ | FK → `service_orders.id` | |
| `descricao` | `description` | `text` | ✅ | | Correction description |
| `status` | `status` | `varchar(20)` | ✅ | | `pending / approved / rejected / completed` |
| `solicitante_email` | `requester_email` | `varchar(200)` | ✅ | | |
| `numero_os` | `service_order_number` | `varchar(50)` | | | |
| `responsavel_id` | `responsible_id` | `uuid` | | FK → `employees.id` | |
| `solicitante_nome` | `requester_name` | `varchar(200)` | | | |
| `aprovado_por` | `approved_by` | `varchar(200)` | | | Who approved |
| `data_aprovacao` | `approval_date` | `timestamptz` | | | |
| `data_conclusao` | `completion_date` | `timestamptz` | | | |
| `observacao_resolucao` | `resolution_notes` | `text` | | | |
| `updated_by` | `updated_by` | `varchar(200)` | | | Last user to update |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

### 39. Base44 `users` fields → `user_profiles` *(new table)*

| Old Column (PT) | New Column (EN) | Type | Required | FK Reference | Description |
|---|---|---|---|---|---|
| *(new)* | `id` | `uuid` | ✅ | PK | |
| *(new)* | `user_id` | `varchar(100)` | ✅ | FK → `auth.users.id` | Supabase auth user ID |
| `organization_id` | `organization_id` | `uuid` | ✅ | FK → `organizations.id` | |
| `nome_exibicao` | `display_name` | `varchar(200)` | | | User's display name shown in UI |
| `foto_perfil_url` | `profile_picture_url` | `varchar(500)` | | | User's avatar/profile picture |
| `role_id` | `role_id` | `uuid` | | FK → `roles.id` | User's permission role |
| `employee_id` | `employee_id` | `uuid` | | FK → `employees.id` | Link to employee record (nullable — not all users are employees) |
| `active` | `is_active` | `boolean` | | | Whether the user account is active |
| *(new)* | `created_at` | `timestamptz` | ✅ | | |
| *(new)* | `created_by` | `varchar(200)` | | | User/email who created the record |
| *(new)* | `updated_at` | `timestamptz` | ✅ | | |
| *(new)* | `updated_by` | `varchar(200)` | | | User/email who last updated the record |
| *(new)* | `deleted_at` | `timestamptz` | | | Soft delete timestamp |
| *(new)* | `deleted_by` | `varchar(200)` | | | User/email who deleted the record |

---

## FK Dependency Order (for migrations)

Create tables in this order to satisfy FK constraints:

```
1.  organizations                        (no FK dependencies — absorbs Configuracao)
2.  roles                                → organizations
3.  actions                              (no FK dependencies)
4.  role_actions                         → roles, actions
5.  bank_accounts                        → organizations
6.  financial_categories                 → organizations
7.  product_categories                   → organizations
8.  master_products                      → organizations
9.  taxes                                → organizations
10. payment_terminals                    → organizations, bank_accounts
11. suppliers                            → organizations
12. clients                              → organizations
13. employees                            → organizations
14. vehicles                             → organizations, clients
15. products                             → organizations, product_categories
16. parts                                → organizations, products
17. appointments                         → organizations, clients, vehicles
18. service_orders                       → organizations, clients, vehicles, master_products, employees, appointments
19. service_order_installments           → organizations, service_orders
20. employee_financial_records           → organizations, employees, service_orders, service_order_installments
21. financial_transactions               → organizations, bank_accounts, employee_financial_records, service_order_installments
22. bank_account_statements              → organizations, bank_accounts, financial_transactions
23. purchases                            → organizations, suppliers, bank_accounts, financial_transactions
24. purchase_returns                     → organizations, purchases, suppliers, financial_transactions, bank_accounts
25. purchase_requests                    → organizations, suppliers, service_orders, purchases
26. business_analyses                    → organizations
27. subscriptions                        → organizations
28. billing_invoices                     → organizations, subscriptions
29. oauth_tokens                         (no FK dependencies)
30. fiscal_sync_status                   → organizations
31. fiscal_integration_endpoints         → organizations
32. fiscal_integration_logs              → organizations
33. service_order_nfe                    → organizations, service_orders
34. service_order_nfse                   → organizations, service_orders
35. service_order_correction_requests    → organizations, service_orders, employees
36. service_order_edit_logs              → organizations, service_orders, service_order_correction_requests
37. user_profiles                        → organizations, roles, employees

-- REMOVED (see Deprecated Tables section):
-- settings               (merged into organizations)
-- nfse_legacy_invoices   (replaced by service_order_nfse)
```

---

## Migration Notes

### IDs
All legacy `string` IDs from Base44 must be converted to `uuid`. During migration, map legacy string IDs to new UUIDs and maintain a translation table if needed.

### Enums
All enum values are now in English (snake_case). Transform values during ETL:
- `pf / pj` → `pf / pj` *(unchanged — standard BR abbreviations)*
- Status fields: translate as mapped in each table above

### Monetary Fields
Replace `number` (float) with `numeric(15,2)` to avoid floating-point rounding errors in financial data.

### JSONB Arrays
All `array` fields become `jsonb`. Validate that source data is valid JSON before insertion.

### Timestamps
Convert `date-time` strings to `timestamptz`. Store all timestamps in UTC.

### Soft Deletes
Tables with `deleted_at` support soft delete. Queries should include `WHERE deleted_at IS NULL` by default.

---

## Deprecated / Removed Tables

These tables existed in Base44 but are **not created** in the new schema. Their data must be handled during ETL as documented below.

### `Configuracao` (was table 19)

| Decision | Merged into `organizations` |
|---|---|
| **Reason** | Strict 1:1 with `Organization`. Both tables stored workshop name, phone, email, and logo. Splitting them forced every query to join two tables just to read basic org data. |
| **ETL action** | Read both `Organization` and `Configuracao` for the same tenant. Write a single row to `organizations`. For conflicting fields (name, phone, email, logo), prefer the `Configuracao` value — it was user-maintained. |
| **FK impact** | `fiscal_sync_status.configuracao_id` → `fiscal_sync_status.organization_id` |

### `Invoice` / `nfse_legacy_invoices` (was table 30)

| Decision | Deprecated — **do not migrate to new table** |
|---|---|
| **Reason** | This was the first-generation NFS-e integration model. It was replaced by `service_order_nfse` (table 32), which has a richer structure (DPS series, cancelation JSON, PDF storage, per-status snapshots). All new NFS-e emissions use `service_order_nfse`. |
| **ETL action** | Archive the raw rows as a read-only JSONB blob in a `legacy_data` column on `service_order_nfse` if historical traceability is needed, or keep the old table as `_legacy_nfse_invoices` (read-only, no FKs) for audit purposes only. |
| **FK impact** | `OrdemServico.nfse_active_id` already points to `service_order_nfse` in the new schema. |

---

## Base44 `users` Table — Field Mapping

The old system stored some organization-level fields directly on the user record. In the new schema, users are managed by **Supabase Auth** (`auth.users`). App-level user data maps as follows:

| Base44 `users` column | New location | Notes |
|---|---|---|
| `nome_exibicao` | `user_profiles.display_name` | User's display name (not org name) |
| `foto_perfil_url` | `user_profiles.profile_picture_url` | User's avatar (not org logo) |
| `tipo_negocio` | `organizations.business_type` | Org-level — type of business |
| `organization_id` | `organizations.id` | The org the user belongs to |
| `role_id` | `user_profiles.role_id` → `roles.id` | Permission role |
| `employee_id` | `user_profiles.employee_id` → `employees.id` | Links user to employee record |
| `active` | `user_profiles.is_active` | User account status |

