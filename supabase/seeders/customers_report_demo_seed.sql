-- =============================================================================
-- Seed: customers_report_demo_seed.sql
-- Purpose: Insert demo clients and service orders for the customers report.
--
-- Covered pages:
-- - /app/reports/customers  (list + detail slideover)
--
-- Required base data:
-- - vehicles_demo_seed.sql  (at least 5 vehicles)
-- - settings_demo_seed.sql  (at least 2 employees)
-- - products_demo_seed.sql  (at least 4 products)
--
-- What is created:
-- - 15 clients with realistic Brazilian names
-- - 25 service orders spread across 3 months
--     • Clients 1-5:  3 orders each  (frequent/high-value customers)
--     • Clients 6-10: 2 orders each  (occasional customers)
--     • Clients 11-15: 1 order each  (new / one-time customers)
--
-- Behavior:
-- - Idempotent: prior rows tagged [seed:customers-report-v1] are removed first.
-- - Service orders are deleted before clients (FK constraint).
-- =============================================================================

DO $$
DECLARE
  v_org   uuid := NULL;
  v_user  text := 'seed@autopro.local';
  v_tag   text := '[seed:customers-report-v1]';

  v_cl    uuid[];   -- client IDs (15)
  v_ve    uuid[];   -- vehicle IDs (up to 10)
  v_em    uuid[];   -- employee IDs (up to 4)
  v_pr    uuid[];   -- product IDs (up to 8)

  -- safe vehicle slots (cycle through available ones)
  v_ve1   uuid;
  v_ve2   uuid;
  v_ve3   uuid;
  v_ve4   uuid;
  v_ve5   uuid;

  -- month start dates
  v_m0    date := date_trunc('month', current_date)::date;
  v_m1    date := (date_trunc('month', current_date) - interval  '1 month')::date;
  v_m2    date := (date_trunc('month', current_date) - interval  '2 months')::date;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Resolve organization
  -- ---------------------------------------------------------------------------
  IF v_org IS NULL THEN
    SELECT id INTO v_org
      FROM public.organizations
     WHERE deleted_at IS NULL
     ORDER BY created_at
     LIMIT 1;
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create one before running this seed.';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. Cleanup (service_orders first — FK references clients)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.service_orders
   WHERE organization_id = v_org
     AND notes LIKE v_tag || '%';

  DELETE FROM public.clients
   WHERE organization_id = v_org
     AND notes LIKE v_tag || '%';

  -- ---------------------------------------------------------------------------
  -- 3. Insert 15 clients
  -- ---------------------------------------------------------------------------
  INSERT INTO public.clients (
    organization_id, name, person_type, tax_id,
    phone, email, city, state,
    notes, created_by, updated_by
  ) VALUES
  (v_org, 'Ana Beatriz Costa',        'pf', '11100000001', '11991110001', 'ana.costa@email.test',        'São Paulo',        'SP', v_tag || ' 01', v_user, v_user),
  (v_org, 'Bruno Henrique Melo',      'pf', '11100000002', '11991110002', 'bruno.melo@email.test',       'Campinas',         'SP', v_tag || ' 02', v_user, v_user),
  (v_org, 'Camila Ferreira Dias',     'pf', '11100000003', '11991110003', 'camila.dias@email.test',      'Rio de Janeiro',   'RJ', v_tag || ' 03', v_user, v_user),
  (v_org, 'Daniel Souza Lopes',       'pf', '11100000004', '11991110004', 'daniel.lopes@email.test',     'Belo Horizonte',   'MG', v_tag || ' 04', v_user, v_user),
  (v_org, 'Eduardo Lima Santos',      'pf', '11100000005', '11991110005', 'eduardo.santos@email.test',   'São Paulo',        'SP', v_tag || ' 05', v_user, v_user),
  (v_org, 'Fernanda Araújo Silva',    'pf', '11100000006', '11991110006', 'fernanda.araujo@email.test',  'Curitiba',         'PR', v_tag || ' 06', v_user, v_user),
  (v_org, 'Gabriel Costa Rodrigues',  'pf', '11100000007', '11991110007', 'gabriel.rodrigues@email.test','Porto Alegre',     'RS', v_tag || ' 07', v_user, v_user),
  (v_org, 'Helena Martins Vieira',    'pf', '11100000008', '11991110008', 'helena.vieira@email.test',    'Recife',           'PE', v_tag || ' 08', v_user, v_user),
  (v_org, 'Igor Pereira Ramos',       'pf', '11100000009', '11991110009', 'igor.ramos@email.test',       'Salvador',         'BA', v_tag || ' 09', v_user, v_user),
  (v_org, 'Juliana Neves Cardoso',    'pf', '11100000010', '11991110010', 'juliana.cardoso@email.test',  'Fortaleza',        'CE', v_tag || ' 10', v_user, v_user),
  (v_org, 'Kevin Alves Torres',       'pf', '11100000011', '11991110011', 'kevin.torres@email.test',     'Brasília',         'DF', v_tag || ' 11', v_user, v_user),
  (v_org, 'Laura Monteiro Farias',    'pf', '11100000012', '11991110012', 'laura.farias@email.test',     'Manaus',           'AM', v_tag || ' 12', v_user, v_user),
  (v_org, 'Marcos Barbosa Cunha',     'pf', '11100000013', '11991110013', 'marcos.cunha@email.test',     'Goiânia',          'GO', v_tag || ' 13', v_user, v_user),
  (v_org, 'Natalia Ribeiro Campos',   'pf', '11100000014', '11991110014', 'natalia.campos@email.test',   'São Paulo',        'SP', v_tag || ' 14', v_user, v_user),
  (v_org, 'Otávio Carvalho Pires',    'pf', '11100000015', '11991110015', 'otavio.pires@email.test',     'Vitória',          'ES', v_tag || ' 15', v_user, v_user);

  -- ---------------------------------------------------------------------------
  -- 4. Collect client IDs (stable order via notes tag suffix ' 01'…' 15')
  -- ---------------------------------------------------------------------------
  SELECT ARRAY(
    SELECT id FROM public.clients
     WHERE organization_id = v_org
       AND notes LIKE v_tag || '%'
     ORDER BY notes
  ) INTO v_cl;

  IF coalesce(array_length(v_cl, 1), 0) < 15 THEN
    RAISE EXCEPTION 'Expected 15 seeded clients, got %.', coalesce(array_length(v_cl, 1), 0);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 5. Collect resource arrays
  -- ---------------------------------------------------------------------------
  SELECT ARRAY(
    SELECT id FROM public.vehicles
     WHERE organization_id = v_org AND deleted_at IS NULL
     ORDER BY created_at LIMIT 10
  ) INTO v_ve;

  SELECT ARRAY(
    SELECT id FROM public.employees
     WHERE organization_id = v_org AND deleted_at IS NULL
     ORDER BY created_at LIMIT 4
  ) INTO v_em;

  SELECT ARRAY(
    SELECT id FROM public.products
     WHERE organization_id = v_org AND deleted_at IS NULL
     ORDER BY created_at LIMIT 8
  ) INTO v_pr;

  IF coalesce(array_length(v_ve, 1), 0) < 1 THEN
    RAISE EXCEPTION 'No vehicles found. Run vehicles_demo_seed.sql first.';
  END IF;
  IF coalesce(array_length(v_em, 1), 0) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 employees. Run settings_demo_seed.sql first.';
  END IF;
  IF coalesce(array_length(v_pr, 1), 0) < 4 THEN
    RAISE EXCEPTION 'Need at least 4 products. Run products_demo_seed.sql first.';
  END IF;

  -- Safe vehicle slots (cycle if fewer than 5 vehicles)
  v_ve1 := v_ve[1];
  v_ve2 := v_ve[LEAST(2, array_length(v_ve, 1))];
  v_ve3 := v_ve[LEAST(3, array_length(v_ve, 1))];
  v_ve4 := v_ve[LEAST(4, array_length(v_ve, 1))];
  v_ve5 := v_ve[LEAST(5, array_length(v_ve, 1))];

  -- ---------------------------------------------------------------------------
  -- 6. Insert 25 service orders
  -- ---------------------------------------------------------------------------
  INSERT INTO public.service_orders (
    id, organization_id, number,
    client_id, vehicle_id,
    entry_date, expected_date, completion_date,
    employee_responsible_id, responsible_employees,
    status, payment_status, payment_method,
    is_installment, installment_count,
    reported_defect, diagnosis,
    items, total_amount, total_cost_amount, commission_amount,
    notes, created_by, updated_by
  ) VALUES

  -- ==========================================================================
  -- Ana Beatriz Costa  (3 orders — highest value, repeat customer)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000001', v_org, 'OS-CRP-001',
    v_cl[1], v_ve1,
    LEAST(v_m0 + 3, current_date), LEAST(v_m0 + 4, current_date), LEAST(v_m0 + 4, current_date),
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Freio traseiro com ruído ao parar',
    'Substituição de pastilhas e discos traseiros',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Pastilha de freio traseira', 'quantity', 1, 'unit_price', 380.00, 'cost_amount', 210.00, 'total_amount', 380.00, 'commission_total', 22.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[2], 'description', 'Disco de freio par traseiro', 'quantity', 1, 'unit_price', 310.00, 'cost_amount', 170.00, 'total_amount', 310.00, 'commission_total', 18.00, 'commissions', '[]'::jsonb)
    ),
    690.00, 380.00, 40.00,
    v_tag || ' OS-CRP-001', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000002', v_org, 'OS-CRP-002',
    v_cl[1], v_ve1,
    v_m1 + 10, v_m1 + 11, v_m1 + 11,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'credit_card', false, NULL,
    'Troca de óleo e revisão geral',
    'Revisão preventiva 10.000 km — óleo, filtros e fluidos',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Óleo sintético 5W30 (5L)',   'quantity', 1, 'unit_price', 220.00, 'cost_amount', 130.00, 'total_amount', 220.00, 'commission_total', 12.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[3], 'description', 'Filtro de óleo + ar',         'quantity', 2, 'unit_price',  90.00, 'cost_amount',  48.00, 'total_amount', 180.00, 'commission_total',  8.00, 'commissions', '[]'::jsonb)
    ),
    400.00, 226.00, 20.00,
    v_tag || ' OS-CRP-002', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000003', v_org, 'OS-CRP-003',
    v_cl[1], v_ve1,
    v_m2 + 5, v_m2 + 6, v_m2 + 7,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Suspensão com ruído na dianteira',
    'Reposição de buchas e amortecedor dianteiro',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[2], 'description', 'Amortecedor dianteiro', 'quantity', 2, 'unit_price', 320.00, 'cost_amount', 190.00, 'total_amount', 640.00, 'commission_total', 30.00, 'commissions', '[]'::jsonb)
    ),
    640.00, 380.00, 30.00,
    v_tag || ' OS-CRP-003', v_user, v_user
  ),

  -- ==========================================================================
  -- Bruno Henrique Melo  (3 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000004', v_org, 'OS-CRP-004',
    v_cl[2], v_ve2,
    LEAST(v_m0 + 7, current_date), LEAST(v_m0 + 8, current_date), LEAST(v_m0 + 8, current_date),
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'cash', false, NULL,
    'Alinhamento e balanceamento',
    'Alinhamento 4 rodas + balanceamento',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[3], 'description', 'Alinhamento e balanceamento completo', 'quantity', 1, 'unit_price', 180.00, 'cost_amount', 80.00, 'total_amount', 180.00, 'commission_total', 10.00, 'commissions', '[]'::jsonb)
    ),
    180.00, 80.00, 10.00,
    v_tag || ' OS-CRP-004', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000005', v_org, 'OS-CRP-005',
    v_cl[2], v_ve2,
    v_m1 + 18, v_m1 + 19, v_m1 + 20,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'partial', 'credit_card', false, NULL,
    'Motor falhando em baixa rotação',
    'Diagnóstico e substituição de velas e bobines',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Jogo de velas iridium',   'quantity', 4, 'unit_price',  85.00, 'cost_amount', 48.00, 'total_amount', 340.00, 'commission_total', 18.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[3], 'description', 'Bobine de ignição',        'quantity', 2, 'unit_price', 195.00, 'cost_amount',115.00, 'total_amount', 390.00, 'commission_total', 22.00, 'commissions', '[]'::jsonb)
    ),
    730.00, 424.00, 40.00,
    v_tag || ' OS-CRP-005', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000006', v_org, 'OS-CRP-006',
    v_cl[2], v_ve2,
    v_m2 + 12, v_m2 + 13, v_m2 + 14,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'pix', false, NULL,
    'Troca de correia dentada',
    'Substituição da correia dentada e tensor',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Kit correia dentada',     'quantity', 1, 'unit_price', 520.00, 'cost_amount', 290.00, 'total_amount', 520.00, 'commission_total', 28.00, 'commissions', '[]'::jsonb)
    ),
    520.00, 290.00, 28.00,
    v_tag || ' OS-CRP-006', v_user, v_user
  ),

  -- ==========================================================================
  -- Camila Ferreira Dias  (3 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000007', v_org, 'OS-CRP-007',
    v_cl[3], v_ve3,
    LEAST(v_m0 + 5, current_date), LEAST(v_m0 + 6, current_date), LEAST(v_m0 + 6, current_date),
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'completed', 'paid', 'transfer', false, NULL,
    'Ar-condicionado não gela',
    'Recarga de gás e limpeza do sistema de A/C',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[2], 'description', 'Recarga gás R134a + aditivo', 'quantity', 1, 'unit_price', 290.00, 'cost_amount', 140.00, 'total_amount', 290.00, 'commission_total', 16.00, 'commissions', '[]'::jsonb)
    ),
    290.00, 140.00, 16.00,
    v_tag || ' OS-CRP-007', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000008', v_org, 'OS-CRP-008',
    v_cl[3], v_ve3,
    v_m1 + 8, v_m1 + 9, v_m1 + 10,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'pix', false, NULL,
    'Revisão pré-viagem',
    'Revisão completa: freios, pneus, fluidos e iluminação',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Revisão completa pré-viagem', 'quantity', 1, 'unit_price', 450.00, 'cost_amount', 220.00, 'total_amount', 450.00, 'commission_total', 24.00, 'commissions', '[]'::jsonb)
    ),
    450.00, 220.00, 24.00,
    v_tag || ' OS-CRP-008', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000009', v_org, 'OS-CRP-009',
    v_cl[3], v_ve3,
    v_m2 + 20, v_m2 + 21, v_m2 + 22,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'credit_card', false, NULL,
    'Bateria fraca, carro não liga',
    'Substituição de bateria 60Ah',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[3], 'description', 'Bateria automotiva 60Ah', 'quantity', 1, 'unit_price', 380.00, 'cost_amount', 210.00, 'total_amount', 380.00, 'commission_total', 20.00, 'commissions', '[]'::jsonb)
    ),
    380.00, 210.00, 20.00,
    v_tag || ' OS-CRP-009', v_user, v_user
  ),

  -- ==========================================================================
  -- Daniel Souza Lopes  (3 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000010', v_org, 'OS-CRP-010',
    v_cl[4], v_ve4,
    LEAST(v_m0 + 2, current_date), LEAST(v_m0 + 3, current_date), LEAST(v_m0 + 3, current_date),
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'pix', false, NULL,
    'Direção com vibração acima de 80 km/h',
    'Balanceamento computadorizado e calibragem',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[3], 'description', 'Balanceamento 4 rodas', 'quantity', 4, 'unit_price', 45.00, 'cost_amount', 18.00, 'total_amount', 180.00, 'commission_total', 10.00, 'commissions', '[]'::jsonb)
    ),
    180.00, 72.00, 10.00,
    v_tag || ' OS-CRP-010', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000011', v_org, 'OS-CRP-011',
    v_cl[4], v_ve4,
    v_m1 + 5, v_m1 + 7, v_m1 + 7,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'cash', false, NULL,
    'Escapamento com barulho',
    'Substituição do silencioso traseiro',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[2], 'description', 'Silencioso traseiro universal', 'quantity', 1, 'unit_price', 480.00, 'cost_amount', 270.00, 'total_amount', 480.00, 'commission_total', 26.00, 'commissions', '[]'::jsonb)
    ),
    480.00, 270.00, 26.00,
    v_tag || ' OS-CRP-011', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000012', v_org, 'OS-CRP-012',
    v_cl[4], v_ve4,
    v_m2 + 14, v_m2 + 16, v_m2 + 16,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'credit_card', false, NULL,
    'Luz do check engine acesa',
    'Diagnóstico por scanner e reset de falhas — sensor O2 substituído',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Sensor de oxigênio', 'quantity', 1, 'unit_price', 320.00, 'cost_amount', 175.00, 'total_amount', 320.00, 'commission_total', 18.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[3], 'description', 'Mão de obra diagnóstico', 'quantity', 1, 'unit_price', 120.00, 'cost_amount',  40.00, 'total_amount', 120.00, 'commission_total',  6.00, 'commissions', '[]'::jsonb)
    ),
    440.00, 215.00, 24.00,
    v_tag || ' OS-CRP-012', v_user, v_user
  ),

  -- ==========================================================================
  -- Eduardo Lima Santos  (3 orders — has a pending order)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000013', v_org, 'OS-CRP-013',
    v_cl[5], v_ve5,
    LEAST(v_m0 + 10, current_date), LEAST(v_m0 + 12, current_date), NULL,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'in_progress', 'pending', 'pix', false, NULL,
    'Câmbio automático com solavanco na 1ª marcha',
    'Diagnóstico em andamento — aguardando laudo do câmbio',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Diagnóstico câmbio automático', 'quantity', 1, 'unit_price', 250.00, 'cost_amount', 80.00, 'total_amount', 250.00, 'commission_total', 14.00, 'commissions', '[]'::jsonb)
    ),
    250.00, 80.00, 14.00,
    v_tag || ' OS-CRP-013', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000014', v_org, 'OS-CRP-014',
    v_cl[5], v_ve5,
    v_m1 + 22, v_m1 + 24, v_m1 + 24,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'transfer', false, NULL,
    'Troca do líquido de freio e fluido de embreagem',
    'Substituição completa dos fluidos',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[3], 'description', 'Fluido de freio DOT4 + embreagem', 'quantity', 2, 'unit_price', 95.00, 'cost_amount', 48.00, 'total_amount', 190.00, 'commission_total', 10.00, 'commissions', '[]'::jsonb)
    ),
    190.00, 96.00, 10.00,
    v_tag || ' OS-CRP-014', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000015', v_org, 'OS-CRP-015',
    v_cl[5], v_ve5,
    v_m2 + 8, v_m2 + 9, v_m2 + 10,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Pneus carecas, necessita substituição urgente',
    'Substituição de 4 pneus 195/65 R15',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[2], 'description', 'Pneu 195/65 R15', 'quantity', 4, 'unit_price', 290.00, 'cost_amount', 175.00, 'total_amount', 1160.00, 'commission_total', 56.00, 'commissions', '[]'::jsonb)
    ),
    1160.00, 700.00, 56.00,
    v_tag || ' OS-CRP-015', v_user, v_user
  ),

  -- ==========================================================================
  -- Fernanda Araújo Silva  (2 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000016', v_org, 'OS-CRP-016',
    v_cl[6], v_ve1,
    LEAST(v_m0 + 6, current_date), LEAST(v_m0 + 7, current_date), LEAST(v_m0 + 7, current_date),
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'credit_card', false, NULL,
    'Faróis embaçados',
    'Polimento e selagem dos faróis dianteiros',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[3], 'description', 'Polimento de faróis', 'quantity', 2, 'unit_price', 110.00, 'cost_amount', 45.00, 'total_amount', 220.00, 'commission_total', 12.00, 'commissions', '[]'::jsonb)
    ),
    220.00, 90.00, 12.00,
    v_tag || ' OS-CRP-016', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000017', v_org, 'OS-CRP-017',
    v_cl[6], v_ve1,
    v_m1 + 15, v_m1 + 17, v_m1 + 17,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Limpeza de bicos injetores',
    'Lavagem ultrassônica dos injetores + limpeza do corpo de borboleta',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Limpeza de injetores (4 un)', 'quantity', 1, 'unit_price', 340.00, 'cost_amount', 160.00, 'total_amount', 340.00, 'commission_total', 18.00, 'commissions', '[]'::jsonb)
    ),
    340.00, 160.00, 18.00,
    v_tag || ' OS-CRP-017', v_user, v_user
  ),

  -- ==========================================================================
  -- Gabriel Costa Rodrigues  (2 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000018', v_org, 'OS-CRP-018',
    v_cl[7], v_ve2,
    LEAST(v_m0 + 9, current_date), LEAST(v_m0 + 10, current_date), LEAST(v_m0 + 10, current_date),
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'completed', 'paid', 'cash', false, NULL,
    'Troca de pastilhas dianteiras',
    'Pastilhas dianteiras + verificação do freio a mão',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Pastilha de freio dianteira', 'quantity', 1, 'unit_price', 260.00, 'cost_amount', 140.00, 'total_amount', 260.00, 'commission_total', 14.00, 'commissions', '[]'::jsonb)
    ),
    260.00, 140.00, 14.00,
    v_tag || ' OS-CRP-018', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000019', v_org, 'OS-CRP-019',
    v_cl[7], v_ve2,
    v_m1 + 25, v_m1 + 26, v_m1 + 27,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'partial', 'credit_card', false, NULL,
    'Reparo no ar-condicionado — compressor com ruído',
    'Troca do compressor do A/C e recarga de gás',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[2], 'description', 'Compressor de A/C remanufaturado', 'quantity', 1, 'unit_price', 980.00, 'cost_amount', 580.00, 'total_amount', 980.00, 'commission_total', 48.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[3], 'description', 'Mão de obra montagem A/C',          'quantity', 1, 'unit_price', 280.00, 'cost_amount',  80.00, 'total_amount', 280.00, 'commission_total', 16.00, 'commissions', '[]'::jsonb)
    ),
    1260.00, 660.00, 64.00,
    v_tag || ' OS-CRP-019', v_user, v_user
  ),

  -- ==========================================================================
  -- Helena Martins Vieira  (2 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000020', v_org, 'OS-CRP-020',
    v_cl[8], v_ve3,
    LEAST(v_m0 + 1, current_date), LEAST(v_m0 + 2, current_date), LEAST(v_m0 + 2, current_date),
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Revisão de 30.000 km',
    'Revisão completa — troca de óleo, filtros, correias e inspeção geral',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Revisão 30.000 km completa', 'quantity', 1, 'unit_price', 890.00, 'cost_amount', 490.00, 'total_amount', 890.00, 'commission_total', 44.00, 'commissions', '[]'::jsonb)
    ),
    890.00, 490.00, 44.00,
    v_tag || ' OS-CRP-020', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000021', v_org, 'OS-CRP-021',
    v_cl[8], v_ve3,
    v_m1 + 20, v_m1 + 21, v_m1 + 22,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'transfer', false, NULL,
    'Coxins do motor desgastados',
    'Troca dos 4 coxins do motor',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Coxim do motor (kit 4 un)', 'quantity', 1, 'unit_price', 560.00, 'cost_amount', 310.00, 'total_amount', 560.00, 'commission_total', 28.00, 'commissions', '[]'::jsonb)
    ),
    560.00, 310.00, 28.00,
    v_tag || ' OS-CRP-021', v_user, v_user
  ),

  -- ==========================================================================
  -- Igor Pereira Ramos  (2 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000022', v_org, 'OS-CRP-022',
    v_cl[9], v_ve4,
    LEAST(v_m0 + 13, current_date), LEAST(v_m0 + 14, current_date), LEAST(v_m0 + 14, current_date),
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'credit_card', false, NULL,
    'Lanterna traseira quebrada',
    'Substituição de lanterna traseira — lado esquerdo',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[3], 'description', 'Lanterna traseira LE original', 'quantity', 1, 'unit_price', 430.00, 'cost_amount', 240.00, 'total_amount', 430.00, 'commission_total', 22.00, 'commissions', '[]'::jsonb)
    ),
    430.00, 240.00, 22.00,
    v_tag || ' OS-CRP-022', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000023', v_org, 'OS-CRP-023',
    v_cl[9], v_ve4,
    v_m2 + 18, v_m2 + 19, v_m2 + 20,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Manutenção de freios completa',
    'Troca de pastilhas e fluido de freio em todas as rodas',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Kit pastilhas 4 rodas',      'quantity', 2, 'unit_price', 240.00, 'cost_amount', 135.00, 'total_amount', 480.00, 'commission_total', 24.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[3], 'description', 'Fluido de freio DOT4 (500ml)', 'quantity', 2, 'unit_price',  60.00, 'cost_amount',  28.00, 'total_amount', 120.00, 'commission_total',  6.00, 'commissions', '[]'::jsonb)
    ),
    600.00, 326.00, 30.00,
    v_tag || ' OS-CRP-023', v_user, v_user
  ),

  -- ==========================================================================
  -- Juliana Neves Cardoso  (2 orders)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000024', v_org, 'OS-CRP-024',
    v_cl[10], v_ve5,
    LEAST(v_m0 + 4, current_date), LEAST(v_m0 + 5, current_date), LEAST(v_m0 + 5, current_date),
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Carro superaquecendo em trânsito lento',
    'Substituição do radiador e mangueiras',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[2], 'description', 'Radiador alumínio c/ reservatório', 'quantity', 1, 'unit_price', 750.00, 'cost_amount', 420.00, 'total_amount', 750.00, 'commission_total', 38.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[4], 'description', 'Jogo de mangueiras do radiador',    'quantity', 1, 'unit_price', 180.00, 'cost_amount',  90.00, 'total_amount', 180.00, 'commission_total',  9.00, 'commissions', '[]'::jsonb)
    ),
    930.00, 510.00, 47.00,
    v_tag || ' OS-CRP-024', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000025', v_org, 'OS-CRP-025',
    v_cl[10], v_ve5,
    v_m1 + 12, v_m1 + 13, v_m1 + 14,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'cash', false, NULL,
    'Troca de amortecedores traseiros',
    'Par de amortecedores traseiros — veículo com 80k km',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[2], 'description', 'Amortecedor traseiro par', 'quantity', 1, 'unit_price', 680.00, 'cost_amount', 380.00, 'total_amount', 680.00, 'commission_total', 34.00, 'commissions', '[]'::jsonb)
    ),
    680.00, 380.00, 34.00,
    v_tag || ' OS-CRP-025', v_user, v_user
  ),

  -- ==========================================================================
  -- Clients 11-15  (1 order each — new / one-time customers)
  -- ==========================================================================
  (
    'e0000001-0000-0000-0000-000000000026', v_org, 'OS-CRP-026',
    v_cl[11], v_ve1,
    LEAST(v_m0 + 8, current_date), LEAST(v_m0 + 9, current_date), LEAST(v_m0 + 9, current_date),
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'open', 'pending', 'pix', false, NULL,
    'Orçamento para revisão geral',
    'Orçamento aprovado, aguardando início dos serviços',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Revisão geral 20.000 km', 'quantity', 1, 'unit_price', 640.00, 'cost_amount', 340.00, 'total_amount', 640.00, 'commission_total', 32.00, 'commissions', '[]'::jsonb)
    ),
    640.00, 340.00, 32.00,
    v_tag || ' OS-CRP-026', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000027', v_org, 'OS-CRP-027',
    v_cl[12], v_ve2,
    v_m1 + 6, v_m1 + 7, v_m1 + 7,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'credit_card', false, NULL,
    'Troca de óleo motor diesel',
    'Óleo 15W40 mineral + filtro de óleo e combustível',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Óleo 15W40 mineral 7L',  'quantity', 1, 'unit_price', 180.00, 'cost_amount',  95.00, 'total_amount', 180.00, 'commission_total',  9.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[3], 'description', 'Filtros óleo + combustível', 'quantity', 2, 'unit_price',  75.00, 'cost_amount',  38.00, 'total_amount', 150.00, 'commission_total',  8.00, 'commissions', '[]'::jsonb)
    ),
    330.00, 171.00, 17.00,
    v_tag || ' OS-CRP-027', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000028', v_org, 'OS-CRP-028',
    v_cl[13], v_ve3,
    v_m1 + 24, v_m1 + 25, v_m1 + 25,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'paid', 'pix', false, NULL,
    'Reparo na embreagem — pedal sem retorno',
    'Substituição do kit embreagem completo',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Kit embreagem (disco + platô + rolamento)', 'quantity', 1, 'unit_price', 1100.00, 'cost_amount', 620.00, 'total_amount', 1100.00, 'commission_total', 55.00, 'commissions', '[]'::jsonb)
    ),
    1100.00, 620.00, 55.00,
    v_tag || ' OS-CRP-028', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000029', v_org, 'OS-CRP-029',
    v_cl[14], v_ve4,
    v_m2 + 10, v_m2 + 11, v_m2 + 11,
    v_em[2], jsonb_build_array(jsonb_build_object('employee_id', v_em[2])),
    'delivered', 'paid', 'cash', false, NULL,
    'Plaquetas de freio e retífica do disco',
    'Retífica dos discos dianteiros + pastilhas novas',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[1], 'description', 'Retífica disco + pastilha dianteira', 'quantity', 1, 'unit_price', 420.00, 'cost_amount', 230.00, 'total_amount', 420.00, 'commission_total', 22.00, 'commissions', '[]'::jsonb)
    ),
    420.00, 230.00, 22.00,
    v_tag || ' OS-CRP-029', v_user, v_user
  ),
  (
    'e0000001-0000-0000-0000-000000000030', v_org, 'OS-CRP-030',
    v_cl[15], v_ve5,
    v_m2 + 22, v_m2 + 23, v_m2 + 24,
    v_em[1], jsonb_build_array(jsonb_build_object('employee_id', v_em[1])),
    'delivered', 'partial', 'credit_card', false, NULL,
    'Sistema de arrefecimento com vazamento',
    'Reparo na bomba dágua e termostato',
    jsonb_build_array(
      jsonb_build_object('product_id', v_pr[4], 'description', 'Bomba d''água + termostato', 'quantity', 1, 'unit_price', 590.00, 'cost_amount', 330.00, 'total_amount', 590.00, 'commission_total', 30.00, 'commissions', '[]'::jsonb),
      jsonb_build_object('product_id', v_pr[3], 'description', 'Aditivo de arrefecimento 5L', 'quantity', 1, 'unit_price',  90.00, 'cost_amount',  42.00, 'total_amount',  90.00, 'commission_total',  4.00, 'commissions', '[]'::jsonb)
    ),
    680.00, 372.00, 34.00,
    v_tag || ' OS-CRP-030', v_user, v_user
  );

  RAISE NOTICE 'customers_report_demo_seed: 15 clients + 30 service orders inserted for organization_id=%', v_org;
END $$;
