-- =============================================================================
-- Seed: 001_base_identity_seed.sql
-- Purpose: Stage 1 Base44 -> AutoPro migration seed for the identity and
--          foundation tables used by organizations and users.
--
-- Covered tables:
--   - auth.users
--   - auth.identities
--   - public.organizations
--   - public.bank_accounts
--   - public.financial_categories
--   - public.product_categories
--   - public.taxes
--   - public.actions
--   - public.roles
--   - public.role_actions
--   - public.employees
--   - public.user_profiles
--   - public.user_preferences
--   - public.notification_preferences
--
-- Source exports:
--   - docs/base_44_export/Organization_export.csv
--   - docs/base_44_export/Configuracao_export.csv
--   - docs/base_44_export/ContaBancaria_export.csv
--   - docs/base_44_export/CategoriaFinanceira_export.csv
--   - docs/base_44_export/CategoriaProduto_export.csv
--   - docs/base_44_export/Imposto_export.csv
--   - docs/base_44_export/Action_export.csv
--   - docs/base_44_export/Role_export.csv
--   - docs/base_44_export/RoleAction_export.csv
--   - docs/base_44_export/Funcionario_export.csv
--   - docs/base_44_export/users_export.md
--
-- Notes:
--   - The new schema is multi-tenant, so legacy org-less system roles and
--     org-less default categories are replicated to each imported org.
--   - Legacy role-action rows whose action ids do not exist in
--     Action_export.csv are intentionally skipped.
--   - auth.users/auth.identities and user_profiles.user_id share the same
--     deterministic UUIDv5 derived from the legacy Base44 user id.
--   - Imported auth accounts receive a random password hash, so access should
--     happen through Supabase password reset or a later managed password flow.
--   - This seed is designed for a clean target database or for re-runs of the
--     same seed. It does not attempt to merge into unrelated pre-existing rows.
-- =============================================================================

DO $$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
  v_seed_actor text := 'migration@autopro.local';
  v_auth_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_default_action_timestamp timestamptz := '2026-02-06T20:43:37.084000Z'::timestamptz;
  v_default_action_actor text := 'beenkoficial@gmail.com';
  v_sql text;
BEGIN
  CREATE TEMP TABLE tmp_org_source (
    legacy_org_id text PRIMARY KEY,
    name varchar(200),
    business_type varchar(100),
    is_active boolean,
    person_type varchar(2),
    tax_id varchar(18),
    state_registration varchar(20),
    phone varchar(20),
    whatsapp varchar(20),
    email varchar(200),
    website varchar(200),
    logo_url varchar(500),
    zip_code varchar(9),
    street varchar(200),
    address_number varchar(10),
    address_complement varchar(100),
    neighborhood varchar(100),
    city varchar(100),
    state char(2),
    municipality_code varchar(10),
    initial_service_order_number int,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200),
    updated_by varchar(200),
    onboarding_completed boolean
  ) ON COMMIT DROP;

  INSERT INTO tmp_org_source (
    legacy_org_id,
    name,
    business_type,
    is_active,
    person_type,
    tax_id,
    state_registration,
    phone,
    whatsapp,
    email,
    website,
    logo_url,
    zip_code,
    street,
    address_number,
    address_complement,
    neighborhood,
    city,
    state,
    municipality_code,
    initial_service_order_number,
    created_at,
    updated_at,
    created_by,
    updated_by,
    onboarding_completed
  )
  VALUES
    (
      '69864e74fb6fe137d3577c07',
      'RETIFICADORA LEAL NH LTDA',
      'Mecânica',
      true,
      'pj',
      '44044239000139',
      NULL,
      '51992797373',
      '51992797373',
      'marquesmd9@gmail.com',
      NULL,
      'https://base44.app/api/apps/68b21e394c1c0a8057cf2135/files/public/68b21e394c1c0a8057cf2135/ac7a3df1a_LOGO.jpg',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      4000,
      '2025-09-09T15:19:38.730000Z'::timestamptz,
      '2026-02-16T21:57:49.017000Z'::timestamptz,
      'marquesmd9@gmail.com',
      'marquesmd9@gmail.com',
      true
    ),
    (
      '69864ce67137a313e5c26d4d',
      'Mecânica Loker',
      'Mecânica',
      true,
      'pj',
      '56200937000165',
      NULL,
      NULL,
      '51983196621',
      'contato@mecanicaloker.com.br',
      'www.mecanicaloker.com.br',
      'https://base44.app/api/apps/68b21e394c1c0a8057cf2135/files/public/68b21e394c1c0a8057cf2135/42861f7e9_images.png',
      '93819048',
      'Rua Presidente Franklin Delano Roosevelt',
      '550',
      NULL,
      'Sete de Setembro',
      'Sapiranga',
      'RS',
      NULL,
      1,
      '2025-09-12T22:08:53.382000Z'::timestamptz,
      '2026-02-07T17:11:08.016000Z'::timestamptz,
      'contato@loker.com.br',
      'contato@loker.com.br',
      true
    );

  INSERT INTO public.organizations (
    id,
    name,
    business_type,
    is_active,
    person_type,
    tax_id,
    state_registration,
    phone,
    whatsapp,
    email,
    website,
    logo_url,
    zip_code,
    street,
    address_number,
    address_complement,
    neighborhood,
    city,
    state,
    municipality_code,
    initial_service_order_number,
    default_bank_account_id,
    notes,
    created_at,
    created_by,
    updated_at,
    updated_by,
    onboarding_completed
  )
  SELECT
    uuid_generate_v5(v_namespace, 'organization:' || legacy_org_id),
    name,
    business_type,
    is_active,
    person_type,
    tax_id,
    state_registration,
    phone,
    whatsapp,
    email,
    website,
    logo_url,
    zip_code,
    street,
    address_number,
    address_complement,
    neighborhood,
    city,
    state,
    municipality_code,
    initial_service_order_number,
    NULL,
    NULL,
    created_at,
    created_by,
    updated_at,
    updated_by,
    onboarding_completed
  FROM tmp_org_source
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    business_type = EXCLUDED.business_type,
    is_active = EXCLUDED.is_active,
    person_type = EXCLUDED.person_type,
    tax_id = EXCLUDED.tax_id,
    state_registration = EXCLUDED.state_registration,
    phone = EXCLUDED.phone,
    whatsapp = EXCLUDED.whatsapp,
    email = EXCLUDED.email,
    website = EXCLUDED.website,
    logo_url = EXCLUDED.logo_url,
    zip_code = EXCLUDED.zip_code,
    street = EXCLUDED.street,
    address_number = EXCLUDED.address_number,
    address_complement = EXCLUDED.address_complement,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    municipality_code = EXCLUDED.municipality_code,
    initial_service_order_number = EXCLUDED.initial_service_order_number,
    updated_by = EXCLUDED.updated_by,
    onboarding_completed = EXCLUDED.onboarding_completed;

  CREATE TEMP TABLE tmp_org_map AS
  SELECT
    legacy_org_id,
    uuid_generate_v5(v_namespace, 'organization:' || legacy_org_id) AS organization_id
  FROM tmp_org_source;

  CREATE TEMP TABLE tmp_bank_account_source (
    legacy_account_id text PRIMARY KEY,
    legacy_org_id text,
    account_name varchar(100),
    account_type text,
    initial_balance numeric(15, 2),
    current_balance numeric(15, 2),
    preferred_payment_method text,
    bank_name varchar(100),
    branch varchar(20),
    account_number varchar(20),
    is_active boolean,
    notes text,
    change_history jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_bank_account_source VALUES
    ('696a7a606110b7df8db70dd9', '69864e74fb6fe137d3577c07', 'BOLETO CRESOL', 'conta_corrente', 0, 5189.47, 'boleto', 'BANCO CRESOL', NULL, NULL, true, NULL, '[]'::jsonb, '2026-01-16T17:50:24.905000Z'::timestamptz, '2026-04-24T16:50:36.856000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6969375e673ef9939d2d37ad', '69864e74fb6fe137d3577c07', 'CARTAO DE CREDITO ', 'conta_corrente', 0, 20987.63, 'cartao_credito', NULL, NULL, NULL, true, NULL, '[]'::jsonb, '2026-01-15T18:52:14.380000Z'::timestamptz, '2026-04-08T18:18:03.905000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6968e1d83874701eaa7fdfcd', '69864e74fb6fe137d3577c07', 'CHEQUE', 'conta_investimento', 550, 4430, 'cheque', 'CHEQUE', NULL, NULL, true, NULL, '[]'::jsonb, '2026-01-15T12:47:20.735000Z'::timestamptz, '2026-04-22T12:44:57.327000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6967da89b2b38c787b2c16c3', '69864e74fb6fe137d3577c07', 'CAIXA DINHEIRO', 'dinheiro_fisico', 1, 28396, 'dinheiro', 'CAIXA DINHEIRO', NULL, NULL, true, NULL, '[]'::jsonb, '2026-01-14T18:03:53.961000Z'::timestamptz, '2026-04-23T20:51:05.768000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6967da592d219d1a3411f847', '69864e74fb6fe137d3577c07', 'CRESOL PJ', 'conta_corrente', 635, 125520.89, NULL, 'CRESOL', '5658', '1153340', true, NULL, '[]'::jsonb, '2026-01-14T18:03:05.283000Z'::timestamptz, '2026-04-24T17:05:14.155000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('68c2d50db3a0291c5ed56d05', '69864ce67137a313e5c26d4d', 'AUTO PRATENSE', 'conta_corrente', 0, 1283.91, NULL, 'AUTO PRATENSE', '0001', '00000-0', true, NULL, '[]'::jsonb, '2025-09-11T13:56:29.447000Z'::timestamptz, '2026-03-25T11:54:33.718000Z'::timestamptz, 'contato@loker.com.br'),
    ('68c0aae6a4a3664141d962d5', '69864ce67137a313e5c26d4d', 'LOKER', 'conta_corrente', 0, -1832.44, NULL, 'INFINITYPAY', '0001', '19555888-0', true, NULL, NULL, '2025-09-09T22:32:06.690000Z'::timestamptz, '2026-02-16T12:36:23.912000Z'::timestamptz, 'contato@loker.com.br');

  INSERT INTO public.bank_accounts (
    id,
    organization_id,
    account_name,
    account_type,
    initial_balance,
    preferred_payment_method,
    bank_name,
    branch,
    account_number,
    current_balance,
    is_active,
    notes,
    change_history,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_account_id),
    org_map.organization_id,
    src.account_name,
    CASE src.account_type
      WHEN 'conta_corrente' THEN 'checking'
      WHEN 'conta_poupanca' THEN 'savings'
      WHEN 'conta_salario' THEN 'salary'
      WHEN 'conta_investimento' THEN 'investment'
      WHEN 'dinheiro_fisico' THEN 'cash'
      ELSE 'checking'
    END,
    src.initial_balance,
    CASE src.preferred_payment_method
      WHEN 'pix' THEN 'pix'
      WHEN 'dinheiro' THEN 'cash'
      WHEN 'cartao_credito' THEN 'credit_card'
      WHEN 'cartao_debito' THEN 'debit_card'
      WHEN 'cheque' THEN 'check'
      WHEN 'transferencia' THEN 'transfer'
      WHEN 'boleto' THEN 'bank_slip'
      ELSE NULL
    END,
    NULLIF(src.bank_name, ''),
    NULLIF(src.branch, ''),
    NULLIF(src.account_number, ''),
    src.current_balance,
    src.is_active,
    NULLIF(src.notes, ''),
    src.change_history,
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by
  FROM tmp_bank_account_source src
  JOIN tmp_org_map org_map
    ON org_map.legacy_org_id = src.legacy_org_id
  ON CONFLICT (id) DO UPDATE
  SET
    account_name = EXCLUDED.account_name,
    account_type = EXCLUDED.account_type,
    initial_balance = EXCLUDED.initial_balance,
    preferred_payment_method = EXCLUDED.preferred_payment_method,
    bank_name = EXCLUDED.bank_name,
    branch = EXCLUDED.branch,
    account_number = EXCLUDED.account_number,
    current_balance = EXCLUDED.current_balance,
    is_active = EXCLUDED.is_active,
    notes = EXCLUDED.notes,
    change_history = EXCLUDED.change_history,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_financial_category_source (
    legacy_category_id text PRIMARY KEY,
    legacy_org_id text,
    name varchar(100),
    legacy_type text,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_financial_category_source VALUES
    ('69dfca76376639630d4bfcf2', '69864e74fb6fe137d3577c07', 'FINANCIAMENTO', 'saida', '2026-04-15T17:27:18.320000Z'::timestamptz, '2026-04-15T17:27:18.320000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('69df9a0eb6d048344c0f272f', '69864e74fb6fe137d3577c07', 'DANIEL 3', 'saida', '2026-04-15T14:00:46.481000Z'::timestamptz, '2026-04-15T14:00:46.481000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('69df9969b5c7fc163f6e49ce', '69864e74fb6fe137d3577c07', 'DANIEL 2', 'saida', '2026-04-15T13:58:01.690000Z'::timestamptz, '2026-04-15T13:58:01.690000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('69df995b1d14ac520ccdcbb9', '69864e74fb6fe137d3577c07', 'DANIEL 1', 'saida', '2026-04-15T13:57:47.030000Z'::timestamptz, '2026-04-15T13:57:47.030000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('69a5d58953fc2332e5135e0c', '69864e74fb6fe137d3577c07', 'TERCEIRIZADO', 'saida', '2026-03-02T18:23:05.783000Z'::timestamptz, '2026-03-02T18:23:05.783000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('69a5d562ff072f248cb73dcd', '69864e74fb6fe137d3577c07', 'PEÇAS', 'saida', '2026-03-02T18:22:26.673000Z'::timestamptz, '2026-03-02T18:22:26.673000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('69a0c0dd9be42317ac351dc5', '69864e74fb6fe137d3577c07', 'CUSTO COM PESSOAL', 'saida', '2026-02-26T21:53:33.192000Z'::timestamptz, '2026-02-26T21:53:33.192000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('699894b2b9ed4f930ab11bd4', '69864e74fb6fe137d3577c07', 'DOACÃO', 'saida', '2026-02-20T17:06:58.431000Z'::timestamptz, '2026-02-20T17:06:58.431000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6997515527e42041713b9ab3', '69864e74fb6fe137d3577c07', 'CARTÃO DE CREDITO', 'saida', '2026-02-19T18:07:17.472000Z'::timestamptz, '2026-02-19T18:07:17.472000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6995df48f514b1173b11a681', '69864e74fb6fe137d3577c07', 'PROLABORE', 'saida', '2026-02-18T15:48:24.989000Z'::timestamptz, '2026-02-18T15:48:24.989000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6995de80e3479bba01e490be', '69864e74fb6fe137d3577c07', 'CUSTO VARIAVEL', 'saida', '2026-02-18T15:45:04.676000Z'::timestamptz, '2026-02-18T15:45:04.676000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6995de75a382aea77ee343f7', '69864e74fb6fe137d3577c07', 'CUSTO FIXO', 'saida', '2026-02-18T15:44:53.163000Z'::timestamptz, '2026-02-18T15:44:53.163000Z'::timestamptz, 'marquesmd9@gmail.com');

  INSERT INTO public.financial_categories (
    id,
    organization_id,
    name,
    type,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'financial_category:' || legacy_category_id),
    org_map.organization_id,
    src.name,
    CASE src.legacy_type
      WHEN 'entrada' THEN 'income'
      ELSE 'expense'
    END,
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by
  FROM tmp_financial_category_source src
  JOIN tmp_org_map org_map
    ON org_map.legacy_org_id = src.legacy_org_id
  ON CONFLICT (organization_id, name) DO UPDATE
  SET
    type = EXCLUDED.type,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_product_category_source (
    legacy_category_id text PRIMARY KEY,
    legacy_org_id text,
    name varchar(100),
    description text,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_product_category_source VALUES
    ('69654e0f95078889d0446920', '69864e74fb6fe137d3577c07', 'grupo', 'Importada via CSV', '2026-01-12T19:39:59.916000Z'::timestamptz, '2026-02-16T12:26:06.079000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6965159dbcbdbcb5e1d6b24d', NULL, 'Kits', 'Importada via CSV', '2026-01-12T15:39:09.075000Z'::timestamptz, '2026-01-12T15:39:09.075000Z'::timestamptz, 'beenkoficial@gmail.com'),
    ('69651595de6245b9c6b033fa', NULL, 'Serviços', 'Importada via CSV', '2026-01-12T15:39:01.375000Z'::timestamptz, '2026-01-12T15:39:01.375000Z'::timestamptz, 'beenkoficial@gmail.com'),
    ('6965159320b6d3cef22a34df', NULL, 'Lubrificantes', 'Importada via CSV', '2026-01-12T15:38:59.102000Z'::timestamptz, '2026-01-12T15:38:59.102000Z'::timestamptz, 'beenkoficial@gmail.com'),
    ('6940319672e01f6fc61cbbf2', '69864e74fb6fe137d3577c07', 'MOTOR', NULL, '2025-12-15T16:04:38.812000Z'::timestamptz, '2026-02-16T12:26:06.035000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('693c8f05b2a7d107b2312ff9', '69864e74fb6fe137d3577c07', 'Cabeçote', NULL, '2025-12-12T21:54:13.114000Z'::timestamptz, '2026-02-16T12:26:06.016000Z'::timestamptz, 'marquesmd9@gmail.com');

  CREATE TEMP TABLE tmp_product_category_expanded AS
  SELECT
    src.legacy_category_id,
    org_map.legacy_org_id AS target_org_legacy_id,
    org_map.organization_id,
    src.name,
    src.description,
    src.created_at,
    src.updated_at,
    src.created_by
  FROM tmp_product_category_source src
  JOIN tmp_org_map org_map
    ON src.legacy_org_id IS NULL OR src.legacy_org_id = org_map.legacy_org_id;

  INSERT INTO public.product_categories (
    id,
    organization_id,
    name,
    description,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'product_category:' || legacy_category_id || ':' || target_org_legacy_id),
    organization_id,
    name,
    description,
    created_at,
    created_by,
    updated_at,
    created_by
  FROM tmp_product_category_expanded
  WHERE target_org_legacy_id IN (SELECT legacy_org_id FROM tmp_org_map)
  ON CONFLICT (organization_id, name) DO UPDATE
  SET
    description = EXCLUDED.description,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_product_category_map AS
  SELECT
    expanded.legacy_category_id,
    expanded.target_org_legacy_id AS legacy_org_id,
    category.id AS product_category_id
  FROM tmp_product_category_expanded expanded
  JOIN public.product_categories category
    ON category.organization_id = expanded.organization_id
   AND category.name = expanded.name
   AND category.deleted_at IS NULL;

  CREATE TEMP TABLE tmp_tax_source (
    legacy_tax_id text PRIMARY KEY,
    legacy_org_id text,
    name varchar(50),
    type varchar(20),
    rate numeric(8, 4),
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_tax_source VALUES
    ('68c0a862a4a3664141d94c00', '69864ce67137a313e5c26d4d', 'SIMPLES', 'federal', 8, '2025-09-09T22:21:22.829000Z'::timestamptz, '2026-02-16T12:42:01.696000Z'::timestamptz, 'contato@loker.com.br'),
    ('68c0a6bdd81a26d9b5c21c02', '69864ce67137a313e5c26d4d', 'ISSQN', 'municipal', 5, '2025-09-09T22:14:21.658000Z'::timestamptz, '2026-02-16T12:42:01.642000Z'::timestamptz, 'contato@loker.com.br');

  INSERT INTO public.taxes (
    id,
    organization_id,
    name,
    type,
    rate,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'tax:' || src.legacy_tax_id || ':' || src.legacy_org_id),
    org_map.organization_id,
    src.name,
    src.type,
    src.rate,
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by
  FROM tmp_tax_source src
  JOIN tmp_org_map org_map
    ON src.legacy_org_id = org_map.legacy_org_id
  ON CONFLICT (organization_id, name) DO UPDATE
  SET
    type = EXCLUDED.type,
    rate = EXCLUDED.rate,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_action_source (
    legacy_action_id text PRIMARY KEY,
    code varchar(100),
    resource varchar(100),
    action_type varchar(20),
    name varchar(100),
    description text,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_action_source VALUES
    ('6986527930417ef399f6af55', 'orders.create', 'orders', 'create', 'Criar Ordens de Serviço', 'Criar Ordens de Serviço', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af56', 'orders.read', 'orders', 'read', 'Visualizar Ordens de Serviço', 'Visualizar Ordens de Serviço', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af57', 'orders.update', 'orders', 'update', 'Atualizar Ordens de Serviço', 'Atualizar Ordens de Serviço', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af58', 'orders.delete', 'orders', 'delete', 'Excluir Ordens de Serviço', 'Excluir Ordens de Serviço', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af69', 'orders.cancel', 'orders', 'update', 'Cancelar Ordens de Serviço', 'Cancelar Ordens de Serviço', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af68', 'orders.pay', 'orders', 'update', 'Pagar Ordens de Serviço', 'Pagar Ordens de Serviço', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('69b9ca7662afe7973f7e5454', 'orders.correct', 'orders', 'update', 'Corrigir Ordem de Serviço', 'Corrigir Ordem de Serviço', '2026-03-17T03:00:00.000Z'::timestamptz, '2026-03-17T21:42:11.279000Z'::timestamptz, 'beenkoficial@gmail.com'),
    ('6986527930417ef399f6af59', 'customers.create', 'customers', 'create', 'Criar Clientes', 'Criar Clientes', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af5a', 'customers.read', 'customers', 'read', 'Visualizar Clientes', 'Visualizar Clientes', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af5b', 'customers.update', 'customers', 'update', 'Atualizar Clientes', 'Atualizar Clientes', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af5c', 'customers.delete', 'customers', 'delete', 'Excluir Clientes', 'Excluir Clientes', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af5d', 'vehicles.create', 'vehicles', 'create', 'Criar Veículos', 'Criar Veículos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af5e', 'vehicles.read', 'vehicles', 'read', 'Visualizar Veículos', 'Visualizar Veículos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af5f', 'vehicles.update', 'vehicles', 'update', 'Atualizar Veículos', 'Atualizar Veículos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af60', 'vehicles.delete', 'vehicles', 'delete', 'Excluir Veículos', 'Excluir Veículos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af6a', 'products.create', 'products', 'create', 'Criar Produtos', 'Criar Produtos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af6b', 'products.read', 'products', 'read', 'Visualizar Produtos', 'Visualizar Produtos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af6c', 'products.update', 'products', 'update', 'Atualizar Produtos', 'Atualizar Produtos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af6d', 'products.delete', 'products', 'delete', 'Excluir Produtos', 'Excluir Produtos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af61', 'inventory.create', 'inventory', 'create', 'Criar Itens de Estoque', 'Criar Itens de Estoque', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af62', 'inventory.read', 'inventory', 'read', 'Visualizar Estoque', 'Visualizar Estoque', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af63', 'inventory.update', 'inventory', 'update', 'Atualizar Estoque', 'Atualizar Estoque', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af64', 'inventory.delete', 'inventory', 'delete', 'Excluir Itens de Estoque', 'Excluir Itens de Estoque', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af75', 'suppliers.create', 'suppliers', 'create', 'Criar Fornecedores', 'Criar Fornecedores', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af76', 'suppliers.read', 'suppliers', 'read', 'Visualizar Fornecedores', 'Visualizar Fornecedores', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af77', 'suppliers.update', 'suppliers', 'update', 'Atualizar Fornecedores', 'Atualizar Fornecedores', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af78', 'suppliers.delete', 'suppliers', 'delete', 'Excluir Fornecedores', 'Excluir Fornecedores', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af7a', 'purchases.create', 'purchases', 'create', 'Criar Compras', 'Criar Compras', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af7b', 'purchases.read', 'purchases', 'read', 'Visualizar Compras', 'Visualizar Compras', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af7c', 'purchases.update', 'purchases', 'update', 'Atualizar Compras', 'Atualizar Compras', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af7d', 'purchases.delete', 'purchases', 'delete', 'Excluir Compras', 'Excluir Compras', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af81', 'returns.read', 'returns', 'read', 'Visualizar Devoluções', 'Visualizar Devoluções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af82', 'returns.create', 'returns', 'create', 'Criar Devoluções', 'Criar Devoluções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af83', 'returns.update', 'returns', 'update', 'Atualizar Devoluções', 'Atualizar Devoluções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af84', 'returns.delete', 'returns', 'delete', 'Excluir Devoluções', 'Excluir Devoluções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af85', 'financial.create', 'financial', 'create', 'Criar Registros Financeiros', 'Criar Registros Financeiros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af86', 'financial.read', 'financial', 'read', 'Visualizar Financeiro', 'Visualizar Financeiro', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af87', 'financial.update', 'financial', 'update', 'Atualizar Registros Financeiros', 'Atualizar Registros Financeiros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af88', 'financial.delete', 'financial', 'delete', 'Excluir Registros Financeiros', 'Excluir Registros Financeiros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af8f', 'appointments.create', 'appointments', 'create', 'Criar Agendamentos', 'Criar Agendamentos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af90', 'appointments.read', 'appointments', 'read', 'Visualizar Agendamentos', 'Visualizar Agendamentos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af91', 'appointments.update', 'appointments', 'update', 'Atualizar Agendamentos', 'Atualizar Agendamentos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af92', 'appointments.delete', 'appointments', 'delete', 'Excluir Agendamentos', 'Excluir Agendamentos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af93', 'employees.create', 'employees', 'create', 'Criar Funcionários', 'Criar Funcionários', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af94', 'employees.read', 'employees', 'read', 'Visualizar Funcionários', 'Visualizar Funcionários', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af97', 'employees.delete', 'employees', 'delete', 'Excluir Funcionários', 'Excluir Funcionários', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af98', 'employees.pay', 'employees', 'update', 'Pagar Funcionários', 'Pagar Funcionários', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af95', 'employees.update', 'employees', 'update', 'Atualizar Funcionários', 'Atualizar Funcionários', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af99', 'reports.view', 'reports', 'read', 'Visualizar Relatórios', 'Visualizar Relatórios', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af9a', 'reports.customers', 'reports', 'read', 'Visualizar Relatórios de Clientes', 'Visualizar Relatórios de Clientes', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af9b', 'reports.financial', 'reports', 'read', 'Visualizar Relatórios Financeiros', 'Visualizar Relatórios Financeiros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af9c', 'reports.commissions', 'reports', 'read', 'Visualizar Relatórios de Comissões', 'Visualizar Relatórios de Comissões', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af9d', 'reports.sales', 'reports', 'read', 'Visualizar Relatórios de Vendas', 'Visualizar Relatórios de Vendas', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af9e', 'reports.purchases', 'reports', 'read', 'Visualizar Relatórios de Compras', 'Visualizar Relatórios de Compras', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af9f', 'reports.costs', 'reports', 'read', 'Visualizar Relatórios de Custos', 'Visualizar Relatórios de Custos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afa0', 'reports.debtors', 'reports', 'read', 'Visualizar Relatórios de Devedores', 'Visualizar Relatórios de Devedores', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afa1', 'reports.suppliers', 'reports', 'read', 'Visualizar Relatórios de Fornecedores', 'Visualizar Relatórios de Fornecedores', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afa2', 'reports.profit', 'reports', 'read', 'Visualizar Relatórios de Lucro', 'Visualizar Relatórios de Lucro', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afa3', 'settings.view', 'settings', 'read', 'Visualizar Configurações', 'Visualizar Configurações', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afa4', 'settings.update', 'settings', 'update', 'Atualizar Configurações', 'Atualizar Configurações', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('69bb306b03b70912c23fa457', 'fiscal.manage', 'settings', 'manage', 'Gerenciamento Fiscal', 'Gerenciamento Fiscal', '2026-03-18T03:00:00.000Z'::timestamptz, '2026-03-18T23:08:27.402000Z'::timestamptz, 'beenkoficial@gmail.com'),
    ('6986527930417ef399f6afa6', 'organization.view', 'organization', 'read', 'Visualizar Organização', 'Visualizar Organização', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afa7', 'organization.update', 'organization', 'update', 'Update Organization', 'Update Organization', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afa9', 'members.view', 'members', 'read', 'Visualizar Membros', 'Visualizar Membros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afaa', 'members.invite', 'members', 'create', 'Convidar Membros', 'Convidar Membros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afab', 'members.update', 'members', 'update', 'Atualizar Membros', 'Atualizar Membros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afac', 'members.delete', 'members', 'delete', 'Excluir Membros', 'Excluir Membros', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afad', 'roles.create', 'roles', 'create', 'Criar Funções', 'Criar Funções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afae', 'roles.read', 'roles', 'read', 'Visualizar Funções', 'Visualizar Funções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afaf', 'roles.update', 'roles', 'update', 'Atualizar Funções', 'Atualizar Funções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afb0', 'roles.delete', 'roles', 'delete', 'Excluir Funções', 'Excluir Funções', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afb1', 'subscription.manage', 'subscription', 'manage', 'Gerenciar Assinatura', 'Gerenciar Assinatura', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afb3', 'subscription.view', 'subscription', 'read', 'Visualizar Assinatura', 'Visualizar Assinatura', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afb8', 'payment_machines.view', 'payment_machines', 'read', 'Visualizar Maquininhas', 'Visualizar Maquininhas', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afb9', 'payment_machines.update', 'payment_machines', 'update', 'Atualizar Maquininhas', 'Atualizar Maquininhas', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afbb', 'authorizations.create', 'authorizations', 'create', 'Criar Autorizações', 'Criar Autorizações', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afbc', 'authorizations.read', 'authorizations', 'read', 'Visualizar Autorizações', 'Visualizar Autorizações', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afbd', 'authorizations.update', 'authorizations', 'update', 'Atualizar Autorizações', 'Atualizar Autorizações', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afbe', 'authorizations.delete', 'authorizations', 'delete', 'Excluir Autorizações', 'Excluir Autorizações', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afc0', 'authorizations.approve', 'authorizations', 'update', 'Aprovar Autorizações', 'Aprovar Autorizações', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afc1', 'consultation.use', 'consultation', 'create', 'Usar Consultoria IA', 'Usar Consultoria IA', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6afc2', 'consultation.view', 'consultation', 'read', 'Visualizar Consultorias', 'Visualizar Consultorias', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af65', 'taxes.view', 'taxes', 'read', 'Visualizar Impostos', 'Visualizar Impostos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af66', 'taxes.update', 'taxes', 'update', 'Atualizar Impostos', 'Atualizar Impostos', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af67', 'bank_accounts.view', 'bank_accounts', 'read', 'Visualizar Contas Bancárias', 'Visualizar Contas Bancárias', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor),
    ('6986527930417ef399f6af7e', 'bank_accounts.update', 'bank_accounts', 'update', 'Atualizar Contas Bancárias', 'Atualizar Contas Bancárias', v_default_action_timestamp, v_default_action_timestamp, v_default_action_actor);

  DELETE FROM public.actions action
  USING tmp_action_source src
  WHERE action.code = src.code
    AND action.id <> uuid_generate_v5(v_namespace, 'action:' || src.legacy_action_id);

  DELETE FROM public.actions
  WHERE code IN (
    'orders.finish',
    'bank_accounts.read',
    'bank_accounts.create',
    'bank_accounts.delete',
    'members.remove',
    'roles.view'
  );

  INSERT INTO public.actions (
    id,
    code,
    name,
    resource,
    action_type,
    description,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'action:' || legacy_action_id),
    code,
    name,
    resource,
    action_type,
    description,
    COALESCE(created_at, updated_at, now()),
    created_by,
    COALESCE(updated_at, created_at, now()),
    created_by
  FROM tmp_action_source
  ON CONFLICT (code) DO UPDATE
  SET
    name = EXCLUDED.name,
    resource = EXCLUDED.resource,
    action_type = EXCLUDED.action_type,
    description = EXCLUDED.description,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_action_map AS
  SELECT
    src.legacy_action_id,
    src.code,
    action.id AS action_id
  FROM tmp_action_source src
  JOIN public.actions action
    ON action.code = src.code;

  CREATE TEMP TABLE tmp_system_role_source (
    legacy_role_id text PRIMARY KEY,
    name varchar(100),
    display_name varchar(100),
    description text,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_system_role_source VALUES
    ('6986558ff6e6a571e2c57060', 'manager', 'Gerente', 'Acesso a operações principais, relatórios e aprovações, sem acesso a configurações críticas', '2026-02-06T20:56:47.767000Z'::timestamptz, '2026-02-06T21:16:25.369000Z'::timestamptz, 'beenkoficial@gmail.com'),
    ('6986558ff6e6a571e2c57061', 'employee', 'Funcionário', 'Acesso limitado apenas para visualizar e executar tarefas operacionais básicas', '2026-02-06T20:56:47.767000Z'::timestamptz, '2026-02-06T21:16:23.631000Z'::timestamptz, 'beenkoficial@gmail.com'),
    ('6986558ff6e6a571e2c57062', 'admin', 'Administrador', 'Acesso total ao sistema, incluindo configurações, usuários e permissões', '2026-02-06T20:56:47.767000Z'::timestamptz, '2026-02-06T21:16:26.661000Z'::timestamptz, 'beenkoficial@gmail.com');

  CREATE TEMP TABLE tmp_custom_role_source (
    legacy_role_id text PRIMARY KEY,
    legacy_org_id text,
    name varchar(100),
    display_name varchar(100),
    description text,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_custom_role_source VALUES
    ('699866335d6ab7400a1544fd', '69864e74fb6fe137d3577c07', 'marcineia', 'Marcineia', NULL, '2026-02-20T13:48:35.504000Z'::timestamptz, '2026-03-24T13:53:03.371000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6995ae645f92c673624791ed', '69864e74fb6fe137d3577c07', 'anderson', 'Anderson', 'Acesso limitado apenas para visualizar e executar tarefas operacionais básicas', '2026-02-18T12:19:48.809000Z'::timestamptz, '2026-02-18T12:19:48.809000Z'::timestamptz, 'marquesmd9@gmail.com');

  INSERT INTO public.roles (
    id,
    organization_id,
    name,
    display_name,
    description,
    is_system_role,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'role:' || src.legacy_role_id || ':' || org_map.legacy_org_id),
    org_map.organization_id,
    src.name,
    src.display_name,
    src.description,
    true,
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by
  FROM tmp_system_role_source src
  CROSS JOIN tmp_org_map org_map
  ON CONFLICT (organization_id, name) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role,
    updated_by = EXCLUDED.updated_by;

  INSERT INTO public.roles (
    id,
    organization_id,
    name,
    display_name,
    description,
    is_system_role,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'role:' || src.legacy_role_id || ':' || src.legacy_org_id),
    org_map.organization_id,
    src.name,
    src.display_name,
    src.description,
    false,
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by
  FROM tmp_custom_role_source src
  JOIN tmp_org_map org_map
    ON org_map.legacy_org_id = src.legacy_org_id
  ON CONFLICT (organization_id, name) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_role_map (
    legacy_role_id text,
    legacy_org_scope text,
    role_name varchar(100),
    role_id uuid,
    PRIMARY KEY (legacy_role_id, legacy_org_scope)
  ) ON COMMIT DROP;

  INSERT INTO tmp_role_map
  SELECT
    src.legacy_role_id,
    org_map.legacy_org_id,
    src.name,
    role.id
  FROM tmp_system_role_source src
  CROSS JOIN tmp_org_map org_map
  JOIN public.roles role
    ON role.organization_id = org_map.organization_id
   AND role.name = src.name;

  INSERT INTO tmp_role_map
  SELECT
    src.legacy_role_id,
    src.legacy_org_id,
    src.name,
    role.id
  FROM tmp_custom_role_source src
  JOIN tmp_org_map org_map
    ON org_map.legacy_org_id = src.legacy_org_id
  JOIN public.roles role
    ON role.organization_id = org_map.organization_id
   AND role.name = src.name;

  CREATE TEMP TABLE tmp_permission_source (
    role_name varchar(100),
    legacy_org_id text,
    action_code varchar(100)
  ) ON COMMIT DROP;

  INSERT INTO tmp_permission_source (role_name, legacy_org_id, action_code)
  SELECT 'admin', org_map.legacy_org_id, action_source.code
  FROM tmp_org_map org_map
  CROSS JOIN tmp_action_source action_source;

  INSERT INTO tmp_permission_source (role_name, legacy_org_id, action_code)
  SELECT 'manager', org_map.legacy_org_id, code
  FROM tmp_org_map org_map
  CROSS JOIN unnest(ARRAY[
    'orders.create', 'orders.read', 'orders.update', 'orders.delete',
    'orders.pay', 'orders.cancel', 'customers.create', 'customers.read',
    'customers.update', 'customers.delete', 'vehicles.create',
    'vehicles.read', 'vehicles.update', 'vehicles.delete',
    'products.create', 'products.read', 'products.update',
    'products.delete', 'inventory.create', 'inventory.read',
    'inventory.update', 'inventory.delete', 'suppliers.create',
    'suppliers.read', 'suppliers.update', 'suppliers.delete',
    'purchases.create', 'purchases.read', 'purchases.update',
    'purchases.delete', 'returns.read', 'returns.create',
    'returns.update', 'returns.delete', 'financial.create',
    'financial.read', 'financial.update', 'financial.delete',
    'appointments.create', 'appointments.read', 'appointments.update',
    'appointments.delete', 'employees.read', 'employees.pay',
    'reports.view', 'reports.customers', 'reports.financial',
    'reports.commissions', 'reports.sales', 'reports.purchases',
    'reports.costs', 'reports.debtors', 'reports.suppliers',
    'reports.profit', 'settings.view', 'members.view',
    'members.invite', 'authorizations.create', 'authorizations.read',
    'authorizations.update', 'authorizations.delete',
    'authorizations.approve', 'consultation.use', 'consultation.view',
    'taxes.view', 'taxes.update', 'bank_accounts.view',
    'bank_accounts.update'
  ]::text[]) AS code;

  INSERT INTO tmp_permission_source (role_name, legacy_org_id, action_code)
  SELECT 'employee', org_map.legacy_org_id, code
  FROM tmp_org_map org_map
  CROSS JOIN unnest(ARRAY[
    'customers.create', 'customers.read', 'customers.update',
    'vehicles.create', 'vehicles.read', 'vehicles.update',
    'orders.create', 'orders.read', 'orders.update', 'orders.pay',
    'products.create', 'products.read', 'inventory.read', 'inventory.update',
    'appointments.create', 'appointments.read', 'returns.read',
    'returns.create', 'purchases.create', 'purchases.read',
    'suppliers.read', 'taxes.view', 'reports.debtors',
    'reports.customers', 'reports.purchases', 'reports.suppliers',
    'payment_machines.view'
  ]::text[]) AS code;

  INSERT INTO tmp_permission_source (role_name, legacy_org_id, action_code)
  SELECT 'anderson', '69864e74fb6fe137d3577c07', code
  FROM unnest(ARRAY[
    'orders.create', 'orders.read', 'orders.update', 'orders.pay',
    'orders.cancel', 'customers.read', 'vehicles.read',
    'vehicles.update', 'vehicles.delete', 'inventory.create',
    'inventory.update', 'inventory.delete', 'taxes.view',
    'taxes.update', 'products.create', 'products.read',
    'products.update', 'products.delete', 'appointments.create',
    'appointments.read', 'appointments.update', 'appointments.delete',
    'reports.commissions', 'authorizations.create',
    'authorizations.read', 'authorizations.update'
  ]::text[]) AS code;

  INSERT INTO tmp_permission_source (role_name, legacy_org_id, action_code)
  SELECT 'marcineia', '69864e74fb6fe137d3577c07', code
  FROM unnest(ARRAY[
    'customers.create', 'customers.read', 'customers.update',
    'customers.delete', 'reports.customers', 'reports.financial',
    'reports.sales', 'reports.purchases', 'reports.costs',
    'reports.debtors', 'reports.suppliers', 'reports.profit',
    'settings.view', 'settings.update', 'reports.view',
    'reports.commissions', 'orders.correct'
  ]::text[]) AS code;

  INSERT INTO public.role_actions (
    id,
    role_id,
    action_id,
    is_granted,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'role_action:' || perm.legacy_org_id || ':' || perm.role_name || ':' || perm.action_code),
    role_map.role_id,
    action_map.action_id,
    true,
    now(),
    v_seed_actor,
    now(),
    v_seed_actor
  FROM tmp_permission_source perm
  JOIN tmp_role_map role_map
    ON role_map.legacy_org_scope = perm.legacy_org_id
   AND role_map.role_name = perm.role_name
  JOIN tmp_action_map action_map
    ON action_map.code = perm.action_code
  ON CONFLICT (role_id, action_id) DO UPDATE
  SET
    is_granted = EXCLUDED.is_granted,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_employee_source (
    legacy_employee_id text PRIMARY KEY,
    legacy_org_id text,
    name varchar(200),
    person_type varchar(2),
    tax_id varchar(18),
    phone varchar(20),
    email varchar(200),
    zip_code varchar(9),
    street varchar(200),
    address_number varchar(10),
    address_complement varchar(100),
    neighborhood varchar(100),
    city varchar(100),
    state char(2),
    has_salary boolean,
    salary_amount numeric(15, 2),
    payment_day int,
    salary_installments jsonb,
    has_commission boolean,
    commission_type text,
    commission_amount numeric(15, 2),
    commission_base text,
    commission_categories jsonb,
    has_minimum_guarantee boolean,
    minimum_guarantee_amount numeric(15, 2),
    minimum_guarantee_installments jsonb,
    pix_key_type varchar(20),
    pix_key varchar(150),
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_employee_source VALUES
    ('6995a7acc606859d0294140a', '69864e74fb6fe137d3577c07', 'DANIEL DOS SANTOS MARQUES', 'pf', '00416212042', '51995727373', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, 5, '[]'::jsonb, false, 'percentual', NULL, 'bruto', '[]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2026-02-18T11:51:08.957000Z'::timestamptz, '2026-02-18T11:51:08.957000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6995a789c34c4b74cf0d3b5b', '69864e74fb6fe137d3577c07', 'MARCINEIA HORN MARQUES', 'pf', '01425750036', '51995258366', 'marcineiahm@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, 5, '[]'::jsonb, false, 'percentual', NULL, 'bruto', '[]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2026-02-18T11:50:33.996000Z'::timestamptz, '2026-02-18T15:24:22.292000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('696f5aa24440e2b6b17ae9c6', '69864e74fb6fe137d3577c07', 'LUCAS SANDER', 'pf', '45753556574', '51999345645', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 5000, 5, '[{"valor":3000,"dia":5},{"valor":2000,"dia":25}]'::jsonb, true, 'percentual', 50, 'lucro', '["693c8f05b2a7d107b2312ff9","6940319672e01f6fc61cbbf2","69654e0f95078889d0446920"]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2026-01-20T10:36:18.815000Z'::timestamptz, '2026-02-27T13:20:10.770000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6940356a6e82941d4b1ea1df', '69864e74fb6fe137d3577c07', 'ANDERSON DOS SANTOS 2', 'pf', '00000000018', '51981711773', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, 5, '[]'::jsonb, true, 'percentual', 20, 'lucro', '["6940319672e01f6fc61cbbf2"]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2025-12-15T16:20:58.998000Z'::timestamptz, '2026-02-07T16:31:27.373000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('6939bc9a7dc0716bdcdaa1c4', '69864e74fb6fe137d3577c07', 'MOACIR DOS SANTOS', 'pf', '00000000017', '51995298450', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 3500, 5, '[]'::jsonb, true, 'percentual', 20, 'lucro', '["6940319672e01f6fc61cbbf2"]'::jsonb, true, 3500, '[{"dia":10,"valor":1750},{"dia":25,"valor":1750}]'::jsonb, 'cpf', NULL, '2025-12-10T18:31:54.004000Z'::timestamptz, '2026-02-07T16:31:35.798000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('690cf6ecafa46cd59f83ca7f', '69864ce67137a313e5c26d4d', 'Tales Aguiar', 'pf', '03045375006', '51993869392', 'santarem279@gmail.com', '93880000', 'rua da cabana', '315', 'Casa', 'Imperatriz', 'Araricá', NULL, true, 4, 5, '[]'::jsonb, true, 'percentual', 20, 'bruto', '[]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2025-11-06T19:28:44.252000Z'::timestamptz, '2026-02-07T16:36:41.528000Z'::timestamptz, 'santarem279@gmail.com'),
    ('68ffc77a00aed3ddac71aab6', '69864ce67137a313e5c26d4d', 'ALAN HOSEL', 'pf', '00688632092', '51996074239', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, 5, '[]'::jsonb, true, 'percentual', 10, 'lucro', '[]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', '00688632092', '2025-10-27T19:26:50.644000Z'::timestamptz, '2026-02-07T16:36:52.067000Z'::timestamptz, 'contato@loker.com.br'),
    ('68c0a5e9b8c14dbd5eebcb8f', '69864ce67137a313e5c26d4d', 'JOAO VITOR SANDER', 'pf', '04761233052', '51997443111', NULL, '93700000', 'DELFIM MOREIRA', '255', 'CASA', 'CELESTE', 'CAMPO BOM', 'RS', true, 1600, 30, '[]'::jsonb, true, 'percentual', 15, 'lucro', '[]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2025-09-09T22:10:49.041000Z'::timestamptz, '2026-02-07T16:37:04.907000Z'::timestamptz, 'contato@loker.com.br'),
    ('68c0a50daa385295b630df82', '69864ce67137a313e5c26d4d', 'AFFONSO LUIS BACK', 'pf', '00686961080', '51997322745', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 4000, 10, '[]'::jsonb, true, 'percentual', 15, 'lucro', '[]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', '00686961080', '2025-09-09T22:07:09.474000Z'::timestamptz, '2026-02-07T16:38:16.699000Z'::timestamptz, 'contato@loker.com.br'),
    ('68c04818e616347ba17980c2', '69864e74fb6fe137d3577c07', 'LUCAS COUTO', 'pf', '00000000016', '51995023311', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 1800, 10, '[{"valor":900,"dia":10},{"valor":900,"dia":25}]'::jsonb, true, 'percentual', 1, 'lucro', '["693c8f05b2a7d107b2312ff9"]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2025-09-09T15:30:32.931000Z'::timestamptz, '2026-04-15T19:50:34.501000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('68c047d9536a03d1012afc8d', '69864e74fb6fe137d3577c07', 'CHARLES FERREIRA', 'pf', '00000000015', '51997294216', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 2300, 5, '[]'::jsonb, true, 'percentual', 15, 'lucro', '["693c8f05b2a7d107b2312ff9"]'::jsonb, true, 2300, '[{"dia":10,"valor":1150},{"dia":25,"valor":1150}]'::jsonb, 'cpf', NULL, '2025-09-09T15:29:29.294000Z'::timestamptz, '2026-02-07T16:32:31.072000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('68c0479791cac5f331e842d8', '69864e74fb6fe137d3577c07', 'EDSON ROBERTO DOS SANTOS', 'pf', '00000000014', '51995312785', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 2400, 10, '[{"valor":1200,"dia":10},{"valor":1200,"dia":25}]'::jsonb, true, 'percentual', 4, 'lucro', '["693c8f05b2a7d107b2312ff9","6940319672e01f6fc61cbbf2"]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2025-09-09T15:28:23.949000Z'::timestamptz, '2026-02-23T17:56:03.424000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('68c046b35e7585b00f56487e', '69864e74fb6fe137d3577c07', 'MATEUS SILVA', 'pf', '00000000013', '51999061397', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 2300, 5, '[]'::jsonb, true, 'percentual', 15, 'lucro', '["693c8f05b2a7d107b2312ff9"]'::jsonb, true, 2300, '[]'::jsonb, 'cpf', NULL, '2025-09-09T15:24:35.369000Z'::timestamptz, '2026-02-07T16:32:50.177000Z'::timestamptz, 'marquesmd9@gmail.com'),
    ('68c0463a42a2b1c018ca2e90', '69864e74fb6fe137d3577c07', 'ANDERSON DOS SANTOS', 'pf', '00000000012', '51981711773', 'lealnh9@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, 5, '[]'::jsonb, true, 'percentual', 9, 'lucro', '["693c8f05b2a7d107b2312ff9"]'::jsonb, false, NULL, '[]'::jsonb, 'cpf', NULL, '2025-09-09T15:22:34.336000Z'::timestamptz, '2026-02-23T12:57:25.259000Z'::timestamptz, 'marquesmd9@gmail.com');

  INSERT INTO public.employees (
    id,
    organization_id,
    name,
    person_type,
    tax_id,
    phone,
    email,
    zip_code,
    street,
    address_number,
    address_complement,
    neighborhood,
    city,
    state,
    has_salary,
    salary_amount,
    payment_day,
    salary_installments,
    has_commission,
    commission_type,
    commission_amount,
    commission_base,
    commission_categories,
    has_minimum_guarantee,
    minimum_guarantee_amount,
    minimum_guarantee_installments,
    pix_key_type,
    pix_key,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'employee:' || src.legacy_employee_id),
    org_map.organization_id,
    src.name,
    src.person_type,
    src.tax_id,
    COALESCE(src.phone, ''),
    NULLIF(src.email, ''),
    NULLIF(src.zip_code, ''),
    NULLIF(src.street, ''),
    NULLIF(src.address_number, ''),
    NULLIF(src.address_complement, ''),
    NULLIF(src.neighborhood, ''),
    NULLIF(src.city, ''),
    NULLIF(src.state, ''),
    src.has_salary,
    src.salary_amount,
    src.payment_day,
    src.salary_installments,
    src.has_commission,
    CASE src.commission_type
      WHEN 'percentual' THEN 'percentage'
      WHEN 'fixo' THEN 'fixed_amount'
      ELSE NULL
    END,
    src.commission_amount,
    CASE src.commission_base
      WHEN 'bruto' THEN 'revenue'
      WHEN 'lucro' THEN 'profit'
      ELSE NULL
    END,
    (
      SELECT COALESCE(jsonb_agg(to_jsonb(map.product_category_id::text)), '[]'::jsonb)
      FROM jsonb_array_elements_text(src.commission_categories) AS legacy_category(legacy_id)
      JOIN tmp_product_category_map map
        ON map.legacy_category_id = legacy_category.legacy_id
       AND map.legacy_org_id = src.legacy_org_id
    ),
    src.has_minimum_guarantee,
    src.minimum_guarantee_amount,
    src.minimum_guarantee_installments,
    NULLIF(src.pix_key_type, ''),
    NULLIF(src.pix_key, ''),
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by
  FROM tmp_employee_source src
  JOIN tmp_org_map org_map
    ON org_map.legacy_org_id = src.legacy_org_id
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    person_type = EXCLUDED.person_type,
    tax_id = EXCLUDED.tax_id,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    zip_code = EXCLUDED.zip_code,
    street = EXCLUDED.street,
    address_number = EXCLUDED.address_number,
    address_complement = EXCLUDED.address_complement,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    has_salary = EXCLUDED.has_salary,
    salary_amount = EXCLUDED.salary_amount,
    payment_day = EXCLUDED.payment_day,
    salary_installments = EXCLUDED.salary_installments,
    has_commission = EXCLUDED.has_commission,
    commission_type = EXCLUDED.commission_type,
    commission_amount = EXCLUDED.commission_amount,
    commission_base = EXCLUDED.commission_base,
    commission_categories = EXCLUDED.commission_categories,
    has_minimum_guarantee = EXCLUDED.has_minimum_guarantee,
    minimum_guarantee_amount = EXCLUDED.minimum_guarantee_amount,
    minimum_guarantee_installments = EXCLUDED.minimum_guarantee_installments,
    pix_key_type = EXCLUDED.pix_key_type,
    pix_key = EXCLUDED.pix_key,
    updated_by = EXCLUDED.updated_by;

  CREATE TEMP TABLE tmp_employee_map AS
  SELECT
    legacy_employee_id,
    uuid_generate_v5(v_namespace, 'employee:' || legacy_employee_id) AS employee_id
  FROM tmp_employee_source;

  CREATE TEMP TABLE tmp_user_source (
    legacy_user_id text PRIMARY KEY,
    email varchar(320),
    full_name varchar(200),
    display_name varchar(200),
    legacy_org_id text,
    legacy_role_id text,
    legacy_employee_id text,
    profile_picture_url varchar(500),
    is_owner boolean,
    is_active boolean,
    created_at timestamptz,
    updated_at timestamptz
  ) ON COMMIT DROP;

  INSERT INTO tmp_user_source VALUES
    ('68b21e394c1c0a8057cf2136', 'beenkoficial@gmail.com', 'Beenk', NULL, NULL, NULL, NULL, NULL, true, true, '2025-08-29T00:00:00Z'::timestamptz, '2026-03-18T00:00:00Z'::timestamptz),
    ('68bf5a54d2be85c156a85dfd', 'marquesmd9@gmail.com', 'marquesmd9', 'Leal', '69864e74fb6fe137d3577c07', '6986558ff6e6a571e2c57062', NULL, NULL, false, true, '2025-09-08T00:00:00Z'::timestamptz, '2026-02-16T00:00:00Z'::timestamptz),
    ('68c06e22e3b7015582db9328', 'contato@loker.com.br', 'contato', 'Loker', '69864ce67137a313e5c26d4d', '6986558ff6e6a571e2c57062', NULL, 'https://base44.app/api/apps/68b21e394c1c0a8057cf2135/files/public/68b21e394c1c0a8057cf2135/40eb7e863_favicon-loker.png', false, true, '2025-09-09T00:00:00Z'::timestamptz, '2026-02-25T00:00:00Z'::timestamptz),
    ('690ba8d6b782bdb7bf634c96', 'santarem279@gmail.com', 'santarem279', NULL, NULL, NULL, NULL, NULL, false, true, '2025-11-05T00:00:00Z'::timestamptz, '2025-11-05T00:00:00Z'::timestamptz),
    ('6995d6534d374b080f9315b9', 'lealnh9@gmail.com', 'lealnh9', NULL, '69864e74fb6fe137d3577c07', '6995ae645f92c673624791ed', '68c0463a42a2b1c018ca2e90', NULL, false, true, '2026-02-18T00:00:00Z'::timestamptz, '2026-02-23T00:00:00Z'::timestamptz),
    ('6995da09baeade58cad85b32', 'marcineiahm@gmail.com', 'marcineiahm', NULL, '69864e74fb6fe137d3577c07', '699866335d6ab7400a1544fd', '6995a789c34c4b74cf0d3b5b', NULL, false, true, '2026-02-18T00:00:00Z'::timestamptz, '2026-02-20T00:00:00Z'::timestamptz),
    ('699a24454ba6adc2756239c4', 'danielsoaresf@hotmail.com', 'danielsoaresf', 'Daniel Soares', '69864e74fb6fe137d3577c07', '6986558ff6e6a571e2c57062', NULL, NULL, false, true, '2026-02-21T00:00:00Z'::timestamptz, '2026-02-23T00:00:00Z'::timestamptz);

  CREATE TEMP TABLE tmp_auth_user_source AS
  SELECT
    src.legacy_user_id,
    uuid_generate_v5(v_namespace, 'auth_user:' || src.legacy_user_id) AS auth_user_id,
    lower(src.email) AS email,
    COALESCE(src.updated_at, src.created_at, now()) AS confirmed_at,
    COALESCE(src.created_at, now()) AS created_at,
    COALESCE(src.updated_at, src.created_at, now()) AS updated_at,
    crypt(gen_random_uuid()::text || ':' || lower(src.email), gen_salt('bf')) AS encrypted_password,
    jsonb_build_object(
      'provider',
      'email',
      'providers',
      jsonb_build_array('email')
    ) AS raw_app_meta_data,
    jsonb_strip_nulls(
      jsonb_build_object(
        'email', lower(src.email),
        'full_name', src.full_name,
        'display_name', src.display_name,
        'legacy_user_id', src.legacy_user_id
      )
    ) AS raw_user_meta_data,
    jsonb_build_object(
      'sub',
      uuid_generate_v5(v_namespace, 'auth_user:' || src.legacy_user_id)::text,
      'email',
      lower(src.email),
      'email_verified',
      true,
      'phone_verified',
      false
    ) AS identity_data
  FROM tmp_user_source src;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'users'
  ) THEN
    SELECT
      'INSERT INTO auth.users ('
      || string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      || ') SELECT '
      || string_agg(expression_sql, ', ' ORDER BY ordinal_position)
      || ' FROM tmp_auth_user_source src ON CONFLICT (id) DO UPDATE SET '
      || string_agg(update_sql, ', ' ORDER BY ordinal_position) FILTER (WHERE update_sql IS NOT NULL)
    INTO v_sql
    FROM (
      SELECT
        ordinal_position,
        column_name,
        CASE column_name
          WHEN 'instance_id' THEN quote_literal(v_auth_instance_id::text) || '::uuid'
          WHEN 'id' THEN 'src.auth_user_id'
          WHEN 'aud' THEN quote_literal('authenticated')
          WHEN 'role' THEN quote_literal('authenticated')
          WHEN 'email' THEN 'src.email'
          WHEN 'encrypted_password' THEN 'src.encrypted_password'
          WHEN 'email_confirmed_at' THEN 'src.confirmed_at'
          WHEN 'created_at' THEN 'src.created_at'
          WHEN 'updated_at' THEN 'src.updated_at'
          WHEN 'raw_app_meta_data' THEN 'src.raw_app_meta_data'
          WHEN 'raw_user_meta_data' THEN 'src.raw_user_meta_data'
          WHEN 'confirmation_token' THEN quote_literal('')
          WHEN 'email_change' THEN quote_literal('')
          WHEN 'email_change_token_new' THEN quote_literal('')
          WHEN 'recovery_token' THEN quote_literal('')
          WHEN 'phone' THEN 'NULL'
          WHEN 'phone_change' THEN quote_literal('')
          WHEN 'phone_change_token' THEN quote_literal('')
          WHEN 'reauthentication_token' THEN quote_literal('')
          WHEN 'is_sso_user' THEN 'false'
          WHEN 'is_anonymous' THEN 'false'
          ELSE NULL
        END AS expression_sql,
        CASE
          WHEN column_name IN ('id', 'instance_id', 'created_at') THEN NULL
          ELSE quote_ident(column_name) || ' = EXCLUDED.' || quote_ident(column_name)
        END AS update_sql
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = ANY (
          ARRAY[
            'instance_id',
            'id',
            'aud',
            'role',
            'email',
            'encrypted_password',
            'email_confirmed_at',
            'created_at',
            'updated_at',
            'raw_app_meta_data',
            'raw_user_meta_data',
            'confirmation_token',
            'email_change',
            'email_change_token_new',
            'recovery_token',
            'phone',
            'phone_change',
            'phone_change_token',
            'reauthentication_token',
            'is_sso_user',
            'is_anonymous'
          ]
        )
    ) auth_user_columns
    WHERE expression_sql IS NOT NULL;

    IF v_sql IS NOT NULL THEN
      EXECUTE v_sql;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'identities'
  ) THEN
    SELECT
      'INSERT INTO auth.identities ('
      || string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      || ') SELECT '
      || string_agg(expression_sql, ', ' ORDER BY ordinal_position)
      || ' FROM tmp_auth_user_source src ON CONFLICT DO NOTHING'
    INTO v_sql
    FROM (
      SELECT
        ordinal_position,
        column_name,
        CASE column_name
          WHEN 'id' THEN 'src.auth_user_id::text'
          WHEN 'provider_id' THEN 'src.auth_user_id::text'
          WHEN 'user_id' THEN 'src.auth_user_id'
          WHEN 'identity_data' THEN 'src.identity_data'
          WHEN 'provider' THEN quote_literal('email')
          WHEN 'last_sign_in_at' THEN 'src.confirmed_at'
          WHEN 'created_at' THEN 'src.created_at'
          WHEN 'updated_at' THEN 'src.updated_at'
          ELSE NULL
        END AS expression_sql
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'identities'
        AND column_name = ANY (
          ARRAY[
            'id',
            'provider_id',
            'user_id',
            'identity_data',
            'provider',
            'last_sign_in_at',
            'created_at',
            'updated_at'
          ]
        )
    ) auth_identity_columns
    WHERE expression_sql IS NOT NULL;

    IF v_sql IS NOT NULL THEN
      EXECUTE v_sql;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (
    id,
    user_id,
    email,
    organization_id,
    display_name,
    profile_picture_url,
    role_id,
    employee_id,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by,
    is_owner,
    stripe_customer_id
  )
  SELECT
    uuid_generate_v5(v_namespace, 'user_profile:' || src.legacy_user_id),
    uuid_generate_v5(v_namespace, 'auth_user:' || src.legacy_user_id)::text,
    lower(src.email),
    org_map.organization_id,
    src.display_name,
    src.profile_picture_url,
    role_map.role_id,
    employee_map.employee_id,
    src.is_active,
    src.created_at,
    src.email,
    src.updated_at,
    src.email,
    src.is_owner,
    NULL
  FROM tmp_user_source src
  LEFT JOIN tmp_org_map org_map
    ON org_map.legacy_org_id = src.legacy_org_id
  LEFT JOIN tmp_role_map role_map
    ON role_map.legacy_role_id = src.legacy_role_id
   AND role_map.legacy_org_scope = src.legacy_org_id
  LEFT JOIN tmp_employee_map employee_map
    ON employee_map.legacy_employee_id = src.legacy_employee_id
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    organization_id = EXCLUDED.organization_id,
    display_name = EXCLUDED.display_name,
    profile_picture_url = EXCLUDED.profile_picture_url,
    role_id = EXCLUDED.role_id,
    employee_id = EXCLUDED.employee_id,
    is_active = EXCLUDED.is_active,
    updated_by = EXCLUDED.updated_by,
    is_owner = EXCLUDED.is_owner,
    stripe_customer_id = EXCLUDED.stripe_customer_id;

  INSERT INTO public.user_preferences (
    id,
    user_id,
    primary_color,
    neutral_color,
    color_mode,
    timezone,
    created_at,
    updated_at
  )
  SELECT
    uuid_generate_v5(v_namespace, 'user_preferences:' || legacy_user_id),
    uuid_generate_v5(v_namespace, 'auth_user:' || legacy_user_id)::text,
    'purple',
    'slate',
    'light',
    'UTC',
    created_at,
    updated_at
  FROM tmp_user_source
  ON CONFLICT (user_id) DO UPDATE
  SET
    primary_color = EXCLUDED.primary_color,
    neutral_color = EXCLUDED.neutral_color,
    color_mode = EXCLUDED.color_mode,
    timezone = EXCLUDED.timezone;

  INSERT INTO public.notification_preferences (
    id,
    user_id,
    channel_in_app,
    channel_email,
    channel_web_push,
    channel_mobile_push,
    weekly_digest,
    product_updates,
    important_updates,
    web_push_permission,
    mobile_push_permission,
    created_at,
    updated_at
  )
  SELECT
    uuid_generate_v5(v_namespace, 'notification_preferences:' || legacy_user_id),
    uuid_generate_v5(v_namespace, 'auth_user:' || legacy_user_id)::text,
    true,
    true,
    false,
    false,
    false,
    true,
    true,
    'default',
    'default',
    created_at,
    updated_at
  FROM tmp_user_source
  ON CONFLICT (user_id) DO UPDATE
  SET
    channel_in_app = EXCLUDED.channel_in_app,
    channel_email = EXCLUDED.channel_email,
    channel_web_push = EXCLUDED.channel_web_push,
    channel_mobile_push = EXCLUDED.channel_mobile_push,
    weekly_digest = EXCLUDED.weekly_digest,
    product_updates = EXCLUDED.product_updates,
    important_updates = EXCLUDED.important_updates,
    web_push_permission = EXCLUDED.web_push_permission,
    mobile_push_permission = EXCLUDED.mobile_push_permission;

  RAISE NOTICE 'Stage 1 migration seed applied: auth users, organizations, base catalogs, roles, employees, and user profiles.';
END;
$$;
