<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
</script>

<template>
  <WorkshopPagePlaceholder
    title="Admin Dashboard"
    description="Painel administrativo global."
    legacy-source="old_project/src/pages/admin/dashboard/DashboardAdmin.jsx"
  />
</template>
