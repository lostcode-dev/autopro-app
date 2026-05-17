-- =============================================================================
-- Migration: 20240101000065_seed_fiscal_actions
-- Description:
--   Seeds the fiscal permission actions (service_invoice.*, product_invoice.*,
--   fiscal.manage) into the global actions catalogue.
--
--   These actions gate NF-e / NFS-e features and are only reachable when the
--   organization holds the "fiscal" plan tier AND the employee's role has the
--   corresponding action granted.
--
--   Uses INSERT … ON CONFLICT DO NOTHING so re-running the migration is safe.
-- =============================================================================

INSERT INTO public.actions (code, name, resource, action_type, description, created_by)
VALUES
  -- ── NFS-e (service invoices) ──────────────────────────────────────────
  ('service_invoice.read',   'Visualizar NFS-e',  'service_invoice', 'read',   'Permite visualizar notas fiscais de serviço emitidas.',            'migration'),
  ('service_invoice.create', 'Emitir NFS-e',      'service_invoice', 'create', 'Permite emitir notas fiscais de serviço.',                         'migration'),
  ('service_invoice.update', 'Editar NFS-e',      'service_invoice', 'update', 'Permite editar/corrigir notas fiscais de serviço.',                 'migration'),
  ('service_invoice.delete', 'Cancelar NFS-e',    'service_invoice', 'delete', 'Permite cancelar notas fiscais de serviço.',                       'migration')
ON CONFLICT (code) DO NOTHING;
