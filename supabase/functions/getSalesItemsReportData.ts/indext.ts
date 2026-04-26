// @ts-nocheck
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

async function getOrganizationId(base44: any, currentUser: any) {
  if (currentUser?.organization_id) {
    return currentUser.organization_id;
  }

  const users = await base44.asServiceRole.entities.User.filter({
    email: currentUser.email,
  });

  if (!users || users.length === 0) {
    return null;
  }

  return users[0].organization_id;
}

function parseDateStart(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function parsePayload(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return {};
    }
    return await req.json();
  } catch {
    return {};
  }
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value
      .map((item) => String(item || '').trim())
      .filter((item) => item && item !== 'todos' && item !== 'null' && item !== 'undefined')));
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized || normalized === 'todos' || normalized === '[]' || normalized === '[ ]' || normalized === 'null' || normalized === 'undefined') {
      return [];
    }

    if (normalized.startsWith('[') && normalized.endsWith(']')) {
      try {
        const parsed = JSON.parse(normalized);
        return parseStringList(parsed);
      } catch {
        return [];
      }
    }

    if (normalized.includes(',')) {
      return Array.from(new Set(normalized
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item && item !== 'todos' && item !== 'null' && item !== 'undefined')));
    }

    return [normalized].filter((item) => item !== 'todos' && item !== 'null' && item !== 'undefined');
  }

  return [];
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    aberta: 'Aberta',
    andamento: 'Em andamento',
    em_andamento: 'Em andamento',
    orcamento: 'Orçamento',
    aguardando_aprovacao: 'Aguardando aprovação',
    aguardando_peca: 'Aguardando peça',
    concluida: 'Concluída',
    entregue: 'Entregue',
    cancelada: 'Cancelada',
  };

  if (map[status]) {
    return map[status];
  }

  if (!status) {
    return 'Não informado';
  }

  return String(status)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getResponsaveis(ordem: any, funcionariosMap: Map<string, any>) {
  if (Array.isArray(ordem?.responsaveis) && ordem.responsaveis.length > 0) {
    const responsaveis = ordem.responsaveis
      .map((item: any) => {
        const funcionario = funcionariosMap.get(String(item?.funcionario_id || ''));
        return {
          id: funcionario?.id || String(item?.funcionario_id || ''),
          nome: funcionario?.nome || 'Responsável não encontrado',
        };
      })
      .filter((item: any) => item.id);

    if (responsaveis.length > 0) {
      return responsaveis;
    }
  }

  if (ordem?.funcionario_responsavel_id) {
    const funcionario = funcionariosMap.get(String(ordem.funcionario_responsavel_id));
    return [
      {
        id: funcionario?.id || String(ordem.funcionario_responsavel_id),
        nome: funcionario?.nome || 'Responsável não encontrado',
      },
    ];
  }

  return [];
}

function getItemResponsaveisFromComissoes(item: any, funcionariosMap: Map<string, any>) {
  const comissoes = Array.isArray(item?.comissoes) ? item.comissoes : [];
  const unique = new Map<string, { id: string; nome: string }>();

  for (const comissao of comissoes) {
    const funcionarioId = normalizeId(comissao?.funcionario_id);
    if (!funcionarioId || unique.has(funcionarioId)) {
      continue;
    }

    const funcionario = funcionariosMap.get(funcionarioId);
    unique.set(funcionarioId, {
      id: funcionario?.id || funcionarioId,
      nome: funcionario?.nome || 'Responsável não encontrado',
    });
  }

  return Array.from(unique.values());
}

function normalizeId(value: unknown) {
  const id = String(value ?? '').trim();
  return id.length > 0 ? id : null;
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFuncionarioCommissionConfig(funcionario: any) {
  const categorias = Array.isArray(funcionario?.categorias_comissao)
    ? funcionario.categorias_comissao.map((item: any) => String(item)).filter(Boolean)
    : [];

  return {
    temComissao: Boolean(funcionario?.tem_comissao),
    tipo: String(funcionario?.tipo_comissao || ''),
    base: String(funcionario?.base_comissao || ''),
    valor: normalizeNumber(funcionario?.valor_comissao),
    categorias,
  };
}

function roundMoney(value: unknown) {
  const numberValue = normalizeNumber(value);
  return Number.parseFloat(numberValue.toFixed(2));
}

function buildCommissionTotalsByOrderEmployeeMap(registros: any[]) {
  const totals = new Map<string, number>();

  for (const registro of registros || []) {
    const ordemId = normalizeId(registro?.ordem_servico_id);
    const funcionarioId = normalizeId(registro?.funcionario_id);

    if (!ordemId || !funcionarioId) {
      continue;
    }

    const key = `${ordemId}::${funcionarioId}`;
    const currentValue = normalizeNumber(totals.get(key));
    totals.set(key, roundMoney(currentValue + normalizeNumber(registro?.valor)));
  }

  return totals;
}

function buildOrdersWithPersistedCommissionSet(registros: any[]) {
  const orderIds = new Set<string>();

  for (const registro of registros || []) {
    const ordemId = normalizeId(registro?.ordem_servico_id);
    const valor = normalizeNumber(registro?.valor);

    if (!ordemId || valor <= 0) {
      continue;
    }

    orderIds.add(ordemId);
  }

  return orderIds;
}

function buildOrderRows(rows: any[]) {
  const grouped = new Map<string, any>();

  for (const row of rows || []) {
    const groupKey = String(row?.ordemId || row?.ordemNumero || row?.id || 'sem-os');
    const current = grouped.get(groupKey);

    if (!current) {
      grouped.set(groupKey, {
        id: `os-${groupKey}`,
        clienteId: row?.clienteId || '',
        cliente: row?.cliente || 'Cliente não encontrado',
        ordemId: row?.ordemId || '',
        ordemNumero: row?.ordemNumero || '-',
        responsavelIds: new Set<string>(Array.isArray(row?.responsavelIds) ? row.responsavelIds.map((item: any) => String(item)) : []),
        responsavelNames: new Set<string>(
          String(row?.responsavel || '')
            .split(',')
            .map((item) => String(item).trim())
            .filter(Boolean),
        ),
        custoTotal: normalizeNumber(row?.custoTotal),
        custoComissao: normalizeNumber(row?.custoComissao),
        custoComComissao: normalizeNumber(row?.custoComComissao),
        valorTotal: normalizeNumber(row?.valorTotal),
        itemCount: 1,
        status: row?.status || '',
        statusLabel: row?.statusLabel || getStatusLabel(String(row?.status || '')),
        data: row?.data || '',
      });
      continue;
    }

    current.custoTotal = roundMoney(current.custoTotal + normalizeNumber(row?.custoTotal));
    current.custoComissao = roundMoney(current.custoComissao + normalizeNumber(row?.custoComissao));
    current.custoComComissao = roundMoney(current.custoComComissao + normalizeNumber(row?.custoComComissao));
    current.valorTotal = roundMoney(current.valorTotal + normalizeNumber(row?.valorTotal));
    current.itemCount += 1;

    for (const responsavelId of Array.isArray(row?.responsavelIds) ? row.responsavelIds : []) {
      current.responsavelIds.add(String(responsavelId));
    }

    for (const responsavelNome of String(row?.responsavel || '').split(',')) {
      const normalizedName = String(responsavelNome).trim();
      if (normalizedName) {
        current.responsavelNames.add(normalizedName);
      }
    }
  }

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    responsavelIds: Array.from(row.responsavelIds),
    responsavel: Array.from(row.responsavelNames).join(', ') || 'Sem responsável',
  }));
}

/**
 * Calculates commission per item for a single employee using direct per-item
 * calculation instead of distributing an order-level total by weight.
 *
 * For percentage commissions: computes each item's commission base (revenue or
 * profit) with proportional order-level discount/taxes and applies the rate.
 * For fixed commissions: distributes the fixed value evenly across eligible items.
 *
 * This avoids rounding drift that occurs when redistributing a pre-rounded
 * order-level total.
 */
function computeEmployeeItemCommissions({
  funcionario,
  ordem,
  items,
}: {
  funcionario: any;
  ordem: any;
  items: Array<{ key: string; categoriaId: string; valorTotal: number; custoTotal: number }>;
}): Map<string, number> {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(item.key, 0));

  const config = getFuncionarioCommissionConfig(funcionario);
  if (!config.temComissao || items.length === 0) {
    return result;
  }

  const hasCategoryFilter = config.categorias.length > 0;
  const eligibleItems = hasCategoryFilter
    ? items.filter((item) => config.categorias.includes(String(item.categoriaId)))
    : items;

  if (eligibleItems.length === 0) {
    return result;
  }

  // Order-level adjustments
  const orderDiscount = normalizeNumber(ordem?.desconto);
  const orderTaxes = normalizeNumber(ordem?.valor_impostos_total);

  // Calculate sale totals for proportional discount/tax distribution
  const allItemsSale = items.reduce((acc, item) => acc + normalizeNumber(item.valorTotal), 0);
  const eligibleSale = eligibleItems.reduce((acc, item) => acc + normalizeNumber(item.valorTotal), 0);

  // Proportional discount/tax for eligible items' share of total
  const eligibleRatio = allItemsSale > 0 ? eligibleSale / allItemsSale : 0;
  const eligibleDiscount = orderDiscount * eligibleRatio;
  const eligibleTax = orderTaxes * eligibleRatio;

  if (config.tipo === 'percentual') {
    for (const item of eligibleItems) {
      const sale = normalizeNumber(item.valorTotal);
      const cost = normalizeNumber(item.custoTotal);

      // Item's proportional share of discount/tax within eligible items
      const fraction = eligibleSale > 0 ? sale / eligibleSale : 1 / eligibleItems.length;
      const itemDiscount = eligibleDiscount * fraction;
      const itemTax = eligibleTax * fraction;

      let base = sale - itemDiscount;
      if (config.base === 'lucro') {
        base = Math.max(0, base - (cost + itemTax));
      }

      const value = roundMoney((base * config.valor) / 100);
      if (value > 0) {
        result.set(item.key, value);
      }
    }
  } else {
    // Fixed commission: distribute evenly among eligible items
    const perItem = roundMoney(config.valor / eligibleItems.length);
    const totalDistributed = roundMoney(perItem * eligibleItems.length);
    const diff = roundMoney(config.valor - totalDistributed);

    eligibleItems.forEach((item, idx) => {
      const val = idx === 0 ? roundMoney(perItem + diff) : perItem;
      if (val > 0) {
        result.set(item.key, val);
      }
    });
  }

  return result;
}

/**
 * Builds a commission-per-item map for one service order.
 *
 * Only employees that have persisted commission records
 * (RegistroFinanceiroFuncionario) are considered. The per-item values are
 * calculated directly from the employee's commission config applied to each
 * item individually — not by distributing an order-level total.
 */
function computeOrderItemCommissionMap({
  ordem,
  responsaveis,
  responsavelIdsSet,
  funcionariosMap,
  commissionTotalsByOrderEmployee,
  normalizedItems,
}: {
  ordem: any;
  responsaveis: Array<{ id: string }>;
  responsavelIdsSet: Set<string>;
  funcionariosMap: Map<string, any>;
  commissionTotalsByOrderEmployee: Map<string, number>;
  normalizedItems: Array<{
    key: string;
    categoriaId: string;
    valorTotal: number;
    custoTotal: number;
  }>;
}) {
  const commissionByItemKey = new Map<string, number>();
  normalizedItems.forEach((item) => commissionByItemKey.set(item.key, 0));

  const activeResponsavelIds =
    responsavelIdsSet.size > 0
      ? responsaveis.map((r) => String(r.id)).filter((id) => responsavelIdsSet.has(id))
      : responsaveis.map((r) => String(r.id));

  if (activeResponsavelIds.length === 0 || normalizedItems.length === 0) {
    return commissionByItemKey;
  }

  for (const funcionarioId of activeResponsavelIds) {
    const funcionario = funcionariosMap.get(String(funcionarioId));
    const employeeKey = `${normalizeId(ordem?.id) || 'ordem'}::${String(funcionarioId)}`;

    // Only process employees with persisted commission records
    const persistedTotal = commissionTotalsByOrderEmployee.has(employeeKey)
      ? roundMoney(commissionTotalsByOrderEmployee.get(employeeKey))
      : 0;

    if (persistedTotal <= 0) {
      continue;
    }

    const employeeCommissions = computeEmployeeItemCommissions({
      funcionario,
      ordem,
      items: normalizedItems,
    });

    employeeCommissions.forEach((value, key) => {
      if (value > 0) {
        commissionByItemKey.set(key, roundMoney(normalizeNumber(commissionByItemKey.get(key)) + value));
      }
    });
  }

  return commissionByItemKey;
}

Deno.serve(async (req) => {
  try {
    const payload = await parsePayload(req);
    const dateFrom = parseDateStart(payload?.dateFrom);
    const dateTo = parseDateEnd(payload?.dateTo);
    const clienteIds = parseStringList(payload?.clienteIds);
    const ordemIds = parseStringList(payload?.ordemIds);
    const responsavelIds = parseStringList(payload?.responsavelIds);
    const statusFilters = parseStringList(payload?.statusFilters);
    const paymentStatusFilters = parseStringList(payload?.paymentStatusFilters);
    const paymentStatusFiltersSet = new Set(paymentStatusFilters);
    const categoriaIds = parseStringList(payload?.categoriaIds);

    const costFilterValues = parseStringList(payload?.costFilter);
    const costSourceValues = parseStringList(payload?.costSource);
    const formasPagamento = parseStringList(payload?.formasPagamento);
    const formasPagamentoSet = new Set(formasPagamento);

    const costFilterSet = new Set(
      costFilterValues.filter((value) => value === 'withCost' || value === 'zeroCost'),
    );

    const costSourceSet = new Set(
      costSourceValues.filter((value) => value === 'item' || value === 'product' || value === 'none'),
    );

    if (responsavelIds.length === 0) {
      const legacyResponsavelIds = parseStringList(payload?.responsavelId);
      responsavelIds.push(...legacyResponsavelIds);
    }

    if (statusFilters.length === 0) {
      const legacyStatusFilters = parseStringList(payload?.status);
      statusFilters.push(...legacyStatusFilters);
    }

    if (categoriaIds.length === 0) {
      const legacyCategoriaIds = parseStringList(payload?.categoriaId);
      categoriaIds.push(...legacyCategoriaIds);
    }

    if (clienteIds.length === 0) {
      const legacyClienteIds = parseStringList(payload?.clienteId);
      clienteIds.push(...legacyClienteIds);
    }

    if (ordemIds.length === 0) {
      const legacyOrdemIds = parseStringList(payload?.ordemId);
      ordemIds.push(...legacyOrdemIds);
    }

    const clienteIdsSet = new Set(clienteIds);
    const ordemIdsSet = new Set(ordemIds);
    const responsavelIdsSet = new Set(responsavelIds);
    const statusFiltersSet = new Set(statusFilters);
    const categoriaIdsSet = new Set(categoriaIds);
    const viewMode = payload?.viewMode === 'os' ? 'os' : 'item';
    const sortBy = ['cliente', 'ordemNumero', 'itemDescricao', 'valorTotal', 'custoTotal', 'custoComissao', 'responsavel', 'status', 'data', 'itemCount'].includes(payload?.sortBy)
      ? payload.sortBy
      : 'data';
    const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)));
    const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 20))));

    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const organizationId = await getOrganizationId(base44, currentUser);
    if (!organizationId) {
      return Response.json({ error: 'Usuário não vinculado a uma organização' }, { status: 400 });
    }

    const filter = { organization_id: organizationId };

    const [ordens, clientes, funcionarios, produtos, categorias, registrosComissao] = await Promise.all([
      base44.asServiceRole.entities.OrdemServico.filter(filter, '-data_entrada'),
      base44.asServiceRole.entities.Cliente.filter(filter),
      base44.asServiceRole.entities.Funcionario.filter(filter),
      base44.asServiceRole.entities.Produto.filter(filter),
      base44.asServiceRole.entities.CategoriaProduto.filter(filter),
      base44.asServiceRole.entities.RegistroFinanceiroFuncionario.filter(
        { ...filter, tipo_registro: 'comissao' },
        '-data_referencia',
      ),
    ]);

    const clientesMap = new Map<string, any>((clientes || []).map((cliente: any) => [String(cliente.id), cliente]));
    const funcionariosMap = new Map<string, any>((funcionarios || []).map((funcionario: any) => [String(funcionario.id), funcionario]));
    const produtosMap = new Map<string, any>((produtos || []).map((produto: any) => [String(produto.id), produto]));
    const categoriasMap = new Map<string, any>((categorias || []).map((categoria: any) => [String(categoria.id), categoria]));

    const persistedCommissionRecords = Array.isArray(registrosComissao)
      ? registrosComissao.filter((registro: any) => normalizeNumber(registro?.valor) > 0)
      : [];
    const commissionTotalsByOrderEmployee = buildCommissionTotalsByOrderEmployeeMap(persistedCommissionRecords);
    const ordersWithPersistedCommission = buildOrdersWithPersistedCommissionSet(persistedCommissionRecords);

    const availableResponsaveis = (funcionarios || [])
      .filter((funcionario: any) => !funcionario?.deleted_at)
      .map((funcionario: any) => ({
        id: String(funcionario.id),
        nome: String(funcionario.nome || 'Responsável sem nome'),
      }))
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    const statusSet = new Set<string>();
    const categorySet = new Map<string, string>();
    const clientSet = new Map<string, string>();
    const orderSet = new Map<string, string>();

    const rows: any[] = [];

    for (const ordem of ordens || []) {
      const dataOS = ordem?.data_entrada ? new Date(`${ordem.data_entrada}T00:00:00`) : null;
      if (!dataOS || Number.isNaN(dataOS.getTime())) {
        continue;
      }

      if (dateFrom && dataOS < dateFrom) {
        continue;
      }

      if (dateTo && dataOS > dateTo) {
        continue;
      }

      const status = String(ordem?.status || '');
      statusSet.add(status);
      if (statusFiltersSet.size > 0 && !statusFiltersSet.has(status)) {
        continue;
      }

      // Filter by status_pagamento da OS
      if (paymentStatusFiltersSet.size > 0) {
        const statusPgto = String(ordem?.status_pagamento || '');
        if (!paymentStatusFiltersSet.has(statusPgto)) {
          continue;
        }
      }

      // Filter by forma_pagamento da OS
      if (formasPagamentoSet.size > 0) {
        const formaPgto = String(ordem?.forma_pagamento || '');
        const key = formaPgto || 'sem_forma_pagamento';
        if (!formasPagamentoSet.has(key)) {
          continue;
        }
      }

      const responsaveis = getResponsaveis(ordem, funcionariosMap);
      const itens = Array.isArray(ordem?.itens) ? ordem.itens : [];
      const storedItemResponsavelIds = new Set(
        itens.flatMap((item: any) =>
          getItemResponsaveisFromComissoes(item, funcionariosMap).map((resp: any) => String(resp.id)),
        ),
      );
      const orderResponsavelIds = responsaveis.map((resp: any) => String(resp.id));
      const effectiveOrderResponsavelIds = storedItemResponsavelIds.size > 0
        ? Array.from(storedItemResponsavelIds)
        : orderResponsavelIds;

      if (responsavelIdsSet.size > 0) {
        const containsResponsavel = effectiveOrderResponsavelIds.some((id: string) => responsavelIdsSet.has(id));
        if (!containsResponsavel) {
          continue;
        }
      }

      const clienteNome = String(
        clientesMap.get(String(ordem?.cliente_id || ''))?.nome ||
        ordem?.cliente_nome ||
        'Cliente não encontrado',
      );
      const clienteFilterValue = normalizeId(ordem?.cliente_id) || `nome:${clienteNome.toLowerCase()}`;
      const ordemNumero = String(ordem?.numero || '-');
      const ordemFilterValue = normalizeId(ordem?.id) || `numero:${ordemNumero}`;

      clientSet.set(clienteFilterValue, clienteNome);
      orderSet.set(ordemFilterValue, ordemNumero);

      if (clienteIdsSet.size > 0 && !clienteIdsSet.has(clienteFilterValue)) {
        continue;
      }

      if (ordemIdsSet.size > 0 && !ordemIdsSet.has(ordemFilterValue)) {
        continue;
      }

      const normalizedItems = itens.map((item: any, index: number) => {
        const produto = item?.produto_id ? produtosMap.get(String(item.produto_id)) : null;
        const itemCategoriaId = produto?.categoria_id ? String(produto.categoria_id) : 'sem_categoria';

        const quantidade = toNumber(item?.quantidade, 0);
        const valorUnitario = toNumber(item?.valor_unitario, 0);
        const valorTotal = toNumber(item?.valor_total, quantidade * valorUnitario);

        const hasItemCostValue = item?.valor_custo != null && String(item.valor_custo) !== '';
        const hasProductCostValue = produto?.preco_custo_unitario != null && String(produto.preco_custo_unitario) !== '';

        const resolvedCostSource = hasItemCostValue
          ? 'item'
          : hasProductCostValue
            ? 'product'
            : 'none';

        const custoUnitario = hasItemCostValue
          ? toNumber(item?.valor_custo, 0)
          : toNumber(produto?.preco_custo_unitario, 0);
        const custoTotal = quantidade * custoUnitario;

        // IMPORTANT: commission rules in Service Order use `item.valor_custo` (no product fallback).
        const custoTotalComissaoBase = quantidade * toNumber(item?.valor_custo, 0);

        const key = `${ordem?.id || 'ordem'}-${index}`;

        return {
          key,
          index,
          rawItem: item,
          produto,
          categoriaId: itemCategoriaId,
          custoFonte: resolvedCostSource,
          custoUnitario,
          custoTotal,
          custoTotalComissaoBase,
          valorTotal,
        };
      });

      const orderId = normalizeId(ordem?.id);
      const hasPersistedCommissionRecords = orderId
        ? ordersWithPersistedCommission.has(orderId)
        : false;

      // Prefer stored per-item commission data if available; fall back to calculation otherwise.
      // Orders without persisted commission records must show zero commission in the report.
      const hasStoredCommissions = normalizedItems.length > 0 &&
        normalizedItems.every((item) => item.rawItem?.comissao_total != null && Array.isArray(item.rawItem?.comissoes));

      let commissionByItemKey: Map<string, number>;

      if (!hasPersistedCommissionRecords) {
        commissionByItemKey = new Map<string, number>();
        for (const item of normalizedItems) {
          commissionByItemKey.set(item.key, 0);
        }
      } else if (hasStoredCommissions) {
        commissionByItemKey = new Map<string, number>();
        for (const item of normalizedItems) {
          const comissoes: any[] = item.rawItem.comissoes || [];
          let total = 0;
          if (responsavelIdsSet.size > 0) {
            // Sum only commissions from filtered employees directly from the item breakdown
            for (const c of comissoes) {
              if (responsavelIdsSet.has(String(c.funcionario_id))) {
                total += normalizeNumber(c.valor);
              }
            }
          } else {
            total = normalizeNumber(item.rawItem.comissao_total);
          }
          commissionByItemKey.set(item.key, roundMoney(total));
        }
      } else {
        commissionByItemKey = computeOrderItemCommissionMap({
          ordem,
          responsaveis,
          responsavelIdsSet,
          funcionariosMap,
          commissionTotalsByOrderEmployee,
          normalizedItems: normalizedItems.map((item) => ({
            key: item.key,
            categoriaId: item.categoriaId,
            valorTotal: item.valorTotal,
            custoTotal: item.custoTotalComissaoBase,
          })),
        });
      }

      for (const item of normalizedItems) {
        const itemResponsaveisFromComissoes = getItemResponsaveisFromComissoes(
          item.rawItem,
          funcionariosMap,
        );
        const itemResponsaveis = itemResponsaveisFromComissoes.length > 0
          ? itemResponsaveisFromComissoes
          : responsaveis;

        if (responsavelIdsSet.size > 0) {
          const itemMatchesResponsavelFilter = itemResponsaveis.some((resp: any) =>
            responsavelIdsSet.has(String(resp.id)),
          );

          if (!itemMatchesResponsavelFilter) {
            continue;
          }
        }

        const itemCategoriaNome = item?.produto?.categoria_id
          ? String(categoriasMap.get(String(item.produto.categoria_id))?.nome || 'Sem categoria')
          : 'Sem categoria';

        categorySet.set(item.categoriaId, itemCategoriaNome);

        if (categoriaIdsSet.size > 0 && !categoriaIdsSet.has(item.categoriaId)) {
          continue;
        }

        // Cost filter (multi-select):
        // - empty or both selected => no filter
        // - withCost => custoTotal > 0
        // - zeroCost => custoTotal <= 0
        if (costFilterSet.size === 1) {
          if (costFilterSet.has('withCost') && !(item.custoTotal > 0)) {
            continue;
          }
          if (costFilterSet.has('zeroCost') && !(item.custoTotal <= 0)) {
            continue;
          }
        }

        // Cost source filter (multi-select):
        // - empty or all selected => no filter
        if (costSourceSet.size > 0 && costSourceSet.size < 3) {
          if (!costSourceSet.has(item.custoFonte)) {
            continue;
          }
        }

        const custoComissao = normalizeNumber(commissionByItemKey.get(item.key));
        const custoComComissao = Number.parseFloat((normalizeNumber(item.custoTotal) + custoComissao).toFixed(2));

        rows.push({
          id: item.key,
          clienteId: clienteFilterValue,
          cliente: clienteNome,
          ordemId: ordemFilterValue,
          ordemNumero: String(ordem?.numero || '-'),
          itemDescricao: String(item?.rawItem?.descricao || 'Item sem descrição'),
          custoFonte: item.custoFonte,
          custoUnitario: item.custoUnitario,
          custoTotal: item.custoTotal,
          custoComissao,
          custoComComissao,
          valorTotal: item.valorTotal,
          responsavel: itemResponsaveis.length > 0
            ? itemResponsaveis.map((resp: any) => resp.nome).join(', ')
            : 'Sem responsável',
          responsavelIds: itemResponsaveis.map((resp: any) => String(resp.id)),
          status,
          statusLabel: getStatusLabel(status),
          data: String(ordem?.data_entrada || ''),
          categoriaId: item.categoriaId,
          categoriaNome: itemCategoriaNome,
        });
      }
    }

    const tableRows = viewMode === 'os' ? buildOrderRows(rows) : rows;

    tableRows.sort((a: any, b: any) => {
      const factor = sortOrder === 'asc' ? 1 : -1;

      if (sortBy === 'valorTotal' || sortBy === 'custoTotal' || sortBy === 'custoComissao' || sortBy === 'itemCount') {
        return (normalizeNumber(a?.[sortBy]) - normalizeNumber(b?.[sortBy])) * factor;
      }

      if (sortBy === 'data') {
        return String(a.data).localeCompare(String(b.data), 'pt-BR', { sensitivity: 'base' }) * factor;
      }

      return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''), 'pt-BR', { sensitivity: 'base' }) * factor;
    });

    const totalValor = rows.reduce((sum: number, row: any) => sum + toNumber(row.valorTotal, 0), 0);
    const totalCusto = rows.reduce((sum: number, row: any) => sum + toNumber(row.custoTotal, 0), 0);
    const totalCustoComissao = rows.reduce((sum: number, row: any) => sum + toNumber(row.custoComissao, 0), 0);
    const totalItems = rows.length;
    const totalOrdens = new Set(rows.map((row: any) => String(row?.ordemId || row?.ordemNumero || ''))).size;

    const totalRows = tableRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pagedRows = tableRows.slice(startIndex, startIndex + pageSize);

    const availableStatuses = Array.from(statusSet)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
      .map((status) => ({
        value: status,
        label: getStatusLabel(status),
      }));

    const availableCategories = Array.from(categorySet.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    const availableClientes = Array.from(clientSet.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));

    const availableOrdens = Array.from(orderSet.entries())
      .map(([value, label]) => ({ value, label: `${label}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));

    return Response.json({
      organization_id: organizationId,
      data: {
        salesItemsReport: {
          filters: {
            availableClientes,
            availableOrdens,
            availableResponsaveis,
            availableStatuses,
            availableCategories,
          },
          summary: {
            totalValor,
            totalCusto,
            totalCustoComissao,
            totalItems,
            totalOrdens,
          },
          table: {
            items: pagedRows,
            pagination: {
              page: currentPage,
              pageSize,
              totalItems: totalRows,
              totalPages,
            },
            sort: {
              sortBy,
              sortOrder,
            },
            viewMode,
          },
        },
      },
    });
  } catch (error: any) {
    console.error('Error getSalesItemsReportData:', error);
    return Response.json(
      {
        error: 'INTERNAL_ERROR',
        message: error?.message || 'Erro ao buscar dados do relatório de itens vendidos',
      },
      { status: 500 },
    );
  }
});