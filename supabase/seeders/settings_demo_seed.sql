-- =============================================================================
-- Seed: settings_demo_seed.sql
-- Purpose: Insert demo data for the Configurações pages.
--
-- Covered pages:
-- - /app/settings              (overview)
-- - /app/settings/company      (organization info — updated with realistic data)
-- - /app/settings/employees    (employees with salary, commission, pix)
-- - /app/settings/roles        (roles + global actions + role_actions mappings)
--
-- Not covered (user-specific, no org-scoped DB rows needed):
-- - /app/settings/profile          (auth.users / user_profiles — per user)
-- - /app/settings/security         (auth.users password — managed by Supabase Auth)
-- - /app/settings/notifications    (notification_preferences — per user)
-- - /app/settings/subscription     (subscriptions — managed by Stripe webhook)
--
-- How to use:
-- 1. Open the Supabase SQL Editor.
-- 2. Optionally replace the NULL below with a specific organization UUID.
-- 3. Run the script.
--
-- Behavior:
-- - If v_organization_id is NULL, uses the first active organization.
-- - Idempotent: cleans up seed rows (tagged with v_seed_tag) before re-inserting.
-- - Actions are global (not org-scoped); inserted with ON CONFLICT DO NOTHING.
-- =============================================================================

DO $$
DECLARE
  v_organization_id uuid := NULL;
  v_seed_user       text := 'seed@autopro.local';
  v_seed_tag        text := '[seed:settings-demo-v1]';

  -- Role UUIDs (stable so re-runs don't duplicate)
  v_role_admin      uuid := 'b0000001-0000-0000-0000-000000000001';
  v_role_mechanic   uuid := 'b0000001-0000-0000-0000-000000000002';
  v_role_reception  uuid := 'b0000001-0000-0000-0000-000000000003';
  v_role_manager    uuid := 'b0000001-0000-0000-0000-000000000004';
  v_role_financial  uuid := 'b0000001-0000-0000-0000-000000000005';

  -- Action UUIDs (global, stable)
  v_act             uuid;

  -- Temporary action store: resource|action_type -> uuid
  act_so_view       uuid := 'a0000001-0000-0000-0000-000000000001';
  act_so_create     uuid := 'a0000001-0000-0000-0000-000000000002';
  act_so_update     uuid := 'a0000001-0000-0000-0000-000000000003';
  act_so_delete     uuid := 'a0000001-0000-0000-0000-000000000004';
  act_so_manage     uuid := 'a0000001-0000-0000-0000-000000000005';

  act_cli_view      uuid := 'a0000002-0000-0000-0000-000000000001';
  act_cli_create    uuid := 'a0000002-0000-0000-0000-000000000002';
  act_cli_update    uuid := 'a0000002-0000-0000-0000-000000000003';
  act_cli_delete    uuid := 'a0000002-0000-0000-0000-000000000004';

  act_fin_view      uuid := 'a0000003-0000-0000-0000-000000000001';
  act_fin_create    uuid := 'a0000003-0000-0000-0000-000000000002';
  act_fin_update    uuid := 'a0000003-0000-0000-0000-000000000003';
  act_fin_manage    uuid := 'a0000003-0000-0000-0000-000000000004';

  act_rep_view      uuid := 'a0000004-0000-0000-0000-000000000001';
  act_rep_manage    uuid := 'a0000004-0000-0000-0000-000000000002';

  act_prod_view     uuid := 'a0000005-0000-0000-0000-000000000001';
  act_prod_create   uuid := 'a0000005-0000-0000-0000-000000000002';
  act_prod_update   uuid := 'a0000005-0000-0000-0000-000000000003';
  act_prod_delete   uuid := 'a0000005-0000-0000-0000-000000000004';

  act_app_view      uuid := 'a0000006-0000-0000-0000-000000000001';
  act_app_create    uuid := 'a0000006-0000-0000-0000-000000000002';
  act_app_update    uuid := 'a0000006-0000-0000-0000-000000000003';

  act_emp_view      uuid := 'a0000007-0000-0000-0000-000000000001';
  act_emp_manage    uuid := 'a0000007-0000-0000-0000-000000000002';

  act_set_view      uuid := 'a0000008-0000-0000-0000-000000000001';
  act_set_manage    uuid := 'a0000008-0000-0000-0000-000000000002';

BEGIN
  -- ============================================================
  -- RESOLVE ORGANIZATION
  -- ============================================================
  IF v_organization_id IS NULL THEN
    SELECT id INTO v_organization_id
      FROM public.organizations
     WHERE deleted_at IS NULL
     ORDER BY created_at
     LIMIT 1;
  END IF;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organization encontrada. Crie ou informe um organization_id antes de rodar o seed.';
  END IF;

  RAISE NOTICE 'Usando organization_id = %', v_organization_id;

  -- ============================================================
  -- FASE 1 — LIMPEZA
  -- ============================================================
  DELETE FROM public.role_actions
   WHERE role_id IN (
     v_role_admin, v_role_mechanic, v_role_reception,
     v_role_manager, v_role_financial
   );

  DELETE FROM public.roles
   WHERE organization_id = v_organization_id
     AND description LIKE v_seed_tag || '%';

  DELETE FROM public.employees
   WHERE organization_id = v_organization_id
     AND created_by = v_seed_user;

  -- ============================================================
  -- FASE 2 — COMPANY (organization update with realistic data)
  -- ============================================================
  UPDATE public.organizations SET
    name                = 'AutoPro Mecânica & Estética',
    business_type       = 'automotive_workshop',
    person_type         = 'pj',
    tax_id              = '12.345.678/0001-99',
    state_registration  = '123.456.789.000',
    phone               = '(11) 3456-7890',
    whatsapp            = '(11) 99876-5432',
    email               = 'contato@autopro.com.br',
    website             = 'https://www.autopro.com.br',
    zip_code            = '01310-100',
    street              = 'Avenida Paulista',
    address_number      = '1500',
    address_complement  = 'Sala 12',
    neighborhood        = 'Bela Vista',
    city                = 'São Paulo',
    state               = 'SP',
    municipality_code   = '3550308'
  WHERE id = v_organization_id;

  RAISE NOTICE 'Organization atualizada com dados demo.';

  -- ============================================================
  -- FASE 3 — ACTIONS (global, idempotent via ON CONFLICT)
  -- ============================================================

  -- service_orders
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_so_view,   'service_orders:view',   'Visualizar Ordens de Serviço', 'service_orders', 'view',   'Permite listar e ver detalhes de ordens de serviço'),
    (act_so_create, 'service_orders:create', 'Criar Ordens de Serviço',      'service_orders', 'create', 'Permite abrir novas ordens de serviço'),
    (act_so_update, 'service_orders:update', 'Editar Ordens de Serviço',     'service_orders', 'update', 'Permite alterar dados de ordens existentes'),
    (act_so_delete, 'service_orders:delete', 'Excluir Ordens de Serviço',    'service_orders', 'delete', 'Permite cancelar ou excluir ordens de serviço'),
    (act_so_manage, 'service_orders:manage', 'Gerenciar Ordens de Serviço',  'service_orders', 'manage', 'Acesso completo às ordens de serviço')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  -- clients
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_cli_view,   'clients:view',   'Visualizar Clientes', 'clients', 'view',   'Permite listar e ver perfis de clientes'),
    (act_cli_create, 'clients:create', 'Cadastrar Clientes',  'clients', 'create', 'Permite cadastrar novos clientes'),
    (act_cli_update, 'clients:update', 'Editar Clientes',     'clients', 'update', 'Permite alterar dados de clientes existentes'),
    (act_cli_delete, 'clients:delete', 'Excluir Clientes',    'clients', 'delete', 'Permite remover clientes do sistema')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  -- financial
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_fin_view,   'financial:view',   'Visualizar Financeiro',  'financial', 'view',   'Permite ver receitas, despesas e extratos'),
    (act_fin_create, 'financial:create', 'Registrar Transações',   'financial', 'create', 'Permite lançar novas transações financeiras'),
    (act_fin_update, 'financial:update', 'Editar Transações',      'financial', 'update', 'Permite alterar transações financeiras'),
    (act_fin_manage, 'financial:manage', 'Gerenciar Financeiro',   'financial', 'manage', 'Acesso completo ao módulo financeiro')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  -- reports
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_rep_view,   'reports:view',   'Visualizar Relatórios', 'reports', 'view',   'Permite acessar os relatórios do sistema'),
    (act_rep_manage, 'reports:manage', 'Gerenciar Relatórios',  'reports', 'manage', 'Permite exportar e configurar relatórios')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  -- products
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_prod_view,   'products:view',   'Visualizar Produtos',  'products', 'view',   'Permite listar produtos e estoque'),
    (act_prod_create, 'products:create', 'Cadastrar Produtos',   'products', 'create', 'Permite adicionar novos produtos'),
    (act_prod_update, 'products:update', 'Editar Produtos',      'products', 'update', 'Permite alterar produtos existentes'),
    (act_prod_delete, 'products:delete', 'Excluir Produtos',     'products', 'delete', 'Permite remover produtos do catálogo')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  -- appointments
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_app_view,   'appointments:view',   'Visualizar Agenda',  'appointments', 'view',   'Permite ver a agenda de atendimentos'),
    (act_app_create, 'appointments:create', 'Criar Agendamentos', 'appointments', 'create', 'Permite agendar novos atendimentos'),
    (act_app_update, 'appointments:update', 'Editar Agendamentos','appointments', 'update', 'Permite alterar agendamentos existentes')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  -- employees
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_emp_view,   'employees:view',   'Visualizar Funcionários', 'employees', 'view',   'Permite listar e ver perfis de funcionários'),
    (act_emp_manage, 'employees:manage', 'Gerenciar Funcionários',  'employees', 'manage', 'Permite cadastrar, editar e desligar funcionários')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  -- settings
  INSERT INTO public.actions (id, code, name, resource, action_type, description)
  VALUES
    (act_set_view,   'settings:view',   'Visualizar Configurações', 'settings', 'view',   'Permite acessar as configurações do sistema'),
    (act_set_manage, 'settings:manage', 'Gerenciar Configurações',  'settings', 'manage', 'Permite alterar configurações da empresa e do sistema')
  ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id;

  RAISE NOTICE 'Actions globais inseridas/atualizadas.';

  -- ============================================================
  -- FASE 4 — ROLES (org-scoped)
  -- ============================================================
  INSERT INTO public.roles (id, organization_id, name, display_name, description, is_system_role, created_by)
  VALUES
    (v_role_admin,
     v_organization_id,
     'administrador',
     'Administrador',
     v_seed_tag || ' Acesso completo a todos os módulos do sistema.',
     false,
     v_seed_user),

    (v_role_manager,
     v_organization_id,
     'gerente',
     'Gerente',
     v_seed_tag || ' Acesso aos módulos operacionais e relatórios, sem acesso a configurações sensíveis.',
     false,
     v_seed_user),

    (v_role_mechanic,
     v_organization_id,
     'mecanico',
     'Mecânico',
     v_seed_tag || ' Acesso às ordens de serviço e agenda. Não visualiza financeiro ou relatórios.',
     false,
     v_seed_user),

    (v_role_reception,
     v_organization_id,
     'recepcionista',
     'Recepcionista',
     v_seed_tag || ' Cadastra clientes, abre OS e gerencia agendamentos.',
     false,
     v_seed_user),

    (v_role_financial,
     v_organization_id,
     'financeiro',
     'Financeiro',
     v_seed_tag || ' Acesso completo ao módulo financeiro e relatórios.',
     false,
     v_seed_user)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    display_name    = EXCLUDED.display_name,
    description     = EXCLUDED.description;

  RAISE NOTICE 'Roles inseridas.';

  -- ============================================================
  -- FASE 5 — ROLE_ACTIONS
  -- ============================================================

  -- Administrador: tudo
  INSERT INTO public.role_actions (role_id, action_id, is_granted)
  SELECT v_role_admin, id, true FROM public.actions
  ON CONFLICT (role_id, action_id) DO UPDATE SET is_granted = true;

  -- Gerente: OS + clientes + agenda + produtos + relatórios + funcionários (view)
  INSERT INTO public.role_actions (role_id, action_id, is_granted)
  VALUES
    (v_role_manager, act_so_view,   true),
    (v_role_manager, act_so_create, true),
    (v_role_manager, act_so_update, true),
    (v_role_manager, act_so_manage, true),
    (v_role_manager, act_cli_view,  true),
    (v_role_manager, act_cli_create,true),
    (v_role_manager, act_cli_update,true),
    (v_role_manager, act_app_view,  true),
    (v_role_manager, act_app_create,true),
    (v_role_manager, act_app_update,true),
    (v_role_manager, act_prod_view, true),
    (v_role_manager, act_prod_update,true),
    (v_role_manager, act_rep_view,  true),
    (v_role_manager, act_emp_view,  true),
    (v_role_manager, act_fin_view,  true)
  ON CONFLICT (role_id, action_id) DO UPDATE SET is_granted = true;

  -- Mecânico: OS (view/update) + agenda (view/create/update)
  INSERT INTO public.role_actions (role_id, action_id, is_granted)
  VALUES
    (v_role_mechanic, act_so_view,   true),
    (v_role_mechanic, act_so_update, true),
    (v_role_mechanic, act_app_view,  true),
    (v_role_mechanic, act_app_create,true),
    (v_role_mechanic, act_app_update,true),
    (v_role_mechanic, act_prod_view, true)
  ON CONFLICT (role_id, action_id) DO UPDATE SET is_granted = true;

  -- Recepcionista: OS (view/create) + clientes + agenda
  INSERT INTO public.role_actions (role_id, action_id, is_granted)
  VALUES
    (v_role_reception, act_so_view,   true),
    (v_role_reception, act_so_create, true),
    (v_role_reception, act_so_update, true),
    (v_role_reception, act_cli_view,  true),
    (v_role_reception, act_cli_create,true),
    (v_role_reception, act_cli_update,true),
    (v_role_reception, act_app_view,  true),
    (v_role_reception, act_app_create,true),
    (v_role_reception, act_app_update,true)
  ON CONFLICT (role_id, action_id) DO UPDATE SET is_granted = true;

  -- Financeiro: financeiro completo + relatórios + clientes (view)
  INSERT INTO public.role_actions (role_id, action_id, is_granted)
  VALUES
    (v_role_financial, act_fin_view,   true),
    (v_role_financial, act_fin_create, true),
    (v_role_financial, act_fin_update, true),
    (v_role_financial, act_fin_manage, true),
    (v_role_financial, act_rep_view,   true),
    (v_role_financial, act_rep_manage, true),
    (v_role_financial, act_cli_view,   true),
    (v_role_financial, act_so_view,    true)
  ON CONFLICT (role_id, action_id) DO UPDATE SET is_granted = true;

  RAISE NOTICE 'Role-actions configuradas.';

  -- ============================================================
  -- FASE 6 — EMPLOYEES
  -- ============================================================
  INSERT INTO public.employees (
    organization_id, name, person_type, tax_id, phone, email,
    zip_code, street, address_number, neighborhood, city, state,
    has_salary, salary_amount, payment_day,
    has_commission, commission_type, commission_amount, commission_base,
    has_minimum_guarantee, minimum_guarantee_amount,
    pix_key_type, pix_key,
    created_by
  ) VALUES

  -- 1. Administrador / dono
  (v_organization_id,
   'Carlos Eduardo Mendes', 'pf', '111.222.333-44',
   '(11) 99100-0001', 'carlos@autopro.com.br',
   '01310-100', 'Av. Paulista', '1500', 'Bela Vista', 'São Paulo', 'SP',
   true, 8000.00, 5,
   false, null, null, null,
   false, null,
   'cpf', '11122233344',
   v_seed_user),

  -- 2. Gerente operacional
  (v_organization_id,
   'Fernanda Lima Santos', 'pf', '222.333.444-55',
   '(11) 99100-0002', 'fernanda@autopro.com.br',
   '04040-003', 'Rua das Flores', '200', 'Vila Madalena', 'São Paulo', 'SP',
   true, 5500.00, 10,
   true, 'percentage', 3.00, 'revenue',
   false, null,
   'email', 'fernanda@autopro.com.br',
   v_seed_user),

  -- 3. Mecânico sênior (comissão alta + piso)
  (v_organization_id,
   'Roberto Silva Oliveira', 'pf', '333.444.555-66',
   '(11) 99100-0003', 'roberto.s@autopro.com.br',
   '08220-100', 'Rua Sete de Setembro', '45', 'Penha', 'São Paulo', 'SP',
   true, 3800.00, 5,
   true, 'percentage', 8.00, 'revenue',
   true, 500.00,
   'cpf', '33344455566',
   v_seed_user),

  -- 4. Mecânico pleno
  (v_organization_id,
   'Thiago Ramos Costa', 'pf', '444.555.666-77',
   '(11) 99100-0004', 'thiago.r@autopro.com.br',
   '08420-000', 'Av. Aricanduva', '980', 'Aricanduva', 'São Paulo', 'SP',
   true, 3000.00, 5,
   true, 'percentage', 6.00, 'revenue',
   true, 400.00,
   'phone', '(11) 99100-0004',
   v_seed_user),

  -- 5. Mecânico júnior
  (v_organization_id,
   'Lucas Ferreira Alves', 'pf', '555.666.777-88',
   '(11) 99100-0005', null,
   '04205-050', 'Rua Domingos de Morais', '312', 'Vila Mariana', 'São Paulo', 'SP',
   true, 2200.00, 5,
   true, 'percentage', 4.00, 'revenue',
   false, null,
   'cpf', '55566677788',
   v_seed_user),

  -- 6. Recepcionista / atendente
  (v_organization_id,
   'Amanda Pereira Souza', 'pf', '666.777.888-99',
   '(11) 99100-0006', 'amanda.p@autopro.com.br',
   '05432-010', 'Rua Tucumã', '78', 'Butantã', 'São Paulo', 'SP',
   true, 2800.00, 10,
   false, null, null, null,
   false, null,
   'random_key', 'f1e2d3c4-b5a6-7890-abcd-ef1234567890',
   v_seed_user),

  -- 7. Financeiro (salário fixo)
  (v_organization_id,
   'Juliana Costa Barbosa', 'pf', '777.888.999-00',
   '(11) 99100-0007', 'juliana.fin@autopro.com.br',
   '04018-001', 'Rua Abílio Soares', '190', 'Paraíso', 'São Paulo', 'SP',
   true, 4200.00, 5,
   false, null, null, null,
   false, null,
   'email', 'juliana.fin@autopro.com.br',
   v_seed_user),

  -- 8. Especialista em estética automotiva (PJ — só comissão)
  (v_organization_id,
   'Estética Premium ME', 'pj', '98.765.432/0001-10',
   '(11) 99100-0008', 'estetica@premium.com.br',
   '01330-010', 'Rua Augusta', '2100', 'Consolação', 'São Paulo', 'SP',
   false, null, null,
   true, 'percentage', 30.00, 'revenue',
   false, null,
   'cnpj', '98765432000110',
   v_seed_user),

  -- 9. Eletricista automotivo (comissão fixa por OS + piso)
  (v_organization_id,
   'Marcelo Gomes Teixeira', 'pf', '888.999.000-11',
   '(11) 99100-0009', null,
   '02304-000', 'Rua Voluntários da Pátria', '550', 'Santana', 'São Paulo', 'SP',
   false, null, null,
   true, 'fixed_amount', 120.00, 'revenue',
   true, 300.00,
   'phone', '(11) 99100-0009',
   v_seed_user),

  -- 10. Ex-funcionário (desligado)
  (v_organization_id,
   'Pedro Henrique Nunes', 'pf', '999.000.111-22',
   '(11) 99100-0010', null,
   '03175-000', 'Rua do Oriente', '1200', 'Brás', 'São Paulo', 'SP',
   true, 2500.00, 5,
   false, null, null, null,
   false, null,
   'cpf', '99900011122',
   v_seed_user);

  -- Mark the last employee as terminated
  UPDATE public.employees
     SET termination_date   = current_date - interval '3 months',
         termination_reason = 'Pedido de demissão — mudança de cidade.'
   WHERE organization_id = v_organization_id
     AND tax_id = '999.000.111-22';

  RAISE NOTICE 'Employees inseridos (10 funcionários, 1 desligado).';

  -- ============================================================
  -- FIM
  -- ============================================================
  RAISE NOTICE '=== settings_demo_seed concluído com sucesso ===';
  RAISE NOTICE 'Organization: %', v_organization_id;
  RAISE NOTICE 'Roles criadas: Administrador, Gerente, Mecânico, Recepcionista, Financeiro';
  RAISE NOTICE 'Actions globais: 23 permissões em 8 recursos';
  RAISE NOTICE 'Employees: 9 ativos + 1 desligado';

END $$;
