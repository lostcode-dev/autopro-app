-- =============================================================================
-- Seeder: 013_cleanup_orphan_taxes_seed.sql
-- Description: Removes legacy taxes that had no organization in Base44 and
--              restores the valid Loker taxes with the correct audit metadata.
-- =============================================================================

DO $$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
  v_loker_legacy_org_id text := '69864ce67137a313e5c26d4d';
  v_loker_org_id uuid := uuid_generate_v5(v_namespace, 'organization:' || v_loker_legacy_org_id);
  v_deleted_tax_count int := 0;
  v_upserted_tax_count int := 0;
BEGIN
  DELETE FROM public.taxes
  WHERE name IN ('SIMPLES', 'ISSQN', 'ISS')
    AND (
      created_by IN ('quotabankoficial@gmail.com', 'beenkoficial@gmail.com')
      OR updated_by IN ('quotabankoficial@gmail.com', 'beenkoficial@gmail.com')
    );

  GET DIAGNOSTICS v_deleted_tax_count = ROW_COUNT;

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
  VALUES
    (
      uuid_generate_v5(v_namespace, 'tax:68c0a862a4a3664141d94c00:' || v_loker_legacy_org_id),
      v_loker_org_id,
      'SIMPLES',
      'federal',
      8,
      '2025-09-09T22:21:22.829000Z'::timestamptz,
      'contato@loker.com.br',
      '2026-02-16T12:42:01.696000Z'::timestamptz,
      'contato@loker.com.br'
    ),
    (
      uuid_generate_v5(v_namespace, 'tax:68c0a6bdd81a26d9b5c21c02:' || v_loker_legacy_org_id),
      v_loker_org_id,
      'ISSQN',
      'municipal',
      5,
      '2025-09-09T22:14:21.658000Z'::timestamptz,
      'contato@loker.com.br',
      '2026-02-16T12:42:01.642000Z'::timestamptz,
      'contato@loker.com.br'
    )
  ON CONFLICT (organization_id, name) DO UPDATE
  SET
    id = EXCLUDED.id,
    type = EXCLUDED.type,
    rate = EXCLUDED.rate,
    created_at = EXCLUDED.created_at,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE public.taxes.id IS DISTINCT FROM EXCLUDED.id
     OR public.taxes.type IS DISTINCT FROM EXCLUDED.type
     OR public.taxes.rate IS DISTINCT FROM EXCLUDED.rate
     OR public.taxes.created_at IS DISTINCT FROM EXCLUDED.created_at
     OR public.taxes.created_by IS DISTINCT FROM EXCLUDED.created_by
     OR public.taxes.updated_at IS DISTINCT FROM EXCLUDED.updated_at
     OR public.taxes.updated_by IS DISTINCT FROM EXCLUDED.updated_by
     OR public.taxes.deleted_at IS NOT NULL
     OR public.taxes.deleted_by IS NOT NULL;

  GET DIAGNOSTICS v_upserted_tax_count = ROW_COUNT;

  RAISE NOTICE 'Orphan tax cleanup complete: % taxes deleted, % valid Loker taxes upserted.',
    v_deleted_tax_count,
    v_upserted_tax_count;
END;
$$;
