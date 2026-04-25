-- =============================================================================
-- Seed: financial_demo_seed.sql
-- Purpose: Insert demo data for the Financeiro children pages:
--          financial overview, bank accounts, taxes, and payment terminals.
--
-- Covered pages:
-- - /app/financial
-- - /app/financial/accounts
-- - /app/financial/taxes
-- - /app/financial/machines
--
-- Not covered:
-- - /app/financial/service-invoices
--   This page is currently blocked by backendReady = false in the frontend,
--   so there is no org-scoped backend to seed yet.
--
-- How to use:
-- 1. Open the Supabase SQL Editor.
-- 2. If you want a specific organization, replace the NULL below with its UUID.
-- 3. Run the script.
--
-- Behavior:
-- - If v_organization_id is NULL, the script uses the first active organization.
-- - The seed is idempotent: it removes previous rows created by this seed before
--   re-inserting the new demo records.
-- =============================================================================

DO $$
DECLARE
  v_organization_id uuid := NULL;
  v_seed_user       text := 'seed@autopro.local';
  v_seed_tag        text := '[seed:financial-demo-v1]';
  v_month_start     date := date_trunc('month', current_date)::date;

  v_account_main    uuid;
  v_account_cash    uuid;
  v_account_reserve uuid;
  v_account_salary  uuid;
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

  RAISE NOTICE 'Usando organization_id = %', v_organization_id;

  -- ===========================================================================
  -- FASE 1 - LIMPEZA
  -- ===========================================================================
  DELETE FROM public.financial_transactions
   WHERE organization_id = v_organization_id
     AND notes LIKE v_seed_tag || '%';

  DELETE FROM public.payment_terminals
   WHERE organization_id = v_organization_id
     AND created_by = v_seed_user
     AND terminal_name LIKE '% Demo';

  DELETE FROM public.taxes
   WHERE organization_id = v_organization_id
     AND created_by = v_seed_user
     AND name LIKE '% Demo';

  DELETE FROM public.bank_accounts
   WHERE organization_id = v_organization_id
     AND notes LIKE v_seed_tag || '%';

  RAISE NOTICE '✓ Dados anteriores do seed removidos';

  -- ===========================================================================
  -- FASE 2 - CONTAS BANCÁRIAS
  -- ===========================================================================
  INSERT INTO public.bank_accounts (
    organization_id,
    account_name,
    account_type,
    initial_balance,
    preferred_payment_method,
    bank_name,
    branch,
    account_number,
    current_balance,
    is_active,
    notes,
    change_history,
    created_by,
    updated_by
  ) VALUES (
    v_organization_id,
    'Conta Operacional Demo',
    'checking',
    25000.00,
    'transfer',
    'Banco do Brasil',
    '0001',
    '12345-6',
    25000.00,
    true,
    v_seed_tag || ' Conta principal da operação diária',
    jsonb_build_array(
      jsonb_build_object('action', 'created_by_seed', 'amount', 25000.00, 'at', now())
    ),
    v_seed_user,
    v_seed_user
  )
  RETURNING id INTO v_account_main;

  INSERT INTO public.bank_accounts (
    organization_id,
    account_name,
    account_type,
    initial_balance,
    preferred_payment_method,
    bank_name,
    branch,
    account_number,
    current_balance,
    is_active,
    notes,
    change_history,
    created_by,
    updated_by
  ) VALUES (
    v_organization_id,
    'Caixa Oficina Demo',
    'cash',
    3500.00,
    'cash',
    NULL,
    NULL,
    NULL,
    3500.00,
    true,
    v_seed_tag || ' Caixa físico para despesas rápidas',
    jsonb_build_array(
      jsonb_build_object('action', 'created_by_seed', 'amount', 3500.00, 'at', now())
    ),
    v_seed_user,
    v_seed_user
  )
  RETURNING id INTO v_account_cash;

  INSERT INTO public.bank_accounts (
    organization_id,
    account_name,
    account_type,
    initial_balance,
    preferred_payment_method,
    bank_name,
    branch,
    account_number,
    current_balance,
    is_active,
    notes,
    change_history,
    created_by,
    updated_by
  ) VALUES (
    v_organization_id,
    'Reserva Financeira Demo',
    'savings',
    18000.00,
    'pix',
    'Caixa Econômica',
    '1020',
    '87654-3',
    18000.00,
    true,
    v_seed_tag || ' Reserva para capital de giro',
    jsonb_build_array(
      jsonb_build_object('action', 'created_by_seed', 'amount', 18000.00, 'at', now())
    ),
    v_seed_user,
    v_seed_user
  )
  RETURNING id INTO v_account_reserve;

  INSERT INTO public.bank_accounts (
    organization_id,
    account_name,
    account_type,
    initial_balance,
    preferred_payment_method,
    bank_name,
    branch,
    account_number,
    current_balance,
    is_active,
    notes,
    change_history,
    created_by,
    updated_by
  ) VALUES (
    v_organization_id,
    'Conta Folha Demo',
    'salary',
    9500.00,
    'transfer',
    'Itaú',
    '3012',
    '99881-0',
    9500.00,
    true,
    v_seed_tag || ' Conta dedicada a folha e retiradas fixas',
    jsonb_build_array(
      jsonb_build_object('action', 'created_by_seed', 'amount', 9500.00, 'at', now())
    ),
    v_seed_user,
    v_seed_user
  )
  RETURNING id INTO v_account_salary;

  RAISE NOTICE '✓ Contas bancárias demo criadas';

  -- ===========================================================================
  -- FASE 3 - IMPOSTOS
  -- ===========================================================================
  INSERT INTO public.taxes (
    organization_id,
    name,
    type,
    rate,
    created_by,
    updated_by
  )
  SELECT
    v_organization_id,
    seed_row.name,
    seed_row.type,
    seed_row.rate,
    v_seed_user,
    v_seed_user
  FROM (
    VALUES
      ('ISS Demo', 'municipal', 5.0000::numeric),
      ('ICMS Demo', 'state', 18.0000::numeric),
      ('IPI Demo', 'federal', 4.0000::numeric),
      ('PIS Demo', 'federal', 1.6500::numeric),
      ('COFINS Demo', 'federal', 7.6000::numeric),
      ('Taxa Ambiental Demo', 'municipal', 2.5000::numeric)
  ) AS seed_row(name, type, rate);

  RAISE NOTICE '✓ Impostos demo criados';

  -- ===========================================================================
  -- FASE 4 - MAQUININHAS
  -- ===========================================================================
  INSERT INTO public.payment_terminals (
    organization_id,
    terminal_name,
    provider_company,
    bank_account_id,
    payment_receipt_days,
    is_active,
    rates,
    created_by,
    updated_by
  ) VALUES
  (
    v_organization_id,
    'Stone Smart Demo',
    'Stone',
    v_account_main,
    2,
    true,
    '[
      {"installment_number":1,"rate_percentage":1.69},
      {"installment_number":2,"rate_percentage":2.95},
      {"installment_number":3,"rate_percentage":3.49},
      {"installment_number":6,"rate_percentage":5.29}
    ]'::jsonb,
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Cielo Flash Demo',
    'Cielo',
    v_account_main,
    30,
    true,
    '[
      {"installment_number":1,"rate_percentage":1.89},
      {"installment_number":2,"rate_percentage":3.10},
      {"installment_number":3,"rate_percentage":3.89},
      {"installment_number":10,"rate_percentage":8.19}
    ]'::jsonb,
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'PagBank Delivery Demo',
    'PagSeguro',
    v_account_reserve,
    14,
    true,
    '[
      {"installment_number":1,"rate_percentage":1.99},
      {"installment_number":2,"rate_percentage":3.45},
      {"installment_number":4,"rate_percentage":4.65},
      {"installment_number":12,"rate_percentage":9.90}
    ]'::jsonb,
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Rede Reserva Demo',
    'Rede',
    v_account_main,
    31,
    false,
    '[
      {"installment_number":1,"rate_percentage":2.09},
      {"installment_number":2,"rate_percentage":3.65},
      {"installment_number":6,"rate_percentage":5.85}
    ]'::jsonb,
    v_seed_user,
    v_seed_user
  );

  RAISE NOTICE '✓ Maquininhas demo criadas';

  -- ===========================================================================
  -- FASE 5 - LANÇAMENTOS FINANCEIROS
  -- ===========================================================================
  INSERT INTO public.financial_transactions (
    organization_id,
    description,
    amount,
    due_date,
    type,
    status,
    category,
    recurrence,
    bank_account_id,
    notes,
    created_by,
    updated_by
  ) VALUES
  (
    v_organization_id,
    'Recebimento revisão geral - cliente frota Demo',
    3250.00,
    v_month_start + 1,
    'income',
    'paid',
    'services',
    NULL,
    v_account_main,
    v_seed_tag || ' Receita recorrente de serviços automotivos',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Venda balcão de peças Demo',
    1840.00,
    v_month_start + 3,
    'income',
    'paid',
    'sales',
    NULL,
    v_account_main,
    v_seed_tag || ' Venda avulsa de componentes do estoque',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Recebimento alinhamento e balanceamento Demo',
    620.00,
    v_month_start + 6,
    'income',
    'pending',
    'services',
    NULL,
    v_account_cash,
    v_seed_tag || ' Serviço agendado ainda não liquidado',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Contrato mensal manutenção preventiva Demo',
    4100.00,
    v_month_start + 8,
    'income',
    'pending',
    'services',
    'monthly',
    v_account_reserve,
    v_seed_tag || ' Receita mensal contratada para testes de recorrência',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Compra de autopeças fornecedor principal Demo',
    2680.00,
    v_month_start + 4,
    'expense',
    'pending',
    'suppliers',
    NULL,
    v_account_main,
    v_seed_tag || ' Despesa em aberto com fornecedor de reposição',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Reposição de filtros e fluidos Demo',
    940.00,
    v_month_start + 2,
    'expense',
    'paid',
    'suppliers',
    NULL,
    v_account_cash,
    v_seed_tag || ' Compra rápida paga no caixa',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Folha operacional oficina Demo',
    7300.00,
    v_month_start + 5,
    'expense',
    'pending',
    'salaries',
    'monthly',
    v_account_salary,
    v_seed_tag || ' Folha pendente para conferência',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Pró-labore sócios Demo',
    3800.00,
    v_month_start + 7,
    'expense',
    'paid',
    'salaries',
    'monthly',
    v_account_salary,
    v_seed_tag || ' Pagamento fixo já realizado',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Aluguel galpão principal Demo',
    5200.00,
    v_month_start + 10,
    'expense',
    'pending',
    'rent',
    'monthly',
    v_account_main,
    v_seed_tag || ' Despesa fixa mensal',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Campanha Instagram oficina Demo',
    890.00,
    v_month_start + 9,
    'expense',
    'paid',
    'marketing',
    NULL,
    v_account_cash,
    v_seed_tag || ' Impulsionamento já quitado',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Google Ads serviços automotivos Demo',
    740.00,
    v_month_start + 13,
    'expense',
    'pending',
    'marketing',
    NULL,
    v_account_cash,
    v_seed_tag || ' Campanha em andamento',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'DAS Simples Nacional Demo',
    1680.00,
    v_month_start + 14,
    'expense',
    'pending',
    'taxes',
    NULL,
    v_account_main,
    v_seed_tag || ' Tributo mensal em aberto',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'ISS mensal serviço externo Demo',
    420.00,
    v_month_start + 11,
    'expense',
    'paid',
    'taxes',
    NULL,
    v_account_main,
    v_seed_tag || ' Imposto municipal já recolhido',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Energia elétrica oficina Demo',
    960.00,
    v_month_start + 12,
    'expense',
    'pending',
    'other',
    NULL,
    v_account_main,
    v_seed_tag || ' Conta operacional da oficina',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Internet e telefonia da recepção Demo',
    280.00,
    v_month_start + 15,
    'expense',
    'paid',
    'other',
    NULL,
    v_account_main,
    v_seed_tag || ' Serviço básico já debitado',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Recebimento pacote revisão premium Demo',
    2290.00,
    v_month_start + 16,
    'income',
    'pending',
    'services',
    NULL,
    v_account_main,
    v_seed_tag || ' Serviço concluído aguardando liquidação',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Receita venda de acessórios Demo',
    1350.00,
    v_month_start + 18,
    'income',
    'paid',
    'sales',
    NULL,
    v_account_cash,
    v_seed_tag || ' Venda complementar de acessórios automotivos',
    v_seed_user,
    v_seed_user
  ),
  (
    v_organization_id,
    'Serviço terceirizado funilaria Demo',
    1580.00,
    v_month_start + 20,
    'expense',
    'pending',
    'suppliers',
    NULL,
    v_account_main,
    v_seed_tag || ' Reembolso para parceiro externo',
    v_seed_user,
    v_seed_user
  );

  RAISE NOTICE '✓ Lançamentos financeiros demo criados';

  -- ===========================================================================
  -- FASE 6 - AJUSTE DE SALDO ATUAL DAS CONTAS DEMO
  -- ===========================================================================
  UPDATE public.bank_accounts AS ba
     SET current_balance = ba.initial_balance + COALESCE((
       SELECT SUM(
         CASE
           WHEN ft.type = 'income' THEN ft.amount
           WHEN ft.type = 'expense' THEN -ft.amount
           ELSE 0
         END
       )
         FROM public.financial_transactions AS ft
        WHERE ft.organization_id = v_organization_id
          AND ft.bank_account_id = ba.id
          AND ft.deleted_at IS NULL
          AND ft.notes LIKE v_seed_tag || '%'
          AND ft.status = 'paid'
     ), 0),
         updated_by = v_seed_user
   WHERE ba.organization_id = v_organization_id
     AND ba.notes LIKE v_seed_tag || '%';

  RAISE NOTICE '✓ Saldos atuais das contas demo recalculados';
  RAISE NOTICE 'Seed financial_demo_seed.sql concluído com sucesso.';
END $$;
