<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  description?: string
  legacySource?: string
  nested?: boolean
}>(), {
  description: 'Estrutura inicial criada para a migracao deste modulo.',
  legacySource: '',
  nested: false
})

useSeoMeta({
  title: () => props.title
})
</script>

<template>
  <UDashboardPanel v-if="!nested" id="workshop-placeholder">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <AppSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <UPageCard
          :title="title"
          :description="description"
          variant="subtle"
        >
          <div class="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <UBadge color="warning" variant="subtle" label="Migracao em andamento" />
            <p>Esta pagina foi criada como base de rota para a migracao do modulo legado.</p>
            <p v-if="legacySource">
              Origem legada: <code>{{ legacySource }}</code>
            </p>
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>

  <div v-else class="space-y-6">
    <UPageCard
      :title="title"
      :description="description"
      variant="subtle"
    >
      <div class="space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <UBadge color="warning" variant="subtle" label="Migracao em andamento" />
        <p>Esta pagina foi criada como base de rota para a migracao do modulo legado.</p>
        <p v-if="legacySource">
          Origem legada: <code>{{ legacySource }}</code>
        </p>
      </div>
    </UPageCard>
  </div>
</template>
