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
  SELECT * FROM jsonb_to_recordset($purchase_requests$[{"legacy_purchase_request_id":"6900d8cb6161d5f1572c13e5","items":"[{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":235.12,\"valor_unitario_estimado\":29.39,\"quantidade\":8,\"descricao\":\"Óleo 5W20\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":169.6,\"valor_unitario_estimado\":21.2,\"quantidade\":8,\"descricao\":\"Óleo 5W30\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":120.60000000000001,\"valor_unitario_estimado\":20.1,\"quantidade\":6,\"descricao\":\"Óleo 10W40\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":79.28,\"valor_unitario_estimado\":19.82,\"quantidade\":4,\"descricao\":\"Óleo 15W40\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":74.61,\"valor_unitario_estimado\":24.87,\"quantidade\":3,\"descricao\":\"Fluido de Freio Dot 4\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":21.98,\"valor_unitario_estimado\":21.98,\"quantidade\":1,\"descricao\":\"Limpa Freio\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":25.32,\"valor_unitario_estimado\":12.66,\"quantidade\":2,\"descricao\":\"Filtro Óleo Ford Ka\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":16.78,\"valor_unitario_estimado\":8.39,\"quantidade\":2,\"descricao\":\"Filtro Óleo Siena\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":20.76,\"valor_unitario_estimado\":10.38,\"quantidade\":2,\"descricao\":\"Filtro Óleo Sandero/Logan\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":3.74,\"valor_unitario_estimado\":3.74,\"quantidade\":1,\"descricao\":\"Veda Escape Bisnaga Orgi\"}]","requester":"contato@loker.com.br","authorization_date":"2025-10-30T19:30:29.449Z","legacy_purchase_id":"","request_number":"SOL-1761663178230","legacy_service_order_id":"","notes":"","request_date":"2025-10-28T14:52:58.230Z","legacy_supplier_id":"68c2cf986ca82b6bdebfc4ca","rejection_reason":"","legacy_org_id":"69864ce67137a313e5c26d4d","justification":"Para a mecânica Oleo, produto etc","total_request_amount":"767.7900000000001","status":"autorizado","authorized_by":"contato@loker.com.br","created_at":"2025-10-28T14:52:59.009000","updated_at":"2026-02-16T16:58:09.441000","created_by":"contato@loker.com.br"},{"legacy_purchase_request_id":"68e52621354fb79098a010ea","items":"[{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":120.60000000000001,\"valor_unitario_estimado\":20.1,\"quantidade\":6,\"descricao\":\"ÓLEO 10W40\"},{\"veiculo_id\":\"68e405c4c18a3f5f0953bc05\",\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":58.84,\"valor_unitario_estimado\":14.71,\"quantidade\":4,\"descricao\":\"VELA IGNICAO GOL/VOYAGE\"},{\"veiculo_id\":\"68e405c4c18a3f5f0953bc05\",\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":163.65,\"valor_unitario_estimado\":163.65,\"quantidade\":1,\"descricao\":\"BOBINA IGNICAO GOL/VOYAGE\"},{\"veiculo_id\":null,\"observacoes\":\"\",\"codigo\":\"\",\"valor_total_estimado\":10.38,\"valor_unitario_estimado\":10.38,\"quantidade\":1,\"descricao\":\"FILTRO DE ÓLEO\"}]","requester":"contato@loker.com.br","authorization_date":"2025-10-30T19:30:34.343Z","legacy_purchase_id":"","request_number":"SOL-1759847969288","legacy_service_order_id":"","notes":"","request_date":"2025-10-07T14:39:29.288Z","legacy_supplier_id":"68c2cf986ca82b6bdebfc4ca","rejection_reason":"","legacy_org_id":"69864ce67137a313e5c26d4d","justification":"ESTOQUE E ARRUMAR FALHA DO VOYAGE","total_request_amount":"353.47","status":"autorizado","authorized_by":"contato@loker.com.br","created_at":"2025-10-07T14:39:29.823000","updated_at":"2026-02-16T16:58:09.455000","created_by":"contato@loker.com.br"}]$purchase_requests$::jsonb) AS src(
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
  SELECT * FROM jsonb_to_recordset($correction_requests$[{"legacy_correction_request_id":"69b9cd8a4c783641612b09b3","approved_by":"danielsoaresf@hotmail.com","requester_email":"danielsoaresf@hotmail.com","service_order_number":"OS4333","legacy_responsible_id":"6995a7acc606859d0294140a","completion_date":"2026-03-17T21:57:13.461Z","description":"Testando solicitação de #OS","requester_name":"Daniel Soares","legacy_service_order_id":"69b80457a5dbf93aa18b5e72","legacy_org_id":"69864e74fb6fe137d3577c07","updated_by":"danielsoaresf@hotmail.com","approval_date":"2026-03-17T21:56:45.069Z","resolution_notes":"Teste","status":"concluida","created_at":"2026-03-17T21:54:18.087000","updated_at":"2026-03-17T21:57:13.607000","created_by":"danielsoaresf@hotmail.com"}]$correction_requests$::jsonb) AS src(
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
