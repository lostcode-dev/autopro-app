<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
</script>

<template>
  <WorkshopPagePlaceholder
    title="Fiscal Admin - Logs"
    description="Logs administrativos da integracao fiscal."
    legacy-source="old_project/src/pages/admin/nuvemfiscal/Index.jsx"
  />
</template>
