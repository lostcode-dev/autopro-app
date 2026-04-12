<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
</script>

<template>
  <WorkshopPagePlaceholder
    title="Fiscal Admin - Empresas"
    description="Gestao administrativa de empresas integradas no fluxo fiscal."
    legacy-source="old_project/src/pages/admin/invoices/Index.jsx"
  />
</template>
