-- =============================================================================
-- Seeder: 006_service_financial_seed.sql
-- Description: Migrates service orders, installments, employee financial records,
--              financial transactions, and service order edit logs from Base44
--              exports after identity, catalog, and master-product seeds.
-- =============================================================================

DO $$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
BEGIN
  CREATE TEMP TABLE tmp_service_order_source (
    legacy_service_order_id text PRIMARY KEY,
    legacy_org_id text,
    legacy_vehicle_id text,
    legacy_number text,
    discount text,
    expected_payment_date text,
    apply_taxes text,
    active_nfse_id text,
    responsible_employees text,
    commission_amount text,
    terminal_fee_amount text,
    reported_defect text,
    payment_method text,
    nfe_ids text,
    expected_date text,
    items text,
    active_nfe_id text,
    total_cost_amount text,
    selected_taxes text,
    total_taxes_amount text,
    completion_date text,
    legacy_appointment_id text,
    total_amount text,
    entry_date text,
    notes text,
    nfse_ids text,
    diagnosis text,
    legacy_employee_responsible_id text,
    is_installment text,
    payment_status text,
    installment_count text,
    legacy_client_id text,
    legacy_master_product_id text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_service_order_source
  SELECT * FROM jsonb_to_recordset($service_orders$__SERVICE_ORDERS_JSON__$service_orders$::jsonb) AS src(
    legacy_service_order_id text,
    legacy_org_id text,
    legacy_vehicle_id text,
    legacy_number text,
    discount text,
    expected_payment_date text,
    apply_taxes text,
    active_nfse_id text,
    responsible_employees text,
    commission_amount text,
    terminal_fee_amount text,
    reported_defect text,
    payment_method text,
    nfe_ids text,
    expected_date text,
    items text,
    active_nfe_id text,
    total_cost_amount text,
    selected_taxes text,
    total_taxes_amount text,
    completion_date text,
    legacy_appointment_id text,
    total_amount text,
    entry_date text,
    notes text,
    nfse_ids text,
    diagnosis text,
    legacy_employee_responsible_id text,
    is_installment text,
    payment_status text,
    installment_count text,
    legacy_client_id text,
    legacy_master_product_id text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_service_order_installment_source (
    legacy_installment_id text PRIMARY KEY,
    legacy_service_order_id text,
    payment_method text,
    notes text,
    installment_number text,
    legacy_org_id text,
    payment_date text,
    installment_amount text,
    due_date text,
    status text,
    legacy_financial_transaction_id text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_service_order_installment_source
  SELECT * FROM jsonb_to_recordset($installments$__INSTALLMENTS_JSON__$installments$::jsonb) AS src(
    legacy_installment_id text,
    legacy_service_order_id text,
    payment_method text,
    notes text,
    installment_number text,
    legacy_org_id text,
    payment_date text,
    installment_amount text,
    due_date text,
    status text,
    legacy_financial_transaction_id text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_employee_financial_record_source (
    legacy_employee_financial_record_id text PRIMARY KEY,
    legacy_service_order_id text,
    legacy_installment_id text,
    legacy_org_id text,
    amount text,
    payment_date text,
    legacy_employee_id text,
    record_type text,
    description text,
    reference_date text,
    status text,
    legacy_financial_transaction_id text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_employee_financial_record_source
  SELECT * FROM jsonb_to_recordset($employee_financial_records$__EMPLOYEE_FINANCIAL_RECORDS_JSON__$employee_financial_records$::jsonb) AS src(
    legacy_employee_financial_record_id text,
    legacy_service_order_id text,
    legacy_installment_id text,
    legacy_org_id text,
    amount text,
    payment_date text,
    legacy_employee_id text,
    record_type text,
    description text,
    reference_date text,
    status text,
    legacy_financial_transaction_id text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_financial_transaction_source (
    legacy_financial_transaction_id text PRIMARY KEY,
    legacy_installment_id text,
    type text,
    current_installment text,
    legacy_employee_financial_record_id text,
    category text,
    amount text,
    due_date text,
    description text,
    recurrence text,
    legacy_purchase_id text,
    notes text,
    legacy_parent_transaction_id text,
    legacy_bank_account_id text,
    legacy_parent_recurrence_id text,
    legacy_org_id text,
    is_installment text,
    recurrence_end_date text,
    installment_count text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_financial_transaction_source
  SELECT * FROM jsonb_to_recordset($financial_transactions$__FINANCIAL_TRANSACTIONS_JSON__$financial_transactions$::jsonb) AS src(
    legacy_financial_transaction_id text,
    legacy_installment_id text,
    type text,
    current_installment text,
    legacy_employee_financial_record_id text,
    category text,
    amount text,
    due_date text,
    description text,
    recurrence text,
    legacy_purchase_id text,
    notes text,
    legacy_parent_transaction_id text,
    legacy_bank_account_id text,
    legacy_parent_recurrence_id text,
    legacy_org_id text,
    is_installment text,
    recurrence_end_date text,
    installment_count text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_service_order_edit_log_source (
    legacy_log_id text PRIMARY KEY,
    legacy_service_order_id text,
    user_name text,
    notes text,
    data_after text,
    legacy_org_id text,
    operation_type text,
    data_before text,
    legacy_correction_id text,
    service_order_number text,
    user_email text,
    changed_fields text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_service_order_edit_log_source
  SELECT * FROM jsonb_to_recordset($service_order_edit_logs$__SERVICE_ORDER_EDIT_LOGS_JSON__$service_order_edit_logs$::jsonb) AS src(
    legacy_log_id text,
    legacy_service_order_id text,
    user_name text,
    notes text,
    data_after text,
    legacy_org_id text,
    operation_type text,
    data_before text,
    legacy_correction_id text,
    service_order_number text,
    user_email text,
    changed_fields text,
    created_at text,
    updated_at text,
    created_by text
  );

  INSERT INTO public.service_orders (
    id, organization_id, number, client_id, vehicle_id, entry_date,
    expected_date, expected_payment_date, completion_date, master_product_id,
    employee_responsible_id, appointment_id, responsible_employees, status,
    payment_status, payment_method, is_installment, installment_count,
    reported_defect, diagnosis, items, apply_taxes, selected_taxes,
    total_taxes_amount, total_amount, total_cost_amount, discount,
    commission_amount, terminal_fee_amount, active_nfe_id, nfe_ids,
    active_nfse_id, nfse_ids, notes, created_at, created_by, updated_at,
    updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id),
    organizations.id,
    src.legacy_number,
    clients.id,
    vehicles.id,
    COALESCE(NULLIF(src.entry_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE),
    NULLIF(src.expected_date, '')::date,
    NULLIF(src.expected_payment_date, '')::date,
    NULLIF(src.completion_date, '')::date,
    master_products.id,
    employees.id,
    appointments.id,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('employee_id', uuid_generate_v5(v_namespace, 'employee:' || (elem->>'funcionario_id'))))
      FROM jsonb_array_elements(COALESCE(NULLIF(src.responsible_employees, '')::jsonb, '[]'::jsonb)) AS elem
      WHERE COALESCE(elem->>'funcionario_id', '') <> ''
    ), '[]'::jsonb),
    CASE src.status
      WHEN 'orcamento' THEN 'estimate'
      WHEN 'aberta' THEN 'open'
      WHEN 'em_andamento' THEN 'in_progress'
      WHEN 'aguardando_peca' THEN 'waiting_for_part'
      WHEN 'concluida' THEN 'completed'
      WHEN 'entregue' THEN 'delivered'
      WHEN 'cancelada' THEN 'cancelled'
      ELSE 'estimate'
    END,
    CASE src.payment_status
      WHEN 'pago' THEN 'paid'
      WHEN 'parcial' THEN 'partial'
      WHEN 'pendente' THEN 'pending'
      ELSE 'pending'
    END,
    CASE src.payment_method
      WHEN 'pix' THEN 'pix'
      WHEN 'dinheiro' THEN 'cash'
      WHEN 'cartao_credito' THEN 'credit_card'
      WHEN 'cartao_debito' THEN 'debit_card'
      WHEN 'cheque' THEN 'check'
      WHEN 'boleto' THEN 'bank_slip'
      WHEN 'transferencia' THEN 'transfer'
      WHEN 'sem_forma_pagamento' THEN 'no_payment'
      ELSE NULL
    END,
    COALESCE(NULLIF(src.is_installment, '')::boolean, false),
    NULLIF(src.installment_count, '')::int,
    NULLIF(src.reported_defect, ''),
    NULLIF(src.diagnosis, ''),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product_id', CASE WHEN COALESCE(item->>'produto_id', '') <> '' THEN uuid_generate_v5(v_namespace, 'product:' || (item->>'produto_id')) ELSE NULL END,
        'description', item->>'descricao',
        'quantity', COALESCE(NULLIF(item->>'quantidade', '')::numeric, 1),
        'unit_price', COALESCE(NULLIF(item->>'valor_unitario', '')::numeric, 0),
        'cost_price', COALESCE(NULLIF(item->>'valor_custo', '')::numeric, 0),
        'total_price', COALESCE(NULLIF(item->>'valor_total', '')::numeric, 0),
        'total_commission', COALESCE(NULLIF(item->>'comissao_total', '')::numeric, 0),
        'commissions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'employee_id', CASE WHEN COALESCE(commission->>'funcionario_id', '') <> '' THEN uuid_generate_v5(v_namespace, 'employee:' || (commission->>'funcionario_id')) ELSE NULL END,
            'amount', COALESCE(NULLIF(commission->>'valor', '')::numeric, 0),
            'type', CASE commission->>'tipo' WHEN 'percentual' THEN 'percentage' WHEN 'fixo' THEN 'fixed_amount' ELSE commission->>'tipo' END,
            'base', CASE commission->>'base' WHEN 'lucro' THEN 'profit' WHEN 'venda' THEN 'revenue' WHEN 'receita' THEN 'revenue' ELSE commission->>'base' END,
            'percentage', NULLIF(commission->>'percentual', '')::numeric
          ))
          FROM jsonb_array_elements(COALESCE(item->'comissoes', '[]'::jsonb)) AS commission
        ), '[]'::jsonb)
      ))
      FROM jsonb_array_elements(COALESCE(NULLIF(src.items, '')::jsonb, '[]'::jsonb)) AS item
    ), '[]'::jsonb),
    COALESCE(NULLIF(src.apply_taxes, '')::boolean, false),
    COALESCE(NULLIF(src.selected_taxes, '')::jsonb, '[]'::jsonb),
    COALESCE(NULLIF(src.total_taxes_amount, '')::numeric, 0),
    COALESCE(NULLIF(src.total_amount, '')::numeric, 0),
    COALESCE(NULLIF(src.total_cost_amount, '')::numeric, 0),
    COALESCE(NULLIF(src.discount, '')::numeric, 0),
    COALESCE(NULLIF(src.commission_amount, '')::numeric, 0),
    COALESCE(NULLIF(src.terminal_fee_amount, '')::numeric, 0),
    NULL,
    NULLIF(src.nfe_ids, ''),
    NULL,
    NULLIF(src.nfse_ids, ''),
    NULLIF(src.notes, ''),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_service_order_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.clients AS clients
    ON clients.id = uuid_generate_v5(v_namespace, 'client:' || src.legacy_client_id)
  LEFT JOIN public.vehicles AS vehicles
    ON vehicles.id = uuid_generate_v5(v_namespace, 'vehicle:' || src.legacy_vehicle_id)
  LEFT JOIN public.master_products AS master_products
    ON master_products.id = uuid_generate_v5(v_namespace, 'master_product:' || src.legacy_master_product_id)
  LEFT JOIN public.employees AS employees
    ON employees.id = uuid_generate_v5(v_namespace, 'employee:' || src.legacy_employee_responsible_id)
  LEFT JOIN public.appointments AS appointments
    ON appointments.id = uuid_generate_v5(v_namespace, 'appointment:' || src.legacy_appointment_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_number <> ''
    AND src.legacy_client_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    number = EXCLUDED.number,
    client_id = EXCLUDED.client_id,
    vehicle_id = EXCLUDED.vehicle_id,
    entry_date = EXCLUDED.entry_date,
    expected_date = EXCLUDED.expected_date,
    expected_payment_date = EXCLUDED.expected_payment_date,
    completion_date = EXCLUDED.completion_date,
    master_product_id = EXCLUDED.master_product_id,
    employee_responsible_id = EXCLUDED.employee_responsible_id,
    appointment_id = EXCLUDED.appointment_id,
    responsible_employees = EXCLUDED.responsible_employees,
    status = EXCLUDED.status,
    payment_status = EXCLUDED.payment_status,
    payment_method = EXCLUDED.payment_method,
    is_installment = EXCLUDED.is_installment,
    installment_count = EXCLUDED.installment_count,
    reported_defect = EXCLUDED.reported_defect,
    diagnosis = EXCLUDED.diagnosis,
    items = EXCLUDED.items,
    apply_taxes = EXCLUDED.apply_taxes,
    selected_taxes = EXCLUDED.selected_taxes,
    total_taxes_amount = EXCLUDED.total_taxes_amount,
    total_amount = EXCLUDED.total_amount,
    total_cost_amount = EXCLUDED.total_cost_amount,
    discount = EXCLUDED.discount,
    commission_amount = EXCLUDED.commission_amount,
    terminal_fee_amount = EXCLUDED.terminal_fee_amount,
    nfe_ids = EXCLUDED.nfe_ids,
    nfse_ids = EXCLUDED.nfse_ids,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;


  WITH installment_rows AS (
    SELECT
      uuid_generate_v5(v_namespace, 'service_order_installment:' || src.legacy_installment_id) AS id,
      organizations.id AS organization_id,
      service_orders.id AS service_order_id,
      NULLIF(src.installment_number, '')::int AS installment_number,
      COALESCE(NULLIF(src.installment_amount, '')::numeric, 0) AS installment_amount,
      COALESCE(NULLIF(src.due_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE) AS due_date,
      NULLIF(src.payment_date, '')::date AS payment_date,
      CASE src.status WHEN 'pago' THEN 'paid' WHEN 'vencido' THEN 'overdue' ELSE 'pending' END AS status,
      CASE src.payment_method
        WHEN 'pix' THEN 'pix'
        WHEN 'dinheiro' THEN 'cash'
        WHEN 'cartao_credito' THEN 'credit_card'
        WHEN 'cartao_debito' THEN 'debit_card'
        WHEN 'cheque' THEN 'check'
        WHEN 'boleto' THEN 'bank_slip'
        WHEN 'transferencia' THEN 'transfer'
        ELSE NULL
      END AS payment_method,
      NULLIF(src.notes, '') AS notes,
      COALESCE(NULLIF(src.created_at, '')::timestamptz, now()) AS created_at,
      NULLIF(src.created_by, '') AS created_by,
      COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()) AS updated_at,
      row_number() OVER (
        PARTITION BY service_orders.id, NULLIF(src.installment_number, '')::int
        ORDER BY COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, '-infinity'::timestamptz) DESC,
                 src.legacy_installment_id DESC
      ) AS rn
    FROM tmp_service_order_installment_source AS src
    JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    JOIN public.service_orders AS service_orders
      ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
    WHERE src.legacy_org_id <> ''
      AND src.legacy_service_order_id <> ''
      AND src.installment_number <> ''
  )
  INSERT INTO public.service_order_installments (
    id, organization_id, service_order_id, installment_number, installment_amount,
    due_date, payment_date, status, payment_method, financial_transaction_id,
    notes, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    id, organization_id, service_order_id, installment_number, installment_amount,
    due_date, payment_date, status, payment_method, NULL,
    notes, created_at, created_by, updated_at, created_by, NULL, NULL
  FROM installment_rows
  WHERE rn = 1
  ON CONFLICT (service_order_id, installment_number) DO UPDATE
  SET
    installment_amount = EXCLUDED.installment_amount,
    due_date = EXCLUDED.due_date,
    payment_date = EXCLUDED.payment_date,
    status = EXCLUDED.status,
    payment_method = EXCLUDED.payment_method,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  INSERT INTO public.employee_financial_records (
    id, organization_id, employee_id, service_order_id, service_order_installment_id,
    financial_transaction_id, record_type, description, amount, reference_date,
    status, payment_date, created_at, created_by, updated_at, updated_by,
    deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'employee_financial_record:' || src.legacy_employee_financial_record_id),
    organizations.id,
    employees.id,
    service_orders.id,
    installments.id,
    NULL,
    CASE src.record_type
      WHEN 'salario' THEN 'salary'
      WHEN 'comissao' THEN 'commission'
      WHEN 'adiantamento' THEN 'advance'
      WHEN 'bonus' THEN 'bonus'
      WHEN 'desconto' THEN 'discount'
      ELSE 'commission'
    END,
    LEFT(COALESCE(NULLIF(src.description, ''), 'Registro financeiro de funcionario'), 300),
    COALESCE(NULLIF(src.amount, '')::numeric, 0),
    COALESCE(NULLIF(src.reference_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE),
    CASE src.status WHEN 'pago' THEN 'paid' ELSE 'pending' END,
    NULLIF(src.payment_date, '')::date,
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_employee_financial_record_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.employees AS employees
    ON employees.id = uuid_generate_v5(v_namespace, 'employee:' || src.legacy_employee_id)
  LEFT JOIN public.service_orders AS service_orders
    ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
  LEFT JOIN tmp_service_order_installment_source AS installment_src
    ON installment_src.legacy_installment_id = src.legacy_installment_id
  LEFT JOIN public.service_orders AS installment_service_orders
    ON installment_service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || installment_src.legacy_service_order_id)
  LEFT JOIN public.service_order_installments AS installments
    ON installments.service_order_id = installment_service_orders.id
   AND installments.installment_number = NULLIF(installment_src.installment_number, '')::int
  WHERE src.legacy_org_id <> ''
    AND src.legacy_employee_id <> ''
    AND src.amount <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    employee_id = EXCLUDED.employee_id,
    service_order_id = EXCLUDED.service_order_id,
    service_order_installment_id = EXCLUDED.service_order_installment_id,
    record_type = EXCLUDED.record_type,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    reference_date = EXCLUDED.reference_date,
    status = EXCLUDED.status,
    payment_date = EXCLUDED.payment_date,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  INSERT INTO public.financial_transactions (
    id, organization_id, description, amount, due_date, type, status, category,
    recurrence, recurrence_end_date, parent_recurrence_id, is_installment,
    installment_count, current_installment, parent_transaction_id,
    employee_financial_record_id, bank_account_id, service_order_installment_id,
    purchase_id, service_order_id, payment_method, notes, created_at, created_by,
    updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_financial_transaction_id),
    organizations.id,
    LEFT(COALESCE(NULLIF(src.description, ''), 'Lancamento financeiro'), 300),
    COALESCE(NULLIF(src.amount, '')::numeric, 0),
    COALESCE(NULLIF(src.due_date, '')::date, NULLIF(src.created_at, '')::date, CURRENT_DATE),
    CASE src.type
      WHEN 'entrada' THEN 'income'
      WHEN 'saida' THEN 'expense'
      WHEN 'transferencia_entrada' THEN 'transfer_in'
      WHEN 'transferencia_saida' THEN 'transfer_out'
      ELSE 'expense'
    END,
    CASE src.status WHEN 'pago' THEN 'paid' WHEN 'cancelado' THEN 'cancelled' ELSE 'pending' END,
    CASE
      WHEN lower(src.category) = 'vendas' THEN 'sales'
      WHEN lower(src.category) LIKE 'servi%' THEN 'services'
      WHEN lower(src.category) = 'aluguel' THEN 'rent'
      WHEN lower(src.category) LIKE 'sal%' OR lower(src.category) IN ('custo com pessoal', 'prolabore') THEN 'salaries'
      WHEN lower(src.category) IN ('fornecedores', 'terceirizado') OR lower(src.category) LIKE 'pe%' THEN 'suppliers'
      WHEN lower(src.category) = 'impostos' THEN 'taxes'
      WHEN lower(src.category) = 'marketing' THEN 'marketing'
      ELSE 'other'
    END,
    CASE src.recurrence WHEN 'nao_recorrente' THEN 'non_recurring' WHEN 'mensal' THEN 'monthly' WHEN 'anual' THEN 'annual' ELSE NULL END,
    NULLIF(src.recurrence_end_date, '')::date,
    NULL,
    COALESCE(NULLIF(src.is_installment, '')::boolean, false),
    NULLIF(src.installment_count, '')::int,
    NULLIF(src.current_installment, '')::int,
    NULL,
    employee_records.id,
    bank_accounts.id,
    installments.id,
    purchases.id,
    COALESCE(installment_orders.id, employee_records.service_order_id),
    NULL,
    NULLIF(src.notes, ''),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_financial_transaction_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  LEFT JOIN public.employee_financial_records AS employee_records
    ON employee_records.id = uuid_generate_v5(v_namespace, 'employee_financial_record:' || src.legacy_employee_financial_record_id)
  LEFT JOIN tmp_service_order_installment_source AS installment_src
    ON installment_src.legacy_installment_id = src.legacy_installment_id
  LEFT JOIN public.service_orders AS installment_orders
    ON installment_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || installment_src.legacy_service_order_id)
  LEFT JOIN public.service_order_installments AS installments
    ON installments.service_order_id = installment_orders.id
   AND installments.installment_number = NULLIF(installment_src.installment_number, '')::int
  LEFT JOIN public.bank_accounts AS bank_accounts
    ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
  LEFT JOIN public.purchases AS purchases
    ON purchases.id = uuid_generate_v5(v_namespace, 'purchase:' || src.legacy_purchase_id)
  WHERE src.legacy_org_id <> ''
    AND src.description <> ''
    AND src.amount <> ''
    AND src.due_date <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    due_date = EXCLUDED.due_date,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    recurrence = EXCLUDED.recurrence,
    recurrence_end_date = EXCLUDED.recurrence_end_date,
    is_installment = EXCLUDED.is_installment,
    installment_count = EXCLUDED.installment_count,
    current_installment = EXCLUDED.current_installment,
    employee_financial_record_id = EXCLUDED.employee_financial_record_id,
    bank_account_id = EXCLUDED.bank_account_id,
    service_order_installment_id = EXCLUDED.service_order_installment_id,
    purchase_id = EXCLUDED.purchase_id,
    service_order_id = EXCLUDED.service_order_id,
    payment_method = EXCLUDED.payment_method,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  UPDATE public.purchases AS purchases
  SET
    financial_transaction_id = financial_transactions.id,
    updated_at = financial_transactions.updated_at,
    updated_by = financial_transactions.updated_by
  FROM tmp_financial_transaction_source AS src
  JOIN public.financial_transactions AS financial_transactions
    ON financial_transactions.id = uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_financial_transaction_id)
  WHERE purchases.id = uuid_generate_v5(v_namespace, 'purchase:' || src.legacy_purchase_id)
    AND COALESCE(src.legacy_purchase_id, '') <> '';

  UPDATE public.financial_transactions AS ft
  SET parent_recurrence_id = parent_ft.id
  FROM tmp_financial_transaction_source AS src
  JOIN public.financial_transactions AS parent_ft
    ON parent_ft.id = uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_parent_recurrence_id)
  WHERE ft.id = uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_financial_transaction_id)
    AND COALESCE(src.legacy_parent_recurrence_id, '') <> '';

  UPDATE public.financial_transactions AS ft
  SET parent_transaction_id = parent_ft.id
  FROM tmp_financial_transaction_source AS src
  JOIN public.financial_transactions AS parent_ft
    ON parent_ft.id = uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_parent_transaction_id)
  WHERE ft.id = uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_financial_transaction_id)
    AND COALESCE(src.legacy_parent_transaction_id, '') <> '';

  UPDATE public.service_order_installments AS installments
  SET financial_transaction_id = financial_transactions.id
  FROM tmp_service_order_installment_source AS src
  JOIN public.service_orders AS service_orders
    ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
  JOIN public.financial_transactions AS financial_transactions
    ON financial_transactions.id = uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_financial_transaction_id)
  WHERE installments.service_order_id = service_orders.id
    AND installments.installment_number = NULLIF(src.installment_number, '')::int
    AND COALESCE(src.legacy_financial_transaction_id, '') <> '';

  UPDATE public.employee_financial_records AS records
  SET financial_transaction_id = financial_transactions.id
  FROM tmp_employee_financial_record_source AS src
  JOIN public.financial_transactions AS financial_transactions
    ON financial_transactions.id = uuid_generate_v5(v_namespace, 'financial_transaction:' || src.legacy_financial_transaction_id)
  WHERE records.id = uuid_generate_v5(v_namespace, 'employee_financial_record:' || src.legacy_employee_financial_record_id)
    AND COALESCE(src.legacy_financial_transaction_id, '') <> '';

  INSERT INTO public.service_order_edit_logs (
    id, organization_id, service_order_id, operation_type, user_email, user_name,
    service_order_number, data_before, data_after, changed_fields, correction_id,
    notes, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'service_order_edit_log:' || src.legacy_log_id),
    organizations.id,
    service_orders.id,
    CASE src.operation_type
      WHEN 'criacao' THEN 'creation'
      WHEN 'edicao' THEN 'edit'
      WHEN 'correcao' THEN 'correction'
      WHEN 'cancelamento' THEN 'cancellation'
      ELSE 'edit'
    END,
    COALESCE(NULLIF(src.user_email, ''), NULLIF(src.created_by, ''), 'migration@autopro.local'),
    NULLIF(src.user_name, ''),
    NULLIF(src.service_order_number, ''),
    NULLIF(src.data_before, ''),
    NULLIF(src.data_after, ''),
    NULLIF(src.changed_fields, ''),
    correction_requests.id,
    NULLIF(src.notes, ''),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_service_order_edit_log_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.service_orders AS service_orders
    ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
  LEFT JOIN public.service_order_correction_requests AS correction_requests
    ON correction_requests.id = uuid_generate_v5(v_namespace, 'service_order_correction_request:' || src.legacy_correction_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_service_order_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    service_order_id = EXCLUDED.service_order_id,
    operation_type = EXCLUDED.operation_type,
    user_email = EXCLUDED.user_email,
    user_name = EXCLUDED.user_name,
    service_order_number = EXCLUDED.service_order_number,
    data_before = EXCLUDED.data_before,
    data_after = EXCLUDED.data_after,
    changed_fields = EXCLUDED.changed_fields,
    correction_id = EXCLUDED.correction_id,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

  RAISE NOTICE 'Skipped % service orders without resolvable organization, client, or number.', (
    SELECT count(*)
    FROM tmp_service_order_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.clients AS clients
      ON clients.id = uuid_generate_v5(v_namespace, 'client:' || src.legacy_client_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_number = ''
       OR src.legacy_client_id = ''
       OR organizations.id IS NULL
       OR clients.id IS NULL
  );

  RAISE NOTICE 'Skipped % service order installments without resolvable organization, service order, or number.', (
    SELECT count(*)
    FROM tmp_service_order_installment_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.service_orders AS service_orders
      ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_service_order_id = ''
       OR src.installment_number = ''
       OR organizations.id IS NULL
       OR service_orders.id IS NULL
  );

  RAISE NOTICE 'Skipped % employee financial records without resolvable organization, employee, or amount.', (
    SELECT count(*)
    FROM tmp_employee_financial_record_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.employees AS employees
      ON employees.id = uuid_generate_v5(v_namespace, 'employee:' || src.legacy_employee_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_employee_id = ''
       OR src.amount = ''
       OR organizations.id IS NULL
       OR employees.id IS NULL
  );

  RAISE NOTICE 'Skipped % financial transactions without resolvable organization or required fields.', (
    SELECT count(*)
    FROM tmp_financial_transaction_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    WHERE src.legacy_org_id = ''
       OR src.description = ''
       OR src.amount = ''
       OR src.due_date = ''
       OR organizations.id IS NULL
  );

  RAISE NOTICE 'Skipped % service order edit logs without resolvable organization or service order.', (
    SELECT count(*)
    FROM tmp_service_order_edit_log_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.service_orders AS service_orders
      ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_service_order_id = ''
       OR organizations.id IS NULL
       OR service_orders.id IS NULL
  );
END $$;
