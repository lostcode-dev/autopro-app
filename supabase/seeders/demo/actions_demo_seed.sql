-- =============================================================================
-- Seed: actions_demo_seed.sql
-- Purpose: Insert the global actions catalog used by roles and permission checks.
--
-- Sources:
-- - supabase/seeders/Action_export.csv
-- - app/constants/action-codes.ts
--
-- Notes:
-- - The exported "id" values are legacy ObjectIds, so this seed upserts by code.
-- - Actions are global and not organization-scoped.
-- - The file keeps the CSV catalog plus only the extra codes that are still
--   referenced by the current app flows.
-- =============================================================================

DO $$
DECLARE
  v_seed_user text := 'seed@autopro.local';
BEGIN
  INSERT INTO public.actions (
    code,
    name,
    resource,
    action_type,
    description,
    created_by,
    updated_by
  )
  VALUES
    ('appointments.create', 'Criar Agendamentos', 'appointments', 'create', 'Criar novos agendamentos', v_seed_user, v_seed_user),
    ('appointments.delete', 'Excluir Agendamentos', 'appointments', 'delete', 'Excluir agendamentos', v_seed_user, v_seed_user),
    ('appointments.read', 'Visualizar Agendamentos', 'appointments', 'read', 'Visualizar lista e detalhes de agendamentos', v_seed_user, v_seed_user),
    ('appointments.update', 'Atualizar Agendamentos', 'appointments', 'update', 'Editar agendamentos', v_seed_user, v_seed_user),
    ('authorizations.approve', 'Aprovar Autorizações', 'authorizations', 'update', 'Aprovar solicitações de autorização', v_seed_user, v_seed_user),
    ('authorizations.create', 'Criar Autorizações', 'authorizations', 'create', 'Criar novas solicitações de autorização', v_seed_user, v_seed_user),
    ('authorizations.delete', 'Excluir Autorizações', 'authorizations', 'delete', 'Excluir solicitações de autorização', v_seed_user, v_seed_user),
    ('authorizations.read', 'Visualizar Autorizações', 'authorizations', 'read', 'Visualizar lista e detalhes de autorizações', v_seed_user, v_seed_user),
    ('authorizations.update', 'Atualizar Autorizações', 'authorizations', 'update', 'Editar solicitações de autorização', v_seed_user, v_seed_user),
    ('bank_accounts.create', 'Criar Contas Bancárias', 'bank_accounts', 'create', 'Criar novas contas bancárias', v_seed_user, v_seed_user),
    ('bank_accounts.delete', 'Excluir Contas Bancárias', 'bank_accounts', 'delete', 'Excluir contas bancárias', v_seed_user, v_seed_user),
    ('bank_accounts.read', 'Visualizar Contas Bancárias', 'bank_accounts', 'read', 'Visualizar lista e detalhes de contas bancárias', v_seed_user, v_seed_user),
    ('bank_accounts.update', 'Atualizar Contas Bancárias', 'bank_accounts', 'update', 'Editar informações de contas bancárias', v_seed_user, v_seed_user),
    ('consultation.use', 'Usar Consultoria IA', 'consultation', 'create', 'Usar recursos de consultoria de IA', v_seed_user, v_seed_user),
    ('consultation.view', 'Visualizar Consultorias', 'consultation', 'read', 'Visualizar histórico de consultorias', v_seed_user, v_seed_user),
    ('customers.create', 'Criar Clientes', 'customers', 'create', 'Criar novos clientes', v_seed_user, v_seed_user),
    ('customers.delete', 'Excluir Clientes', 'customers', 'delete', 'Excluir clientes', v_seed_user, v_seed_user),
    ('customers.read', 'Visualizar Clientes', 'customers', 'read', 'Visualizar lista e detalhes de clientes', v_seed_user, v_seed_user),
    ('customers.update', 'Atualizar Clientes', 'customers', 'update', 'Editar informações de clientes', v_seed_user, v_seed_user),
    ('employees.create', 'Criar Funcionários', 'employees', 'create', 'Criar novos registros de funcionários', v_seed_user, v_seed_user),
    ('employees.delete', 'Excluir Funcionários', 'employees', 'delete', 'Excluir registros de funcionários', v_seed_user, v_seed_user),
    ('employees.read', 'Visualizar Funcionários', 'employees', 'read', 'Visualizar lista e detalhes de funcionários', v_seed_user, v_seed_user),
    ('employees.update', 'Atualizar Funcionários', 'employees', 'update', 'Editar informações de funcionários', v_seed_user, v_seed_user),
    ('financial.create', 'Criar Registros Financeiros', 'financial', 'create', 'Criar novos registros financeiros', v_seed_user, v_seed_user),
    ('financial.delete', 'Excluir Registros Financeiros', 'financial', 'delete', 'Excluir registros financeiros', v_seed_user, v_seed_user),
    ('financial.read', 'Visualizar Financeiro', 'financial', 'read', 'Visualizar registros e relatórios financeiros', v_seed_user, v_seed_user),
    ('financial.update', 'Atualizar Registros Financeiros', 'financial', 'update', 'Editar registros financeiros', v_seed_user, v_seed_user),
    ('fiscal.manage', 'Gerenciamento Fiscal', 'settings', 'manage', 'Possível alterar os dados da empresa', v_seed_user, v_seed_user),
    ('inventory.adjust', 'Ajustar Estoque', 'inventory', 'update', 'Ajustar quantidades de estoque', v_seed_user, v_seed_user),
    ('inventory.create', 'Criar Itens de Estoque', 'inventory', 'create', 'Criar novos itens de estoque', v_seed_user, v_seed_user),
    ('inventory.delete', 'Excluir Itens de Estoque', 'inventory', 'delete', 'Excluir itens de estoque', v_seed_user, v_seed_user),
    ('inventory.read', 'Visualizar Estoque', 'inventory', 'read', 'Visualizar lista de estoque e níveis de inventário', v_seed_user, v_seed_user),
    ('inventory.update', 'Atualizar Estoque', 'inventory', 'update', 'Editar itens de estoque e quantidades', v_seed_user, v_seed_user),
    ('members.invite', 'Convidar Membros', 'members', 'create', 'Convidar novos membros para a organização', v_seed_user, v_seed_user),
    ('members.remove', 'Remover Membros', 'members', 'delete', 'Remover membros da organização', v_seed_user, v_seed_user),
    ('members.update', 'Atualizar Membros', 'members', 'update', 'Editar informações de membros', v_seed_user, v_seed_user),
    ('members.view', 'Visualizar Membros', 'members', 'read', 'Visualizar membros da organização', v_seed_user, v_seed_user),
    ('orders.cancel', 'Cancelar Ordens de Serviço', 'orders', 'update', 'Cancelar ordens de serviço', v_seed_user, v_seed_user),
    ('orders.correct', 'Corrigir Ordem de Serviço', 'orders', 'update', 'Receber Solicitações e Corrigir Ordem de Serviço', v_seed_user, v_seed_user),
    ('orders.create', 'Criar Ordens de Serviço', 'orders', 'create', 'Criar novas ordens de serviço', v_seed_user, v_seed_user),
    ('orders.delete', 'Excluir Ordens de Serviço', 'orders', 'delete', 'Excluir ordens de serviço', v_seed_user, v_seed_user),
    ('orders.finish', 'Finalizar Ordens de Serviço', 'orders', 'update', 'Marcar ordens de serviço como finalizadas', v_seed_user, v_seed_user),
    ('orders.read', 'Visualizar Ordens de Serviço', 'orders', 'read', 'Visualizar lista e detalhes de ordens de serviço', v_seed_user, v_seed_user),
    ('orders.update', 'Atualizar Ordens de Serviço', 'orders', 'update', 'Editar ordens de serviço', v_seed_user, v_seed_user),
    ('organization.update', 'Update Organization', 'organization', 'update', 'Edit organization information', v_seed_user, v_seed_user),
    ('organization.view', 'Visualizar Organização', 'organization', 'read', 'Visualizar detalhes da organização', v_seed_user, v_seed_user),
    ('payment_machines.update', 'Atualizar Maquininhas', 'payment_machines', 'update', 'Editar configurações de maquininhas', v_seed_user, v_seed_user),
    ('payment_machines.view', 'Visualizar Maquininhas', 'payment_machines', 'read', 'Visualizar configurações de maquininhas', v_seed_user, v_seed_user),
    ('products.create', 'Criar Produtos', 'products', 'create', 'Criar novos produtos', v_seed_user, v_seed_user),
    ('products.delete', 'Excluir Produtos', 'products', 'delete', 'Excluir produtos', v_seed_user, v_seed_user),
    ('products.read', 'Visualizar Produtos', 'products', 'read', 'Visualizar lista e detalhes de produtos', v_seed_user, v_seed_user),
    ('products.update', 'Atualizar Produtos', 'products', 'update', 'Editar informações de produtos', v_seed_user, v_seed_user),
    ('purchases.authorize', 'Autorizar Compras', 'purchases', 'update', 'Autorizar solicitações de compra', v_seed_user, v_seed_user),
    ('purchases.create', 'Criar Compras', 'purchases', 'create', 'Criar novas ordens de compra', v_seed_user, v_seed_user),
    ('purchases.delete', 'Excluir Compras', 'purchases', 'delete', 'Excluir ordens de compra', v_seed_user, v_seed_user),
    ('purchases.read', 'Visualizar Compras', 'purchases', 'read', 'Visualizar lista e detalhes de compras', v_seed_user, v_seed_user),
    ('purchases.update', 'Atualizar Compras', 'purchases', 'update', 'Editar ordens de compra', v_seed_user, v_seed_user),
    ('reports.commissions', 'Visualizar Relatórios de Comissões', 'reports', 'read', 'Visualizar relatórios de comissões', v_seed_user, v_seed_user),
    ('reports.costs', 'Visualizar Relatórios de Custos', 'reports', 'read', 'Visualizar relatórios de custos', v_seed_user, v_seed_user),
    ('reports.customers', 'Visualizar Relatórios de Clientes', 'reports', 'read', 'Visualizar relatórios relacionados a clientes', v_seed_user, v_seed_user),
    ('reports.debtors', 'Visualizar Relatórios de Devedores', 'reports', 'read', 'Visualizar relatórios de devedores', v_seed_user, v_seed_user),
    ('reports.financial', 'Visualizar Relatórios Financeiros', 'reports', 'read', 'Visualizar relatórios financeiros', v_seed_user, v_seed_user),
    ('reports.profit', 'Visualizar Relatórios de Lucro', 'reports', 'read', 'Visualizar relatórios de lucro', v_seed_user, v_seed_user),
    ('reports.purchases', 'Visualizar Relatórios de Compras', 'reports', 'read', 'Visualizar relatórios de compras', v_seed_user, v_seed_user),
    ('reports.sales', 'Visualizar Relatórios de Vendas', 'reports', 'read', 'Visualizar relatórios de vendas', v_seed_user, v_seed_user),
    ('reports.suppliers', 'Visualizar Relatórios de Fornecedores', 'reports', 'read', 'Visualizar relatórios de fornecedores', v_seed_user, v_seed_user),
    ('reports.view', 'Visualizar Relatórios', 'reports', 'read', 'Visualizar todos os relatórios', v_seed_user, v_seed_user),
    ('returns.create', 'Criar Devoluções', 'returns', 'create', 'Criar novos registros de devolução', v_seed_user, v_seed_user),
    ('returns.delete', 'Excluir Devoluções', 'returns', 'delete', 'Excluir registros de devolução', v_seed_user, v_seed_user),
    ('returns.read', 'Visualizar Devoluções', 'returns', 'read', 'Visualizar lista e detalhes de devoluções', v_seed_user, v_seed_user),
    ('returns.update', 'Atualizar Devoluções', 'returns', 'update', 'Editar registros de devolução', v_seed_user, v_seed_user),
    ('roles.create', 'Criar Papéis', 'roles', 'create', 'Criar novos papéis', v_seed_user, v_seed_user),
    ('roles.delete', 'Excluir Papéis', 'roles', 'delete', 'Excluir papéis', v_seed_user, v_seed_user),
    ('roles.manage_permissions', 'Gerenciar Permissões de Papéis', 'roles', 'manage', 'Permite configurar permissões dos papéis da organização', v_seed_user, v_seed_user),
    ('roles.update', 'Atualizar Papéis', 'roles', 'update', 'Editar papéis e permissões', v_seed_user, v_seed_user),
    ('roles.view', 'View Roles', 'roles', 'read', 'View roles and permissions', v_seed_user, v_seed_user),
    ('service_invoice.read', 'Visualizar Notas de Serviço', 'service_invoice', 'read', 'Visualizar lista e detalhes de notas fiscais de serviço', v_seed_user, v_seed_user),
    ('settings.update', 'Atualizar Configurações', 'settings', 'update', 'Modificar configurações do sistema', v_seed_user, v_seed_user),
    ('settings.view', 'Visualizar Configurações', 'settings', 'read', 'Visualizar configurações do sistema', v_seed_user, v_seed_user),
    ('subscription.view', 'Visualizar Assinatura', 'subscription', 'read', 'Visualizar detalhes da assinatura', v_seed_user, v_seed_user),
    ('suppliers.create', 'Criar Fornecedores', 'suppliers', 'create', 'Criar novos fornecedores', v_seed_user, v_seed_user),
    ('suppliers.delete', 'Excluir Fornecedores', 'suppliers', 'delete', 'Excluir fornecedores', v_seed_user, v_seed_user),
    ('suppliers.read', 'Visualizar Fornecedores', 'suppliers', 'read', 'Visualizar lista e detalhes de fornecedores', v_seed_user, v_seed_user),
    ('suppliers.update', 'Atualizar Fornecedores', 'suppliers', 'update', 'Editar informações de fornecedores', v_seed_user, v_seed_user),
    ('taxes.update', 'Update Taxes', 'taxes', 'update', 'Edit tax settings', v_seed_user, v_seed_user),
    ('taxes.view', 'View Taxes', 'taxes', 'read', 'View tax settings and information', v_seed_user, v_seed_user),
    ('vehicles.create', 'Criar Veículos', 'vehicles', 'create', 'Criar novos veículos', v_seed_user, v_seed_user),
    ('vehicles.delete', 'Excluir Veículos', 'vehicles', 'delete', 'Excluir veículos', v_seed_user, v_seed_user),
    ('vehicles.read', 'Visualizar Veículos', 'vehicles', 'read', 'Visualizar lista e detalhes de veículos', v_seed_user, v_seed_user),
    ('vehicles.update', 'Atualizar Veículos', 'vehicles', 'update', 'Editar informações de veículos', v_seed_user, v_seed_user)
  ON CONFLICT (code) DO UPDATE
  SET
    name = EXCLUDED.name,
    resource = EXCLUDED.resource,
    action_type = EXCLUDED.action_type,
    description = EXCLUDED.description,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL;

  RAISE NOTICE 'Actions catalog seeded successfully.';
END $$;
