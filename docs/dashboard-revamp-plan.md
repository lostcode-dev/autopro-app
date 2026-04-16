# Plano: Revisão do Dashboard — Alinhamento com Regras de Negócio do Sistema Antigo

## Problema

O dashboard atual (`app/pages/app/index.vue`) tem **6 cards** focados em métricas financeiras do período selecionado. O sistema antigo tinha **4 cards** com foco no estado operacional da oficina em tempo real. As regras de negócio são diferentes.

---

## Comparativo: Antigo vs. Atual

### Cards superiores

| # | Sistema Antigo | Lógica | Sistema Atual | Lógica |
|---|----------------|--------|---------------|--------|
| 1 | **Ordens em Andamento** | Count de OS com status `em_andamento` ou `aberta` — snapshot atual, sem filtro de data | Faturamento bruto | Soma `total_amount` de OS `completed/delivered` no período |
| 2 | **Faturamento do Mês** | Soma de `valor_total` de OS `concluida/entregue` no mês atual | Lucro líquido | `grossRevenue - totalCosts` no período |
| 3 | **Total de Clientes** | Count de TODOS os clientes da org — sem filtro de data | OS concluídas | Count de OS `completed/delivered` no período |
| 4 | **Agendamentos Hoje** | Count de agendamentos com `data_agendamento = hoje` — sempre o dia atual | Ticket médio | `grossRevenue / count` de OS no período |
| 5 | — | — | Novos clientes | Count de clientes criados no período |
| 6 | — | — | Margem de lucro | `(netProfit / grossRevenue) * 100` no período |

### Seções abaixo dos cards

| Seção | Sistema Antigo | Sistema Atual |
|-------|----------------|---------------|
| Esquerda | **Ordens Recentes** — últimas 5 OS (qualquer status), com cliente, veículo, valor, defeito relatado | Agendamentos do período (sem relevância operacional imediata) |
| Direita | **Agenda de Hoje** — agendamentos do dia atual, com horário, cliente, veículo | OS em andamento (lista) |
| Alerta | **Banner de estoque baixo** — aparece quando há peças com estoque ≤ mínimo | Ausente |
| Rodapé | — | Top 5 serviços/peças no período |

---

## Regras de Negócio dos 4 Cards

### Card 1 — Ordens em Andamento

> Responde: *"Quantas OSs estou atendendo agora?"*

**Dado**: Count de `service_orders` com status ativo  
**Filtro**: `status IN ('open', 'in_progress', 'waiting_for_part')` — sem filtro de data  
**Atualização**: Sempre reflete o estado atual (não muda com o date picker)  
**Coluna DB**: `service_orders.status`  
**Ícone**: `i-lucide-wrench` — cor azul  

```sql
SELECT COUNT(*) FROM service_orders
WHERE organization_id = $orgId
  AND deleted_at IS NULL
  AND status IN ('open', 'in_progress', 'waiting_for_part')
```

---

### Card 2 — Faturamento do Mês

> Responde: *"Quanto faturei no período?"*

**Dado**: Soma de `total_amount` de OS concluídas no período selecionado  
**Filtro**: `status IN ('completed', 'delivered')` AND `entry_date` dentro do período  
**Atualização**: Muda conforme o date picker  
**Coluna DB**: `service_orders.total_amount`, `service_orders.entry_date`  
**Ícone**: `i-lucide-trending-up` — cor verde  
**Formato**: R$ moeda brasileira  

```sql
SELECT COALESCE(SUM(total_amount), 0) FROM service_orders
WHERE organization_id = $orgId
  AND deleted_at IS NULL
  AND status IN ('completed', 'delivered')
  AND entry_date BETWEEN $dateFrom AND $dateTo
```

---

### Card 3 — Total de Clientes

> Responde: *"Quantos clientes tenho cadastrados?"*

**Dado**: Count de TODOS os clientes ativos da org  
**Filtro**: Sem filtro de data — sempre o total acumulado  
**Atualização**: Não muda com o date picker  
**Coluna DB**: `clients.id`  
**Ícone**: `i-lucide-users` — cor roxa  

```sql
SELECT COUNT(*) FROM clients
WHERE organization_id = $orgId
  AND deleted_at IS NULL
```

---

### Card 4 — Agendamentos Hoje

> Responde: *"Quantos clientes vêm hoje?"*

**Dado**: Count de agendamentos para o dia atual  
**Filtro**: `appointment_date = CURRENT_DATE` — fixo no hoje, não muda com date picker  
**Atualização**: Sempre reflete o dia atual  
**Coluna DB**: `appointments.appointment_date`  
**Ícone**: `i-lucide-calendar` — cor laranja  

```sql
SELECT COUNT(*) FROM appointments
WHERE organization_id = $orgId
  AND deleted_at IS NULL
  AND appointment_date = CURRENT_DATE
```

---

## Seções Abaixo dos Cards

### Seção 1 (esquerda) — Ordens Recentes

> Últimas 5 ordens de serviço criadas, independente de status.

**Dados mostrados por item:**
- Número da OS (`number`) + badge de status
- Nome do cliente (`clients.name`)
- Veículo: `marca modelo — placa` (`vehicles.brand vehicle.model — vehicle.plate`)
- Data de entrada (`entry_date` formatada como `dd/MM/yyyy`)
- Defeito relatado (`reported_defect`) — truncado em 1 linha
- Valor total (`total_amount`) em moeda

**Query base:**
```sql
SELECT so.*, c.name AS client_name, v.brand, v.model, v.plate
FROM service_orders so
LEFT JOIN clients c ON c.id = so.client_id
LEFT JOIN vehicles v ON v.id = so.vehicle_id
WHERE so.organization_id = $orgId
  AND so.deleted_at IS NULL
ORDER BY so.created_at DESC
LIMIT 5
```

**Mapa de status → cor do badge:**

| Status | Cor | Label |
|--------|-----|-------|
| `estimate` | neutral | Orçamento |
| `open` | info | Aberta |
| `in_progress` | warning | Em andamento |
| `waiting_for_part` | orange | Aguard. peça |
| `completed` | success | Concluída |
| `delivered` | success | Entregue |
| `cancelled` | error | Cancelada |

**Rodapé do card**: link "Ver todas as OS" → `/app/service-orders`

---

### Seção 2 (direita) — Agenda de Hoje

> Agendamentos do dia atual, ordenados por horário.

**Dados mostrados por item:**
- Horário (`time`) + badge de status
- Nome do cliente (`clients.name`)
- Veículo: `marca modelo` (`vehicles.brand vehicle.model`)
- Tipo de serviço (`service_type`)

**Query base:**
```sql
SELECT a.*, c.name AS client_name, v.brand, v.model
FROM appointments a
LEFT JOIN clients c ON c.id = a.client_id
LEFT JOIN vehicles v ON v.id = a.vehicle_id
WHERE a.organization_id = $orgId
  AND a.deleted_at IS NULL
  AND a.appointment_date = CURRENT_DATE
ORDER BY a.time ASC
```

**Estado vazio**: "Nenhum agendamento para hoje." com ícone de calendário

**Rodapé do card**: link "Ver todos os agendamentos" → `/app/appointments`

---

### Banner de Alerta de Estoque Baixo

> Aparece apenas quando há itens com estoque atual ≤ estoque mínimo.

**Condição de exibição**: `count > 0`  
**Query**:
```sql
SELECT COUNT(*) FROM products  -- ou inventory, verificar tabela correta
WHERE organization_id = $orgId
  AND deleted_at IS NULL
  AND current_stock <= minimum_stock
```

**Visual:**
```
⚠️  Atenção ao Estoque
    X peça(s) com estoque baixo
    [Ver itens com estoque baixo →]
```

**Posição**: Entre os cards superiores e as seções de lista (mesma posição do antigo)  
**Rota do link**: `/app/inventory` (ou `/app/products`, verificar rota correta)

---

## Novo Endpoint: `GET /api/reports/dashboard-stats`

Criar um endpoint dedicado para os 4 stats cards + alerta de estoque + contagens, separado do `/api/reports/overview` (que continua existindo para relatórios do período).

```typescript
// server/api/reports/dashboard-stats.get.ts
// Retorna métricas operacionais em tempo real (sem dependência de date picker)
// + faturamento do período para o card 2

// Response shape:
{
  openOrdersCount: number,         // Card 1: OS abertas/em andamento/aguardando peça
  grossRevenue: number,            // Card 2: Faturamento do período
  totalClients: number,            // Card 3: Total acumulado de clientes
  todayAppointmentsCount: number,  // Card 4: Agendamentos hoje
  lowStockCount: number,           // Banner: peças com estoque baixo
  recentOrders: RecentOrder[],     // Seção: últimas 5 OS com dados relacionados
  todaySchedule: TodayAppointment[] // Seção: agendamentos de hoje com dados relacionados
}
```

**Parâmetros da query**: apenas `dateFrom` e `dateTo` (afetam apenas o Card 2 — faturamento)

---

## Alterações no `app/pages/app/index.vue`

### 1. Substituir 6 cards por 4 cards

```typescript
// Antes: 6 cards todos dependentes do período
// Depois: 4 cards com lógicas independentes

const statsCards = computed(() => {
  if (!dashStats.value) return []
  return [
    {
      label: 'OS em Andamento',
      value: dashStats.value.openOrdersCount,
      icon: 'i-lucide-wrench',
      color: 'text-blue-500'
    },
    {
      label: 'Faturamento do Mês',
      value: formatCurrency(dashStats.value.grossRevenue),
      icon: 'i-lucide-trending-up',
      color: 'text-green-500'
    },
    {
      label: 'Total de Clientes',
      value: dashStats.value.totalClients,
      icon: 'i-lucide-users',
      color: 'text-purple-500'
    },
    {
      label: 'Agendamentos Hoje',
      value: dashStats.value.todayAppointmentsCount,
      icon: 'i-lucide-calendar',
      color: 'text-orange-500'
    }
  ]
})
```

### 2. Grid de 4 colunas (não 6)

```html
<!-- Antes: grid-cols-2 md:grid-cols-3 xl:grid-cols-6 -->
<!-- Depois: -->
<div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
  <UPageCard v-for="card in statsCards" ... />
</div>
```

### 3. Banner de estoque baixo

```html
<!-- Inserir entre os cards e as seções de lista -->
<div
  v-if="dashStats?.lowStockCount > 0"
  class="flex items-center gap-3 rounded-xl border border-warning bg-warning/10 p-4"
>
  <UIcon name="i-lucide-alert-triangle" class="text-warning text-xl shrink-0" />
  <div>
    <p class="font-semibold text-sm">Atenção ao Estoque</p>
    <p class="text-xs text-muted">
      {{ dashStats.lowStockCount }} peça{{ dashStats.lowStockCount > 1 ? 's' : '' }} com estoque baixo
    </p>
  </div>
  <NuxtLink to="/app/inventory" class="ml-auto text-xs text-primary hover:underline">
    Ver itens →
  </NuxtLink>
</div>
```

### 4. Renomear seções

```html
<!-- Antes: "Agendamentos do período" e "OS em andamento" -->
<!-- Depois: -->
<UPageCard title="Ordens Recentes" ...>      <!-- esquerda: últimas 5 OS -->
<UPageCard title="Agenda de Hoje" ...>       <!-- direita: agendamentos do dia -->
```

---

## Checklist de Implementação

### Fase 1 — Novo endpoint
- [ ] Criar `server/api/reports/dashboard-stats.get.ts` com as 4 queries otimizadas
- [ ] Adicionar query de `recentOrders` com JOIN em `clients` e `vehicles`
- [ ] Adicionar query de `todaySchedule` com JOIN em `clients` e `vehicles`
- [ ] Adicionar query de `lowStockCount` (verificar nome da tabela: `products` ou `inventory`)
- [ ] Confirmar nome das colunas de estoque (`current_stock`, `minimum_stock` ou similar)

### Fase 2 — Atualizar `app/pages/app/index.vue`
- [ ] Substituir `useAsyncData` do `/api/reports/overview` pelo novo `/api/reports/dashboard-stats`
- [ ] Reduzir de 6 para 4 cards com os novos labels e lógicas
- [ ] Alterar grid de 6 colunas para 4 colunas
- [ ] Adicionar banner de estoque baixo (condicional)
- [ ] Substituir "Agendamentos do período" por "Ordens Recentes" com campos corretos
- [ ] Substituir "OS em andamento" por "Agenda de Hoje" com campos corretos
- [ ] Remover seção "Top serviços/peças" (não estava no antigo)
- [ ] Remover date picker do header (Card 2 usa período mas os outros 3 são fixos — avaliar com o usuário se mantém o date picker só para o faturamento)

### Fase 3 — Skeleton states
- [ ] Atualizar skeleton de 6 para 4 blocos no loading state
- [ ] Adicionar skeleton para as duas seções de lista

---

## Arquivos a Criar / Modificar

| Arquivo | Ação |
|---------|------|
| `server/api/reports/dashboard-stats.get.ts` | Criar — endpoint dedicado ao dashboard |
| `app/pages/app/index.vue` | Modificar — layout, cards, seções |
| `server/api/reports/overview.get.ts` | Manter sem alterações (usado em relatórios) |

---

## Decisão pendente: Date Picker

O sistema antigo **não tinha date picker** — os cards tinham lógicas fixas (mês atual, hoje, total). O atual tem um date picker que afeta todos os cards.

**Opção A** — Remover o date picker, os 4 cards seguem lógica fixa como no antigo  
**Opção B** — Manter o date picker, mas apenas o Card 2 (Faturamento) é afetado; os outros 3 são fixos  
**Opção C** — Manter o date picker para todos (comportamento atual), apenas mudar os cards de 6 para 4  

Recomendação: **Opção B** — mantém a utilidade do filtro de período para o faturamento, mas preserva a natureza operacional em tempo real dos outros 3 cards.
