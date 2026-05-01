<script setup lang="ts">
defineProps<{
  reportedDefect: string
  diagnosis: string
  notes: string
}>()

defineEmits<{
  'update:reportedDefect': [v: string]
  'update:diagnosis': [v: string]
  'update:notes': [v: string]
}>()
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-wrench" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Atendimento inicial
        </h3>
      </div>
    </template>

    <div class="space-y-4">
      <UFormField label="Defeito relatado">
        <UTextarea
          :model-value="reportedDefect"
          placeholder="Descreva o defeito relatado pelo cliente..."
          :rows="5"
          class="w-full"
          @update:model-value="$emit('update:reportedDefect', String($event ?? ''))"
        />
      </UFormField>

      <UFormField label="Diagnóstico">
        <UTextarea
          :model-value="diagnosis"
          placeholder="Diagnóstico técnico inicial..."
          :rows="5"
          class="w-full"
          @update:model-value="$emit('update:diagnosis', String($event ?? ''))"
        />
      </UFormField>

      <UFormField label="Observações internas">
        <UTextarea
          :model-value="notes"
          placeholder="Informações adicionais para a equipe..."
          :rows="4"
          class="w-full"
          @update:model-value="$emit('update:notes', String($event ?? ''))"
        />
      </UFormField>
    </div>
  </UCard>
</template>
