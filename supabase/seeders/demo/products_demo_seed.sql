-- =============================================================================
-- Seed: products_demo_seed.sql
-- Purpose: Insert demo data for all products-area pages:
--          product_categories, products, parts (inventory),
--          suppliers, purchases, purchase_requests, purchase_returns
--
-- How to use:
-- 1. Open the Supabase SQL Editor.
-- 2. If you want a specific organization, replace the NULL below with its UUID.
-- 3. Run the script.
--
-- Behavior:
-- - If v_organization_id is NULL, the script uses the first active organization.
-- - The seed is idempotent: it removes previous rows created by this seed before
--   re-inserting all records.
-- - Dependency order: categories → suppliers → products → parts → purchases
--   → purchase_requests → purchase_returns
-- =============================================================================

DO $$
DECLARE
  v_organization_id     uuid := NULL;

  -- Collected IDs for cross-table references
  v_category_ids        uuid[];
  v_supplier_ids        uuid[];
  v_product_ids         uuid[];
  v_part_ids            uuid[];
  v_bank_account_id     uuid;
  v_purchase_ids        uuid[];
  v_product_code_start  int;

  -- Loop helpers
  v_idx                 int;
  v_cat_count           int;
  v_sup_count           int;
  v_prod_count          int;
  v_part_count          int;
  v_purchase_count      int;

  -- Temp vars
  v_sup_id              uuid;
  v_prod_id             uuid;
  v_part_id             uuid;
  v_purchase_id         uuid;
  v_purchase_date       date;
  v_total               numeric(15,2);
  v_status              varchar(20);

  -- Data arrays
  v_category_names      text[] := ARRAY[
    'Freios', 'Motor', 'Suspensão', 'Transmissão', 'Elétrica',
    'Funilaria', 'Filtros e Óleos', 'Pneus e Rodas', 'Acessórios', 'Escapamento'
  ];

  v_supplier_names      text[] := ARRAY[
    'AutoPeças Brasil Ltda', 'Distribuidora Norte Auto', 'Peças & Cia ME',
    'Global Auto Supply', 'MegaPeças Distribuidora', 'Sul Peças Comércio',
    'Partsmaster Brasil', 'Importadora EuroAuto', 'Rede Total Peças',
    'FastParts Logística', 'Qualidade Peças Ltda', 'Alfa Distribuidora',
    'Omega AutoPeças', 'Prime Parts Brasil', 'TechAuto Distribuidora',
    'Nacional Peças ME', 'TopPeças Comércio', 'Vintage Auto Supply',
    'Precisão Peças Ltda', 'Maxpeças Distribuidora'
  ];

  v_supplier_cities     text[] := ARRAY[
    'São Paulo','Campinas','Ribeirão Preto','Santos','São Bernardo do Campo',
    'Guarulhos','Osasco','Mauá','Sorocaba','Jundiaí',
    'Bauru','Piracicaba','São José dos Campos','Taubaté','Franca',
    'Americana','Limeira','Araraquara','Marília','Presidente Prudente'
  ];

  v_product_names       text[] := ARRAY[
    'Pastilha de Freio Dianteira', 'Disco de Freio Dianteiro', 'Pastilha de Freio Traseira',
    'Disco de Freio Traseiro', 'Fluido de Freio DOT 4', 'Cilindro Mestre de Freio',
    'Filtro de Óleo', 'Filtro de Ar', 'Filtro de Combustível', 'Filtro de Cabine',
    'Óleo Motor 5W30 Sintético', 'Óleo Motor 10W40 Semi-Sintético', 'Óleo de Câmbio',
    'Vela de Ignição', 'Cabo de Vela', 'Bobina de Ignição', 'Sensor de Oxigênio',
    'Correia Dentada', 'Tensor de Correia', 'Bomba D''Água',
    'Amortecedor Dianteiro', 'Amortecedor Traseiro', 'Mola Dianteira', 'Mola Traseira',
    'Barra Estabilizadora', 'Bucha de Bandeja', 'Pivô de Suspensão',
    'Bateria 60Ah', 'Bateria 70Ah', 'Alternador', 'Motor de Arranque',
    'Lâmpada Farol H4', 'Lâmpada Farol LED', 'Lanterna Traseira',
    'Embreagem Completa', 'Disco de Embreagem', 'Platô de Embreagem',
    'Rolamento de Roda Dianteiro', 'Rolamento de Roda Traseiro', 'Semi-eixo Dianteiro',
    'Escapamento Completo', 'Catalisador', 'Silencioso Traseiro',
    'Radiador', 'Mangueira de Radiador Superior', 'Mangueira de Radiador Inferior',
    'Para-choque Dianteiro', 'Para-choque Traseiro', 'Grade Dianteira',
    'Pneu 175/70 R13', 'Pneu 185/65 R15', 'Pneu 205/55 R16',
    'Roda Liga Leve 14"', 'Roda Liga Leve 15"', 'Roda Liga Leve 16"',
    'Kit Higienização A/C', 'Limpador de Para-brisa', 'Fluido de Direção',
    'Correia Poly-V', 'Termostato', 'Tampa de Radiador'
  ];

  v_part_codes          text[];
  v_part_descriptions   text[] := ARRAY[
    'Pastilha freio diant. – kit 4 pçs', 'Disco freio diant. – par', 'Pastilha freio tras. – kit 4 pçs',
    'Disco freio tras. – par', 'Fluido freio DOT 4 500ml', 'Cilindro mestre freio duplo',
    'Filtro óleo blindado', 'Filtro ar esportivo lavável', 'Filtro combustível inline',
    'Filtro cabine carvão ativado', 'Óleo 5W30 sintético 1L', 'Óleo 10W40 semi-sint. 1L',
    'Óleo câmbio automático ATF', 'Vela ignição platina', 'Cabo vela silicone 8mm',
    'Bobina ignição individual', 'Sensor lambda banda larga', 'Kit correia dentada + tensor',
    'Tensor correia dentada', 'Bomba d''água alumínio',
    'Amortecedor diant. pressurizado', 'Amortecedor tras. pressurizado',
    'Mola suspensão diant.', 'Mola suspensão tras.',
    'Barra estab. diant.', 'Bucha bandeja poliuretano', 'Pivô sup. diant.',
    'Bateria 60Ah – livre manutenção', 'Bateria 70Ah – Start/Stop',
    'Alternador recondicionado 90A', 'Motor arranque remanufaturado',
    'Lâmpada H4 55/60W', 'Kit lâmpada LED H4 6000K', 'Lanterna tras. LED completa',
    'Kit embreagem completo', 'Disco embreagem cerâmico', 'Platô embreagem reforçado',
    'Rolamento roda diant. – par', 'Rolamento roda tras. – par', 'Semi-eixo com homocinética',
    'Escapamento inox completo', 'Catalisador universal', 'Silencioso central',
    'Radiador alumínio 2 fileiras', 'Mangueira rad. superior', 'Mangueira rad. inferior',
    'Para-choque diant. ABS', 'Para-choque tras. ABS', 'Grade diant. cromada',
    'Pneu 175/70 R13 82T', 'Pneu 185/65 R15 88H', 'Pneu 205/55 R16 91V'
  ];

  v_part_brands         text[] := ARRAY[
    'Brembo','TRW','Bosch','Mann','NGK','Valeo','SKF','Dayco',
    'Monroe','Cofap','Magneti Marelli','Delphi','Continental','Gates',
    'Mahle','Fras-le','Bendix','Jurid','LUK','ZF'
  ];

  v_part_locations      text[] := ARRAY[
    'Prateleira A1','Prateleira A2','Prateleira A3','Prateleira B1','Prateleira B2',
    'Prateleira B3','Gaveta C1','Gaveta C2','Gaveta C3','Estoque Fundo',
    'Área Pneus','Área Baterias','Área Elétrica','Área Escapamentos','Área Suspensão'
  ];

  v_part_categories     text[] := ARRAY[
    'brakes','engine','suspension','transmission','electrical',
    'body','filters','tires','other','engine'
  ];

  v_requesters          text[] := ARRAY[
    'Carlos Mecânico','João Eletricista','Pedro Funileiro',
    'Ana Supervisora','Roberto Gerente','Marcos Técnico'
  ];

BEGIN
  -- ─── Resolve organization ─────────────────────────────────────────────────
  IF v_organization_id IS NULL THEN
    SELECT id INTO v_organization_id
      FROM public.organizations
     WHERE deleted_at IS NULL
     ORDER BY created_at
     LIMIT 1;
  END IF;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organization encontrada. Crie ou informe um organization_id antes de rodar o seed.';
  END IF;

  RAISE NOTICE 'Usando organization_id = %', v_organization_id;

  -- =========================================================================
  -- FASE 1 – LIMPEZA (ordem reversa de dependências)
  -- =========================================================================
  DELETE FROM public.purchase_returns
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:products-demo-v1]%';

  DELETE FROM public.purchase_requests
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:products-demo-v1]%';

  DELETE FROM public.purchases
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:products-demo-v1]%';

  DELETE FROM public.parts
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:products-demo-v1]%';

  DELETE FROM public.products
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:products-demo-v1]%';

  DELETE FROM public.suppliers
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:products-demo-v1]%';

  DELETE FROM public.product_categories
   WHERE organization_id = v_organization_id
     AND description LIKE '[seed:products-demo-v1]%';

  DELETE FROM public.bank_accounts
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:products-demo-v1]%';

  RAISE NOTICE '✓ Dados anteriores do seed removidos';

  -- ─── Conta bancária: reutilizar existente ou criar demo ──────────────────
  SELECT id INTO v_bank_account_id
    FROM public.bank_accounts
   WHERE organization_id = v_organization_id
     AND deleted_at IS NULL
   ORDER BY created_at
   LIMIT 1;

  IF v_bank_account_id IS NULL THEN
    INSERT INTO public.bank_accounts (
      organization_id, account_name, account_type,
      initial_balance, current_balance,
      preferred_payment_method, bank_name,
      is_active, notes, created_by, updated_by
    ) VALUES (
      v_organization_id,
      'Conta Corrente Demo',
      'checking',
      50000.00,
      50000.00,
      'transfer',
      'Banco Demo',
      true,
      '[seed:products-demo-v1] Conta bancária criada automaticamente pelo seed',
      'seed@autopro.local',
      'seed@autopro.local'
    )
    RETURNING id INTO v_bank_account_id;

    RAISE NOTICE '✓ Conta bancária demo criada (id=%)', v_bank_account_id;
  ELSE
    RAISE NOTICE '✓ Conta bancária existente reutilizada (id=%)', v_bank_account_id;
  END IF;

  -- =========================================================================
  -- FASE 2 – INSERÇÕES
  -- =========================================================================

  -- =========================================================================
  -- 1. PRODUCT CATEGORIES (10 categorias)
  -- =========================================================================
  v_category_ids := ARRAY[]::uuid[];

  -- Insert categories and collect their IDs
  v_category_ids := ARRAY[]::uuid[];

  FOR v_idx IN 1..array_length(v_category_names, 1) LOOP
    INSERT INTO public.product_categories (
      organization_id, name, description, created_by, updated_by
    ) VALUES (
      v_organization_id,
      v_category_names[v_idx],
      '[seed:products-demo-v1] Categoria demo para testes',
      'seed@autopro.local',
      'seed@autopro.local'
    )
    ON CONFLICT (organization_id, name) DO UPDATE
      SET description = EXCLUDED.description,
          updated_by  = EXCLUDED.updated_by
    RETURNING id INTO v_prod_id;

    v_category_ids := array_append(v_category_ids, v_prod_id);
  END LOOP;

  v_cat_count := array_length(v_category_ids, 1);
  RAISE NOTICE '✓ % categorias inseridas/atualizadas', v_cat_count;

  -- =========================================================================
  -- 2. SUPPLIERS (20 fornecedores)
  -- =========================================================================
  v_supplier_ids := ARRAY[]::uuid[];

  FOR v_idx IN 1..array_length(v_supplier_names, 1) LOOP
    INSERT INTO public.suppliers (
      organization_id, name, person_type, trade_name, tax_id,
      phone, email, website,
      zip_code, street, address_number, neighborhood, city, state,
      category, payment_term_days, credit_limit, is_active, notes,
      created_by, updated_by
    ) VALUES (
      v_organization_id,
      v_supplier_names[v_idx],
      CASE WHEN v_idx <= 15 THEN 'pj' ELSE 'pf' END,
      CASE WHEN v_idx <= 15 THEN format('%s Peças', split_part(v_supplier_names[v_idx], ' ', 1)) ELSE NULL END,
      CASE
        WHEN v_idx <= 15 THEN lpad((10000000000014 + v_idx)::text, 14, '0')
        ELSE lpad((11100000000 + v_idx)::text, 11, '0')
      END,
      format('(11) 3%s-%s',
        lpad(((v_idx * 317) % 9000 + 1000)::text, 4, '0'),
        lpad(((v_idx * 531) % 9000 + 1000)::text, 4, '0')
      ),
      format('contato@%s.com.br', lower(regexp_replace(split_part(v_supplier_names[v_idx], ' ', 1), '[^a-zA-Z0-9]', '', 'g'))),
      format('https://www.%s.com.br', lower(regexp_replace(split_part(v_supplier_names[v_idx], ' ', 1), '[^a-zA-Z0-9]', '', 'g'))),
      lpad((1000 + v_idx * 23)::text, 5, '0') || '-' || lpad((v_idx * 7 % 1000)::text, 3, '0'),
      format('Rua das Indústrias, %s', 100 + v_idx * 13),
      lpad(v_idx::text, 3, '0'),
      'Distrito Industrial',
      v_supplier_cities[v_idx],
      'SP',
      CASE (v_idx % 6)
        WHEN 0 THEN 'auto_parts'
        WHEN 1 THEN 'tools'
        WHEN 2 THEN 'equipment'
        WHEN 3 THEN 'services'
        WHEN 4 THEN 'consumables'
        ELSE 'other'
      END,
      CASE (v_idx % 4) WHEN 0 THEN 7 WHEN 1 THEN 14 WHEN 2 THEN 28 ELSE 30 END,
      ROUND((v_idx * 1500.00 + 5000.00)::numeric, 2),
      true,
      format('[seed:products-demo-v1] Fornecedor demo %s', lpad(v_idx::text, 3, '0')),
      'seed@autopro.local',
      'seed@autopro.local'
    )
    RETURNING id INTO v_sup_id;

    v_supplier_ids := array_append(v_supplier_ids, v_sup_id);
  END LOOP;

  v_sup_count := array_length(v_supplier_ids, 1);
  RAISE NOTICE '✓ % fornecedores inseridos', v_sup_count;

  -- =========================================================================
  -- 3. PRODUCTS (60 produtos no catálogo)
  -- =========================================================================
  v_product_ids := ARRAY[]::uuid[];

  SELECT COALESCE(MAX(code), 0) INTO v_product_code_start
    FROM public.products
   WHERE organization_id = v_organization_id;

  FOR v_idx IN 1..array_length(v_product_names, 1) LOOP
    INSERT INTO public.products (
      organization_id, name, code, type, category_id,
      track_inventory, initial_stock_quantity,
      unit_sale_price, unit_cost_price,
      notes, created_by, updated_by
    ) VALUES (
      v_organization_id,
      v_product_names[v_idx],
      v_product_code_start + v_idx,
      CASE WHEN v_idx % 8 = 0 THEN 'group' ELSE 'unit' END,
      v_category_ids[((v_idx - 1) % v_cat_count) + 1],
      CASE WHEN v_idx % 8 != 0 THEN true ELSE false END,
      CASE WHEN v_idx % 8 != 0 THEN (v_idx * 3 % 50) + 5 ELSE 0 END,
      ROUND((v_idx * 47.50 + 29.90)::numeric, 2),
      ROUND((v_idx * 31.00 + 19.90)::numeric, 2),
      format('[seed:products-demo-v1] Produto demo %s', lpad(v_idx::text, 3, '0')),
      'seed@autopro.local',
      'seed@autopro.local'
    )
    RETURNING id INTO v_prod_id;

    v_product_ids := array_append(v_product_ids, v_prod_id);
  END LOOP;

  v_prod_count := array_length(v_product_ids, 1);
  RAISE NOTICE '✓ % produtos inseridos', v_prod_count;

  -- =========================================================================
  -- 4. PARTS – estoque (52 peças)
  -- =========================================================================
  v_part_ids := ARRAY[]::uuid[];

  FOR v_idx IN 1..array_length(v_part_descriptions, 1) LOOP
    INSERT INTO public.parts (
      organization_id, product_id, code, description,
      stock_quantity, minimum_quantity,
      sale_price, cost_price,
      category, brand, supplier_name, location,
      notes, created_by, updated_by
    ) VALUES (
      v_organization_id,
      CASE WHEN v_idx <= v_prod_count THEN v_product_ids[v_idx] ELSE NULL END,
      format('PRT-%s', lpad(v_idx::text, 4, '0')),
      v_part_descriptions[v_idx],
      -- Vary stock: some low, some normal, some high
      CASE
        WHEN v_idx % 7 = 0 THEN 0                          -- sem estoque
        WHEN v_idx % 5 = 0 THEN (v_idx % 3) + 1            -- estoque crítico
        WHEN v_idx % 3 = 0 THEN (v_idx * 2 % 20) + 5       -- estoque baixo
        ELSE (v_idx * 3 % 80) + 15                          -- estoque normal
      END,
      CASE
        WHEN v_idx % 7 = 0 THEN 10   -- mínimo alto (estoque zerado)
        WHEN v_idx % 5 = 0 THEN 5
        ELSE 3
      END,
      ROUND((v_idx * 53.75 + 24.90)::numeric, 2),
      ROUND((v_idx * 35.50 + 14.90)::numeric, 2),
      v_part_categories[((v_idx - 1) % array_length(v_part_categories, 1)) + 1],
      v_part_brands[((v_idx - 1) % array_length(v_part_brands, 1)) + 1],
      v_supplier_names[((v_idx - 1) % v_sup_count) + 1],
      v_part_locations[((v_idx - 1) % array_length(v_part_locations, 1)) + 1],
      format('[seed:products-demo-v1] Peça demo %s', lpad(v_idx::text, 3, '0')),
      'seed@autopro.local',
      'seed@autopro.local'
    )
    RETURNING id INTO v_part_id;

    v_part_ids := array_append(v_part_ids, v_part_id);
  END LOOP;

  v_part_count := array_length(v_part_ids, 1);
  RAISE NOTICE '✓ % peças (estoque) inseridas', v_part_count;

  -- =========================================================================
  -- 5. PURCHASES (35 compras – últimos 6 meses)
  -- =========================================================================
  v_purchase_ids := ARRAY[]::uuid[];

  FOR v_idx IN 1..35 LOOP
    v_purchase_date := (CURRENT_DATE - ((v_idx * 5) % 180 || ' days')::interval)::date;
    v_total         := ROUND((v_idx * 387.50 + 250.00)::numeric, 2);
    v_status        := CASE WHEN v_purchase_date < CURRENT_DATE - INTERVAL '10 days' THEN 'paid' ELSE 'pending' END;

    INSERT INTO public.purchases (
      organization_id, supplier_id, bank_account_id,
      purchase_date, total_amount, payment_status,
      invoice_number, due_date, notes,
      items, created_by, updated_by
    ) VALUES (
      v_organization_id,
      v_supplier_ids[((v_idx - 1) % v_sup_count) + 1],
      v_bank_account_id,
      v_purchase_date,
      v_total,
      v_status,
      format('NF-%s', lpad(((v_idx * 1009) % 99999 + 10000)::text, 5, '0')),
      (v_purchase_date + ((v_idx % 3 + 1) * 15 || ' days')::interval)::date,
      format('[seed:products-demo-v1] Compra demo %s', lpad(v_idx::text, 3, '0')),
      jsonb_build_array(
        jsonb_build_object(
          'part_id',         v_part_ids[((v_idx - 1) % v_part_count) + 1],
          'description',     v_part_descriptions[((v_idx - 1) % array_length(v_part_descriptions, 1)) + 1],
          'quantity',        (v_idx % 5) + 1,
          'unit_cost_price', ROUND(((v_idx * 35.50 + 14.90) / ((v_idx % 5) + 1))::numeric, 2),
          'unit_sale_price', ROUND(((v_idx * 53.75 + 24.90) / ((v_idx % 5) + 1))::numeric, 2),
          'total_item_price',ROUND((v_total * 0.6)::numeric, 2),
          'add_to_stock',    true
        ),
        jsonb_build_object(
          'part_id',         v_part_ids[((v_idx) % v_part_count) + 1],
          'description',     v_part_descriptions[(v_idx % array_length(v_part_descriptions, 1)) + 1],
          'quantity',        (v_idx % 3) + 1,
          'unit_cost_price', ROUND(((v_idx * 22.00 + 9.90))::numeric, 2),
          'unit_sale_price', ROUND(((v_idx * 33.00 + 14.90))::numeric, 2),
          'total_item_price',ROUND((v_total * 0.4)::numeric, 2),
          'add_to_stock',    true
        )
      ),
      'seed@autopro.local',
      'seed@autopro.local'
    )
    RETURNING id INTO v_purchase_id;

    v_purchase_ids := array_append(v_purchase_ids, v_purchase_id);
  END LOOP;

  v_purchase_count := array_length(v_purchase_ids, 1);
  RAISE NOTICE '✓ % compras inseridas', v_purchase_count;

  -- =========================================================================
  -- 6. PURCHASE REQUESTS (30 solicitações de compra)
  -- =========================================================================
  FOR v_idx IN 1..30 LOOP
    v_status := CASE (v_idx % 4)
      WHEN 0 THEN 'waiting'
      WHEN 1 THEN 'authorized'
      WHEN 2 THEN 'rejected'
      ELSE       'purchased'
    END;

    INSERT INTO public.purchase_requests (
      organization_id, request_number, request_date, supplier_id,
      status, items, total_request_amount, requester,
      justification, notes,
      authorization_date, authorized_by,
      rejection_reason,
      purchase_id,
      created_by, updated_by
    ) VALUES (
      v_organization_id,
      format('SOL-%s', lpad(v_idx::text, 5, '0')),
      (CURRENT_DATE - ((v_idx * 4) % 120 || ' days')::interval)::timestamptz,
      v_supplier_ids[((v_idx - 1) % v_sup_count) + 1],
      v_status,
      jsonb_build_array(
        jsonb_build_object(
          'description',          v_part_descriptions[((v_idx - 1) % array_length(v_part_descriptions, 1)) + 1],
          'code',                 format('PRT-%s', lpad(v_idx::text, 4, '0')),
          'vehicle_id',           NULL,
          'quantity',             (v_idx % 4) + 1,
          'estimated_unit_price', ROUND((v_idx * 42.00 + 18.50)::numeric, 2),
          'estimated_total_price',ROUND(((v_idx * 42.00 + 18.50) * ((v_idx % 4) + 1))::numeric, 2),
          'notes',                CASE WHEN v_idx % 3 = 0 THEN 'Urgente' ELSE NULL END
        ),
        jsonb_build_object(
          'description',          v_part_descriptions[(v_idx % array_length(v_part_descriptions, 1)) + 1],
          'code',                 format('PRT-%s', lpad((v_idx + 1)::text, 4, '0')),
          'vehicle_id',           NULL,
          'quantity',             (v_idx % 3) + 1,
          'estimated_unit_price', ROUND((v_idx * 28.00 + 11.00)::numeric, 2),
          'estimated_total_price',ROUND(((v_idx * 28.00 + 11.00) * ((v_idx % 3) + 1))::numeric, 2),
          'notes',                NULL
        )
      ),
      ROUND(((v_idx * 42.00 + 18.50) * ((v_idx % 4) + 1) + (v_idx * 28.00 + 11.00) * ((v_idx % 3) + 1))::numeric, 2),
      v_requesters[((v_idx - 1) % array_length(v_requesters, 1)) + 1],
      CASE
        WHEN v_idx % 3 = 0 THEN 'Reposição de estoque crítico'
        WHEN v_idx % 3 = 1 THEN 'Material para OS em andamento'
        ELSE 'Compra preventiva conforme planejamento'
      END,
      format('[seed:products-demo-v1] Solicitação demo %s', lpad(v_idx::text, 3, '0')),
      CASE WHEN v_status = 'authorized' THEN (CURRENT_DATE - ((v_idx * 2) % 30 || ' days')::interval)::timestamptz ELSE NULL END,
      CASE WHEN v_status = 'authorized' THEN 'Gerente Administrativo' ELSE NULL END,
      CASE WHEN v_status = 'rejected'   THEN 'Orçamento indisponível no período' ELSE NULL END,
      CASE WHEN v_status = 'purchased'  THEN v_purchase_ids[((v_idx - 1) % v_purchase_count) + 1] ELSE NULL END,
      'seed@autopro.local',
      'seed@autopro.local'
    );
  END LOOP;

  RAISE NOTICE '✓ 30 solicitações de compra inseridas';

  -- =========================================================================
  -- 7. PURCHASE RETURNS (15 devoluções)
  -- =========================================================================

  FOR v_idx IN 1..15 LOOP
    v_purchase_id := v_purchase_ids[((v_idx - 1) % v_purchase_count) + 1];
    v_total       := ROUND((v_idx * 145.00 + 80.00)::numeric, 2);
    v_status      := CASE WHEN v_idx % 3 = 0 THEN 'completed' ELSE 'pending' END;

    INSERT INTO public.purchase_returns (
      organization_id, purchase_id, supplier_id,
      bank_account_id,
      return_date, reason, status,
      total_returned_amount, returned_items,
      generated_financial_credit, notes,
      created_by, updated_by
    )
    SELECT
      v_organization_id,
      v_purchase_id,
      p.supplier_id,
      v_bank_account_id,
      (CURRENT_DATE - ((v_idx * 7) % 90 || ' days')::interval)::date,
      CASE (v_idx % 6)
        WHEN 0 THEN 'warranty'
        WHEN 1 THEN 'wrong_part'
        WHEN 2 THEN 'manufacturing_defect'
        WHEN 3 THEN 'damaged_product'
        WHEN 4 THEN 'incompatible'
        ELSE       'other'
      END,
      v_status,
      v_total,
      jsonb_build_array(
        jsonb_build_object(
          'part_id',         v_part_ids[((v_idx - 1) % v_part_count) + 1],
          'description',     v_part_descriptions[((v_idx - 1) % array_length(v_part_descriptions, 1)) + 1],
          'quantity',        (v_idx % 3) + 1,
          'unit_cost_price', ROUND((v_total / ((v_idx % 3) + 1))::numeric, 2),
          'total_item_price',v_total
        )
      ),
      v_status = 'completed',
      format('[seed:products-demo-v1] Devolução demo %s', lpad(v_idx::text, 3, '0')),
      'seed@autopro.local',
      'seed@autopro.local'
    FROM public.purchases p
    WHERE p.id = v_purchase_id;
  END LOOP;

  RAISE NOTICE '✓ 15 devoluções inseridas';

  -- =========================================================================
  -- SUMÁRIO FINAL
  -- =========================================================================
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Seed products_demo_seed.sql concluído:';
  RAISE NOTICE '  Categorias       : %', v_cat_count;
  RAISE NOTICE '  Fornecedores     : %', v_sup_count;
  RAISE NOTICE '  Produtos         : %', v_prod_count;
  RAISE NOTICE '  Peças (estoque)  : %', v_part_count;
  RAISE NOTICE '  Compras          : %', v_purchase_count;
  RAISE NOTICE '  Solicitações     : 30';
  RAISE NOTICE '  Devoluções       : 15';
  RAISE NOTICE '  Organization ID  : %', v_organization_id;
  RAISE NOTICE '=================================================';
END $$;
