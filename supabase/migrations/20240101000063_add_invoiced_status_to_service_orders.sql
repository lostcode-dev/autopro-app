-- Migration 63: add 'invoiced' status to service_orders
--
-- When a service order has an NFS-e emitted successfully its status is set to
-- 'invoiced'. We need to extend the CHECK constraint to allow this new value.

ALTER TABLE service_orders
  DROP CONSTRAINT IF EXISTS service_orders_status_check;

ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_status_check CHECK (status IN (
    'estimate',
    'open',
    'in_progress',
    'waiting_for_part',
    'completed',
    'invoiced',
    'delivered',
    'cancelled'
  ));
