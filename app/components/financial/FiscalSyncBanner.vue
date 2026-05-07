<script setup lang="ts">
defineProps<{
  errorMessage?: string | null
}>()

defineEmits<{
  configure: []
}>()
</script>

<template>
  <div class="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-alert-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div class="flex-1">
        <p class="font-semibold text-highlighted">Integração fiscal não configurada</p>
        <p class="mt-0.5 text-sm text-muted">
          Sua empresa ainda não está registrada na Focus NFe. Configure a integração para emitir notas fiscais de serviço (NFS-e).
        </p>
        <div v-if="errorMessage" class="mt-2 rounded border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
          Último erro: {{ errorMessage }}
        </div>
      </div>
      <UButton
        label="Configurar integração"
        icon="i-lucide-settings"
        size="sm"
        color="warning"
        variant="solid"
        class="shrink-0"
        @click="$emit('configure')"
      />
    </div>
  </div>
</template>
