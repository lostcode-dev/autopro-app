-- =============================================================================
-- Seeder: 015_normalize_service_order_items_seed.sql
-- Description: Repairs migrated service order items so report-compatible aliases
--              are present without removing legacy keys still consumed by the UI.
-- =============================================================================

DO $$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
BEGIN
  WITH per_item AS (
    SELECT
      service_order.id AS service_order_id,
      item_position,
      item,
      COALESCE(
        NULLIF(item->>'product_id', ''),
        CASE
          WHEN COALESCE(item->>'produto_id', '') <> ''
            THEN uuid_generate_v5(v_namespace, 'product:' || (item->>'produto_id'))::text
          ELSE NULL
        END
      ) AS normalized_product_id,
      COALESCE(
        NULLIF(item->>'description', ''),
        NULLIF(item->>'descricao', '')
      ) AS normalized_description,
      COALESCE(
        NULLIF(item->>'quantity', '')::numeric,
        NULLIF(item->>'quantidade', '')::numeric,
        1
      ) AS normalized_quantity,
      COALESCE(
        NULLIF(item->>'unit_price', '')::numeric,
        NULLIF(item->>'valor_unitario', '')::numeric,
        NULLIF(item->>'valor_venda_unitario', '')::numeric,
        0
      ) AS normalized_unit_price,
      COALESCE(
        NULLIF(item->>'cost_amount', '')::numeric,
        NULLIF(item->>'cost_price', '')::numeric,
        NULLIF(item->>'valor_custo', '')::numeric,
        NULLIF(item->>'valor_custo_unitario', '')::numeric,
        0
      ) AS normalized_cost_amount,
      COALESCE(
        NULLIF(item->>'total_amount', '')::numeric,
        NULLIF(item->>'total_price', '')::numeric,
        NULLIF(item->>'valor_total', '')::numeric,
        NULLIF(item->>'valor_total_item', '')::numeric
      ) AS normalized_total_amount,
      COALESCE(
        NULLIF(item->>'commission_total', '')::numeric,
        NULLIF(item->>'total_commission', '')::numeric,
        NULLIF(item->>'comissao_total', '')::numeric,
        0
      ) AS normalized_commission_total,
      CASE
        WHEN jsonb_typeof(
          COALESCE(
            NULLIF(item->'commissions', 'null'::jsonb),
            NULLIF(item->'comissoes', 'null'::jsonb),
            '[]'::jsonb
          )
        ) = 'array'
          THEN COALESCE((
            SELECT jsonb_agg(
              commission
              || jsonb_strip_nulls(jsonb_build_object(
                'employee_id', COALESCE(
                  NULLIF(commission->>'employee_id', ''),
                  CASE
                    WHEN COALESCE(commission->>'funcionario_id', '') <> ''
                      THEN uuid_generate_v5(v_namespace, 'employee:' || (commission->>'funcionario_id'))::text
                    ELSE NULL
                  END
                ),
                'type', COALESCE(
                  NULLIF(commission->>'type', ''),
                  CASE commission->>'tipo'
                    WHEN 'percentual' THEN 'percentage'
                    WHEN 'fixo' THEN 'fixed_amount'
                    ELSE NULLIF(commission->>'tipo', '')
                  END,
                  'percentage'
                ),
                'base', COALESCE(
                  NULLIF(commission->>'base', ''),
                  CASE commission->>'base'
                    WHEN 'lucro' THEN 'profit'
                    WHEN 'venda' THEN 'revenue'
                    WHEN 'receita' THEN 'revenue'
                    ELSE NULL
                  END
                )
              ))
              || jsonb_build_object(
                'amount', COALESCE(
                  NULLIF(commission->>'amount', '')::numeric,
                  NULLIF(commission->>'valor', '')::numeric,
                  0
                ),
                'percentage', COALESCE(
                  NULLIF(commission->>'percentage', '')::numeric,
                  NULLIF(commission->>'percentual', '')::numeric
                )
              )
            )
            FROM jsonb_array_elements(
              COALESCE(
                NULLIF(item->'commissions', 'null'::jsonb),
                NULLIF(item->'comissoes', 'null'::jsonb),
                '[]'::jsonb
              )
            ) AS commission
          ), '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS normalized_commissions
    FROM public.service_orders AS service_order
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(service_order.items, '[]'::jsonb)) WITH ORDINALITY AS item_elements(item, item_position)
    WHERE service_order.deleted_at IS NULL
      AND jsonb_typeof(COALESCE(service_order.items, '[]'::jsonb)) = 'array'
  ),
  normalized AS (
    SELECT
      service_order_id,
      jsonb_agg(
        item
        || jsonb_strip_nulls(jsonb_build_object(
          'product_id', normalized_product_id,
          'description', normalized_description
        ))
        || jsonb_build_object(
          'quantity', normalized_quantity,
          'unit_price', normalized_unit_price,
          'cost_price', normalized_cost_amount,
          'cost_amount', normalized_cost_amount,
          'total_price', COALESCE(normalized_total_amount, normalized_unit_price * normalized_quantity),
          'total_amount', COALESCE(normalized_total_amount, normalized_unit_price * normalized_quantity),
          'total_commission', normalized_commission_total,
          'commission_total', normalized_commission_total,
          'commissions', normalized_commissions
        )
        ORDER BY item_position
      ) AS normalized_items
    FROM per_item
    GROUP BY service_order_id
  )
  UPDATE public.service_orders AS service_order
  SET items = normalized.normalized_items
  FROM normalized
  WHERE service_order.id = normalized.service_order_id
    AND service_order.items IS DISTINCT FROM normalized.normalized_items;
END $$;