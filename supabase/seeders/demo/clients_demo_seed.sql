-- =============================================================================
-- Seed: clients_demo_seed.sql
-- Purpose: Insert 50 demo clients for a single organization in Supabase.
--
-- How to use:
-- 1. Open the Supabase SQL Editor.
-- 2. If you want a specific organization, replace the NULL below with its UUID.
-- 3. Run the script.
--
-- Behavior:
-- - If v_organization_id is NULL, the script uses the first active organization.
-- - The seed is idempotent for this organization: it removes previous rows created
--   by this seed before inserting the new 50 records.
-- =============================================================================

DO $$
DECLARE
  v_organization_id uuid := 'ac547d2f-afe7-4523-b019-c27a16e820e1';
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
    RAISE EXCEPTION 'Nenhuma organization encontrada. Crie ou informe um organization_id antes de rodar o seed.';
  END IF;

  DELETE FROM public.clients
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:clients-demo-v1]%';

  INSERT INTO public.clients (
    organization_id,
    name,
    person_type,
    tax_id,
    phone,
    email,
    mobile_phone,
    birth_date,
    zip_code,
    street,
    address_number,
    address_complement,
    neighborhood,
    city,
    state,
    notes,
    created_by,
    updated_by
  )
  SELECT
    v_organization_id,
    CASE
      WHEN gs <= 25 THEN format('Cliente Teste %s', lpad(gs::text, 3, '0'))
      ELSE format('Empresa Teste %s Auto Center', lpad((gs - 25)::text, 3, '0'))
    END AS name,
    CASE
      WHEN gs <= 25 THEN 'pf'
      ELSE 'pj'
    END AS person_type,
    CASE
      WHEN gs <= 25 THEN lpad((11100000000 + gs)::text, 11, '0')
      ELSE lpad((33000000000000 + gs)::text, 14, '0')
    END AS tax_id,
    format('1199%04s', lpad(gs::text, 4, '0')) AS phone,
    CASE
      WHEN gs <= 25 THEN format('cliente.%s@seed.autopro.test', lpad(gs::text, 3, '0'))
      ELSE format('contato.%s@seed.autopro.test', lpad(gs::text, 3, '0'))
    END AS email,
    format('1198%04s', lpad(gs::text, 4, '0')) AS mobile_phone,
    CASE
      WHEN gs <= 25 THEN (DATE '1985-01-01' + ((gs - 1) * INTERVAL '180 day'))::date
      ELSE NULL
    END AS birth_date,
    CASE (gs % 10)
      WHEN 0 THEN '01001-000'
      WHEN 1 THEN '01310-100'
      WHEN 2 THEN '20040-020'
      WHEN 3 THEN '30130-110'
      WHEN 4 THEN '40020-000'
      WHEN 5 THEN '50030-230'
      WHEN 6 THEN '60060-080'
      WHEN 7 THEN '70040-010'
      WHEN 8 THEN '80010-000'
      ELSE '90010-150'
    END AS zip_code,
    CASE (gs % 8)
      WHEN 0 THEN 'Rua das Oficinas'
      WHEN 1 THEN 'Avenida dos Mecânicos'
      WHEN 2 THEN 'Rua do Motor'
      WHEN 3 THEN 'Avenida das Peças'
      WHEN 4 THEN 'Rua da Revisão'
      WHEN 5 THEN 'Alameda dos Pneus'
      WHEN 6 THEN 'Rua do Elevador Hidráulico'
      ELSE 'Travessa do Scanner'
    END AS street,
    ((gs % 250) + 10)::text AS address_number,
    CASE
      WHEN gs % 4 = 0 THEN 'Sala 2'
      WHEN gs % 4 = 1 THEN 'Galpão A'
      WHEN gs % 4 = 2 THEN 'Fundos'
      ELSE NULL
    END AS address_complement,
    CASE (gs % 6)
      WHEN 0 THEN 'Centro'
      WHEN 1 THEN 'Jardim Europa'
      WHEN 2 THEN 'Vila Nova'
      WHEN 3 THEN 'Industrial'
      WHEN 4 THEN 'Boa Vista'
      ELSE 'Santa Luzia'
    END AS neighborhood,
    CASE (gs % 10)
      WHEN 0 THEN 'São Paulo'
      WHEN 1 THEN 'Campinas'
      WHEN 2 THEN 'Rio de Janeiro'
      WHEN 3 THEN 'Belo Horizonte'
      WHEN 4 THEN 'Salvador'
      WHEN 5 THEN 'Recife'
      WHEN 6 THEN 'Fortaleza'
      WHEN 7 THEN 'Brasília'
      WHEN 8 THEN 'Curitiba'
      ELSE 'Porto Alegre'
    END AS city,
    CASE (gs % 10)
      WHEN 0 THEN 'SP'
      WHEN 1 THEN 'SP'
      WHEN 2 THEN 'RJ'
      WHEN 3 THEN 'MG'
      WHEN 4 THEN 'BA'
      WHEN 5 THEN 'PE'
      WHEN 6 THEN 'CE'
      WHEN 7 THEN 'DF'
      WHEN 8 THEN 'PR'
      ELSE 'RS'
    END AS state,
    format('[seed:clients-demo-v1] Cliente de demonstração %s', lpad(gs::text, 3, '0')) AS notes,
    'seed@autopro.local' AS created_by,
    'seed@autopro.local' AS updated_by
  FROM generate_series(1, 50) AS gs;

  RAISE NOTICE 'Seed concluído com sucesso para organization_id=%', v_organization_id;
END $$;
