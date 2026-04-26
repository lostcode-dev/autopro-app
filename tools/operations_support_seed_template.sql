-- =============================================================================
-- Seeder: 005_operations_support_seed.sql
-- Description: Migrates appointments, purchases, business analyses, purchase
--              returns, and bank account statements from Base44 exports after
--              identity, catalog, and master-product seeds.
-- =============================================================================

DO $$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
BEGIN
  CREATE TEMP TABLE tmp_appointment_source (
    legacy_appointment_id text PRIMARY KEY,
    legacy_vehicle_id text,
    legacy_service_order_id text,
    notes text,
    time text,
    priority text,
    legacy_org_id text,
    appointment_date text,
    service_type text,
    legacy_client_id text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_appointment_source
  SELECT * FROM jsonb_to_recordset($appointments$__APPOINTMENTS_JSON__$appointments$::jsonb) AS src(
    legacy_appointment_id text,
    legacy_vehicle_id text,
    legacy_service_order_id text,
    notes text,
    time text,
    priority text,
    legacy_org_id text,
    appointment_date text,
    service_type text,
    legacy_client_id text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_purchase_source (
    legacy_purchase_id text PRIMARY KEY,
    items text,
    invoice_number text,
    due_date text,
    legacy_financial_transaction_id text,
    total_amount text,
    notes text,
    legacy_bank_account_id text,
    legacy_supplier_id text,
    legacy_org_id text,
    payment_date text,
    payment_status text,
    purchase_date text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_purchase_source
  SELECT * FROM jsonb_to_recordset($purchases$__PURCHASES_JSON__$purchases$::jsonb) AS src(
    legacy_purchase_id text,
    items text,
    invoice_number text,
    due_date text,
    legacy_financial_transaction_id text,
    total_amount text,
    notes text,
    legacy_bank_account_id text,
    legacy_supplier_id text,
    legacy_org_id text,
    payment_date text,
    payment_status text,
    purchase_date text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_business_analysis_source (
    legacy_business_analysis_id text PRIMARY KEY,
    analysis_date text,
    financial_analysis text,
    legacy_org_id text,
    strengths text,
    base_data text,
    title text,
    improvement_areas text,
    executive_summary text,
    growth_strategies text,
    business_score text,
    customer_analysis text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_business_analysis_source
  SELECT * FROM jsonb_to_recordset($business_analyses$__BUSINESS_ANALYSES_JSON__$business_analyses$::jsonb) AS src(
    legacy_business_analysis_id text,
    analysis_date text,
    financial_analysis text,
    legacy_org_id text,
    strengths text,
    base_data text,
    title text,
    improvement_areas text,
    executive_summary text,
    growth_strategies text,
    business_score text,
    customer_analysis text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_purchase_return_source (
    legacy_purchase_return_id text PRIMARY KEY,
    returned_items text,
    reason text,
    generated_financial_credit text,
    return_date text,
    legacy_purchase_id text,
    legacy_financial_transaction_id text,
    notes text,
    legacy_bank_account_id text,
    legacy_supplier_id text,
    legacy_org_id text,
    total_returned_amount text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_purchase_return_source
  SELECT * FROM jsonb_to_recordset($purchase_returns$__PURCHASE_RETURNS_JSON__$purchase_returns$::jsonb) AS src(
    legacy_purchase_return_id text,
    returned_items text,
    reason text,
    generated_financial_credit text,
    return_date text,
    legacy_purchase_id text,
    legacy_financial_transaction_id text,
    notes text,
    legacy_bank_account_id text,
    legacy_supplier_id text,
    legacy_org_id text,
    total_returned_amount text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_bank_statement_source (
    legacy_bank_statement_id text PRIMARY KEY,
    transaction_date text,
    notes text,
    legacy_bank_account_id text,
    transaction_type text,
    legacy_org_id text,
    amount text,
    previous_balance text,
    legacy_financial_transaction_id text,
    description text,
    new_balance text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_bank_statement_source
  SELECT * FROM jsonb_to_recordset($bank_statements$__BANK_STATEMENTS_JSON__$bank_statements$::jsonb) AS src(
    legacy_bank_statement_id text,
    transaction_date text,
    notes text,
    legacy_bank_account_id text,
    transaction_type text,
    legacy_org_id text,
    amount text,
    previous_balance text,
    legacy_financial_transaction_id text,
    description text,
    new_balance text,
    created_at text,
    updated_at text,
    created_by text
  );

  INSERT INTO public.appointments (
    id, organization_id, client_id, vehicle_id, appointment_date, time,
    service_type, priority, status, service_order_id, notes, created_at,
    created_by, updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'appointment:' || src.legacy_appointment_id),
    organizations.id,
    clients.id,
    vehicles.id,
    COALESCE(NULLIF(src.appointment_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE),
    LEFT(COALESCE(NULLIF(src.time, ''), '08:00'), 5),
    LEFT(COALESCE(NULLIF(src.service_type, ''), 'Servico'), 200),
    CASE src.priority WHEN 'alta' THEN 'high' WHEN 'media' THEN 'medium' WHEN 'baixa' THEN 'low' ELSE NULL END,
    CASE src.status WHEN 'confirmado' THEN 'confirmed' WHEN 'cancelado' THEN 'cancelled' WHEN 'concluido' THEN 'completed' ELSE 'scheduled' END,
    CASE WHEN COALESCE(src.legacy_service_order_id, '') <> '' THEN uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id) ELSE NULL END,
    NULLIF(src.notes, ''),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_appointment_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.clients AS clients
    ON clients.id = uuid_generate_v5(v_namespace, 'client:' || src.legacy_client_id)
  JOIN public.vehicles AS vehicles
    ON vehicles.id = uuid_generate_v5(v_namespace, 'vehicle:' || src.legacy_vehicle_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_client_id <> ''
    AND src.legacy_vehicle_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    client_id = EXCLUDED.client_id,
    vehicle_id = EXCLUDED.vehicle_id,
    appointment_date = EXCLUDED.appointment_date,
    time = EXCLUDED.time,
    service_type = EXCLUDED.service_type,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    service_order_id = EXCLUDED.service_order_id,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  INSERT INTO public.purchases (
    id, organization_id, supplier_id, bank_account_id, financial_transaction_id,
    purchase_date, total_amount, payment_status, invoice_number, payment_date,
    due_date, notes, items, created_at, created_by, updated_at, updated_by,
    deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'purchase:' || src.legacy_purchase_id),
    organizations.id,
    suppliers.id,
    bank_accounts.id,
    NULL,
    COALESCE(NULLIF(src.purchase_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE),
    COALESCE(NULLIF(src.total_amount, '')::numeric, 0),
    CASE src.payment_status WHEN 'pago' THEN 'paid' ELSE 'pending' END,
    NULLIF(src.invoice_number, ''),
    NULLIF(src.payment_date, '')::date,
    NULLIF(src.due_date, '')::date,
    NULLIF(src.notes, ''),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', CASE WHEN COALESCE(item->>'peca_id', '') <> '' THEN uuid_generate_v5(v_namespace, 'part:' || (item->>'peca_id')) ELSE NULL END,
        'description', item->>'descricao',
        'quantity', COALESCE(NULLIF(item->>'quantidade', '')::numeric, 1),
        'unit_cost_price', COALESCE(NULLIF(item->>'valor_custo_unitario', '')::numeric, 0),
        'unit_sale_price', COALESCE(NULLIF(item->>'valor_venda_unitario', '')::numeric, 0),
        'total_item_price', COALESCE(NULLIF(item->>'valor_total_item', '')::numeric, 0),
        'add_to_stock', COALESCE(NULLIF(item->>'adicionar_estoque', '')::boolean, false)
      ))
      FROM jsonb_array_elements(COALESCE(NULLIF(src.items, '')::jsonb, '[]'::jsonb)) AS item
    ), '[]'::jsonb),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_purchase_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.suppliers AS suppliers
    ON suppliers.id = uuid_generate_v5(v_namespace, 'supplier:' || src.legacy_supplier_id)
  JOIN public.bank_accounts AS bank_accounts
    ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_supplier_id <> ''
    AND src.legacy_bank_account_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    supplier_id = EXCLUDED.supplier_id,
    bank_account_id = EXCLUDED.bank_account_id,
    purchase_date = EXCLUDED.purchase_date,
    total_amount = EXCLUDED.total_amount,
    payment_status = EXCLUDED.payment_status,
    invoice_number = EXCLUDED.invoice_number,
    payment_date = EXCLUDED.payment_date,
    due_date = EXCLUDED.due_date,
    notes = EXCLUDED.notes,
    items = EXCLUDED.items,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  INSERT INTO public.business_analyses (
    id, organization_id, title, analysis_date, business_score,
    executive_summary, strengths, improvement_areas, growth_strategies,
    financial_analysis, customer_analysis, base_data, created_at, created_by,
    updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'business_analysis:' || src.legacy_business_analysis_id),
    organizations.id,
    LEFT(COALESCE(NULLIF(src.title, ''), 'Analise de negocio'), 200),
    COALESCE(NULLIF(src.analysis_date, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    LEAST(GREATEST(COALESCE(NULLIF(src.business_score, '')::int, 0), 0), 100),
    COALESCE(NULLIF(src.executive_summary, ''), 'Importado do Base44'),
    COALESCE(NULLIF(src.strengths, '')::jsonb, '[]'::jsonb),
    COALESCE(NULLIF(src.improvement_areas, '')::jsonb, '[]'::jsonb),
    COALESCE(NULLIF(src.growth_strategies, '')::jsonb, '[]'::jsonb),
    NULLIF(src.financial_analysis, ''),
    NULLIF(src.customer_analysis, ''),
    COALESCE(NULLIF(src.base_data, '')::jsonb, '{}'::jsonb),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_business_analysis_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  WHERE src.legacy_org_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    title = EXCLUDED.title,
    analysis_date = EXCLUDED.analysis_date,
    business_score = EXCLUDED.business_score,
    executive_summary = EXCLUDED.executive_summary,
    strengths = EXCLUDED.strengths,
    improvement_areas = EXCLUDED.improvement_areas,
    growth_strategies = EXCLUDED.growth_strategies,
    financial_analysis = EXCLUDED.financial_analysis,
    customer_analysis = EXCLUDED.customer_analysis,
    base_data = EXCLUDED.base_data,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  INSERT INTO public.purchase_returns (
    id, organization_id, purchase_id, supplier_id, financial_transaction_id,
    bank_account_id, return_date, reason, status, total_returned_amount,
    returned_items, generated_financial_credit, notes, created_at, created_by,
    updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'purchase_return:' || src.legacy_purchase_return_id),
    organizations.id,
    purchases.id,
    suppliers.id,
    NULL,
    bank_accounts.id,
    COALESCE(NULLIF(src.return_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE),
    CASE src.reason
      WHEN 'garantia' THEN 'warranty'
      WHEN 'peca_errada' THEN 'wrong_part'
      WHEN 'defeito_fabricacao' THEN 'manufacturing_defect'
      WHEN 'produto_danificado' THEN 'damaged_product'
      WHEN 'nao_compativel' THEN 'incompatible'
      ELSE 'other'
    END,
    CASE src.status WHEN 'concluida' THEN 'completed' ELSE 'pending' END,
    COALESCE(NULLIF(src.total_returned_amount, '')::numeric, 0),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', CASE WHEN COALESCE(item->>'peca_id', '') <> '' THEN uuid_generate_v5(v_namespace, 'part:' || (item->>'peca_id')) ELSE NULL END,
        'description', item->>'descricao',
        'quantity', COALESCE(NULLIF(item->>'quantidade', '')::numeric, 1),
        'unit_cost_price', COALESCE(NULLIF(item->>'valor_custo_unitario', '')::numeric, 0),
        'total_item_price', COALESCE(NULLIF(item->>'valor_total_item', '')::numeric, 0)
      ))
      FROM jsonb_array_elements(COALESCE(NULLIF(src.returned_items, '')::jsonb, '[]'::jsonb)) AS item
    ), '[]'::jsonb),
    COALESCE(NULLIF(src.generated_financial_credit, '')::boolean, false),
    NULLIF(src.notes, ''),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_purchase_return_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.purchases AS purchases
    ON purchases.id = uuid_generate_v5(v_namespace, 'purchase:' || src.legacy_purchase_id)
  JOIN public.suppliers AS suppliers
    ON suppliers.id = uuid_generate_v5(v_namespace, 'supplier:' || src.legacy_supplier_id)
  LEFT JOIN public.bank_accounts AS bank_accounts
    ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_purchase_id <> ''
    AND src.legacy_supplier_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    purchase_id = EXCLUDED.purchase_id,
    supplier_id = EXCLUDED.supplier_id,
    bank_account_id = EXCLUDED.bank_account_id,
    return_date = EXCLUDED.return_date,
    reason = EXCLUDED.reason,
    status = EXCLUDED.status,
    total_returned_amount = EXCLUDED.total_returned_amount,
    returned_items = EXCLUDED.returned_items,
    generated_financial_credit = EXCLUDED.generated_financial_credit,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  INSERT INTO public.bank_account_statements (
    id, organization_id, bank_account_id, transaction_date, description,
    transaction_type, amount, previous_balance, new_balance,
    financial_transaction_id, notes, created_at, created_by, updated_at,
    updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'bank_account_statement:' || src.legacy_bank_statement_id),
    organizations.id,
    bank_accounts.id,
    COALESCE(NULLIF(src.transaction_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE),
    LEFT(COALESCE(NULLIF(src.description, ''), 'Movimentacao bancaria'), 300),
    CASE src.transaction_type WHEN 'entrada' THEN 'income' WHEN 'transferencia_entrada' THEN 'transfer_in' WHEN 'transferencia_saida' THEN 'transfer_out' ELSE 'expense' END,
    COALESCE(NULLIF(src.amount, '')::numeric, 0),
    COALESCE(NULLIF(src.previous_balance, '')::numeric, 0),
    COALESCE(NULLIF(src.new_balance, '')::numeric, 0),
    NULL,
    NULLIF(src.notes, ''),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_bank_statement_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.bank_accounts AS bank_accounts
    ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_bank_account_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    bank_account_id = EXCLUDED.bank_account_id,
    transaction_date = EXCLUDED.transaction_date,
    description = EXCLUDED.description,
    transaction_type = EXCLUDED.transaction_type,
    amount = EXCLUDED.amount,
    previous_balance = EXCLUDED.previous_balance,
    new_balance = EXCLUDED.new_balance,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  RAISE NOTICE 'Skipped % appointments without resolvable organization, client, or vehicle.', (
    SELECT count(*)
    FROM tmp_appointment_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.clients AS clients
      ON clients.id = uuid_generate_v5(v_namespace, 'client:' || src.legacy_client_id)
    LEFT JOIN public.vehicles AS vehicles
      ON vehicles.id = uuid_generate_v5(v_namespace, 'vehicle:' || src.legacy_vehicle_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_client_id = ''
       OR src.legacy_vehicle_id = ''
       OR organizations.id IS NULL
       OR clients.id IS NULL
       OR vehicles.id IS NULL
  );

  RAISE NOTICE 'Skipped % purchases without resolvable organization, supplier, or bank account.', (
    SELECT count(*)
    FROM tmp_purchase_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.suppliers AS suppliers
      ON suppliers.id = uuid_generate_v5(v_namespace, 'supplier:' || src.legacy_supplier_id)
    LEFT JOIN public.bank_accounts AS bank_accounts
      ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_supplier_id = ''
       OR src.legacy_bank_account_id = ''
       OR organizations.id IS NULL
       OR suppliers.id IS NULL
       OR bank_accounts.id IS NULL
  );

  RAISE NOTICE 'Skipped % business analyses without resolvable organization.', (
    SELECT count(*)
    FROM tmp_business_analysis_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    WHERE src.legacy_org_id = ''
       OR organizations.id IS NULL
  );

  RAISE NOTICE 'Skipped % purchase returns without resolvable organization, purchase, or supplier.', (
    SELECT count(*)
    FROM tmp_purchase_return_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.purchases AS purchases
      ON purchases.id = uuid_generate_v5(v_namespace, 'purchase:' || src.legacy_purchase_id)
    LEFT JOIN public.suppliers AS suppliers
      ON suppliers.id = uuid_generate_v5(v_namespace, 'supplier:' || src.legacy_supplier_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_purchase_id = ''
       OR src.legacy_supplier_id = ''
       OR organizations.id IS NULL
       OR purchases.id IS NULL
       OR suppliers.id IS NULL
  );

  RAISE NOTICE 'Skipped % bank account statements without resolvable organization or bank account.', (
    SELECT count(*)
    FROM tmp_bank_statement_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.bank_accounts AS bank_accounts
      ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_bank_account_id = ''
       OR organizations.id IS NULL
       OR bank_accounts.id IS NULL
  );
END $$;
