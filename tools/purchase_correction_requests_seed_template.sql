-- =============================================================================
-- Seeder: 011_purchase_and_correction_requests_seed.sql
-- Description: Migrates purchase requests and service order correction requests
--              from Base44 exports after purchases and service orders exist.
-- =============================================================================

DO $$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
BEGIN
  CREATE TEMP TABLE tmp_purchase_request_source (
    legacy_purchase_request_id text PRIMARY KEY,
    items text,
    requester text,
    authorization_date text,
    legacy_purchase_id text,
    request_number text,
    legacy_service_order_id text,
    notes text,
    request_date text,
    legacy_supplier_id text,
    rejection_reason text,
    legacy_org_id text,
    justification text,
    total_request_amount text,
    status text,
    authorized_by text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_purchase_request_source
  SELECT * FROM jsonb_to_recordset($purchase_requests$__PURCHASE_REQUESTS_JSON__$purchase_requests$::jsonb) AS src(
    legacy_purchase_request_id text,
    items text,
    requester text,
    authorization_date text,
    legacy_purchase_id text,
    request_number text,
    legacy_service_order_id text,
    notes text,
    request_date text,
    legacy_supplier_id text,
    rejection_reason text,
    legacy_org_id text,
    justification text,
    total_request_amount text,
    status text,
    authorized_by text,
    created_at text,
    updated_at text,
    created_by text
  );

  CREATE TEMP TABLE tmp_correction_request_source (
    legacy_correction_request_id text PRIMARY KEY,
    approved_by text,
    requester_email text,
    service_order_number text,
    legacy_responsible_id text,
    completion_date text,
    description text,
    requester_name text,
    legacy_service_order_id text,
    legacy_org_id text,
    updated_by text,
    approval_date text,
    resolution_notes text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  ) ON COMMIT DROP;

  INSERT INTO tmp_correction_request_source
  SELECT * FROM jsonb_to_recordset($correction_requests$__CORRECTION_REQUESTS_JSON__$correction_requests$::jsonb) AS src(
    legacy_correction_request_id text,
    approved_by text,
    requester_email text,
    service_order_number text,
    legacy_responsible_id text,
    completion_date text,
    description text,
    requester_name text,
    legacy_service_order_id text,
    legacy_org_id text,
    updated_by text,
    approval_date text,
    resolution_notes text,
    status text,
    created_at text,
    updated_at text,
    created_by text
  );

  INSERT INTO public.purchase_requests (
    id, organization_id, request_number, request_date, supplier_id, status,
    items, total_request_amount, requester, service_order_id, justification,
    notes, authorization_date, authorized_by, rejection_reason, purchase_id,
    created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'purchase_request:' || src.legacy_purchase_request_id),
    organizations.id,
    LEFT(COALESCE(NULLIF(src.request_number, ''), src.legacy_purchase_request_id), 50),
    COALESCE(NULLIF(src.request_date, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    suppliers.id,
    CASE src.status
      WHEN 'aguardando' THEN 'waiting'
      WHEN 'pendente' THEN 'waiting'
      WHEN 'autorizado' THEN 'authorized'
      WHEN 'aprovado' THEN 'authorized'
      WHEN 'recusado' THEN 'rejected'
      WHEN 'rejeitado' THEN 'rejected'
      WHEN 'comprado' THEN 'purchased'
      ELSE 'waiting'
    END,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description', item->>'descricao',
        'code', item->>'codigo',
        'vehicle_id', CASE WHEN COALESCE(item->>'veiculo_id', '') <> '' THEN uuid_generate_v5(v_namespace, 'vehicle:' || (item->>'veiculo_id')) ELSE NULL END,
        'quantity', COALESCE(NULLIF(item->>'quantidade', '')::numeric, 1),
        'estimated_unit_price', COALESCE(NULLIF(item->>'valor_unitario_estimado', '')::numeric, 0),
        'estimated_total_price', COALESCE(NULLIF(item->>'valor_total_estimado', '')::numeric, 0),
        'notes', item->>'observacoes'
      ))
      FROM jsonb_array_elements(COALESCE(NULLIF(src.items, '')::jsonb, '[]'::jsonb)) AS item
    ), '[]'::jsonb),
    COALESCE(NULLIF(src.total_request_amount, '')::numeric, 0),
    LEFT(COALESCE(NULLIF(src.requester, ''), NULLIF(src.created_by, ''), 'migration@autopro.local'), 200),
    service_orders.id,
    NULLIF(src.justification, ''),
    NULLIF(src.notes, ''),
    NULLIF(src.authorization_date, '')::timestamptz,
    NULLIF(src.authorized_by, ''),
    NULLIF(src.rejection_reason, ''),
    purchases.id,
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    NULL,
    NULL
  FROM tmp_purchase_request_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.suppliers AS suppliers
    ON suppliers.id = uuid_generate_v5(v_namespace, 'supplier:' || src.legacy_supplier_id)
  LEFT JOIN public.service_orders AS service_orders
    ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
  LEFT JOIN public.purchases AS purchases
    ON purchases.id = uuid_generate_v5(v_namespace, 'purchase:' || src.legacy_purchase_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_supplier_id <> ''
    AND src.request_number <> ''
  ON CONFLICT (organization_id, request_number) DO UPDATE
  SET
    supplier_id = EXCLUDED.supplier_id,
    status = EXCLUDED.status,
    request_date = EXCLUDED.request_date,
    items = EXCLUDED.items,
    total_request_amount = EXCLUDED.total_request_amount,
    requester = EXCLUDED.requester,
    service_order_id = EXCLUDED.service_order_id,
    justification = EXCLUDED.justification,
    notes = EXCLUDED.notes,
    authorization_date = EXCLUDED.authorization_date,
    authorized_by = EXCLUDED.authorized_by,
    rejection_reason = EXCLUDED.rejection_reason,
    purchase_id = EXCLUDED.purchase_id,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  INSERT INTO public.service_order_correction_requests (
    id, organization_id, service_order_id, description, status,
    requester_email, requester_name, service_order_number, responsible_id,
    approved_by, approval_date, completion_date, resolution_notes, created_at,
    created_by, updated_at, updated_by, deleted_at, deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'service_order_correction_request:' || src.legacy_correction_request_id),
    organizations.id,
    service_orders.id,
    COALESCE(NULLIF(src.description, ''), 'Solicitacao de correcao importada do Base44'),
    CASE src.status
      WHEN 'pendente' THEN 'pending'
      WHEN 'aprovada' THEN 'approved'
      WHEN 'aprovado' THEN 'approved'
      WHEN 'rejeitada' THEN 'rejected'
      WHEN 'rejeitado' THEN 'rejected'
      WHEN 'concluida' THEN 'completed'
      WHEN 'concluido' THEN 'completed'
      ELSE 'pending'
    END,
    COALESCE(NULLIF(src.requester_email, ''), NULLIF(src.created_by, ''), 'migration@autopro.local'),
    NULLIF(src.requester_name, ''),
    NULLIF(src.service_order_number, ''),
    employees.id,
    NULLIF(src.approved_by, ''),
    NULLIF(src.approval_date, '')::timestamptz,
    NULLIF(src.completion_date, '')::timestamptz,
    NULLIF(src.resolution_notes, ''),
    COALESCE(NULLIF(src.created_at, '')::timestamptz, now()),
    NULLIF(src.created_by, ''),
    COALESCE(NULLIF(src.updated_at, '')::timestamptz, NULLIF(src.created_at, '')::timestamptz, now()),
    COALESCE(NULLIF(src.updated_by, ''), NULLIF(src.created_by, '')),
    NULL,
    NULL
  FROM tmp_correction_request_source AS src
  JOIN public.organizations AS organizations
    ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
  JOIN public.service_orders AS service_orders
    ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
  LEFT JOIN public.employees AS employees
    ON employees.id = uuid_generate_v5(v_namespace, 'employee:' || src.legacy_responsible_id)
  WHERE src.legacy_org_id <> ''
    AND src.legacy_service_order_id <> ''
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    service_order_id = EXCLUDED.service_order_id,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    requester_email = EXCLUDED.requester_email,
    requester_name = EXCLUDED.requester_name,
    service_order_number = EXCLUDED.service_order_number,
    responsible_id = EXCLUDED.responsible_id,
    approved_by = EXCLUDED.approved_by,
    approval_date = EXCLUDED.approval_date,
    completion_date = EXCLUDED.completion_date,
    resolution_notes = EXCLUDED.resolution_notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  UPDATE public.service_order_edit_logs AS logs
  SET
    correction_id = correction_requests.id,
    updated_at = correction_requests.updated_at,
    updated_by = correction_requests.updated_by
  FROM tmp_correction_request_source AS src
  JOIN public.service_order_correction_requests AS correction_requests
    ON correction_requests.id = uuid_generate_v5(v_namespace, 'service_order_correction_request:' || src.legacy_correction_request_id)
  WHERE logs.correction_id IS NULL
    AND logs.operation_type = 'correction'
    AND logs.service_order_id = correction_requests.service_order_id
    AND (
      COALESCE(src.service_order_number, '') = ''
      OR logs.service_order_number = src.service_order_number
    )
    AND COALESCE(src.legacy_correction_request_id, '') <> '';

  RAISE NOTICE 'Skipped % purchase requests without resolvable organization, supplier, or request number.', (
    SELECT count(*)
    FROM tmp_purchase_request_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.suppliers AS suppliers
      ON suppliers.id = uuid_generate_v5(v_namespace, 'supplier:' || src.legacy_supplier_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_supplier_id = ''
       OR src.request_number = ''
       OR organizations.id IS NULL
       OR suppliers.id IS NULL
  );

  RAISE NOTICE 'Skipped % service order correction requests without resolvable organization or service order.', (
    SELECT count(*)
    FROM tmp_correction_request_source AS src
    LEFT JOIN public.organizations AS organizations
      ON organizations.id = uuid_generate_v5(v_namespace, 'organization:' || src.legacy_org_id)
    LEFT JOIN public.service_orders AS service_orders
      ON service_orders.id = uuid_generate_v5(v_namespace, 'service_order:' || src.legacy_service_order_id)
    WHERE src.legacy_org_id = ''
       OR src.legacy_service_order_id = ''
       OR organizations.id IS NULL
       OR service_orders.id IS NULL
  );
END $$;
