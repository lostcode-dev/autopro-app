# Guia de Migração de Dados — Base44 → AutoPro (Supabase)

> **Objetivo:** Migrar os dados operacionais do sistema legado (Base44) para o novo schema PostgreSQL/Supabase.  
> **Pré-requisito de leitura:** [`migrate_database_base44.md`](./migrate_database_base44.md) (mapeamento de colunas completo).

---

## Visão Geral da Estratégia

1. **Exportar** os dados do Base44 em CSV (via painel admin ou API de exportação)
2. **Carregar** cada CSV em uma tabela de staging (colunas `text`, sem FK)
3. **Transformar e inserir** via `INSERT ... SELECT` com casts, enums mapeados e FKs resolvidas
4. **Validar** contagens e integridade referencial
5. **Limpar** as tabelas de staging

Os scripts usam `COPY` do PostgreSQL para carregar CSV e são idempotentes (staging é sempre recriada).

---

## Ordem dos Pacotes (respeita dependências FK)

```
Package 0 — Fundação          (manual, sem FK)
  organizations, bank_accounts, financial_categories, product_categories, taxes, payment_terminals

Package 1 — Pessoas           (FK → organizations)
  suppliers, employees, clients

Package 2 — Veículos          (FK → clients)
  vehicles

Package 3 — Produtos          (FK → product_categories)
  products, parts

Package 4 — Ordens de Serviço (FK → clients, vehicles, employees, products)
  service_orders
  service_order_installments

Package 5 — Financeiro        (FK → service_orders, bank_accounts, employees)
  financial_transactions
  employee_financial_records

Package 6 — Auxiliares        (FK → clients, vehicles, employees, suppliers)
  appointments
  purchases
  purchase_requests
```

> **Regra:** nunca pule para o próximo pacote sem validar o anterior. Um FK inválido na inserção causa rollback silencioso.

---

## Variáveis Globais

Todos os scripts assumem as seguintes variáveis. Defina antes de rodar:

```sql
-- Substitua pelo UUID real da organização criada no novo sistema
\set org_id '00000000-0000-0000-0000-000000000000'

-- Usuário responsável pela migração (gravado em created_by / updated_by)
\set migrator 'migration@autopro.local'
```

---

## Package 0 — Fundação

### 0.1 `organizations`

Criada manualmente no Supabase. Copie o `id` gerado para usar como `:org_id` nos demais scripts.

**Campos críticos para preencher na UI antes de migrar:**
- `name`, `subdomain`
- `default_bank_account_id` (atualizar após Package 0 — bank_accounts)
- `cnpj`, `phone`, `address_*` (se disponíveis)

---

### 0.2 `bank_accounts` (ContaBancaria)

**Colunas esperadas no CSV do Base44:**

| CSV Column (Base44) | Tipo | Obrigatório |
|---|---|---|
| `id` | string (Base44 ID) | ✅ |
| `nome_conta` | string | ✅ |
| `tipo` | string | ✅ |
| `saldo_inicial` | number | |
| `saldo_atual` | number | |
| `banco` | string | |
| `agencia` | string | |
| `conta` | string | |
| `ativa` | boolean | |
| `observacoes` | string | |

```sql
-- Staging
DROP TABLE IF EXISTS stg_bank_accounts;
CREATE TEMP TABLE stg_bank_accounts (
  old_id          text,
  nome_conta      text,
  tipo            text,
  saldo_inicial   text,
  saldo_atual     text,
  banco           text,
  agencia         text,
  conta           text,
  ativa           text,
  observacoes     text
);

-- Carregar CSV (ajuste o caminho)
COPY stg_bank_accounts FROM '/tmp/bank_accounts.csv' WITH (FORMAT csv, HEADER true);

-- Inserir no novo schema
INSERT INTO public.bank_accounts (
  organization_id, account_name, account_type,
  initial_balance, current_balance,
  bank_name, branch, account_number,
  is_active, notes, created_by, updated_by
)
SELECT
  :'org_id',
  nome_conta,
  tipo,
  COALESCE(saldo_inicial::numeric, 0),
  COALESCE(saldo_atual::numeric, 0),
  banco,
  agencia,
  conta,
  COALESCE(ativa::boolean, true),
  observacoes,
  :'migrator',
  :'migrator'
FROM stg_bank_accounts
ON CONFLICT DO NOTHING;
```

> **Mapeamento de IDs:** Após inserção, crie uma tabela de referência cruzada para resolver FKs nos pacotes seguintes:

```sql
-- Tabela de referência: old_id → new_uuid (use em todos os pacotes)
CREATE TABLE IF NOT EXISTS migration_id_map (
  entity    text,
  old_id    text,
  new_id    uuid,
  PRIMARY KEY (entity, old_id)
);

-- Mapear bank_accounts (assuma que nome_conta é único)
INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'bank_account', s.old_id, ba.id
FROM stg_bank_accounts s
JOIN public.bank_accounts ba ON ba.account_name = s.nome_conta
  AND ba.organization_id = :'org_id'::uuid;
```

---

### 0.3 `financial_categories` (CategoriaFinanceira)

```sql
DROP TABLE IF EXISTS stg_financial_categories;
CREATE TEMP TABLE stg_financial_categories (
  old_id  text,
  nome    text,
  tipo    text   -- 'receita' | 'despesa'
);

COPY stg_financial_categories FROM '/tmp/financial_categories.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.financial_categories (organization_id, name, description, created_by, updated_by)
SELECT :'org_id', nome, NULL, :'migrator', :'migrator'
FROM stg_financial_categories
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'financial_category', s.old_id, fc.id
FROM stg_financial_categories s
JOIN public.financial_categories fc ON fc.name = s.nome AND fc.organization_id = :'org_id'::uuid;
```

---

### 0.4 `product_categories` (CategoriaProduto)

```sql
DROP TABLE IF EXISTS stg_product_categories;
CREATE TEMP TABLE stg_product_categories (
  old_id  text,
  nome    text
);

COPY stg_product_categories FROM '/tmp/product_categories.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.product_categories (organization_id, name, created_by, updated_by)
SELECT :'org_id', nome, :'migrator', :'migrator'
FROM stg_product_categories
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'product_category', s.old_id, pc.id
FROM stg_product_categories s
JOIN public.product_categories pc ON pc.name = s.nome AND pc.organization_id = :'org_id'::uuid;
```

---

### 0.5 `taxes` (Imposto)

```sql
DROP TABLE IF EXISTS stg_taxes;
CREATE TEMP TABLE stg_taxes (
  old_id    text,
  nome      text,
  tipo      text,   -- 'municipal' | 'state' | 'federal'
  aliquota  text    -- percentual, ex: '5.0'
);

COPY stg_taxes FROM '/tmp/taxes.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.taxes (organization_id, name, type, rate, created_by, updated_by)
SELECT :'org_id', nome, tipo, aliquota::numeric, :'migrator', :'migrator'
FROM stg_taxes
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'tax', s.old_id, t.id
FROM stg_taxes s
JOIN public.taxes t ON t.name = s.nome AND t.organization_id = :'org_id'::uuid;
```

---

## Package 1 — Pessoas

### 1.1 `suppliers` (Fornecedor)

**Colunas esperadas no CSV:**

| CSV Column | Descrição |
|---|---|
| `id` | ID Base44 |
| `nome` | Razão social / nome |
| `tipo_pessoa` | `pf` ou `pj` |
| `cpf_cnpj` | CPF ou CNPJ (pode conter formatação) |
| `telefone` | |
| `whatsapp` | |
| `email` | |
| `site` | |
| `cep` | |
| `logradouro` | |
| `numero` | |
| `complemento` | |
| `bairro` | |
| `cidade` | |
| `uf` | |
| `categoria` | `pecas` \| `servicos` \| `geral` etc. |
| `prazo_pagamento_dias` | |
| `limite_credito` | |
| `ativo` | boolean |
| `observacoes` | |

```sql
DROP TABLE IF EXISTS stg_suppliers;
CREATE TEMP TABLE stg_suppliers (
  old_id                  text,
  nome                    text,
  tipo_pessoa             text,
  cpf_cnpj                text,
  telefone                text,
  whatsapp                text,
  email                   text,
  site                    text,
  cep                     text,
  logradouro              text,
  numero                  text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      text,
  categoria               text,
  prazo_pagamento_dias    text,
  limite_credito          text,
  ativo                   text,
  observacoes             text
);

COPY stg_suppliers FROM '/tmp/suppliers.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.suppliers (
  organization_id, name, person_type, tax_id,
  phone, whatsapp, email, website,
  zip_code, street, address_number, address_complement, neighborhood, city, state,
  category,
  payment_term_days, credit_limit,
  is_active, notes, created_by, updated_by
)
SELECT
  :'org_id',
  nome,
  COALESCE(tipo_pessoa, 'pj'),
  REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g'),  -- remove formatação
  REGEXP_REPLACE(telefone, '[^0-9]', '', 'g'),
  REGEXP_REPLACE(whatsapp, '[^0-9]', '', 'g'),
  email,
  site,
  REGEXP_REPLACE(cep, '[^0-9]', '', 'g'),
  logradouro,
  numero,
  complemento,
  bairro,
  cidade,
  upper(uf),
  categoria,
  NULLIF(prazo_pagamento_dias, '')::int,
  NULLIF(limite_credito, '')::numeric,
  COALESCE(ativo::boolean, true),
  observacoes,
  :'migrator', :'migrator'
FROM stg_suppliers
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'supplier', s.old_id, sup.id
FROM stg_suppliers s
JOIN public.suppliers sup ON sup.organization_id = :'org_id'::uuid
  AND sup.name = s.nome;
```

---

### 1.2 `employees` (Funcionario)

**Colunas esperadas no CSV:**

| CSV Column | Descrição |
|---|---|
| `id` | ID Base44 |
| `nome` | Nome completo |
| `tipo_pessoa` | `pf` |
| `cpf_cnpj` | CPF |
| `telefone` | |
| `email` | |
| `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf` | Endereço |
| `tem_salario` | boolean |
| `salario` | valor numérico |
| `dia_pagamento` | dia do mês (1-31) |
| `tem_comissao` | boolean |
| `comissao_tipo` | `percentage` \| `fixed_amount` |
| `comissao_valor` | percentual ou valor fixo |
| `comissao_base` | `revenue` \| `profit` |
| `tem_garantia_minima` | boolean |
| `garantia_minima` | valor numérico |
| `tipo_chave_pix` | `cpf` \| `phone` \| `email` \| `random` |
| `chave_pix` | |
| `data_demissao` | YYYY-MM-DD ou vazio |
| `observacoes` | |

```sql
DROP TABLE IF EXISTS stg_employees;
CREATE TEMP TABLE stg_employees (
  old_id              text,
  nome                text,
  tipo_pessoa         text,
  cpf_cnpj            text,
  telefone            text,
  email               text,
  cep                 text,
  logradouro          text,
  numero              text,
  complemento         text,
  bairro              text,
  cidade              text,
  uf                  text,
  tem_salario         text,
  salario             text,
  dia_pagamento       text,
  tem_comissao        text,
  comissao_tipo       text,
  comissao_valor      text,
  comissao_base       text,
  tem_garantia_minima text,
  garantia_minima     text,
  tipo_chave_pix      text,
  chave_pix           text,
  data_demissao       text,
  observacoes         text
);

COPY stg_employees FROM '/tmp/employees.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.employees (
  organization_id, name, person_type, tax_id,
  phone, email,
  zip_code, street, address_number, address_complement, neighborhood, city, state,
  has_salary, salary_amount, payment_day,
  has_commission, commission_type, commission_amount, commission_base,
  has_minimum_guarantee, minimum_guarantee_amount,
  pix_key_type, pix_key,
  termination_date,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  nome, COALESCE(tipo_pessoa, 'pf'),
  REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g'),
  REGEXP_REPLACE(telefone, '[^0-9]', '', 'g'),
  email,
  REGEXP_REPLACE(cep, '[^0-9]', '', 'g'),
  logradouro, numero, complemento, bairro, cidade, upper(uf),
  COALESCE(tem_salario::boolean, false),
  NULLIF(salario, '')::numeric,
  NULLIF(dia_pagamento, '')::int,
  COALESCE(tem_comissao::boolean, false),
  NULLIF(comissao_tipo, ''),
  NULLIF(comissao_valor, '')::numeric,
  COALESCE(NULLIF(comissao_base, ''), 'revenue'),
  COALESCE(tem_garantia_minima::boolean, false),
  NULLIF(garantia_minima, '')::numeric,
  NULLIF(tipo_chave_pix, ''),
  NULLIF(chave_pix, ''),
  NULLIF(data_demissao, '')::date,
  observacoes,
  :'migrator', :'migrator'
FROM stg_employees
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'employee', s.old_id, e.id
FROM stg_employees s
JOIN public.employees e ON e.organization_id = :'org_id'::uuid
  AND REGEXP_REPLACE(e.tax_id, '[^0-9]', '', 'g') = REGEXP_REPLACE(s.cpf_cnpj, '[^0-9]', '', 'g');
```

---

### 1.3 `clients` (Cliente)

**Colunas esperadas no CSV:**

| CSV Column | Descrição |
|---|---|
| `id` | ID Base44 |
| `nome` | Nome / razão social |
| `tipo_pessoa` | `pf` \| `pj` |
| `cpf_cnpj` | CPF ou CNPJ |
| `telefone` | |
| `email` | |
| `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf` | |
| `funcionario_responsavel_id` | ID Base44 do funcionário |
| `data_nascimento` | YYYY-MM-DD (PF) |
| `observacoes` | |

```sql
DROP TABLE IF EXISTS stg_clients;
CREATE TEMP TABLE stg_clients (
  old_id                      text,
  nome                        text,
  tipo_pessoa                 text,
  cpf_cnpj                    text,
  telefone                    text,
  email                       text,
  cep                         text,
  logradouro                  text,
  numero                      text,
  complemento                 text,
  bairro                      text,
  cidade                      text,
  uf                          text,
  funcionario_responsavel_id  text,
  data_nascimento             text,
  observacoes                 text
);

COPY stg_clients FROM '/tmp/clients.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.clients (
  organization_id, name, person_type, tax_id,
  phone, email,
  zip_code, street, address_number, address_complement, neighborhood, city, state,
  employee_responsible_id,
  birth_date,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  nome,
  COALESCE(tipo_pessoa, 'pf'),
  REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g'),
  REGEXP_REPLACE(telefone, '[^0-9]', '', 'g'),
  email,
  REGEXP_REPLACE(cep, '[^0-9]', '', 'g'),
  logradouro, numero, complemento, bairro, cidade, upper(uf),
  -- Resolve FK de funcionário usando a tabela de mapeamento
  (SELECT new_id FROM migration_id_map WHERE entity='employee' AND old_id=s.funcionario_responsavel_id),
  NULLIF(data_nascimento, '')::date,
  observacoes,
  :'migrator', :'migrator'
FROM stg_clients s
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'client', s.old_id, c.id
FROM stg_clients s
JOIN public.clients c ON c.organization_id = :'org_id'::uuid
  AND REGEXP_REPLACE(c.tax_id, '[^0-9]', '', 'g') = REGEXP_REPLACE(s.cpf_cnpj, '[^0-9]', '', 'g')
  AND c.name = s.nome;
```

> **Atenção:** Se houver clientes sem CPF/CNPJ, use `name + phone` como chave de join.

---

## Package 2 — Veículos

### 2.1 `vehicles` (Veiculo)

**Colunas esperadas no CSV:**

| CSV Column | Descrição |
|---|---|
| `id` | ID Base44 |
| `cliente_id` | ID Base44 do cliente |
| `placa` | Ex: `ABC-1234` ou `ABC1D23` |
| `marca` | |
| `modelo` | |
| `ano` | 4 dígitos |
| `cor` | |
| `motor` | Ex: `1.0`, `2.0 Turbo` |
| `tipo_combustivel` | `gasolina` \| `etanol` \| `flex` \| `diesel` \| `eletrico` \| `hibrido` |
| `km` | Quilometragem atual |
| `observacoes` | |

```sql
DROP TABLE IF EXISTS stg_vehicles;
CREATE TEMP TABLE stg_vehicles (
  old_id          text,
  cliente_id      text,
  placa           text,
  marca           text,
  modelo          text,
  ano             text,
  cor             text,
  motor           text,
  tipo_combustivel text,
  km              text,
  observacoes     text
);

COPY stg_vehicles FROM '/tmp/vehicles.csv' WITH (FORMAT csv, HEADER true);

-- Mapeamento de fuel_type: antigo (PT) → novo (EN)
-- gasolina → gasoline | etanol → ethanol | flex → flex | diesel → diesel
-- eletrico → electric | hibrido → hybrid
INSERT INTO public.vehicles (
  organization_id, client_id,
  license_plate, brand, model, year, color,
  engine, fuel_type, mileage,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  (SELECT new_id FROM migration_id_map WHERE entity='client' AND old_id=s.cliente_id),
  UPPER(REPLACE(placa, '-', '')),  -- normaliza placa
  marca, modelo,
  NULLIF(ano, '')::int,
  cor, motor,
  CASE tipo_combustivel
    WHEN 'gasolina'  THEN 'gasoline'
    WHEN 'etanol'    THEN 'ethanol'
    WHEN 'flex'      THEN 'flex'
    WHEN 'diesel'    THEN 'diesel'
    WHEN 'eletrico'  THEN 'electric'
    WHEN 'hibrido'   THEN 'hybrid'
    ELSE tipo_combustivel
  END,
  NULLIF(km, '')::int,
  observacoes,
  :'migrator', :'migrator'
FROM stg_vehicles s
WHERE (SELECT new_id FROM migration_id_map WHERE entity='client' AND old_id=s.cliente_id) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'vehicle', s.old_id, v.id
FROM stg_vehicles s
JOIN public.vehicles v ON v.organization_id = :'org_id'::uuid
  AND v.license_plate = UPPER(REPLACE(s.placa, '-', ''));
```

---

## Package 3 — Produtos

### 3.1 `products` (Produto)

**Colunas esperadas no CSV:**

| CSV Column | Descrição |
|---|---|
| `id` | ID Base44 |
| `nome` | Nome do produto/serviço |
| `codigo` | Código interno |
| `tipo` | `unit` \| `group` |
| `categoria_id` | ID Base44 da categoria |
| `controlar_estoque` | boolean |
| `estoque_inicial` | número |
| `preco_venda` | |
| `preco_custo` | |
| `observacoes` | |

```sql
DROP TABLE IF EXISTS stg_products;
CREATE TEMP TABLE stg_products (
  old_id              text,
  nome                text,
  codigo              text,
  tipo                text,
  categoria_id        text,
  controlar_estoque   text,
  estoque_inicial     text,
  preco_venda         text,
  preco_custo         text,
  observacoes         text
);

COPY stg_products FROM '/tmp/products.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.products (
  organization_id, name, code, type,
  category_id,
  track_inventory, initial_stock_quantity,
  unit_sale_price, unit_cost_price,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  nome, NULLIF(codigo, ''), COALESCE(tipo, 'unit'),
  (SELECT new_id FROM migration_id_map WHERE entity='product_category' AND old_id=s.categoria_id),
  COALESCE(controlar_estoque::boolean, false),
  COALESCE(NULLIF(estoque_inicial, '')::int, 0),
  COALESCE(NULLIF(preco_venda, '')::numeric, 0),
  COALESCE(NULLIF(preco_custo, '')::numeric, 0),
  observacoes,
  :'migrator', :'migrator'
FROM stg_products s
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'product', s.old_id, p.id
FROM stg_products s
JOIN public.products p ON p.organization_id = :'org_id'::uuid AND p.name = s.nome;
```

---

### 3.2 `parts` (Peca)

```sql
DROP TABLE IF EXISTS stg_parts;
CREATE TEMP TABLE stg_parts (
  old_id              text,
  produto_id          text,   -- ID Base44 (opcional)
  codigo              text,
  descricao           text,
  quantidade_estoque  text,
  quantidade_minima   text,
  preco_venda         text,
  preco_custo         text,
  categoria           text,
  marca               text,
  fornecedor_nome     text,
  localizacao         text,
  observacoes         text
);

COPY stg_parts FROM '/tmp/parts.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.parts (
  organization_id, product_id, code, description,
  stock_quantity, minimum_quantity,
  sale_price, cost_price,
  category, brand, supplier_name, location,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  (SELECT new_id FROM migration_id_map WHERE entity='product' AND old_id=s.produto_id),
  NULLIF(codigo, ''), descricao,
  COALESCE(NULLIF(quantidade_estoque, '')::int, 0),
  COALESCE(NULLIF(quantidade_minima, '')::int, 0),
  COALESCE(NULLIF(preco_venda, '')::numeric, 0),
  COALESCE(NULLIF(preco_custo, '')::numeric, 0),
  categoria, marca, fornecedor_nome, localizacao,
  observacoes,
  :'migrator', :'migrator'
FROM stg_parts s
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'part', s.old_id, p.id
FROM stg_parts s
JOIN public.parts p ON p.organization_id = :'org_id'::uuid AND p.description = s.descricao;
```

---

## Package 4 — Ordens de Serviço

### 4.1 `service_orders` (OrdemServico)

Esta é a tabela mais complexa. Os **itens** são armazenados como JSONB.

**Colunas esperadas no CSV principal:**

| CSV Column | Descrição |
|---|---|
| `id` | ID Base44 |
| `numero` | Número da OS |
| `cliente_id` | ID Base44 do cliente |
| `veiculo_id` | ID Base44 do veículo |
| `funcionario_responsavel_id` | ID Base44 (legado) |
| `data_entrada` | YYYY-MM-DD |
| `data_prevista` | YYYY-MM-DD |
| `data_prevista_pagamento` | YYYY-MM-DD |
| `data_conclusao` | YYYY-MM-DD |
| `status` | ver mapeamento abaixo |
| `status_pagamento` | `pendente` \| `pago` \| `parcial` |
| `forma_pagamento` | ver mapeamento abaixo |
| `parcelado` | boolean |
| `numero_parcelas` | int |
| `defeito_relatado` | |
| `diagnostico` | |
| `valor_total` | |
| `valor_custo_total` | |
| `desconto` | |
| `valor_comissao` | |
| `observacoes` | |
| `itens_json` | JSON serializado (array de itens) |

**Mapeamento de enums:**

```sql
-- status
CASE status
  WHEN 'orcamento'        THEN 'estimate'
  WHEN 'aberta'           THEN 'open'
  WHEN 'em_andamento'     THEN 'in_progress'
  WHEN 'aguardando_peca'  THEN 'waiting_for_part'
  WHEN 'concluida'        THEN 'completed'
  WHEN 'entregue'         THEN 'delivered'
  WHEN 'cancelada'        THEN 'cancelled'
  ELSE 'open'
END

-- payment_status
CASE status_pagamento
  WHEN 'pendente' THEN 'pending'
  WHEN 'pago'     THEN 'paid'
  WHEN 'parcial'  THEN 'partial'
  ELSE 'pending'
END

-- payment_method
CASE forma_pagamento
  WHEN 'pix'                  THEN 'pix'
  WHEN 'dinheiro'             THEN 'cash'
  WHEN 'cartao_credito'       THEN 'credit_card'
  WHEN 'cartao_debito'        THEN 'debit_card'
  WHEN 'cheque'               THEN 'check'
  WHEN 'boleto'               THEN 'bank_slip'
  WHEN 'transferencia'        THEN 'transfer'
  WHEN 'sem_forma_pagamento'  THEN 'no_payment'
  ELSE 'pix'
END
```

```sql
DROP TABLE IF EXISTS stg_service_orders;
CREATE TEMP TABLE stg_service_orders (
  old_id                      text,
  numero                      text,
  cliente_id                  text,
  veiculo_id                  text,
  funcionario_responsavel_id  text,
  data_entrada                text,
  data_prevista               text,
  data_prevista_pagamento     text,
  data_conclusao              text,
  status                      text,
  status_pagamento            text,
  forma_pagamento             text,
  parcelado                   text,
  numero_parcelas             text,
  defeito_relatado            text,
  diagnostico                 text,
  valor_total                 text,
  valor_custo_total           text,
  desconto                    text,
  valor_comissao              text,
  observacoes                 text,
  itens_json                  text   -- JSON array serializado
);

COPY stg_service_orders FROM '/tmp/service_orders.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.service_orders (
  organization_id, number,
  client_id, vehicle_id, employee_responsible_id,
  entry_date, expected_date, expected_payment_date, completion_date,
  status, payment_status, payment_method,
  is_installment, installment_count,
  reported_defect, diagnosis,
  items,
  total_amount, total_cost_amount, discount, commission_amount,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  numero,
  (SELECT new_id FROM migration_id_map WHERE entity='client'   AND old_id=s.cliente_id),
  (SELECT new_id FROM migration_id_map WHERE entity='vehicle'  AND old_id=s.veiculo_id),
  (SELECT new_id FROM migration_id_map WHERE entity='employee' AND old_id=s.funcionario_responsavel_id),
  NULLIF(data_entrada, '')::date,
  NULLIF(data_prevista, '')::date,
  NULLIF(data_prevista_pagamento, '')::date,
  NULLIF(data_conclusao, '')::date,
  CASE status
    WHEN 'orcamento'       THEN 'estimate'
    WHEN 'aberta'          THEN 'open'
    WHEN 'em_andamento'    THEN 'in_progress'
    WHEN 'aguardando_peca' THEN 'waiting_for_part'
    WHEN 'concluida'       THEN 'completed'
    WHEN 'entregue'        THEN 'delivered'
    WHEN 'cancelada'       THEN 'cancelled'
    ELSE 'open'
  END,
  CASE status_pagamento
    WHEN 'pendente' THEN 'pending'
    WHEN 'pago'     THEN 'paid'
    WHEN 'parcial'  THEN 'partial'
    ELSE 'pending'
  END,
  CASE forma_pagamento
    WHEN 'pix'                 THEN 'pix'
    WHEN 'dinheiro'            THEN 'cash'
    WHEN 'cartao_credito'      THEN 'credit_card'
    WHEN 'cartao_debito'       THEN 'debit_card'
    WHEN 'cheque'              THEN 'check'
    WHEN 'boleto'              THEN 'bank_slip'
    WHEN 'transferencia'       THEN 'transfer'
    WHEN 'sem_forma_pagamento' THEN 'no_payment'
    ELSE 'pix'
  END,
  COALESCE(parcelado::boolean, false),
  NULLIF(numero_parcelas, '')::int,
  defeito_relatado, diagnostico,
  -- Preserve itens_json como JSONB (se não existir, usa array vazio)
  COALESCE(NULLIF(itens_json, '')::jsonb, '[]'::jsonb),
  COALESCE(NULLIF(valor_total, '')::numeric, 0),
  COALESCE(NULLIF(valor_custo_total, '')::numeric, 0),
  COALESCE(NULLIF(desconto, '')::numeric, 0),
  COALESCE(NULLIF(valor_comissao, '')::numeric, 0),
  observacoes,
  :'migrator', :'migrator'
FROM stg_service_orders s
WHERE (SELECT new_id FROM migration_id_map WHERE entity='client' AND old_id=s.cliente_id) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'service_order', s.old_id, so.id
FROM stg_service_orders s
JOIN public.service_orders so ON so.organization_id = :'org_id'::uuid AND so.number = s.numero;
```

> **Sobre `itens_json`:** O Base44 exporta os itens da OS como um campo JSON serializado dentro do CSV. Se o export do Base44 gerar os itens em linhas separadas (tabela `OrdemServicoItem`), adapte o script para agregá-los com `json_agg()` antes da inserção.

---

### 4.2 `service_order_installments` (ParcelaOrdemServico)

```sql
DROP TABLE IF EXISTS stg_so_installments;
CREATE TEMP TABLE stg_so_installments (
  old_id              text,
  ordem_servico_id    text,
  numero_parcela      text,
  valor_parcela       text,
  data_vencimento     text,
  data_pagamento      text,
  status              text,   -- 'pendente' | 'pago' | 'vencido'
  forma_pagamento     text,
  observacoes         text
);

COPY stg_so_installments FROM '/tmp/service_order_installments.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.service_order_installments (
  organization_id, service_order_id,
  installment_number, installment_amount,
  due_date, payment_date,
  status, payment_method,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  (SELECT new_id FROM migration_id_map WHERE entity='service_order' AND old_id=s.ordem_servico_id),
  numero_parcela::int,
  valor_parcela::numeric,
  NULLIF(data_vencimento, '')::date,
  NULLIF(data_pagamento, '')::date,
  CASE status
    WHEN 'pendente' THEN 'pending'
    WHEN 'pago'     THEN 'paid'
    WHEN 'vencido'  THEN 'overdue'
    ELSE 'pending'
  END,
  CASE forma_pagamento
    WHEN 'cartao_credito' THEN 'credit_card'
    WHEN 'dinheiro'       THEN 'cash'
    WHEN 'pix'            THEN 'pix'
    WHEN 'boleto'         THEN 'bank_slip'
    ELSE 'pix'
  END,
  observacoes,
  :'migrator', :'migrator'
FROM stg_so_installments s
WHERE (SELECT new_id FROM migration_id_map WHERE entity='service_order' AND old_id=s.ordem_servico_id) IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

## Package 5 — Financeiro

### 5.1 `financial_transactions` (LancamentoFinanceiro)

```sql
DROP TABLE IF EXISTS stg_financial_transactions;
CREATE TEMP TABLE stg_financial_transactions (
  old_id          text,
  descricao       text,
  valor           text,
  data_vencimento text,
  tipo            text,   -- 'receita' | 'despesa' | 'transferencia'
  status          text,   -- 'pendente' | 'pago' | 'cancelado'
  categoria       text,   -- texto ou old_id de CategoriaFinanceira
  conta_id        text,   -- old_id de ContaBancaria
  recorrencia     text,   -- 'mensal' | 'semanal' | 'anual' | null
  parcelado       text,
  numero_parcelas text,
  observacoes     text
);

COPY stg_financial_transactions FROM '/tmp/financial_transactions.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.financial_transactions (
  organization_id, description, amount,
  due_date, type, status,
  category, bank_account_id,
  recurrence, is_installment, installment_count,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  descricao,
  valor::numeric,
  NULLIF(data_vencimento, '')::date,
  CASE tipo
    WHEN 'receita'       THEN 'income'
    WHEN 'despesa'       THEN 'expense'
    WHEN 'transferencia' THEN 'transfer'
    ELSE 'expense'
  END,
  CASE status
    WHEN 'pendente'   THEN 'pending'
    WHEN 'pago'       THEN 'paid'
    WHEN 'cancelado'  THEN 'cancelled'
    ELSE 'pending'
  END,
  -- categoria pode ser texto livre ou referência
  COALESCE(
    (SELECT fc.name FROM public.financial_categories fc
       JOIN migration_id_map m ON m.new_id = fc.id
      WHERE m.entity='financial_category' AND m.old_id=s.categoria
      LIMIT 1),
    s.categoria
  ),
  (SELECT new_id FROM migration_id_map WHERE entity='bank_account' AND old_id=s.conta_id),
  CASE recorrencia
    WHEN 'mensal'   THEN 'monthly'
    WHEN 'semanal'  THEN 'weekly'
    WHEN 'anual'    THEN 'annual'
    ELSE 'non_recurring'
  END,
  COALESCE(parcelado::boolean, false),
  NULLIF(numero_parcelas, '')::int,
  observacoes,
  :'migrator', :'migrator'
FROM stg_financial_transactions s
ON CONFLICT DO NOTHING;

INSERT INTO migration_id_map (entity, old_id, new_id)
SELECT 'financial_transaction', s.old_id, ft.id
FROM stg_financial_transactions s
JOIN public.financial_transactions ft ON ft.organization_id = :'org_id'::uuid
  AND ft.description = s.descricao
  AND ft.amount = s.valor::numeric
  AND ft.due_date = NULLIF(s.data_vencimento, '')::date;
```

---

### 5.2 `employee_financial_records` (RegistroFinanceiroFuncionario)

```sql
DROP TABLE IF EXISTS stg_employee_records;
CREATE TEMP TABLE stg_employee_records (
  old_id              text,
  funcionario_id      text,
  ordem_servico_id    text,
  tipo                text,   -- 'comissao' | 'salario' | 'adiantamento' | 'bonus' | 'desconto'
  descricao           text,
  valor               text,
  data_referencia     text,
  status              text,   -- 'pendente' | 'pago'
  data_pagamento      text
);

COPY stg_employee_records FROM '/tmp/employee_financial_records.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.employee_financial_records (
  organization_id, employee_id, service_order_id,
  record_type, description, amount,
  reference_date, status, payment_date,
  created_by, updated_by
)
SELECT
  :'org_id',
  (SELECT new_id FROM migration_id_map WHERE entity='employee'      AND old_id=s.funcionario_id),
  (SELECT new_id FROM migration_id_map WHERE entity='service_order' AND old_id=s.ordem_servico_id),
  CASE tipo
    WHEN 'comissao'     THEN 'commission'
    WHEN 'salario'      THEN 'salary'
    WHEN 'adiantamento' THEN 'advance'
    WHEN 'bonus'        THEN 'bonus'
    WHEN 'desconto'     THEN 'discount'
    ELSE 'commission'
  END,
  descricao,
  valor::numeric,
  NULLIF(data_referencia, '')::date,
  CASE status
    WHEN 'pendente' THEN 'pending'
    WHEN 'pago'     THEN 'paid'
    ELSE 'pending'
  END,
  NULLIF(data_pagamento, '')::date,
  :'migrator', :'migrator'
FROM stg_employee_records s
WHERE (SELECT new_id FROM migration_id_map WHERE entity='employee' AND old_id=s.funcionario_id) IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

## Package 6 — Auxiliares

### 6.1 `appointments` (Agendamento)

```sql
DROP TABLE IF EXISTS stg_appointments;
CREATE TEMP TABLE stg_appointments (
  old_id          text,
  cliente_id      text,
  veiculo_id      text,
  data_agendamento text,
  hora            text,
  tipo_servico    text,
  prioridade      text,   -- 'baixa' | 'normal' | 'alta' | 'urgente'
  status          text,   -- 'agendado' | 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado'
  observacoes     text
);

COPY stg_appointments FROM '/tmp/appointments.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.appointments (
  organization_id, client_id, vehicle_id,
  appointment_date, time,
  service_type, priority, status,
  notes, created_by, updated_by
)
SELECT
  :'org_id',
  (SELECT new_id FROM migration_id_map WHERE entity='client'  AND old_id=s.cliente_id),
  (SELECT new_id FROM migration_id_map WHERE entity='vehicle' AND old_id=s.veiculo_id),
  NULLIF(data_agendamento, '')::date,
  NULLIF(hora, '')::time,
  tipo_servico,
  CASE prioridade
    WHEN 'baixa'   THEN 'low'
    WHEN 'normal'  THEN 'normal'
    WHEN 'alta'    THEN 'high'
    WHEN 'urgente' THEN 'urgent'
    ELSE 'normal'
  END,
  CASE status
    WHEN 'agendado'     THEN 'scheduled'
    WHEN 'confirmado'   THEN 'confirmed'
    WHEN 'em_andamento' THEN 'in_progress'
    WHEN 'concluido'    THEN 'completed'
    WHEN 'cancelado'    THEN 'cancelled'
    ELSE 'scheduled'
  END,
  observacoes,
  :'migrator', :'migrator'
FROM stg_appointments s
WHERE (SELECT new_id FROM migration_id_map WHERE entity='client' AND old_id=s.cliente_id) IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

### 6.2 `purchases` (Compra)

```sql
DROP TABLE IF EXISTS stg_purchases;
CREATE TEMP TABLE stg_purchases (
  old_id          text,
  fornecedor_id   text,
  conta_id        text,
  data_compra     text,
  valor_total     text,
  status_pagamento text,
  numero_nf       text,
  data_pagamento  text,
  data_vencimento text,
  itens_json      text,   -- JSON array serializado
  observacoes     text
);

COPY stg_purchases FROM '/tmp/purchases.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.purchases (
  organization_id, supplier_id, bank_account_id,
  purchase_date, total_amount, payment_status,
  invoice_number, payment_date, due_date,
  items, notes, created_by, updated_by
)
SELECT
  :'org_id',
  (SELECT new_id FROM migration_id_map WHERE entity='supplier'     AND old_id=s.fornecedor_id),
  (SELECT new_id FROM migration_id_map WHERE entity='bank_account' AND old_id=s.conta_id),
  NULLIF(data_compra, '')::date,
  valor_total::numeric,
  CASE status_pagamento
    WHEN 'pendente' THEN 'pending'
    WHEN 'pago'     THEN 'paid'
    WHEN 'parcial'  THEN 'partial'
    ELSE 'pending'
  END,
  NULLIF(numero_nf, ''),
  NULLIF(data_pagamento, '')::date,
  NULLIF(data_vencimento, '')::date,
  COALESCE(NULLIF(itens_json, '')::jsonb, '[]'::jsonb),
  observacoes,
  :'migrator', :'migrator'
FROM stg_purchases s
ON CONFLICT DO NOTHING;
```

---

## Validação Pós-Migração

Execute após cada pacote para verificar a integridade:

```sql
-- Contagem por entidade na migration_id_map
SELECT entity, COUNT(*) AS migrated
FROM migration_id_map
GROUP BY entity
ORDER BY entity;

-- Verificar FKs órfãs em service_orders
SELECT COUNT(*) AS orphan_clients
FROM public.service_orders
WHERE organization_id = :'org_id'::uuid AND client_id NOT IN (
  SELECT id FROM public.clients WHERE organization_id = :'org_id'::uuid
);

-- Verificar vehicles sem cliente
SELECT COUNT(*) AS orphan_vehicles
FROM public.vehicles
WHERE organization_id = :'org_id'::uuid AND client_id NOT IN (
  SELECT id FROM public.clients WHERE organization_id = :'org_id'::uuid
);

-- Verificar service_orders com itens JSON inválidos
SELECT id, number
FROM public.service_orders
WHERE organization_id = :'org_id'::uuid
  AND (items IS NULL OR jsonb_typeof(items) != 'array');

-- Contagem total por tabela
SELECT
  (SELECT COUNT(*) FROM public.clients              WHERE organization_id = :'org_id'::uuid AND deleted_at IS NULL) AS clients,
  (SELECT COUNT(*) FROM public.vehicles             WHERE organization_id = :'org_id'::uuid AND deleted_at IS NULL) AS vehicles,
  (SELECT COUNT(*) FROM public.employees            WHERE organization_id = :'org_id'::uuid AND deleted_at IS NULL) AS employees,
  (SELECT COUNT(*) FROM public.suppliers            WHERE organization_id = :'org_id'::uuid AND deleted_at IS NULL) AS suppliers,
  (SELECT COUNT(*) FROM public.products             WHERE organization_id = :'org_id'::uuid AND deleted_at IS NULL) AS products,
  (SELECT COUNT(*) FROM public.service_orders       WHERE organization_id = :'org_id'::uuid AND deleted_at IS NULL) AS service_orders,
  (SELECT COUNT(*) FROM public.financial_transactions WHERE organization_id = :'org_id'::uuid AND deleted_at IS NULL) AS financial_transactions;
```

---

## Limpeza

Após validação completa e aprovação:

```sql
-- Remove staging tables (opcional — são TEMP e desaparecem no fim da sessão)
DROP TABLE IF EXISTS stg_bank_accounts, stg_financial_categories, stg_product_categories;
DROP TABLE IF EXISTS stg_taxes, stg_suppliers, stg_employees, stg_clients;
DROP TABLE IF EXISTS stg_vehicles, stg_products, stg_parts;
DROP TABLE IF EXISTS stg_service_orders, stg_so_installments;
DROP TABLE IF EXISTS stg_financial_transactions, stg_employee_records;
DROP TABLE IF EXISTS stg_appointments, stg_purchases;

-- Mantém a tabela de mapeamento para referência histórica (ou dropa se não precisar)
-- DROP TABLE IF EXISTS migration_id_map;
```

---

## Checklist Final

```
Package 0 — Fundação
  [ ] organizations (1 registro manual criado)
  [ ] bank_accounts importado e mapeado
  [ ] financial_categories importado e mapeado
  [ ] product_categories importado e mapeado
  [ ] taxes importado e mapeado

Package 1 — Pessoas
  [ ] suppliers importado e mapeado
  [ ] employees importado e mapeado
  [ ] clients importado e mapeado
  [ ] Nenhum client sem CPF/CNPJ sem tratamento

Package 2 — Veículos
  [ ] vehicles importado e mapeado
  [ ] Nenhum vehicle com client_id inválido

Package 3 — Produtos
  [ ] products importado e mapeado
  [ ] parts importado (product_id pode ser NULL)

Package 4 — Ordens de Serviço
  [ ] service_orders importado com itens JSONB válidos
  [ ] service_order_installments importado (se houver)
  [ ] Nenhuma OS com client_id inválido

Package 5 — Financeiro
  [ ] financial_transactions importado
  [ ] employee_financial_records importado

Package 6 — Auxiliares
  [ ] appointments importado
  [ ] purchases importado

Validação
  [ ] Contagens batem com o sistema antigo (±2% tolerado para registros deletados)
  [ ] Nenhum FK órfão nas queries de validação
  [ ] JSONB items de service_orders todos do tipo array
  [ ] migration_id_map arquivado ou exportado para referência
```
