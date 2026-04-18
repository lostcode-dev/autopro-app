-- =============================================================================
-- Seed: reports_demo_seed.sql
-- Purpose: Insert demo data for the reports pages.
--
-- Covered pages:
-- - /app/reports
-- - /app/reports/commissions
-- - /app/reports/customers
-- - /app/reports/debtors
-- - /app/reports/costs
-- - /app/reports/profit
-- - /app/reports/purchases
-- - /app/reports/suppliers
-- - /app/reports/sales-items
--
-- Required base data:
-- - clients_demo_seed.sql
-- - vehicles_demo_seed.sql
-- - settings_demo_seed.sql
-- - products_demo_seed.sql
-- - financial_demo_seed.sql or any existing active bank account
--
-- Behavior:
-- - If v_organization_id is NULL, uses the first active organization.
-- - Idempotent: removes prior report demo rows using the seed tag.
-- - Uses only English status values to stay aligned with the current schema.
-- =============================================================================

DO $$
DECLARE
  v_organization_id uuid := NULL;
  v_seed_user       text := 'seed@autopro.local';
  v_seed_tag        text := '[seed:reports-demo-v1]';

  v_bank_account_id uuid;
  v_client_ids      uuid[];
  v_vehicle_ids     uuid[];
  v_employee_ids    uuid[];
  v_product_ids     uuid[];
  v_supplier_ids    uuid[];

  v_month_start     date := date_trunc('month', current_date)::date;
  v_prev_month      date := (date_trunc('month', current_date) - interval '1 month')::date;

  v_date_1          date := greatest(date_trunc('month', current_date)::date, current_date - 14);
  v_date_2          date := greatest(date_trunc('month', current_date)::date, current_date - 11);
  v_date_3          date := greatest(date_trunc('month', current_date)::date, current_date - 8);
  v_date_4          date := greatest(date_trunc('month', current_date)::date, current_date - 6);
  v_date_5          date := greatest(date_trunc('month', current_date)::date, current_date - 4);

  v_order_1         uuid := 'd0000001-0000-0000-0000-000000000001';
  v_order_2         uuid := 'd0000001-0000-0000-0000-000000000002';
  v_order_3         uuid := 'd0000001-0000-0000-0000-000000000003';
  v_order_4         uuid := 'd0000001-0000-0000-0000-000000000004';
  v_order_5         uuid := 'd0000001-0000-0000-0000-000000000005';
  v_order_6         uuid := 'd0000001-0000-0000-0000-000000000006';
  v_order_7         uuid := 'd0000001-0000-0000-0000-000000000007';
  v_order_8         uuid := 'd0000001-0000-0000-0000-000000000008';

  v_installment_1   uuid := 'd0000002-0000-0000-0000-000000000001';
  v_installment_2   uuid := 'd0000002-0000-0000-0000-000000000002';
  v_installment_3   uuid := 'd0000002-0000-0000-0000-000000000003';
BEGIN
  IF v_organization_id IS NULL THEN
    SELECT id
      INTO v_organization_id
      FROM public.organizations
     WHERE deleted_at IS NULL
     ORDER BY created_at
     LIMIT 1;
  END IF;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create or provide an organization_id before running the seed.';
  END IF;

  SELECT id
    INTO v_bank_account_id
    FROM public.bank_accounts
   WHERE organization_id = v_organization_id
     AND deleted_at IS NULL
     AND is_active = true
   ORDER BY created_at
   LIMIT 1;

  SELECT ARRAY(
    SELECT id
      FROM public.clients
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 6
  ) INTO v_client_ids;

  SELECT ARRAY(
    SELECT id
      FROM public.vehicles
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 6
  ) INTO v_vehicle_ids;

  SELECT ARRAY(
    SELECT id
      FROM public.employees
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 4
  ) INTO v_employee_ids;

  SELECT ARRAY(
    SELECT id
      FROM public.products
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 8
  ) INTO v_product_ids;

  SELECT ARRAY(
    SELECT id
      FROM public.suppliers
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 4
  ) INTO v_supplier_ids;

  IF v_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'No active bank account found. Run financial_demo_seed.sql or products_demo_seed.sql first.';
  END IF;

  IF coalesce(array_length(v_client_ids, 1), 0) < 6 THEN
    RAISE EXCEPTION 'At least 6 clients are required. Run clients_demo_seed.sql first.';
  END IF;

  IF coalesce(array_length(v_vehicle_ids, 1), 0) < 6 THEN
    RAISE EXCEPTION 'At least 6 vehicles are required. Run vehicles_demo_seed.sql first.';
  END IF;

  IF coalesce(array_length(v_employee_ids, 1), 0) < 4 THEN
    RAISE EXCEPTION 'At least 4 employees are required. Run settings_demo_seed.sql first.';
  END IF;

  IF coalesce(array_length(v_product_ids, 1), 0) < 8 THEN
    RAISE EXCEPTION 'At least 8 products are required. Run products_demo_seed.sql first.';
  END IF;

  IF coalesce(array_length(v_supplier_ids, 1), 0) < 4 THEN
    RAISE EXCEPTION 'At least 4 suppliers are required. Run products_demo_seed.sql first.';
  END IF;

  DELETE FROM public.employee_financial_records
   WHERE organization_id = v_organization_id
     AND description LIKE v_seed_tag || '%';

  DELETE FROM public.service_order_installments
   WHERE organization_id = v_organization_id
     AND notes LIKE v_seed_tag || '%';

  DELETE FROM public.service_orders
   WHERE organization_id = v_organization_id
     AND notes LIKE v_seed_tag || '%';

  DELETE FROM public.financial_transactions
   WHERE organization_id = v_organization_id
     AND notes LIKE v_seed_tag || '%';

  DELETE FROM public.purchases
   WHERE organization_id = v_organization_id
     AND notes LIKE v_seed_tag || '%';

  -- ===========================================================================
  -- Purchases and supplier-driven report data
  -- ===========================================================================
  INSERT INTO public.purchases (
    organization_id,
    supplier_id,
    bank_account_id,
    purchase_date,
    total_amount,
    payment_status,
    invoice_number,
    payment_date,
    due_date,
    notes,
    items,
    created_by,
    updated_by
  ) VALUES
  (
    v_organization_id,
    v_supplier_ids[1],
    v_bank_account_id,
    v_date_1,
    1280.00,
    'paid',
    'REP-PO-1001',
    v_date_1 + 1,
    v_date_1,
    v_seed_tag || ' Purchase 01',
    jsonb_build_array(
      jsonb_build_object('part_id', v_product_ids[1], 'description', 'Brake pad kit', 'quantity', 4, 'unit_cost_price', 120.00, 'unit_sale_price', 180.00, 'total_item_price', 480.00, 'add_to_stock', true),
      jsonb_build_object('part_id', v_product_ids[2], 'description', 'Brake disc pair', 'quantity', 2, 'unit_cost_price', 240.00, 'unit_sale_price', 360.00, 'total_item_price', 480.00, 'add_to_stock', true),
      jsonb_build_object('part_id', v_product_ids[3], 'description', 'DOT 4 fluid', 'quantity', 4, 'unit_cost_price', 80.00, 'unit_sale_price', 120.00, 'total_item_price', 320.00, 'add_to_stock', true)
    ),
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    v_supplier_ids[2],
    v_bank_account_id,
    v_date_3,
    760.00,
    'pending',
    'REP-PO-1002',
    NULL,
    current_date + 6,
    v_seed_tag || ' Purchase 02',
    jsonb_build_array(
      jsonb_build_object('part_id', v_product_ids[4], 'description', 'Oil filter', 'quantity', 8, 'unit_cost_price', 35.00, 'unit_sale_price', 59.00, 'total_item_price', 280.00, 'add_to_stock', true),
      jsonb_build_object('part_id', v_product_ids[5], 'description', 'Synthetic oil 5W30', 'quantity', 8, 'unit_cost_price', 60.00, 'unit_sale_price', 95.00, 'total_item_price', 480.00, 'add_to_stock', true)
    ),
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    v_supplier_ids[3],
    v_bank_account_id,
    v_prev_month + 7,
    1490.00,
    'paid',
    'REP-PO-1003',
    v_prev_month + 8,
    v_prev_month + 7,
    v_seed_tag || ' Purchase 03',
    jsonb_build_array(
      jsonb_build_object('part_id', v_product_ids[6], 'description', 'Shock absorber set', 'quantity', 4, 'unit_cost_price', 210.00, 'unit_sale_price', 320.00, 'total_item_price', 840.00, 'add_to_stock', true),
      jsonb_build_object('part_id', v_product_ids[7], 'description', 'Suspension bushing kit', 'quantity', 5, 'unit_cost_price', 130.00, 'unit_sale_price', 190.00, 'total_item_price', 650.00, 'add_to_stock', true)
    ),
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    v_supplier_ids[4],
    v_bank_account_id,
    v_prev_month + 18,
    980.00,
    'pending',
    'REP-PO-1004',
    NULL,
    current_date - 3,
    v_seed_tag || ' Purchase 04',
    jsonb_build_array(
      jsonb_build_object('part_id', v_product_ids[8], 'description', 'Battery 70Ah', 'quantity', 4, 'unit_cost_price', 185.00, 'unit_sale_price', 280.00, 'total_item_price', 740.00, 'add_to_stock', true),
      jsonb_build_object('part_id', v_product_ids[1], 'description', 'Brake cleaner', 'quantity', 6, 'unit_cost_price', 40.00, 'unit_sale_price', 65.00, 'total_item_price', 240.00, 'add_to_stock', true)
    ),
    v_seed_user,
    v_seed_user
  );

  -- ===========================================================================
  -- Financial transactions for costs/profit reports
  -- ===========================================================================
  INSERT INTO public.financial_transactions (
    organization_id,
    description,
    amount,
    due_date,
    type,
    status,
    category,
    recurrence,
    bank_account_id,
    notes,
    created_by,
    updated_by
  ) VALUES
  (v_organization_id, 'Workshop rent',                3200.00, v_month_start + 2,  'expense', 'paid',    'rent',      'monthly',      v_bank_account_id, v_seed_tag || ' Expense 01', v_seed_user, v_seed_user),
  (v_organization_id, 'Payroll reserve',              5400.00, v_month_start + 4,  'expense', 'paid',    'salaries',  'monthly',      v_bank_account_id, v_seed_tag || ' Expense 02', v_seed_user, v_seed_user),
  (v_organization_id, 'Supplier settlement batch',    1850.00, v_month_start + 6,  'expense', 'paid',    'suppliers', 'non_recurring', v_bank_account_id, v_seed_tag || ' Expense 03', v_seed_user, v_seed_user),
  (v_organization_id, 'Traffic campaign',              780.00, v_month_start + 8,  'expense', 'pending', 'marketing', 'non_recurring', v_bank_account_id, v_seed_tag || ' Expense 04', v_seed_user, v_seed_user),
  (v_organization_id, 'City tax payment',              620.00, v_prev_month + 10,  'expense', 'paid',    'taxes',     'non_recurring', v_bank_account_id, v_seed_tag || ' Expense 05', v_seed_user, v_seed_user),
  (v_organization_id, 'Shop supplies and tools',       440.00, v_prev_month + 16,  'expense', 'paid',    'other',     'non_recurring', v_bank_account_id, v_seed_tag || ' Expense 06', v_seed_user, v_seed_user);

  -- ===========================================================================
  -- Service orders for overview, customers, debtors, commissions, and sales
  -- ===========================================================================
  INSERT INTO public.service_orders (
    id,
    organization_id,
    number,
    client_id,
    vehicle_id,
    entry_date,
    expected_date,
    expected_payment_date,
    completion_date,
    employee_responsible_id,
    responsible_employees,
    status,
    payment_status,
    payment_method,
    is_installment,
    installment_count,
    reported_defect,
    diagnosis,
    items,
    total_amount,
    total_cost_amount,
    commission_amount,
    notes,
    created_by,
    updated_by
  ) VALUES
  (
    v_order_1,
    v_organization_id,
    'OS-RPT-001',
    v_client_ids[1],
    v_vehicle_ids[1],
    v_date_1,
    v_date_1 + 1,
    v_date_1 + 2,
    v_date_1 + 1,
    v_employee_ids[2],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2]), jsonb_build_object('employee_id', v_employee_ids[3])),
    'delivered',
    'paid',
    'pix',
    false,
    NULL,
    'Brake noise during low speed stops',
    'Front brake kit replacement',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[1], 'description', 'Brake pad replacement', 'quantity', 1, 'unit_price', 350.00, 'cost_amount', 210.00, 'total_amount', 350.00, 'commission_total', 28.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2], 'amount', 28.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 8))),
      jsonb_build_object('product_id', v_product_ids[2], 'description', 'Brake disc pair',       'quantity', 1, 'unit_price', 190.00, 'cost_amount',  90.00, 'total_amount', 190.00, 'commission_total', 12.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3], 'amount', 12.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6)))
    ),
    540.00,
    300.00,
    40.00,
    v_seed_tag || ' Service order 01',
    v_seed_user,
    v_seed_user
  ),
  (
    v_order_2,
    v_organization_id,
    'OS-RPT-002',
    v_client_ids[2],
    v_vehicle_ids[2],
    v_date_2,
    v_date_2 + 1,
    v_date_2 + 2,
    v_date_2 + 2,
    v_employee_ids[2],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2]), jsonb_build_object('employee_id', v_employee_ids[4])),
    'completed',
    'paid',
    'credit_card',
    false,
    NULL,
    'Oil leak and rough idle',
    'Filter and ignition service',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[4], 'description', 'Oil filter service',    'quantity', 2, 'unit_price', 110.00, 'cost_amount',  55.00, 'total_amount', 220.00, 'commission_total', 14.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2], 'amount', 14.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6))),
      jsonb_build_object('product_id', v_product_ids[5], 'description', 'Synthetic oil change',   'quantity', 5, 'unit_price',  85.00, 'cost_amount',  48.00, 'total_amount', 425.00, 'commission_total', 28.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2], 'amount', 28.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6))),
      jsonb_build_object('product_id', v_product_ids[3], 'description', 'Ignition tune-up',       'quantity', 1, 'unit_price', 225.00, 'cost_amount', 135.00, 'total_amount', 225.00, 'commission_total', 16.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[4], 'amount', 16.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 8)))
    ),
    870.00,
    485.00,
    58.00,
    v_seed_tag || ' Service order 02',
    v_seed_user,
    v_seed_user
  ),
  (
    v_order_3,
    v_organization_id,
    'OS-RPT-003',
    v_client_ids[3],
    v_vehicle_ids[3],
    v_date_3,
    v_date_3 + 1,
    current_date - 2,
    v_date_3 + 1,
    v_employee_ids[3],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3])),
    'delivered',
    'partial',
    'transfer',
    false,
    NULL,
    'Suspension vibration over bumps',
    'Front suspension repair',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[6], 'description', 'Shock absorber replacement', 'quantity', 2, 'unit_price', 240.00, 'cost_amount', 150.00, 'total_amount', 480.00, 'commission_total', 30.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3], 'amount', 30.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6))),
      jsonb_build_object('product_id', v_product_ids[7], 'description', 'Alignment support items',   'quantity', 2, 'unit_price', 140.00, 'cost_amount',  65.00, 'total_amount', 280.00, 'commission_total', 14.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3], 'amount', 14.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6)))
    ),
    760.00,
    430.00,
    44.00,
    v_seed_tag || ' Service order 03',
    v_seed_user,
    v_seed_user
  ),
  (
    v_order_4,
    v_organization_id,
    'OS-RPT-004',
    v_client_ids[4],
    v_vehicle_ids[4],
    v_date_4,
    v_date_4 + 2,
    current_date + 5,
    NULL,
    v_employee_ids[4],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[4])),
    'open',
    'pending',
    'bank_slip',
    false,
    NULL,
    'Battery discharge after overnight stop',
    'Electrical system diagnostics pending approval',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[8], 'description', 'Battery inspection and setup', 'quantity', 1, 'unit_price', 410.00, 'cost_amount', 250.00, 'total_amount', 410.00, 'commission_total', 20.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[4], 'amount', 20.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 5)))
    ),
    410.00,
    250.00,
    20.00,
    v_seed_tag || ' Service order 04',
    v_seed_user,
    v_seed_user
  ),
  (
    v_order_5,
    v_organization_id,
    'OS-RPT-005',
    v_client_ids[5],
    v_vehicle_ids[5],
    v_date_5,
    v_date_5 + 2,
    current_date + 12,
    v_date_5 + 2,
    v_employee_ids[2],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2]), jsonb_build_object('employee_id', v_employee_ids[3])),
    'delivered',
    'partial',
    'credit_card',
    true,
    3,
    'Complete preventive maintenance',
    'Multi-point service with installment payment',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[4], 'description', 'Filters package',        'quantity', 3, 'unit_price', 120.00, 'cost_amount',  68.00, 'total_amount', 360.00, 'commission_total', 22.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2], 'amount', 22.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6))),
      jsonb_build_object('product_id', v_product_ids[5], 'description', 'Engine oil package',     'quantity', 6, 'unit_price',  95.00, 'cost_amount',  56.00, 'total_amount', 570.00, 'commission_total', 34.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2], 'amount', 34.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6))),
      jsonb_build_object('product_id', v_product_ids[3], 'description', 'General review labor',   'quantity', 1, 'unit_price', 420.00, 'cost_amount', 210.00, 'total_amount', 420.00, 'commission_total', 22.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3], 'amount', 22.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 5.25)))
    ),
    1350.00,
    750.00,
    78.00,
    v_seed_tag || ' Service order 05',
    v_seed_user,
    v_seed_user
  ),
  (
    v_order_6,
    v_organization_id,
    'OS-RPT-006',
    v_client_ids[1],
    v_vehicle_ids[1],
    v_prev_month + 6,
    v_prev_month + 7,
    v_prev_month + 8,
    v_prev_month + 7,
    v_employee_ids[2],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2])),
    'delivered',
    'paid',
    'cash',
    false,
    NULL,
    'Periodic 10k maintenance',
    'Standard preventive service',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[4], 'description', 'Preventive maintenance package', 'quantity', 1, 'unit_price', 620.00, 'cost_amount', 360.00, 'total_amount', 620.00, 'commission_total', 30.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[2], 'amount', 30.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 4.84)))
    ),
    620.00,
    360.00,
    30.00,
    v_seed_tag || ' Service order 06',
    v_seed_user,
    v_seed_user
  ),
  (
    v_order_7,
    v_organization_id,
    'OS-RPT-007',
    v_client_ids[6],
    v_vehicle_ids[6],
    v_prev_month + 13,
    v_prev_month + 14,
    current_date - 12,
    v_prev_month + 14,
    v_employee_ids[3],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3]), jsonb_build_object('employee_id', v_employee_ids[4])),
    'completed',
    'pending',
    'pix',
    false,
    NULL,
    'Engine overheating in traffic',
    'Cooling system repair',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[2], 'description', 'Cooling repair kit',      'quantity', 2, 'unit_price', 240.00, 'cost_amount', 145.00, 'total_amount', 480.00, 'commission_total', 28.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3], 'amount', 28.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 6))),
      jsonb_build_object('product_id', v_product_ids[3], 'description', 'Thermostat replacement',  'quantity', 1, 'unit_price', 180.00, 'cost_amount', 110.00, 'total_amount', 180.00, 'commission_total', 10.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[4], 'amount', 10.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 5.55))),
      jsonb_build_object('product_id', v_product_ids[5], 'description', 'Coolant refill',          'quantity', 4, 'unit_price',  80.00, 'cost_amount',  45.00, 'total_amount', 320.00, 'commission_total', 17.00, 'commissions', jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[3], 'amount', 17.00, 'type', 'percentage', 'base', 'revenue', 'percentage', 5.31)))
    ),
    980.00,
    580.00,
    55.00,
    v_seed_tag || ' Service order 07',
    v_seed_user,
    v_seed_user
  ),
  (
    v_order_8,
    v_organization_id,
    'OS-RPT-008',
    v_client_ids[2],
    v_vehicle_ids[2],
    v_prev_month + 20,
    v_prev_month + 22,
    v_prev_month + 22,
    NULL,
    v_employee_ids[4],
    jsonb_build_array(jsonb_build_object('employee_id', v_employee_ids[4])),
    'cancelled',
    'pending',
    'no_payment',
    false,
    NULL,
    'Headlight replacement estimate',
    'Cancelled by customer',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_ids[8], 'description', 'Headlight assembly estimate', 'quantity', 1, 'unit_price', 290.00, 'cost_amount', 180.00, 'total_amount', 290.00, 'commission_total', 0.00, 'commissions', jsonb_build_array())
    ),
    290.00,
    180.00,
    0.00,
    v_seed_tag || ' Service order 08',
    v_seed_user,
    v_seed_user
  );

  -- ===========================================================================
  -- Installments for debtors and commission cross-checks
  -- ===========================================================================
  INSERT INTO public.service_order_installments (
    id,
    organization_id,
    service_order_id,
    installment_number,
    installment_amount,
    due_date,
    payment_date,
    status,
    payment_method,
    notes,
    created_by,
    updated_by
  ) VALUES
  (
    v_installment_1,
    v_organization_id,
    v_order_5,
    1,
    450.00,
    current_date - 6,
    current_date - 5,
    'paid',
    'credit_card',
    v_seed_tag || ' Installment 01',
    v_seed_user,
    v_seed_user
  ),
  (
    v_installment_2,
    v_organization_id,
    v_order_5,
    2,
    450.00,
    current_date - 1,
    NULL,
    'overdue',
    'credit_card',
    v_seed_tag || ' Installment 02',
    v_seed_user,
    v_seed_user
  ),
  (
    v_installment_3,
    v_organization_id,
    v_order_5,
    3,
    450.00,
    current_date + 10,
    NULL,
    'pending',
    'credit_card',
    v_seed_tag || ' Installment 03',
    v_seed_user,
    v_seed_user
  );

  -- ===========================================================================
  -- Commission records
  -- ===========================================================================
  INSERT INTO public.employee_financial_records (
    organization_id,
    employee_id,
    service_order_id,
    record_type,
    description,
    amount,
    reference_date,
    status,
    payment_date,
    created_by,
    updated_by
  ) VALUES
  (v_organization_id, v_employee_ids[2], v_order_1, 'commission', v_seed_tag || ' Commission OS-RPT-001 A', 28.00, v_date_1,          'paid',    v_date_1 + 2,  v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[3], v_order_1, 'commission', v_seed_tag || ' Commission OS-RPT-001 B', 12.00, v_date_1,          'paid',    v_date_1 + 2,  v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[2], v_order_2, 'commission', v_seed_tag || ' Commission OS-RPT-002 A', 42.00, v_date_2,          'paid',    v_date_2 + 3,  v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[4], v_order_2, 'commission', v_seed_tag || ' Commission OS-RPT-002 B', 16.00, v_date_2,          'paid',    v_date_2 + 3,  v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[3], v_order_3, 'commission', v_seed_tag || ' Commission OS-RPT-003',   44.00, v_date_3,          'pending', NULL,          v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[4], v_order_4, 'commission', v_seed_tag || ' Commission OS-RPT-004',   20.00, v_date_4,          'pending', NULL,          v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[2], v_order_5, 'commission', v_seed_tag || ' Commission OS-RPT-005 A', 56.00, v_date_5,          'pending', NULL,          v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[3], v_order_5, 'commission', v_seed_tag || ' Commission OS-RPT-005 B', 22.00, v_date_5,          'pending', NULL,          v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[2], v_order_6, 'commission', v_seed_tag || ' Commission OS-RPT-006',   30.00, v_prev_month + 6, 'paid',    v_prev_month + 8, v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[3], v_order_7, 'commission', v_seed_tag || ' Commission OS-RPT-007 A', 45.00, v_prev_month + 13,'pending', NULL,          v_seed_user, v_seed_user),
  (v_organization_id, v_employee_ids[4], v_order_7, 'commission', v_seed_tag || ' Commission OS-RPT-007 B', 10.00, v_prev_month + 13,'pending', NULL,          v_seed_user, v_seed_user);

  RAISE NOTICE 'Reports demo seed completed for organization_id=%', v_organization_id;
END $$;
