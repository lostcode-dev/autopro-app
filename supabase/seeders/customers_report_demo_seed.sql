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
-- - 50 clients with realistic Brazilian names
-- - 90 service orders spread across 4 months
--     • Clients 1-5:  5 orders each  (frequent / high-value customers)
--     • Clients 6-10: 4 orders each  (regular customers)
--     • Clients 11-15: 2 orders each (occasional customers)
--     • Clients 16-50: 1 order each  (new / one-time customers)
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

  v_cl    uuid[];
  v_ve    uuid[];
  v_em    uuid[];
  v_pr    uuid[];

  v_ve1   uuid;
  v_ve2   uuid;
  v_ve3   uuid;
  v_ve4   uuid;
  v_ve5   uuid;

  v_m0    date := date_trunc('month', current_date)::date;
  v_m1    date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_m2    date := (date_trunc('month', current_date) - interval '2 months')::date;
  v_m3    date := (date_trunc('month', current_date) - interval '3 months')::date;
BEGIN
  IF v_org IS NULL THEN
    SELECT id INTO v_org FROM public.organizations
     WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1;
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create one before running this seed.';
  END IF;

  DELETE FROM public.service_orders
   WHERE organization_id = v_org AND notes LIKE v_tag || '%';
  DELETE FROM public.clients
   WHERE organization_id = v_org AND notes LIKE v_tag || '%';

  -- ---------------------------------------------------------------------------
  -- 15 clients
  -- ---------------------------------------------------------------------------
  INSERT INTO public.clients (
    organization_id, name, person_type, tax_id,
    phone, email, city, state,
    notes, created_by, updated_by
  ) VALUES
  (v_org,'Ana Beatriz Costa',       'pf','11100000001','11991110001','ana.costa@email.test',        'São Paulo',        'SP',v_tag||' 01',v_user,v_user),
  (v_org,'Bruno Henrique Melo',     'pf','11100000002','11991110002','bruno.melo@email.test',       'Campinas',         'SP',v_tag||' 02',v_user,v_user),
  (v_org,'Camila Ferreira Dias',    'pf','11100000003','11991110003','camila.dias@email.test',      'Rio de Janeiro',   'RJ',v_tag||' 03',v_user,v_user),
  (v_org,'Daniel Souza Lopes',      'pf','11100000004','11991110004','daniel.lopes@email.test',     'Belo Horizonte',   'MG',v_tag||' 04',v_user,v_user),
  (v_org,'Eduardo Lima Santos',     'pf','11100000005','11991110005','eduardo.santos@email.test',   'São Paulo',        'SP',v_tag||' 05',v_user,v_user),
  (v_org,'Fernanda Araújo Silva',   'pf','11100000006','11991110006','fernanda.araujo@email.test',  'Curitiba',         'PR',v_tag||' 06',v_user,v_user),
  (v_org,'Gabriel Costa Rodrigues', 'pf','11100000007','11991110007','gabriel.rodrigues@email.test','Porto Alegre',     'RS',v_tag||' 07',v_user,v_user),
  (v_org,'Helena Martins Vieira',   'pf','11100000008','11991110008','helena.vieira@email.test',    'Recife',           'PE',v_tag||' 08',v_user,v_user),
  (v_org,'Igor Pereira Ramos',      'pf','11100000009','11991110009','igor.ramos@email.test',       'Salvador',         'BA',v_tag||' 09',v_user,v_user),
  (v_org,'Juliana Neves Cardoso',   'pf','11100000010','11991110010','juliana.cardoso@email.test',  'Fortaleza',        'CE',v_tag||' 10',v_user,v_user),
  (v_org,'Kevin Alves Torres',      'pf','11100000011','11991110011','kevin.torres@email.test',     'Brasília',         'DF',v_tag||' 11',v_user,v_user),
  (v_org,'Laura Monteiro Farias',   'pf','11100000012','11991110012','laura.farias@email.test',     'Manaus',           'AM',v_tag||' 12',v_user,v_user),
  (v_org,'Marcos Barbosa Cunha',    'pf','11100000013','11991110013','marcos.cunha@email.test',     'Goiânia',          'GO',v_tag||' 13',v_user,v_user),
  (v_org,'Natalia Ribeiro Campos',  'pf','11100000014','11991110014','natalia.campos@email.test',   'São Paulo',        'SP',v_tag||' 14',v_user,v_user),
  (v_org,'Otávio Carvalho Pires',   'pf','11100000015','11991110015','otavio.pires@email.test',     'Vitória',          'ES',v_tag||' 15',v_user,v_user),
  -- Clients 16-50
  (v_org,'Pedro Augusto Correia',    'pf','11100000016','11991110016','pedro.correia@email.test',    'Florianópolis',    'SC',v_tag||' 16',v_user,v_user),
  (v_org,'Renata Oliveira Moura',    'pf','11100000017','11991110017','renata.moura@email.test',     'São Paulo',        'SP',v_tag||' 17',v_user,v_user),
  (v_org,'Sérgio Fonseca Lima',      'pf','11100000018','11991110018','sergio.lima@email.test',      'Rio de Janeiro',   'RJ',v_tag||' 18',v_user,v_user),
  (v_org,'Tatiane Borges Almeida',   'pf','11100000019','11991110019','tatiane.almeida@email.test',  'Curitiba',         'PR',v_tag||' 19',v_user,v_user),
  (v_org,'Ulisses Ferreira Neto',    'pf','11100000020','11991110020','ulisses.neto@email.test',     'Brasília',         'DF',v_tag||' 20',v_user,v_user),
  (v_org,'Vanessa Prado Rocha',      'pf','11100000021','11991110021','vanessa.rocha@email.test',    'Belo Horizonte',   'MG',v_tag||' 21',v_user,v_user),
  (v_org,'Wagner Santos Bispo',      'pf','11100000022','11991110022','wagner.bispo@email.test',     'Salvador',         'BA',v_tag||' 22',v_user,v_user),
  (v_org,'Ximena Castro Freitas',    'pf','11100000023','11991110023','ximena.freitas@email.test',   'Recife',           'PE',v_tag||' 23',v_user,v_user),
  (v_org,'Yago Mendes Teixeira',     'pf','11100000024','11991110024','yago.teixeira@email.test',    'Fortaleza',        'CE',v_tag||' 24',v_user,v_user),
  (v_org,'Zuleika Andrade Gomes',    'pf','11100000025','11991110025','zuleika.gomes@email.test',    'Porto Alegre',     'RS',v_tag||' 25',v_user,v_user),
  (v_org,'André Luís Pacheco',       'pf','11100000026','11991110026','andre.pacheco@email.test',    'Manaus',           'AM',v_tag||' 26',v_user,v_user),
  (v_org,'Beatriz Cunha Saraiva',    'pf','11100000027','11991110027','beatriz.saraiva@email.test',  'Goiânia',          'GO',v_tag||' 27',v_user,v_user),
  (v_org,'Cássio Henrique Pinto',    'pf','11100000028','11991110028','cassio.pinto@email.test',     'Vitória',          'ES',v_tag||' 28',v_user,v_user),
  (v_org,'Débora Leal Monteiro',     'pf','11100000029','11991110029','debora.monteiro@email.test',  'São Paulo',        'SP',v_tag||' 29',v_user,v_user),
  (v_org,'Elias Rodrigues Viana',    'pf','11100000030','11991110030','elias.viana@email.test',      'Campinas',         'SP',v_tag||' 30',v_user,v_user),
  (v_org,'Fábio Azevedo Queiroz',    'pf','11100000031','11991110031','fabio.queiroz@email.test',    'Rio de Janeiro',   'RJ',v_tag||' 31',v_user,v_user),
  (v_org,'Giovana Macedo Braga',     'pf','11100000032','11991110032','giovana.braga@email.test',    'Belo Horizonte',   'MG',v_tag||' 32',v_user,v_user),
  (v_org,'Henrique Vilela Costa',    'pf','11100000033','11991110033','henrique.vcosta@email.test',  'São Paulo',        'SP',v_tag||' 33',v_user,v_user),
  (v_org,'Isabela Nogueira Luz',     'pf','11100000034','11991110034','isabela.luz@email.test',      'Curitiba',         'PR',v_tag||' 34',v_user,v_user),
  (v_org,'Jefferson Mota Dantas',    'pf','11100000035','11991110035','jefferson.dantas@email.test', 'Brasília',         'DF',v_tag||' 35',v_user,v_user),
  (v_org,'Kátia Sousa Bento',        'pf','11100000036','11991110036','katia.bento@email.test',      'Salvador',         'BA',v_tag||' 36',v_user,v_user),
  (v_org,'Leonardo Dias Faria',      'pf','11100000037','11991110037','leonardo.faria@email.test',   'Fortaleza',        'CE',v_tag||' 37',v_user,v_user),
  (v_org,'Mônica Teles Assis',       'pf','11100000038','11991110038','monica.assis@email.test',     'Porto Alegre',     'RS',v_tag||' 38',v_user,v_user),
  (v_org,'Nilton Cruz Esperança',    'pf','11100000039','11991110039','nilton.esperanca@email.test', 'Recife',           'PE',v_tag||' 39',v_user,v_user),
  (v_org,'Olívia Carneiro Soares',   'pf','11100000040','11991110040','olivia.soares@email.test',    'São Paulo',        'SP',v_tag||' 40',v_user,v_user),
  (v_org,'Paulo Sérgio Araújo',      'pf','11100000041','11991110041','paulo.araujo@email.test',     'Rio de Janeiro',   'RJ',v_tag||' 41',v_user,v_user),
  (v_org,'Queila Menezes Forte',     'pf','11100000042','11991110042','queila.forte@email.test',     'Manaus',           'AM',v_tag||' 42',v_user,v_user),
  (v_org,'Roberto Nascimento Paz',   'pf','11100000043','11991110043','roberto.paz@email.test',      'Goiânia',          'GO',v_tag||' 43',v_user,v_user),
  (v_org,'Sandra Lopes Bezerra',     'pf','11100000044','11991110044','sandra.bezerra@email.test',   'Vitória',          'ES',v_tag||' 44',v_user,v_user),
  (v_org,'Thiago Guimarães Vale',    'pf','11100000045','11991110045','thiago.vale@email.test',      'São Paulo',        'SP',v_tag||' 45',v_user,v_user),
  (v_org,'Ursula Campos Pereira',    'pf','11100000046','11991110046','ursula.pereira@email.test',   'Campinas',         'SP',v_tag||' 46',v_user,v_user),
  (v_org,'Valdir Batista Hora',      'pf','11100000047','11991110047','valdir.hora@email.test',      'Florianópolis',    'SC',v_tag||' 47',v_user,v_user),
  (v_org,'Wanda Pires Esteves',      'pf','11100000048','11991110048','wanda.esteves@email.test',    'Belo Horizonte',   'MG',v_tag||' 48',v_user,v_user),
  (v_org,'Xerxes Tavares Luz',       'pf','11100000049','11991110049','xerxes.luz@email.test',       'Brasília',         'DF',v_tag||' 49',v_user,v_user),
  (v_org,'Yolanda Melo Rezende',     'pf','11100000050','11991110050','yolanda.rezende@email.test',  'Salvador',         'BA',v_tag||' 50',v_user,v_user);

  SELECT ARRAY(
    SELECT id FROM public.clients
     WHERE organization_id = v_org AND notes LIKE v_tag || '%'
     ORDER BY notes
  ) INTO v_cl;

  IF coalesce(array_length(v_cl,1),0) < 50 THEN
    RAISE EXCEPTION 'Expected 50 seeded clients, got %.', coalesce(array_length(v_cl,1),0);
  END IF;

  SELECT ARRAY(SELECT id FROM public.vehicles  WHERE organization_id=v_org AND deleted_at IS NULL ORDER BY created_at LIMIT 10) INTO v_ve;
  SELECT ARRAY(SELECT id FROM public.employees WHERE organization_id=v_org AND deleted_at IS NULL ORDER BY created_at LIMIT 4)  INTO v_em;
  SELECT ARRAY(SELECT id FROM public.products  WHERE organization_id=v_org AND deleted_at IS NULL ORDER BY created_at LIMIT 8)  INTO v_pr;

  IF coalesce(array_length(v_ve,1),0)<1 THEN RAISE EXCEPTION 'No vehicles. Run vehicles_demo_seed.sql first.'; END IF;
  IF coalesce(array_length(v_em,1),0)<2 THEN RAISE EXCEPTION 'Need >= 2 employees. Run settings_demo_seed.sql first.'; END IF;
  IF coalesce(array_length(v_pr,1),0)<4 THEN RAISE EXCEPTION 'Need >= 4 products. Run products_demo_seed.sql first.'; END IF;

  v_ve1 := v_ve[1];
  v_ve2 := v_ve[LEAST(2,array_length(v_ve,1))];
  v_ve3 := v_ve[LEAST(3,array_length(v_ve,1))];
  v_ve4 := v_ve[LEAST(4,array_length(v_ve,1))];
  v_ve5 := v_ve[LEAST(5,array_length(v_ve,1))];

  -- ---------------------------------------------------------------------------
  -- 55 service orders
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

  -- ============================================================
  -- Ana Beatriz Costa — 5 ordens (maior cliente, alto ticket)
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000001',v_org,'OS-CRP-001',v_cl[1],v_ve1,
   LEAST(v_m0+3,current_date),LEAST(v_m0+4,current_date),LEAST(v_m0+4,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Freio traseiro com ruído ao parar','Substituição de pastilhas e discos traseiros',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Pastilha freio traseira','quantity',1,'unit_price',380.00,'cost_amount',210.00,'total_amount',380.00,'commission_total',22.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[2],'description','Disco de freio par traseiro','quantity',1,'unit_price',310.00,'cost_amount',170.00,'total_amount',310.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),690.00,380.00,40.00,v_tag||' OS-CRP-001',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000002',v_org,'OS-CRP-002',v_cl[1],v_ve1,
   v_m1+10,v_m1+11,v_m1+11,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Revisão de 10.000 km','Troca de óleo sintético e filtros',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Óleo sintético 5W30 5L','quantity',1,'unit_price',220.00,'cost_amount',130.00,'total_amount',220.00,'commission_total',12.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[3],'description','Filtro de óleo + ar','quantity',2,'unit_price',90.00,'cost_amount',48.00,'total_amount',180.00,'commission_total',8.00,'commissions','[]'::jsonb)
   ),400.00,226.00,20.00,v_tag||' OS-CRP-002',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000003',v_org,'OS-CRP-003',v_cl[1],v_ve1,
   v_m2+5,v_m2+6,v_m2+7,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Suspensão com ruído na dianteira','Reposição de buchas e amortecedor dianteiro',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Amortecedor dianteiro par','quantity',1,'unit_price',640.00,'cost_amount',380.00,'total_amount',640.00,'commission_total',30.00,'commissions','[]'::jsonb)
   ),640.00,380.00,30.00,v_tag||' OS-CRP-003',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000004',v_org,'OS-CRP-004',v_cl[1],v_ve1,
   v_m3+8,v_m3+9,v_m3+10,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Troca de correia dentada','Substituição da correia + tensor + bomba d''água',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit correia dentada completo','quantity',1,'unit_price',780.00,'cost_amount',430.00,'total_amount',780.00,'commission_total',38.00,'commissions','[]'::jsonb)
   ),780.00,430.00,38.00,v_tag||' OS-CRP-004',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000005',v_org,'OS-CRP-005',v_cl[1],v_ve1,
   LEAST(v_m0+12,current_date),LEAST(v_m0+14,current_date),NULL,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'in_progress','pending','pix',false,NULL,
   'Ar-condicionado sem refrigeração','Diagnóstico em andamento — compressor verificado',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Diagnóstico sistema A/C','quantity',1,'unit_price',150.00,'cost_amount',50.00,'total_amount',150.00,'commission_total',8.00,'commissions','[]'::jsonb)
   ),150.00,50.00,8.00,v_tag||' OS-CRP-005',v_user,v_user),

  -- ============================================================
  -- Bruno Henrique Melo — 5 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000006',v_org,'OS-CRP-006',v_cl[2],v_ve2,
   LEAST(v_m0+7,current_date),LEAST(v_m0+8,current_date),LEAST(v_m0+8,current_date),
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Alinhamento e balanceamento','Alinhamento 4 rodas + balanceamento computadorizado',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Alinhamento e balanceamento','quantity',1,'unit_price',180.00,'cost_amount',80.00,'total_amount',180.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),180.00,80.00,10.00,v_tag||' OS-CRP-006',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000007',v_org,'OS-CRP-007',v_cl[2],v_ve2,
   v_m1+18,v_m1+19,v_m1+20,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','partial','credit_card',false,NULL,
   'Motor falhando em baixa rotação','Velas e bobines de ignição substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Jogo de velas iridium','quantity',4,'unit_price',85.00,'cost_amount',48.00,'total_amount',340.00,'commission_total',18.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[3],'description','Bobine de ignição','quantity',2,'unit_price',195.00,'cost_amount',115.00,'total_amount',390.00,'commission_total',22.00,'commissions','[]'::jsonb)
   ),730.00,424.00,40.00,v_tag||' OS-CRP-007',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000008',v_org,'OS-CRP-008',v_cl[2],v_ve2,
   v_m2+12,v_m2+13,v_m2+14,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Troca de correia dentada','Correia + tensor substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit correia dentada','quantity',1,'unit_price',520.00,'cost_amount',290.00,'total_amount',520.00,'commission_total',28.00,'commissions','[]'::jsonb)
   ),520.00,290.00,28.00,v_tag||' OS-CRP-008',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000009',v_org,'OS-CRP-009',v_cl[2],v_ve2,
   v_m3+15,v_m3+16,v_m3+17,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','transfer',false,NULL,
   'Vazamento de óleo no cárter','Troca de junta e vedante do motor',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Junta do cárter + vedante','quantity',1,'unit_price',340.00,'cost_amount',180.00,'total_amount',340.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),340.00,180.00,18.00,v_tag||' OS-CRP-009',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000010',v_org,'OS-CRP-010',v_cl[2],v_ve2,
   LEAST(v_m0+2,current_date),LEAST(v_m0+3,current_date),LEAST(v_m0+3,current_date),
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Revisão preventiva 20.000 km','Revisão completa com troca de fluidos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão preventiva 20k km','quantity',1,'unit_price',650.00,'cost_amount',340.00,'total_amount',650.00,'commission_total',32.00,'commissions','[]'::jsonb)
   ),650.00,340.00,32.00,v_tag||' OS-CRP-010',v_user,v_user),

  -- ============================================================
  -- Camila Ferreira Dias — 5 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000011',v_org,'OS-CRP-011',v_cl[3],v_ve3,
   LEAST(v_m0+5,current_date),LEAST(v_m0+6,current_date),LEAST(v_m0+6,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'completed','paid','transfer',false,NULL,
   'Ar-condicionado não gela','Recarga de gás R134a e limpeza do sistema',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Recarga gás R134a + aditivo','quantity',1,'unit_price',290.00,'cost_amount',140.00,'total_amount',290.00,'commission_total',16.00,'commissions','[]'::jsonb)
   ),290.00,140.00,16.00,v_tag||' OS-CRP-011',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000012',v_org,'OS-CRP-012',v_cl[3],v_ve3,
   v_m1+8,v_m1+9,v_m1+10,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Revisão pré-viagem','Freios, pneus, fluidos e iluminação verificados',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão pré-viagem completa','quantity',1,'unit_price',450.00,'cost_amount',220.00,'total_amount',450.00,'commission_total',24.00,'commissions','[]'::jsonb)
   ),450.00,220.00,24.00,v_tag||' OS-CRP-012',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000013',v_org,'OS-CRP-013',v_cl[3],v_ve3,
   v_m2+20,v_m2+21,v_m2+22,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','credit_card',false,NULL,
   'Bateria fraca, carro não liga','Substituição de bateria 60Ah',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Bateria automotiva 60Ah','quantity',1,'unit_price',380.00,'cost_amount',210.00,'total_amount',380.00,'commission_total',20.00,'commissions','[]'::jsonb)
   ),380.00,210.00,20.00,v_tag||' OS-CRP-013',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000014',v_org,'OS-CRP-014',v_cl[3],v_ve3,
   v_m3+5,v_m3+6,v_m3+7,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Pneus desgastados','Troca de 2 pneus dianteiros 195/65 R15',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Pneu 195/65 R15','quantity',2,'unit_price',290.00,'cost_amount',175.00,'total_amount',580.00,'commission_total',28.00,'commissions','[]'::jsonb)
   ),580.00,350.00,28.00,v_tag||' OS-CRP-014',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000015',v_org,'OS-CRP-015',v_cl[3],v_ve3,
   v_m1+25,v_m1+26,v_m1+27,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','partial','credit_card',false,NULL,
   'Embreagem patinando','Substituição de kit embreagem completo',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit embreagem (disco + platô + rolamento)','quantity',1,'unit_price',1100.00,'cost_amount',620.00,'total_amount',1100.00,'commission_total',55.00,'commissions','[]'::jsonb)
   ),1100.00,620.00,55.00,v_tag||' OS-CRP-015',v_user,v_user),

  -- ============================================================
  -- Daniel Souza Lopes — 5 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000016',v_org,'OS-CRP-016',v_cl[4],v_ve4,
   LEAST(v_m0+2,current_date),LEAST(v_m0+3,current_date),LEAST(v_m0+3,current_date),
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Direção com vibração acima de 80 km/h','Balanceamento computadorizado 4 rodas',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Balanceamento 4 rodas','quantity',4,'unit_price',45.00,'cost_amount',18.00,'total_amount',180.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),180.00,72.00,10.00,v_tag||' OS-CRP-016',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000017',v_org,'OS-CRP-017',v_cl[4],v_ve4,
   v_m1+5,v_m1+7,v_m1+7,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','cash',false,NULL,
   'Escapamento com barulho','Substituição do silencioso traseiro',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Silencioso traseiro universal','quantity',1,'unit_price',480.00,'cost_amount',270.00,'total_amount',480.00,'commission_total',26.00,'commissions','[]'::jsonb)
   ),480.00,270.00,26.00,v_tag||' OS-CRP-017',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000018',v_org,'OS-CRP-018',v_cl[4],v_ve4,
   v_m2+14,v_m2+16,v_m2+16,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Luz do check engine acesa','Sensor O2 substituído após diagnóstico por scanner',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Sensor de oxigênio','quantity',1,'unit_price',320.00,'cost_amount',175.00,'total_amount',320.00,'commission_total',18.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[3],'description','Mão de obra diagnóstico','quantity',1,'unit_price',120.00,'cost_amount',40.00,'total_amount',120.00,'commission_total',6.00,'commissions','[]'::jsonb)
   ),440.00,215.00,24.00,v_tag||' OS-CRP-018',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000019',v_org,'OS-CRP-019',v_cl[4],v_ve4,
   v_m3+20,v_m3+22,v_m3+22,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Revisão de 40.000 km','Revisão completa: correias, fluidos, filtros e freios',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão 40k km completa','quantity',1,'unit_price',1200.00,'cost_amount',660.00,'total_amount',1200.00,'commission_total',60.00,'commissions','[]'::jsonb)
   ),1200.00,660.00,60.00,v_tag||' OS-CRP-019',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000020',v_org,'OS-CRP-020',v_cl[4],v_ve4,
   LEAST(v_m0+9,current_date),LEAST(v_m0+10,current_date),NULL,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'open','pending','bank_slip',false,NULL,
   'Transmissão com solavanco ao engatar','Aguardando diagnóstico do câmbio automático',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Diagnóstico câmbio automático','quantity',1,'unit_price',200.00,'cost_amount',70.00,'total_amount',200.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),200.00,70.00,10.00,v_tag||' OS-CRP-020',v_user,v_user),

  -- ============================================================
  -- Eduardo Lima Santos — 5 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000021',v_org,'OS-CRP-021',v_cl[5],v_ve5,
   LEAST(v_m0+10,current_date),LEAST(v_m0+12,current_date),LEAST(v_m0+12,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'completed','paid','pix',false,NULL,
   'Reparo no sistema elétrico — lanternas não funcionam','Fusíveis e relés substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Mão de obra elétrica','quantity',1,'unit_price',280.00,'cost_amount',90.00,'total_amount',280.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),280.00,90.00,14.00,v_tag||' OS-CRP-021',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000022',v_org,'OS-CRP-022',v_cl[5],v_ve5,
   v_m1+22,v_m1+24,v_m1+24,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','transfer',false,NULL,
   'Troca de fluido de freio e embreagem','Fluidos trocados — inspecão ok',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Fluido de freio DOT4 + embreagem','quantity',2,'unit_price',95.00,'cost_amount',48.00,'total_amount',190.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),190.00,96.00,10.00,v_tag||' OS-CRP-022',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000023',v_org,'OS-CRP-023',v_cl[5],v_ve5,
   v_m2+8,v_m2+9,v_m2+10,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Pneus carecas — 4 unidades','Substituição de 4 pneus 195/65 R15',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Pneu 195/65 R15','quantity',4,'unit_price',290.00,'cost_amount',175.00,'total_amount',1160.00,'commission_total',56.00,'commissions','[]'::jsonb)
   ),1160.00,700.00,56.00,v_tag||' OS-CRP-023',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000024',v_org,'OS-CRP-024',v_cl[5],v_ve5,
   v_m3+10,v_m3+12,v_m3+12,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Pastilhas de freio desgastadas','Troca de pastilhas nas 4 rodas',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit pastilhas 4 rodas','quantity',2,'unit_price',240.00,'cost_amount',135.00,'total_amount',480.00,'commission_total',24.00,'commissions','[]'::jsonb)
   ),480.00,270.00,24.00,v_tag||' OS-CRP-024',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000025',v_org,'OS-CRP-025',v_cl[5],v_ve5,
   v_m1+14,v_m1+15,v_m1+16,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','credit_card',false,NULL,
   'Direção pesada e com folga','Troca da caixa de direção hidráulica',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Caixa de direção hidráulica remanufaturada','quantity',1,'unit_price',1350.00,'cost_amount',780.00,'total_amount',1350.00,'commission_total',65.00,'commissions','[]'::jsonb)
   ),1350.00,780.00,65.00,v_tag||' OS-CRP-025',v_user,v_user),

  -- ============================================================
  -- Fernanda Araújo Silva — 4 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000026',v_org,'OS-CRP-026',v_cl[6],v_ve1,
   LEAST(v_m0+6,current_date),LEAST(v_m0+7,current_date),LEAST(v_m0+7,current_date),
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Faróis embaçados','Polimento e selagem dos faróis dianteiros',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Polimento de faróis','quantity',2,'unit_price',110.00,'cost_amount',45.00,'total_amount',220.00,'commission_total',12.00,'commissions','[]'::jsonb)
   ),220.00,90.00,12.00,v_tag||' OS-CRP-026',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000027',v_org,'OS-CRP-027',v_cl[6],v_ve1,
   v_m1+15,v_m1+17,v_m1+17,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Limpeza de bicos injetores','Lavagem ultrassônica dos injetores',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Limpeza de injetores (4 un)','quantity',1,'unit_price',340.00,'cost_amount',160.00,'total_amount',340.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),340.00,160.00,18.00,v_tag||' OS-CRP-027',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000028',v_org,'OS-CRP-028',v_cl[6],v_ve1,
   v_m2+9,v_m2+10,v_m2+11,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Troca de pastilhas dianteiras','Pastilhas dianteiras + verificação do freio a mão',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Pastilha de freio dianteira','quantity',1,'unit_price',260.00,'cost_amount',140.00,'total_amount',260.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),260.00,140.00,14.00,v_tag||' OS-CRP-028',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000029',v_org,'OS-CRP-029',v_cl[6],v_ve1,
   v_m3+18,v_m3+19,v_m3+20,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Câmbio manual com dificuldade para engatar','Troca do fluido de câmbio e cabos de marcha',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Fluido câmbio + cabos de marcha','quantity',1,'unit_price',420.00,'cost_amount',230.00,'total_amount',420.00,'commission_total',22.00,'commissions','[]'::jsonb)
   ),420.00,230.00,22.00,v_tag||' OS-CRP-029',v_user,v_user),

  -- ============================================================
  -- Gabriel Costa Rodrigues — 4 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000030',v_org,'OS-CRP-030',v_cl[7],v_ve2,
   LEAST(v_m0+9,current_date),LEAST(v_m0+10,current_date),LEAST(v_m0+10,current_date),
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'completed','paid','cash',false,NULL,
   'Troca de pastilhas dianteiras','Pastilhas dianteiras + verificação geral',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Pastilha de freio dianteira','quantity',1,'unit_price',260.00,'cost_amount',140.00,'total_amount',260.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),260.00,140.00,14.00,v_tag||' OS-CRP-030',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000031',v_org,'OS-CRP-031',v_cl[7],v_ve2,
   v_m1+6,v_m1+8,v_m1+8,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','partial','credit_card',false,NULL,
   'Compressor do A/C com ruído','Troca do compressor e recarga de gás',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Compressor de A/C remanufaturado','quantity',1,'unit_price',980.00,'cost_amount',580.00,'total_amount',980.00,'commission_total',48.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[3],'description','Mão de obra montagem A/C','quantity',1,'unit_price',280.00,'cost_amount',80.00,'total_amount',280.00,'commission_total',16.00,'commissions','[]'::jsonb)
   ),1260.00,660.00,64.00,v_tag||' OS-CRP-031',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000032',v_org,'OS-CRP-032',v_cl[7],v_ve2,
   v_m2+22,v_m2+23,v_m2+24,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Revisão de 15.000 km','Troca de óleo, filtros e verificação geral',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão 15k km','quantity',1,'unit_price',480.00,'cost_amount',250.00,'total_amount',480.00,'commission_total',24.00,'commissions','[]'::jsonb)
   ),480.00,250.00,24.00,v_tag||' OS-CRP-032',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000033',v_org,'OS-CRP-033',v_cl[7],v_ve2,
   v_m3+7,v_m3+8,v_m3+9,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','cash',false,NULL,
   'Reparo elétrico — vidro elétrico não funciona','Motor do vidro elétrico substituído',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Motor vidro elétrico LD','quantity',1,'unit_price',380.00,'cost_amount',210.00,'total_amount',380.00,'commission_total',20.00,'commissions','[]'::jsonb)
   ),380.00,210.00,20.00,v_tag||' OS-CRP-033',v_user,v_user),

  -- ============================================================
  -- Helena Martins Vieira — 4 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000034',v_org,'OS-CRP-034',v_cl[8],v_ve3,
   LEAST(v_m0+1,current_date),LEAST(v_m0+2,current_date),LEAST(v_m0+2,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Revisão de 30.000 km','Revisão completa: óleo, filtros, correias e inspeção geral',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão 30k km completa','quantity',1,'unit_price',890.00,'cost_amount',490.00,'total_amount',890.00,'commission_total',44.00,'commissions','[]'::jsonb)
   ),890.00,490.00,44.00,v_tag||' OS-CRP-034',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000035',v_org,'OS-CRP-035',v_cl[8],v_ve3,
   v_m1+20,v_m1+21,v_m1+22,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','transfer',false,NULL,
   'Coxins do motor desgastados','Troca dos 4 coxins do motor',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Coxim do motor (kit 4 un)','quantity',1,'unit_price',560.00,'cost_amount',310.00,'total_amount',560.00,'commission_total',28.00,'commissions','[]'::jsonb)
   ),560.00,310.00,28.00,v_tag||' OS-CRP-035',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000036',v_org,'OS-CRP-036',v_cl[8],v_ve3,
   v_m2+4,v_m2+5,v_m2+6,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Buzina não funciona e limpador de para-brisa falhando','Reparo elétrico geral',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Reparo elétrico buzina + limpador','quantity',1,'unit_price',220.00,'cost_amount',90.00,'total_amount',220.00,'commission_total',12.00,'commissions','[]'::jsonb)
   ),220.00,90.00,12.00,v_tag||' OS-CRP-036',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000037',v_org,'OS-CRP-037',v_cl[8],v_ve3,
   v_m3+14,v_m3+15,v_m3+16,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Troca de amortecedores traseiros','Par de amortecedores traseiros + molas',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Kit amortecedor traseiro par + molas','quantity',1,'unit_price',920.00,'cost_amount',520.00,'total_amount',920.00,'commission_total',46.00,'commissions','[]'::jsonb)
   ),920.00,520.00,46.00,v_tag||' OS-CRP-037',v_user,v_user),

  -- ============================================================
  -- Igor Pereira Ramos — 4 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000038',v_org,'OS-CRP-038',v_cl[9],v_ve4,
   LEAST(v_m0+13,current_date),LEAST(v_m0+14,current_date),LEAST(v_m0+14,current_date),
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Lanterna traseira quebrada','Substituição de lanterna traseira LE',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Lanterna traseira LE original','quantity',1,'unit_price',430.00,'cost_amount',240.00,'total_amount',430.00,'commission_total',22.00,'commissions','[]'::jsonb)
   ),430.00,240.00,22.00,v_tag||' OS-CRP-038',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000039',v_org,'OS-CRP-039',v_cl[9],v_ve4,
   v_m1+3,v_m1+4,v_m1+4,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Manutenção de freios completa','Pastilhas e fluido de freio em todas as rodas',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit pastilhas 4 rodas','quantity',2,'unit_price',240.00,'cost_amount',135.00,'total_amount',480.00,'commission_total',24.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[3],'description','Fluido de freio DOT4','quantity',2,'unit_price',60.00,'cost_amount',28.00,'total_amount',120.00,'commission_total',6.00,'commissions','[]'::jsonb)
   ),600.00,326.00,30.00,v_tag||' OS-CRP-039',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000040',v_org,'OS-CRP-040',v_cl[9],v_ve4,
   v_m2+18,v_m2+19,v_m2+20,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Sistema de partida com falha','Motor de arranque substituído',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Motor de arranque remanufaturado','quantity',1,'unit_price',560.00,'cost_amount',310.00,'total_amount',560.00,'commission_total',28.00,'commissions','[]'::jsonb)
   ),560.00,310.00,28.00,v_tag||' OS-CRP-040',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000041',v_org,'OS-CRP-041',v_cl[9],v_ve4,
   v_m3+22,v_m3+24,v_m3+24,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Vela de ignição com falha no cilindro 3','Jogo de velas substituído',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Jogo de velas iridium','quantity',4,'unit_price',85.00,'cost_amount',48.00,'total_amount',340.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),340.00,192.00,18.00,v_tag||' OS-CRP-041',v_user,v_user),

  -- ============================================================
  -- Juliana Neves Cardoso — 4 ordens
  -- ============================================================
  ('e0000001-0000-0000-0000-000000000042',v_org,'OS-CRP-042',v_cl[10],v_ve5,
   LEAST(v_m0+4,current_date),LEAST(v_m0+5,current_date),LEAST(v_m0+5,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Carro superaquecendo em trânsito','Radiador e mangueiras substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Radiador alumínio + reservatório','quantity',1,'unit_price',750.00,'cost_amount',420.00,'total_amount',750.00,'commission_total',38.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[4],'description','Jogo de mangueiras do radiador','quantity',1,'unit_price',180.00,'cost_amount',90.00,'total_amount',180.00,'commission_total',9.00,'commissions','[]'::jsonb)
   ),930.00,510.00,47.00,v_tag||' OS-CRP-042',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000043',v_org,'OS-CRP-043',v_cl[10],v_ve5,
   v_m1+12,v_m1+13,v_m1+14,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Troca de amortecedores traseiros','Par de amortecedores traseiros — veículo com 80k km',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Amortecedor traseiro par','quantity',1,'unit_price',680.00,'cost_amount',380.00,'total_amount',680.00,'commission_total',34.00,'commissions','[]'::jsonb)
   ),680.00,380.00,34.00,v_tag||' OS-CRP-043',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000044',v_org,'OS-CRP-044',v_cl[10],v_ve5,
   v_m2+16,v_m2+17,v_m2+18,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','credit_card',false,NULL,
   'Alternador não carregando a bateria','Alternador substituído',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Alternador remanufaturado','quantity',1,'unit_price',780.00,'cost_amount',440.00,'total_amount',780.00,'commission_total',39.00,'commissions','[]'::jsonb)
   ),780.00,440.00,39.00,v_tag||' OS-CRP-044',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000045',v_org,'OS-CRP-045',v_cl[10],v_ve5,
   v_m3+5,v_m3+6,v_m3+7,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Filtro de ar e filtro de cabine sujos','Troca de filtros de ar e cabine',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Filtro de ar + filtro de cabine','quantity',2,'unit_price',95.00,'cost_amount',48.00,'total_amount',190.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),190.00,96.00,10.00,v_tag||' OS-CRP-045',v_user,v_user),

  -- ============================================================
  -- Clients 11-15 — 2 ordens cada
  -- ============================================================

  -- Kevin Alves Torres
  ('e0000001-0000-0000-0000-000000000046',v_org,'OS-CRP-046',v_cl[11],v_ve1,
   LEAST(v_m0+8,current_date),LEAST(v_m0+9,current_date),LEAST(v_m0+9,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'open','pending','pix',false,NULL,
   'Orçamento para revisão geral','Orçamento aprovado, aguardando início',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão geral 20k km','quantity',1,'unit_price',640.00,'cost_amount',340.00,'total_amount',640.00,'commission_total',32.00,'commissions','[]'::jsonb)
   ),640.00,340.00,32.00,v_tag||' OS-CRP-046',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000047',v_org,'OS-CRP-047',v_cl[11],v_ve1,
   v_m2+14,v_m2+15,v_m2+16,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Pneu furado no aro traseiro','Reparo de pneu e calibragem geral',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Reparo de pneu + calibragem','quantity',1,'unit_price',120.00,'cost_amount',45.00,'total_amount',120.00,'commission_total',6.00,'commissions','[]'::jsonb)
   ),120.00,45.00,6.00,v_tag||' OS-CRP-047',v_user,v_user),

  -- Laura Monteiro Farias
  ('e0000001-0000-0000-0000-000000000048',v_org,'OS-CRP-048',v_cl[12],v_ve2,
   v_m1+6,v_m1+7,v_m1+7,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Troca de óleo motor diesel','Óleo 15W40 mineral + filtros',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Óleo 15W40 mineral 7L','quantity',1,'unit_price',180.00,'cost_amount',95.00,'total_amount',180.00,'commission_total',9.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[3],'description','Filtros óleo + combustível','quantity',2,'unit_price',75.00,'cost_amount',38.00,'total_amount',150.00,'commission_total',8.00,'commissions','[]'::jsonb)
   ),330.00,171.00,17.00,v_tag||' OS-CRP-048',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000049',v_org,'OS-CRP-049',v_cl[12],v_ve2,
   v_m3+20,v_m3+21,v_m3+22,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Revisão semestral de fluidos','Troca de todos os fluidos do veículo',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Troca completa de fluidos','quantity',1,'unit_price',480.00,'cost_amount',250.00,'total_amount',480.00,'commission_total',24.00,'commissions','[]'::jsonb)
   ),480.00,250.00,24.00,v_tag||' OS-CRP-049',v_user,v_user),

  -- Marcos Barbosa Cunha
  ('e0000001-0000-0000-0000-000000000050',v_org,'OS-CRP-050',v_cl[13],v_ve3,
   LEAST(v_m0+5,current_date),LEAST(v_m0+6,current_date),LEAST(v_m0+6,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'completed','paid','pix',false,NULL,
   'Embreagem sem retorno do pedal','Substituição do kit embreagem completo',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit embreagem (disco + platô + rolamento)','quantity',1,'unit_price',1100.00,'cost_amount',620.00,'total_amount',1100.00,'commission_total',55.00,'commissions','[]'::jsonb)
   ),1100.00,620.00,55.00,v_tag||' OS-CRP-050',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000051',v_org,'OS-CRP-051',v_cl[13],v_ve3,
   v_m2+10,v_m2+11,v_m2+11,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Discos e pastilhas traseiras desgastados','Retífica dos discos + pastilhas novas',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Retífica disco + pastilha traseira','quantity',1,'unit_price',420.00,'cost_amount',230.00,'total_amount',420.00,'commission_total',22.00,'commissions','[]'::jsonb)
   ),420.00,230.00,22.00,v_tag||' OS-CRP-051',v_user,v_user),

  -- Natalia Ribeiro Campos
  ('e0000001-0000-0000-0000-000000000052',v_org,'OS-CRP-052',v_cl[14],v_ve4,
   v_m1+10,v_m1+11,v_m1+12,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Sensor de estacionamento com falha','Substituição dos sensores de ré',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Kit sensores de estacionamento (4 un)','quantity',1,'unit_price',320.00,'cost_amount',165.00,'total_amount',320.00,'commission_total',16.00,'commissions','[]'::jsonb)
   ),320.00,165.00,16.00,v_tag||' OS-CRP-052',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000053',v_org,'OS-CRP-053',v_cl[14],v_ve4,
   v_m3+12,v_m3+13,v_m3+14,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','credit_card',false,NULL,
   'Freio a mão não trava','Regulagem e substituição do cabo de freio de estacionamento',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Cabo freio de estacionamento','quantity',1,'unit_price',240.00,'cost_amount',120.00,'total_amount',240.00,'commission_total',12.00,'commissions','[]'::jsonb)
   ),240.00,120.00,12.00,v_tag||' OS-CRP-053',v_user,v_user),

  -- Otávio Carvalho Pires
  ('e0000001-0000-0000-0000-000000000054',v_org,'OS-CRP-054',v_cl[15],v_ve5,
   LEAST(v_m0+3,current_date),LEAST(v_m0+4,current_date),LEAST(v_m0+4,current_date),
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Bomba d''água com vazamento','Bomba dágua + termostato substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Bomba d''água + termostato','quantity',1,'unit_price',590.00,'cost_amount',330.00,'total_amount',590.00,'commission_total',30.00,'commissions','[]'::jsonb),
     jsonb_build_object('product_id',v_pr[3],'description','Aditivo de arrefecimento 5L','quantity',1,'unit_price',90.00,'cost_amount',42.00,'total_amount',90.00,'commission_total',4.00,'commissions','[]'::jsonb)
   ),680.00,372.00,34.00,v_tag||' OS-CRP-054',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000055',v_org,'OS-CRP-055',v_cl[15],v_ve5,
   v_m2+20,v_m2+22,v_m2+22,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','partial','credit_card',false,NULL,
   'Troca completa de pneus — 4 unidades','Pneus 205/55 R16 substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Pneu 205/55 R16','quantity',4,'unit_price',340.00,'cost_amount',205.00,'total_amount',1360.00,'commission_total',66.00,'commissions','[]'::jsonb)
   ),1360.00,820.00,66.00,v_tag||' OS-CRP-055',v_user,v_user);

  -- ---------------------------------------------------------------------------
  -- 35 service orders for clients 16-50 (1 each)
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

  ('e0000001-0000-0000-0000-000000000056',v_org,'OS-CRP-056',v_cl[16],v_ve1,
   v_m1+5,v_m1+6,v_m1+6,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Troca de óleo e filtros','Óleo sintético 5W30 + filtros de óleo e ar substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Troca de óleo + filtros','quantity',1,'unit_price',260.00,'cost_amount',140.00,'total_amount',260.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),260.00,140.00,14.00,v_tag||' OS-CRP-056',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000057',v_org,'OS-CRP-057',v_cl[17],v_ve2,
   v_m1+12,v_m1+13,v_m1+13,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Alinhamento 4 rodas','Alinhamento computadorizado nas 4 rodas',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Alinhamento 4 rodas','quantity',1,'unit_price',180.00,'cost_amount',80.00,'total_amount',180.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),180.00,80.00,10.00,v_tag||' OS-CRP-057',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000058',v_org,'OS-CRP-058',v_cl[18],v_ve3,
   v_m2+3,v_m2+4,v_m2+4,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','credit_card',false,NULL,
   'Pastilhas de freio dianteiras','Substituição das pastilhas dianteiras',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Pastilha freio dianteira','quantity',1,'unit_price',280.00,'cost_amount',155.00,'total_amount',280.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),280.00,155.00,14.00,v_tag||' OS-CRP-058',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000059',v_org,'OS-CRP-059',v_cl[19],v_ve4,
   v_m2+8,v_m2+10,v_m2+10,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Revisão preventiva 20.000 km','Troca de óleo, filtros e inspeção geral',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão preventiva 20k km','quantity',1,'unit_price',480.00,'cost_amount',250.00,'total_amount',480.00,'commission_total',24.00,'commissions','[]'::jsonb)
   ),480.00,250.00,24.00,v_tag||' OS-CRP-059',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000060',v_org,'OS-CRP-060',v_cl[20],v_ve5,
   v_m2+15,v_m2+16,v_m2+16,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','cash',false,NULL,
   'Balanceamento computadorizado','Balanceamento nas 4 rodas',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Balanceamento 4 rodas','quantity',4,'unit_price',45.00,'cost_amount',18.00,'total_amount',180.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),180.00,72.00,10.00,v_tag||' OS-CRP-060',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000061',v_org,'OS-CRP-061',v_cl[21],v_ve1,
   v_m3+4,v_m3+6,v_m3+6,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Troca da correia dentada','Correia + tensor + bomba d''água substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit correia dentada completo','quantity',1,'unit_price',520.00,'cost_amount',290.00,'total_amount',520.00,'commission_total',26.00,'commissions','[]'::jsonb)
   ),520.00,290.00,26.00,v_tag||' OS-CRP-061',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000062',v_org,'OS-CRP-062',v_cl[22],v_ve2,
   v_m3+10,v_m3+11,v_m3+11,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','transfer',false,NULL,
   'Bateria fraca — carro não liga','Substituição da bateria 60Ah',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Bateria automotiva 60Ah','quantity',1,'unit_price',380.00,'cost_amount',210.00,'total_amount',380.00,'commission_total',20.00,'commissions','[]'::jsonb)
   ),380.00,210.00,20.00,v_tag||' OS-CRP-062',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000063',v_org,'OS-CRP-063',v_cl[23],v_ve3,
   v_m1+20,v_m1+22,v_m1+22,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','pix',false,NULL,
   'Pneus dianteiros desgastados','Troca de 2 pneus dianteiros 195/65 R15',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Pneu 195/65 R15','quantity',2,'unit_price',290.00,'cost_amount',175.00,'total_amount',580.00,'commission_total',28.00,'commissions','[]'::jsonb)
   ),580.00,350.00,28.00,v_tag||' OS-CRP-063',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000064',v_org,'OS-CRP-064',v_cl[24],v_ve4,
   v_m2+22,v_m2+24,v_m2+24,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','partial','credit_card',false,NULL,
   'Diagnóstico elétrico e reparo','Substituição de relés e reparo na central',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Mão de obra elétrica','quantity',1,'unit_price',350.00,'cost_amount',120.00,'total_amount',350.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),350.00,120.00,18.00,v_tag||' OS-CRP-064',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000065',v_org,'OS-CRP-065',v_cl[25],v_ve5,
   v_m3+16,v_m3+18,v_m3+18,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Amortecedor dianteiro com ruído','Troca do par de amortecedores dianteiros',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Amortecedor dianteiro par','quantity',1,'unit_price',680.00,'cost_amount',395.00,'total_amount',680.00,'commission_total',34.00,'commissions','[]'::jsonb)
   ),680.00,395.00,34.00,v_tag||' OS-CRP-065',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000066',v_org,'OS-CRP-066',v_cl[26],v_ve1,
   v_m1+8,v_m1+9,v_m1+9,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Alinhamento e balanceamento','Alinhamento 4 rodas + balanceamento computadorizado',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Alinhamento + balanceamento','quantity',1,'unit_price',260.00,'cost_amount',115.00,'total_amount',260.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),260.00,115.00,14.00,v_tag||' OS-CRP-066',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000067',v_org,'OS-CRP-067',v_cl[27],v_ve2,
   v_m2+5,v_m2+6,v_m2+6,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Limpeza de bicos injetores','Lavagem ultrassônica dos 4 injetores',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Limpeza de injetores (4 un)','quantity',1,'unit_price',340.00,'cost_amount',160.00,'total_amount',340.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),340.00,160.00,18.00,v_tag||' OS-CRP-067',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000068',v_org,'OS-CRP-068',v_cl[28],v_ve3,
   v_m2+19,v_m2+20,v_m2+20,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'completed','paid','pix',false,NULL,
   'Fluidos de freio e embreagem vencidos','Troca dos fluidos DOT4 e embreagem',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Fluido DOT4 + embreagem','quantity',2,'unit_price',95.00,'cost_amount',48.00,'total_amount',190.00,'commission_total',10.00,'commissions','[]'::jsonb)
   ),190.00,96.00,10.00,v_tag||' OS-CRP-068',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000069',v_org,'OS-CRP-069',v_cl[29],v_ve4,
   v_m3+8,v_m3+10,v_m3+10,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Motor falhando em baixa rotação','Troca de velas e bobines de ignição',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Velas + bobines ignição','quantity',1,'unit_price',480.00,'cost_amount',265.00,'total_amount',480.00,'commission_total',24.00,'commissions','[]'::jsonb)
   ),480.00,265.00,24.00,v_tag||' OS-CRP-069',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000070',v_org,'OS-CRP-070',v_cl[30],v_ve5,
   v_m1+15,v_m1+16,v_m1+16,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Revisão de 10.000 km','Troca de óleo, filtros e verificação geral',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão 10k km','quantity',1,'unit_price',350.00,'cost_amount',180.00,'total_amount',350.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),350.00,180.00,18.00,v_tag||' OS-CRP-070',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000071',v_org,'OS-CRP-071',v_cl[31],v_ve1,
   v_m2+10,v_m2+12,v_m2+12,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','transfer',false,NULL,
   'Check engine — sensor O2','Substituição do sensor de oxigênio + diagnóstico',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Sensor O2 + diagnóstico','quantity',1,'unit_price',440.00,'cost_amount',240.00,'total_amount',440.00,'commission_total',22.00,'commissions','[]'::jsonb)
   ),440.00,240.00,22.00,v_tag||' OS-CRP-071',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000072',v_org,'OS-CRP-072',v_cl[32],v_ve2,
   v_m3+5,v_m3+6,v_m3+7,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Correia alternador desgastada','Troca da correia + tensor do alternador',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Correia alternador + tensor','quantity',1,'unit_price',390.00,'cost_amount',210.00,'total_amount',390.00,'commission_total',20.00,'commissions','[]'::jsonb)
   ),390.00,210.00,20.00,v_tag||' OS-CRP-072',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000073',v_org,'OS-CRP-073',v_cl[33],v_ve3,
   v_m1+22,v_m1+23,v_m1+24,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Pastilhas nas 4 rodas','Substituição de pastilhas dianteiras e traseiras',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit pastilhas 4 rodas','quantity',2,'unit_price',240.00,'cost_amount',132.00,'total_amount',480.00,'commission_total',24.00,'commissions','[]'::jsonb)
   ),480.00,264.00,24.00,v_tag||' OS-CRP-073',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000074',v_org,'OS-CRP-074',v_cl[34],v_ve4,
   v_m2+14,v_m2+16,v_m2+16,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Troca de 2 pneus dianteiros','Pneus 195/65 R15 substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Pneu 195/65 R15','quantity',2,'unit_price',290.00,'cost_amount',175.00,'total_amount',580.00,'commission_total',28.00,'commissions','[]'::jsonb)
   ),580.00,350.00,28.00,v_tag||' OS-CRP-074',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000075',v_org,'OS-CRP-075',v_cl[35],v_ve5,
   v_m3+18,v_m3+20,v_m3+21,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Embreagem patinando','Substituição do kit embreagem completo',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit embreagem (disco + platô + rolamento)','quantity',1,'unit_price',1100.00,'cost_amount',620.00,'total_amount',1100.00,'commission_total',55.00,'commissions','[]'::jsonb)
   ),1100.00,620.00,55.00,v_tag||' OS-CRP-075',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000076',v_org,'OS-CRP-076',v_cl[36],v_ve1,
   v_m1+4,v_m1+5,v_m1+5,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'completed','paid','pix',false,NULL,
   'Revisão completa de freios','Pastilhas, discos e fluido verificados e substituídos',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Revisão completa de freios','quantity',1,'unit_price',420.00,'cost_amount',230.00,'total_amount',420.00,'commission_total',22.00,'commissions','[]'::jsonb)
   ),420.00,230.00,22.00,v_tag||' OS-CRP-076',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000077',v_org,'OS-CRP-077',v_cl[37],v_ve2,
   v_m2+8,v_m2+10,v_m2+11,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Suspensão dianteira com ruído','Substituição de buchas e amortecedor dianteiro',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Kit suspensão dianteira','quantity',1,'unit_price',640.00,'cost_amount',380.00,'total_amount',640.00,'commission_total',32.00,'commissions','[]'::jsonb)
   ),640.00,380.00,32.00,v_tag||' OS-CRP-077',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000078',v_org,'OS-CRP-078',v_cl[38],v_ve3,
   v_m3+12,v_m3+13,v_m3+13,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Troca de óleo e filtro de ar','Óleo 5W40 + filtro de ar e óleo',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Troca de óleo + filtros','quantity',1,'unit_price',260.00,'cost_amount',140.00,'total_amount',260.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),260.00,140.00,14.00,v_tag||' OS-CRP-078',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000079',v_org,'OS-CRP-079',v_cl[39],v_ve4,
   v_m1+18,v_m1+20,v_m1+20,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','partial','credit_card',false,NULL,
   'Câmbio automático com solavanco','Troca do fluido e filtragem do câmbio automático',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Fluido câmbio automático + filtragem','quantity',1,'unit_price',580.00,'cost_amount',320.00,'total_amount',580.00,'commission_total',29.00,'commissions','[]'::jsonb)
   ),580.00,320.00,29.00,v_tag||' OS-CRP-079',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000080',v_org,'OS-CRP-080',v_cl[40],v_ve5,
   v_m2+6,v_m2+7,v_m2+8,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Reparo elétrico — lanternas traseiras','Substituição de lâmpadas e reparo do chicote',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Mão de obra elétrica','quantity',1,'unit_price',280.00,'cost_amount',90.00,'total_amount',280.00,'commission_total',14.00,'commissions','[]'::jsonb)
   ),280.00,90.00,14.00,v_tag||' OS-CRP-080',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000081',v_org,'OS-CRP-081',v_cl[41],v_ve1,
   v_m2+20,v_m2+21,v_m2+22,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','transfer',false,NULL,
   'Ar-condicionado não resfria','Recarga de gás R134a e limpeza do sistema',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[2],'description','Recarga gás R134a + limpeza','quantity',1,'unit_price',290.00,'cost_amount',140.00,'total_amount',290.00,'commission_total',15.00,'commissions','[]'::jsonb)
   ),290.00,140.00,15.00,v_tag||' OS-CRP-081',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000082',v_org,'OS-CRP-082',v_cl[42],v_ve2,
   v_m3+6,v_m3+7,v_m3+8,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Discos e pastilhas dianteiros','Substituição de discos e pastilhas dianteiras',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Discos + pastilhas dianteiras','quantity',1,'unit_price',690.00,'cost_amount',390.00,'total_amount',690.00,'commission_total',35.00,'commissions','[]'::jsonb)
   ),690.00,390.00,35.00,v_tag||' OS-CRP-082',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000083',v_org,'OS-CRP-083',v_cl[43],v_ve3,
   v_m1+10,v_m1+11,v_m1+11,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'completed','paid','cash',false,NULL,
   'Vidro elétrico não funciona','Substituição do motor do vidro elétrico LE',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Motor vidro elétrico LE','quantity',1,'unit_price',380.00,'cost_amount',210.00,'total_amount',380.00,'commission_total',20.00,'commissions','[]'::jsonb)
   ),380.00,210.00,20.00,v_tag||' OS-CRP-083',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000084',v_org,'OS-CRP-084',v_cl[44],v_ve4,
   v_m2+3,v_m2+5,v_m2+5,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Revisão de 20.000 km','Revisão preventiva completa 20k km',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão preventiva 20k km','quantity',1,'unit_price',650.00,'cost_amount',340.00,'total_amount',650.00,'commission_total',32.00,'commissions','[]'::jsonb)
   ),650.00,340.00,32.00,v_tag||' OS-CRP-084',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000085',v_org,'OS-CRP-085',v_cl[45],v_ve5,
   v_m3+14,v_m3+16,v_m3+16,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Coxins do motor desgastados','Substituição dos 4 coxins do motor',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Kit coxim motor (4 un)','quantity',1,'unit_price',560.00,'cost_amount',310.00,'total_amount',560.00,'commission_total',28.00,'commissions','[]'::jsonb)
   ),560.00,310.00,28.00,v_tag||' OS-CRP-085',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000086',v_org,'OS-CRP-086',v_cl[46],v_ve1,
   v_m1+6,v_m1+7,v_m1+7,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Correia do alternador partida','Substituição da correia + esticador do alternador',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Correia alternador + esticador','quantity',1,'unit_price',360.00,'cost_amount',195.00,'total_amount',360.00,'commission_total',18.00,'commissions','[]'::jsonb)
   ),360.00,195.00,18.00,v_tag||' OS-CRP-086',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000087',v_org,'OS-CRP-087',v_cl[47],v_ve2,
   v_m1+14,v_m1+15,v_m1+15,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','cash',false,NULL,
   'Alinhamento e balanceamento','Alinhamento 4 rodas + balanceamento computadorizado',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[3],'description','Alinhamento + balanceamento','quantity',1,'unit_price',240.00,'cost_amount',105.00,'total_amount',240.00,'commission_total',12.00,'commissions','[]'::jsonb)
   ),240.00,105.00,12.00,v_tag||' OS-CRP-087',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000088',v_org,'OS-CRP-088',v_cl[48],v_ve3,
   v_m2+18,v_m2+19,v_m2+20,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Pastilhas dianteiras + fluido de freio','Pastilhas novas + troca fluido DOT4',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[1],'description','Pastilhas + fluido DOT4','quantity',1,'unit_price',380.00,'cost_amount',210.00,'total_amount',380.00,'commission_total',20.00,'commissions','[]'::jsonb)
   ),380.00,210.00,20.00,v_tag||' OS-CRP-088',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000089',v_org,'OS-CRP-089',v_cl[49],v_ve4,
   v_m3+9,v_m3+10,v_m3+11,
   v_em[2],jsonb_build_array(jsonb_build_object('employee_id',v_em[2])),
   'delivered','paid','credit_card',false,NULL,
   'Revisão de 10.000 km','Troca de óleo sintético, filtros e inspeção',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Revisão 10k km completa','quantity',1,'unit_price',380.00,'cost_amount',200.00,'total_amount',380.00,'commission_total',20.00,'commissions','[]'::jsonb)
   ),380.00,200.00,20.00,v_tag||' OS-CRP-089',v_user,v_user),

  ('e0000001-0000-0000-0000-000000000090',v_org,'OS-CRP-090',v_cl[50],v_ve5,
   v_m1+25,v_m1+27,v_m1+27,
   v_em[1],jsonb_build_array(jsonb_build_object('employee_id',v_em[1])),
   'delivered','paid','pix',false,NULL,
   'Bomba d''água com vazamento','Substituição da bomba d''água + termostato + aditivo',
   jsonb_build_array(
     jsonb_build_object('product_id',v_pr[4],'description','Bomba d''água + termostato + aditivo','quantity',1,'unit_price',590.00,'cost_amount',330.00,'total_amount',590.00,'commission_total',30.00,'commissions','[]'::jsonb)
   ),590.00,330.00,30.00,v_tag||' OS-CRP-090',v_user,v_user);

  RAISE NOTICE 'customers_report_demo_seed: 50 clientes + 90 ordens de serviço inseridos para organization_id=%', v_org;
END $$;
