-- =============================================================================
-- Seeder: 012_cleanup_placeholder_clients_seed.sql
-- Description: Removes legacy placeholder clients created for vehicles without
--              an original client reference.
-- =============================================================================

DO $$
DECLARE
  v_unlinked_vehicle_count int := 0;
  v_deleted_client_count int := 0;
BEGIN
  CREATE TEMP TABLE tmp_placeholder_clients_to_remove (
    id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO tmp_placeholder_clients_to_remove (id)
  SELECT clients.id
  FROM public.clients
  WHERE clients.name = 'Cliente legado sem vinculo'
    AND clients.phone = '0000000000'
    AND clients.created_by = 'migration:003_operational_catalog_seed'
    AND clients.notes = 'Auto-created during migration for vehicles without a client reference.';

  UPDATE public.vehicles
  SET
    client_id = NULL,
    updated_at = now(),
    updated_by = 'migration:012_cleanup_placeholder_clients_seed'
  WHERE client_id IN (
    SELECT id
    FROM tmp_placeholder_clients_to_remove
  );

  GET DIAGNOSTICS v_unlinked_vehicle_count = ROW_COUNT;

  DELETE FROM public.clients
  WHERE id IN (
    SELECT id
    FROM tmp_placeholder_clients_to_remove
  );

  GET DIAGNOSTICS v_deleted_client_count = ROW_COUNT;

  RAISE NOTICE 'Placeholder client cleanup complete: % vehicles unlinked, % clients deleted.',
    v_unlinked_vehicle_count,
    v_deleted_client_count;
END;
$$;
