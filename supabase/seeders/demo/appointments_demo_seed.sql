-- =============================================================================
-- Seed: appointments_demo_seed.sql
-- Purpose: Insert ~22 demo appointments per month throughout 2026 (≈264 total)
--          for a single organization in Supabase.
--
-- How to use:
-- 1. Run clients_demo_seed.sql first  (appointments need clients).
-- 2. Run vehicles_demo_seed.sql first (appointments need vehicles).
-- 3. Open the Supabase SQL Editor.
-- 4. If you want a specific organization, replace the UUID below with its own.
-- 5. Run the script.
--
-- Behavior:
-- - If v_organization_id is NULL, the script uses the first active organization.
-- - Picks up to 40 clients and 40 vehicles already in the org.
-- - Selects the first 22 Mon–Sat dates of each month of 2026 as appointment dates.
-- - Distributes service types, times, priorities and statuses realistically.
-- - Status distribution: past dates → completed/cancelled; future → scheduled/confirmed.
-- - Idempotent: removes rows tagged [seed:appointments-demo-v1] before re-inserting.
-- =============================================================================

DO $$
DECLARE
  v_organization_id uuid := 'ac547d2f-afe7-4523-b019-c27a16e820e1';

  v_client_ids  uuid[];
  v_vehicle_ids uuid[];
  v_client_count  int;
  v_vehicle_count int;

  v_service_types text[] := ARRAY[
    'Troca de óleo e filtro',
    'Revisão geral',
    'Alinhamento e balanceamento',
    'Troca de pastilhas de freio',
    'Troca de pneus',
    'Diagnóstico eletrônico',
    'Troca de correia dentada',
    'Revisão do sistema de arrefecimento',
    'Troca de amortecedores',
    'Higienização do ar-condicionado',
    'Troca de bateria',
    'Revisão de freios',
    'Troca de velas de ignição',
    'Revisão de suspensão',
    'Troca de fluido de freio',
    'Polimento e cristalização',
    'Injeção eletrônica',
    'Troca de filtro de ar',
    'Revisão pré-viagem',
    'Troca de embreagem'
  ];

  v_times text[] := ARRAY[
    '07:30','08:00','08:30','09:00','09:30','10:00',
    '10:30','11:00','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30'
  ];

  v_priorities text[] := ARRAY[
    NULL, NULL, NULL,       -- 3/7 sem prioridade
    'low', 'low',           -- 2/7 baixa
    'medium',               -- 1/7 média
    'high'                  -- 1/7 alta
  ];

  v_today        date := CURRENT_DATE;
  v_appt_date    date;
  v_status       text;
  v_priority     text;
  v_idx          int;
  v_row_num      int;
BEGIN
  -- ── Resolve organization ──────────────────────────────────────────────────
  IF v_organization_id IS NULL THEN
    SELECT id INTO v_organization_id
      FROM public.organizations
     WHERE deleted_at IS NULL
     ORDER BY created_at
     LIMIT 1;
  END IF;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organization encontrada. Crie ou informe um organization_id.';
  END IF;

  -- ── Load client IDs ────────────────────────────────────────────────────────
  SELECT ARRAY(
    SELECT id FROM public.clients
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 40
  ) INTO v_client_ids;

  v_client_count := array_length(v_client_ids, 1);
  IF v_client_count IS NULL OR v_client_count = 0 THEN
    RAISE EXCEPTION 'Nenhum cliente encontrado para a organização %. Execute clients_demo_seed.sql primeiro.', v_organization_id;
  END IF;

  -- ── Load vehicle IDs ────────────────────────────────────────────────────────
  SELECT ARRAY(
    SELECT id FROM public.vehicles
     WHERE organization_id = v_organization_id
       AND deleted_at IS NULL
     ORDER BY created_at
     LIMIT 40
  ) INTO v_vehicle_ids;

  v_vehicle_count := array_length(v_vehicle_ids, 1);
  IF v_vehicle_count IS NULL OR v_vehicle_count = 0 THEN
    RAISE EXCEPTION 'Nenhum veículo encontrado para a organização %. Execute vehicles_demo_seed.sql primeiro.', v_organization_id;
  END IF;

  -- ── Remove previous seed rows ─────────────────────────────────────────────
  DELETE FROM public.appointments
   WHERE organization_id = v_organization_id
     AND notes LIKE '[seed:appointments-demo-v1]%';

  -- ── Insert appointments ───────────────────────────────────────────────────
  -- Strategy: for each month of 2026, take the first 22 Mon-Sat dates.
  -- v_idx is a global counter used to rotate service type, time, etc.
  v_idx := 1;

  FOR v_appt_date IN
    SELECT d::date
    FROM (
      SELECT
        d,
        ROW_NUMBER() OVER (
          PARTITION BY DATE_TRUNC('month', d)
          ORDER BY d
        ) AS rn
      FROM generate_series(
        '2026-01-01'::date,
        '2026-12-31'::date,
        '1 day'::interval
      ) AS d
      WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 6  -- Mon=1, Sat=6
    ) sub
    WHERE rn <= 22
    ORDER BY d
  LOOP
    -- Status based on whether the date is past, today or future
    IF v_appt_date < v_today THEN
      -- Past: mostly completed, some cancelled
      CASE (v_idx % 8)
        WHEN 0 THEN v_status := 'cancelled';
        ELSE         v_status := 'completed';
      END CASE;
    ELSIF v_appt_date = v_today THEN
      -- Today: confirmed or in-progress (use confirmed)
      v_status := 'confirmed';
    ELSE
      -- Future: mix of scheduled and confirmed
      CASE (v_idx % 4)
        WHEN 0 THEN v_status := 'confirmed';
        ELSE         v_status := 'scheduled';
      END CASE;
    END IF;

    -- Priority from rotating array (NULL allowed)
    v_priority := v_priorities[((v_idx - 1) % array_length(v_priorities, 1)) + 1];

    INSERT INTO public.appointments (
      organization_id,
      client_id,
      vehicle_id,
      appointment_date,
      time,
      service_type,
      priority,
      status,
      notes,
      created_by,
      updated_by
    ) VALUES (
      v_organization_id,
      v_client_ids [((v_idx - 1) % v_client_count)  + 1],
      v_vehicle_ids[((v_idx - 1) % v_vehicle_count) + 1],
      v_appt_date,
      v_times       [((v_idx - 1) % array_length(v_times,        1)) + 1],
      v_service_types[((v_idx - 1) % array_length(v_service_types, 1)) + 1],
      v_priority,
      v_status,
      format('[seed:appointments-demo-v1] Agendamento de demonstração %s', lpad(v_idx::text, 3, '0')),
      'seed@autopro.local',
      'seed@autopro.local'
    );

    v_idx := v_idx + 1;
  END LOOP;

  RAISE NOTICE 'Seed concluído: % agendamentos inseridos para organization_id=%', v_idx - 1, v_organization_id;
END $$;
