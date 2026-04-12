<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
</script>

<template>
  <WorkshopPagePlaceholder
    title="Administracao de organizacoes"
    description="Gestao administrativa de organizacoes."
    legacy-source="old_project/src/pages/admin/organizations/Index.jsx"
  />
</template>
