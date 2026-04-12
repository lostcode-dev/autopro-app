<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
</script>

<template>
  <WorkshopPagePlaceholder
    title="Admin do sistema"
    description="Ferramentas administrativas e tecnicas do sistema."
    legacy-source="old_project/src/pages/configs/admin/Index.jsx"
  />
</template>
