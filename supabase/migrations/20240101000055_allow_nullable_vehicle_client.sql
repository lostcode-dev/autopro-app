-- =============================================================================
-- Migration: 20240101000055_allow_nullable_vehicle_client.sql
-- Description: Allows migrated vehicles to exist without a linked client.
-- =============================================================================

ALTER TABLE public.vehicles
  ALTER COLUMN client_id DROP NOT NULL;

COMMENT ON COLUMN public.vehicles.client_id IS 'Optional customer who owns this vehicle. Some legacy migrated vehicles may not have a client reference.';
