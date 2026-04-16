-- =============================================================================
-- Seed: vehicles_demo_seed.sql
-- Purpose: Insert 40 demo vehicles for a single organization in Supabase.
--          Vehicles are distributed among the clients already present in the org.
--
-- How to use:
-- 1. Run clients_demo_seed.sql first (or ensure clients exist for the org).
-- 2. Open the Supabase SQL Editor.
-- 3. If you want a specific organization, replace the NULL below with its UUID.
-- 4. Run the script.
--
-- Behavior:
-- - If v_organization_id is NULL, the script uses the first active organization.
-- - The seed is idempotent: removes previous rows created by this seed before
--   inserting the new 40 records.
-- =============================================================================

DO $$
DECLARE
  v_organization_id uuid := 'ac547d2f-afe7-4523-b019-c27a16e820e1';

  -- Arrays of data for generating realistic vehicles
  v_brands     text[] := ARRAY[
    'Toyota','Toyota','Chevrolet','Chevrolet','Volkswagen','Volkswagen',
    'Fiat','Fiat','Honda','Honda','Hyundai','Hyundai',
    'Ford','Ford','Renault','Renault','Jeep','Nissan',
    'Mitsubishi','BMW'
  ];
  v_models     text[] := ARRAY[
    'Corolla','Hilux','Onix','S10','Gol','Polo',
    'Argo','Toro','Civic','HR-V','HB20','Creta',
    'Ka','Ranger','Kwid','Duster','Compass','Kicks',
    'L200','Serie 3'
  ];
  v_engines    text[] := ARRAY[
    '2.0 16V','2.8 TURBO DIESEL','1.0 TURBO','2.8 TURBO DIESEL','1.0 MPI','1.0 TSI',
    '1.3 FIREFLY','1.3 FIREFLY','2.0 16V','1.5 VTEC TURBO','1.0 12V','2.0 TURBO',
    '1.0 12V','2.2 TURBO DIESEL','1.0 SCE','1.6 16V','2.0 TURBO','1.6 16V',
    '2.4 MIVEC','2.0 TURBO'
  ];
  v_fuel_types text[] := ARRAY[
    'flex','diesel','flex','diesel','flex','flex',
    'flex','flex','flex','flex','flex','gasoline',
    'flex','diesel','flex','flex','flex','flex',
    'diesel','gasoline'
  ];
  v_colors     text[] := ARRAY[
    'Prata','Branco','Preto','Cinza','Vermelho','Azul',
    'Branco Perola','Grafite','Prata','Azul Marinho',
    'Vermelho Chili','Branco','Preto','Prata','Cinza','Laranja',
    'Preto','Cinza','Branco','Azul'
  ];
  v_plates     text[] := ARRAY[
    'ABC1234','DEF5678','GHI9012','JKL3456','MNO7890','PQR1234',
    'STU5678','VWX9012','YZA3456','BCD7890','EFG1234','HIJ5678',
    'KLM9012','NOP3456','QRS7890','TUV1234','WXY5678','ZAB9012',
    'CDE3456','FGH7890','IJK1B23','LMN2C45','OPQ3D67','RST4E89',
    'UVW5F01','XYZ6G23','ABC7H45','DEF8I67','GHI9J01','JKL0K23',
    'MNO1L45','PQR2M67','STU3N89','VWX4O01','YZA5P23','BCD6Q45',
    'EFG7R67','HIJ8S89','KLM9T01','NOP0U23'
  ];
  v_years      int[]  := ARRAY[
    2021,2022,2019,2020,2018,2023,
    2022,2021,2020,2023,2019,2022,
    2018,2021,2020,2022,2023,2021,
    2019,2022,2020,2021,2023,2018,
    2022,2019,2021,2020,2023,2022,
    2018,2021,2020,2019,2023,2022,
    2021,2020,2019,2023
  ];
  v_mileages   int[]  := ARRAY[
    45000,32000,87000,61000,120000,8500,
    15000,52000,78000,11000,93000,27000,
    145000,44000,68000,19000,5500,38000,
    110000,22000,59000,73000,14000,133000,
    25000,82000,47000,66000,9000,41000,
    158000,36000,71000,105000,12000,55000,
    89000,43000,126000,17000
  ];

  v_client_ids uuid[];
  v_client_count int;
  v_idx int;
BEGIN
  -- Resolve organization
  IF v_organization_id IS NULL THEN
    SELECT id
      INTO v_organization_id
      FROM public.organizations
     WHERE deleted_at IS NULL
     ORDER BY created_at
     LIMIT 1;
  END IF;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organization encontrada. Crie ou informe um organization_id antes de rodar o seed.';
  END IF;

  -- Load client IDs from the organization
  SELECT ARRAY(
    SELECT id
      FROM public.clients
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 50
  ) INTO v_client_ids;

  v_client_count := array_length(v_client_ids, 1);

  IF v_client_count IS NULL OR v_client_count = 0 THEN
    RAISE EXCEPTION 'Nenhum cliente encontrado para a organização %. Execute clients_demo_seed.sql primeiro.', v_organization_id;
  END IF;

  -- Remove previous seed rows
  DELETE FROM public.vehicles
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:vehicles-demo-v1]%';

  -- Insert 40 vehicles
  FOR v_idx IN 1..40 LOOP
    INSERT INTO public.vehicles (
      organization_id,
      client_id,
      license_plate,
      brand,
      model,
      year,
      color,
      engine,
      fuel_type,
      mileage,
      notes,
      created_by,
      updated_by
    ) VALUES (
      v_organization_id,
      v_client_ids[((v_idx - 1) % v_client_count) + 1],
      v_plates[v_idx],
      v_brands[((v_idx - 1) % array_length(v_brands, 1)) + 1],
      v_models[((v_idx - 1) % array_length(v_models, 1)) + 1],
      v_years[v_idx],
      v_colors[((v_idx - 1) % array_length(v_colors, 1)) + 1],
      v_engines[((v_idx - 1) % array_length(v_engines, 1)) + 1],
      v_fuel_types[((v_idx - 1) % array_length(v_fuel_types, 1)) + 1],
      v_mileages[v_idx],
      format('[seed:vehicles-demo-v1] Veículo de demonstração %s', lpad(v_idx::text, 3, '0')),
      'seed@autopro.local',
      'seed@autopro.local'
    );
  END LOOP;

  RAISE NOTICE 'Seed concluído: 40 veículos inseridos para organization_id=%', v_organization_id;
END $$;
