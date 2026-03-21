<script setup lang="ts">
import type { Asset, Debt, Expense, Income } from '~/types/financial'
import { TransactionType } from '~/types/financial'

definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Finanças'
})

const {
  // Dashboard
  dashboardData,
  dashboardStatus,

  // Categories
  incomeCategories,
  expenseCategories,

  // Incomes
  incomeData,
  incomeStatus,
  incomePage,
  incomePageSize,
  incomeSearch,

  // Expenses
  expenseData,
  expenseStatus,
  expensePage,
  expensePageSize,
  expenseSearch,

  // Debts
  debtData,
  debtStatus,
  debtPage,
  debtPageSize,
  debtSearch,
  debtStatusFilter,

  // Assets
  assetData,
  assetStatus,
  assetPage,
  assetPageSize,
  assetSearch,

  // Actions
  deleteIncome,
  deleteExpense,
  deleteDebt,
  deleteAsset,

  // Helpers
  formatCurrency,
  debtStatusOptions
} = useFinancial()

// ─── Active tab ───────────────────────────────────────────────────────────────
const activeTab = ref('dashboard')

const tabs = [
  { label: 'Painel', value: 'dashboard', icon: 'i-lucide-layout-dashboard' },
  { label: 'Receitas', value: 'incomes', icon: 'i-lucide-trending-up' },
  { label: 'Despesas', value: 'expenses', icon: 'i-lucide-trending-down' },
  { label: 'Dívidas', value: 'debts', icon: 'i-lucide-credit-card' },
  { label: 'Patrimônio', value: 'assets', icon: 'i-lucide-landmark' }
]

// ─── Modals ───────────────────────────────────────────────────────────────────
const incomeModalOpen = ref(false)
const expenseModalOpen = ref(false)
const debtModalOpen = ref(false)
const assetModalOpen = ref(false)
const categoryModalOpen = ref(false)
const deleteModalOpen = ref(false)
const debtSlideoverOpen = ref(false)

const selectedIncome = ref<Income | null>(null)
const selectedExpense = ref<Expense | null>(null)
const selectedDebt = ref<Debt | null>(null)
const selectedAsset = ref<Asset | null>(null)

const deleteTarget = ref<{ type: string; id: string; name: string } | null>(null)

// ─── Category type for modal ─────────────────────────────────────────────────
const categoryDefaultType = ref<TransactionType>(TransactionType.Expense)

// ─── Income actions ───────────────────────────────────────────────────────────
function onNewIncome(): void {
  selectedIncome.value = null
  incomeModalOpen.value = true
}

function onEditIncome(income: Income): void {
  selectedIncome.value = income
  incomeModalOpen.value = true
}

function onDeleteIncome(income: Income): void {
  deleteTarget.value = { type: 'income', id: income.id, name: income.source }
  deleteModalOpen.value = true
}

// ─── Expense actions ──────────────────────────────────────────────────────────
function onNewExpense(): void {
  selectedExpense.value = null
  expenseModalOpen.value = true
}

function onEditExpense(expense: Expense): void {
  selectedExpense.value = expense
  expenseModalOpen.value = true
}

function onDeleteExpense(expense: Expense): void {
  deleteTarget.value = { type: 'expense', id: expense.id, name: expense.description }
  deleteModalOpen.value = true
}

// ─── Debt actions ─────────────────────────────────────────────────────────────
function onNewDebt(): void {
  selectedDebt.value = null
  debtModalOpen.value = true
}

function onSelectDebt(debt: Debt): void {
  selectedDebt.value = debt
  debtSlideoverOpen.value = true
}

function onEditDebt(debt: Debt): void {
  selectedDebt.value = debt
  debtModalOpen.value = true
}

function onDeleteDebt(debt: Debt): void {
  deleteTarget.value = { type: 'debt', id: debt.id, name: debt.name }
  deleteModalOpen.value = true
}

// ─── Asset actions ────────────────────────────────────────────────────────────
function onNewAsset(): void {
  selectedAsset.value = null
  assetModalOpen.value = true
}

function onEditAsset(asset: Asset): void {
  selectedAsset.value = asset
  assetModalOpen.value = true
}

function onDeleteAsset(asset: Asset): void {
  deleteTarget.value = { type: 'asset', id: asset.id, name: asset.name }
  deleteModalOpen.value = true
}

// ─── Delete handler ───────────────────────────────────────────────────────────
async function onDeleteConfirmed(): Promise<void> {
  if (!deleteTarget.value) return

  const { type, id } = deleteTarget.value
  let success = false

  switch (type) {
    case 'income':
      success = await deleteIncome(id)
      break
    case 'expense':
      success = await deleteExpense(id)
      break
    case 'debt':
      success = await deleteDebt(id)
      break
    case 'asset':
      success = await deleteAsset(id)
      break
  }

  if (success) {
    deleteModalOpen.value = false
    deleteTarget.value = null
  }
}

// ─── Category filter ──────────────────────────────────────────────────────────
function onNewCategory(type: TransactionType): void {
  categoryDefaultType.value = type
  categoryModalOpen.value = true
}

// ─── Debt status filter ──────────────────────────────────────────────────────
const ALL_FILTER = '__all__'

const debtStatusModel = computed({
  get: () => debtStatusFilter.value || ALL_FILTER,
  set: (v: string) => { debtStatusFilter.value = v === ALL_FILTER ? '' : v }
})

const debtStatusFilterOptions = computed(() => [
  { label: 'Todas', value: ALL_FILTER },
  ...debtStatusOptions
])

// ─── Add button label based on active tab ────────────────────────────────────
const addButtonConfig = computed(() => {
  switch (activeTab.value) {
    case 'incomes': return { label: 'Nova receita', icon: 'i-lucide-plus', action: onNewIncome }
    case 'expenses': return { label: 'Nova despesa', icon: 'i-lucide-plus', action: onNewExpense }
    case 'debts': return { label: 'Nova dívida', icon: 'i-lucide-plus', action: onNewDebt }
    case 'assets': return { label: 'Novo ativo', icon: 'i-lucide-plus', action: onNewAsset }
    default: return null
  }
})
</script>

<template>
  <UDashboardPanel id="financial">
    <template #header>
      <UDashboardNavbar title="Finanças">
        <template #leading>
          <AppSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
          <UButton
            v-if="addButtonConfig"
            :label="addButtonConfig.label"
            :icon="addButtonConfig.icon"
            @click="addButtonConfig.action"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Tabs -->
        <UTabs
          :items="tabs"
          :model-value="activeTab"
          @update:model-value="activeTab = $event as string"
        />

        <!-- DASHBOARD TAB -->
        <div v-if="activeTab === 'dashboard'" class="space-y-6">
          <FinancialDashboardCards
            :dashboard="dashboardData ?? null"
            :loading="dashboardStatus === 'pending'"
            :format-currency="formatCurrency"
          />
          <FinancialDashboardDetails
            :dashboard="dashboardData ?? null"
            :loading="dashboardStatus === 'pending'"
            :format-currency="formatCurrency"
          />
        </div>

        <!-- INCOMES TAB -->
        <div v-if="activeTab === 'incomes'" class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="incomeSearch"
              icon="i-lucide-search"
              placeholder="Buscar receitas..."
              class="max-w-xs"
            />
            <UButton
              icon="i-lucide-tag"
              label="Nova categoria"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="onNewCategory(TransactionType.Income)"
            />
          </div>

          <FinancialIncomeList
            :incomes="incomeData?.data ?? []"
            :total="incomeData?.total ?? 0"
            :page="incomePage"
            :page-size="incomePageSize"
            :loading="incomeStatus === 'pending'"
            :format-currency="formatCurrency"
            @update:page="incomePage = $event"
            @edit="onEditIncome"
            @delete="onDeleteIncome"
          />
        </div>

        <!-- EXPENSES TAB -->
        <div v-if="activeTab === 'expenses'" class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="expenseSearch"
              icon="i-lucide-search"
              placeholder="Buscar despesas..."
              class="max-w-xs"
            />
            <UButton
              icon="i-lucide-tag"
              label="Nova categoria"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="onNewCategory(TransactionType.Expense)"
            />
          </div>

          <FinancialExpenseList
            :expenses="expenseData?.data ?? []"
            :total="expenseData?.total ?? 0"
            :page="expensePage"
            :page-size="expensePageSize"
            :loading="expenseStatus === 'pending'"
            :format-currency="formatCurrency"
            @update:page="expensePage = $event"
            @edit="onEditExpense"
            @delete="onDeleteExpense"
          />
        </div>

        <!-- DEBTS TAB -->
        <div v-if="activeTab === 'debts'" class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="debtSearch"
              icon="i-lucide-search"
              placeholder="Buscar dívidas..."
              class="max-w-xs"
            />
            <USelect
              v-model="debtStatusModel"
              :items="debtStatusFilterOptions"
              value-key="value"
              class="min-w-32"
            />
          </div>

          <FinancialDebtList
            :debts="debtData?.data ?? []"
            :total="debtData?.total ?? 0"
            :page="debtPage"
            :page-size="debtPageSize"
            :loading="debtStatus === 'pending'"
            :format-currency="formatCurrency"
            @update:page="debtPage = $event"
            @select="onSelectDebt"
            @edit="onEditDebt"
            @delete="onDeleteDebt"
          />
        </div>

        <!-- ASSETS TAB -->
        <div v-if="activeTab === 'assets'" class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="assetSearch"
              icon="i-lucide-search"
              placeholder="Buscar ativos..."
              class="max-w-xs"
            />
          </div>

          <FinancialAssetList
            :assets="assetData?.data ?? []"
            :total="assetData?.total ?? 0"
            :page="assetPage"
            :page-size="assetPageSize"
            :loading="assetStatus === 'pending'"
            :format-currency="formatCurrency"
            @update:page="assetPage = $event"
            @edit="onEditAsset"
            @delete="onDeleteAsset"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <FinancialIncomeModal
    :open="incomeModalOpen"
    :categories="incomeCategories"
    :income="selectedIncome"
    @update:open="incomeModalOpen = $event"
    @saved="selectedIncome = null"
  />

  <FinancialExpenseModal
    :open="expenseModalOpen"
    :categories="expenseCategories"
    :expense="selectedExpense"
    @update:open="expenseModalOpen = $event"
    @saved="selectedExpense = null"
  />

  <FinancialDebtModal
    :open="debtModalOpen"
    :debt="selectedDebt"
    @update:open="debtModalOpen = $event"
    @saved="selectedDebt = null"
  />

  <FinancialAssetModal
    :open="assetModalOpen"
    :asset="selectedAsset"
    @update:open="assetModalOpen = $event"
    @saved="selectedAsset = null"
  />

  <FinancialCategoryModal
    :open="categoryModalOpen"
    :default-type="categoryDefaultType"
    @update:open="categoryModalOpen = $event"
    @saved="categoryModalOpen = false"
  />

  <FinancialDeleteConfirmModal
    :open="deleteModalOpen"
    :title="'Confirmar exclusão'"
    :description="'Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.'"
    :item-name="deleteTarget?.name ?? ''"
    @update:open="deleteModalOpen = $event"
    @confirmed="onDeleteConfirmed"
  />

  <FinancialDebtSlideover
    :open="debtSlideoverOpen"
    :debt="selectedDebt"
    :format-currency="formatCurrency"
    @update:open="debtSlideoverOpen = $event"
    @updated="debtSlideoverOpen = false"
  />
</template>
