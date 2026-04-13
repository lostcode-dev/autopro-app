<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatórios' })

const reports = [
  {
    title: 'Visão Geral',
    description: 'Resumo financeiro do período com receitas, custos e lucro.',
    icon: 'i-lucide-layout-dashboard',
    to: '/app/reports',
    highlight: true
  },
  {
    title: 'Comissões',
    description: 'Comissões por funcionário e ordem de serviço.',
    icon: 'i-lucide-badge-percent',
    to: '/app/reports/commissions'
  },
  {
    title: 'Clientes',
    description: 'Receita, ordens e ticket médio por cliente.',
    icon: 'i-lucide-users',
    to: '/app/reports/customers'
  },
  {
    title: 'Inadimplentes',
    description: 'Clientes com pagamentos pendentes.',
    icon: 'i-lucide-alert-triangle',
    to: '/app/reports/debtors'
  },
  {
    title: 'Custos e Lucro',
    description: 'Análise de custos, receitas e margem de lucro.',
    icon: 'i-lucide-trending-up',
    to: '/app/reports/costs'
  },
  {
    title: 'Lucro',
    description: 'Relatório detalhado de lucro e evolução.',
    icon: 'i-lucide-circle-dollar-sign',
    to: '/app/reports/profit'
  },
  {
    title: 'Compras',
    description: 'Análise de compras por fornecedor e período.',
    icon: 'i-lucide-shopping-cart',
    to: '/app/reports/purchases'
  },
  {
    title: 'Fornecedores',
    description: 'Histórico de compras e valores por fornecedor.',
    icon: 'i-lucide-truck',
    to: '/app/reports/suppliers'
  },
  {
    title: 'Itens Vendidos',
    description: 'Serviços e peças mais vendidos no período.',
    icon: 'i-lucide-list-checks',
    to: '/app/reports/sales-items'
  }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Relatórios">
        <template #leading>
          <AppSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="report in reports"
            :key="report.to"
            :to="report.to"
            class="group"
          >
            <UPageCard
              :title="report.title"
              :description="report.description"
              :ui="{ root: 'hover:ring-2 hover:ring-primary transition-all' }"
            >
              <template #leading>
                <UIcon :name="report.icon" class="text-2xl text-primary" />
              </template>
              <template #trailing>
                <UIcon name="i-lucide-chevron-right" class="text-muted group-hover:text-primary transition-colors" />
              </template>
            </UPageCard>
          </NuxtLink>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
