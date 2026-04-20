<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Feedback, FeedbackAttachment } from '~/types/feedback'
import {
  feedbackTypeLabels,
  feedbackTypeIcons,
  feedbackTypeColors,
  feedbackStatusLabels,
  feedbackStatusColors
} from '~/types/feedback'

const props = defineProps<{
  open: boolean
  feedback: Feedback | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'delete': [id: string]
  'respond': [feedbackId: string, content: string]
}>()

const responseSchema = z.object({
  content: z.string().min(1, 'Mensagem obrigatória').max(5000)
})

type ResponseSchema = z.infer<typeof responseSchema>

const responseState = reactive<ResponseSchema>({ content: '' })
const sendingResponse = ref(false)

const detailData = ref<Feedback | null>(null)
const loadingDetail = ref(false)

watch(() => props.feedback, async (fb) => {
  if (fb) {
    loadingDetail.value = true
    try {
      detailData.value = await $fetch<Feedback>(`/api/feedback/${fb.id}`)
    } catch {
      detailData.value = fb
    } finally {
      loadingDetail.value = false
    }
  } else {
    detailData.value = null
  }
}, { immediate: true })

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isImage(att: FeedbackAttachment) {
  return att.fileType.startsWith('image/')
}

function isVideo(att: FeedbackAttachment) {
  return att.fileType.startsWith('video/')
}

async function onSubmitResponse(evt: FormSubmitEvent<ResponseSchema>) {
  if (!detailData.value || sendingResponse.value) return
  sendingResponse.value = true
  try {
    emit('respond', detailData.value.id, evt.data.content)
    responseState.content = ''
    detailData.value = await $fetch<Feedback>(`/api/feedback/${detailData.value.id}`)
  } finally {
    sendingResponse.value = false
  }
}

function onClose() {
  emit('update:open', false)
  responseState.content = ''
}
</script>

<template>
  <USlideover :open="props.open" title="Detalhes do chamado" @update:open="onClose">
    <template #body>
      <div v-if="loadingDetail" class="space-y-4 p-4">
        <USkeleton class="h-6 w-3/4" />
        <USkeleton class="h-4 w-1/2" />
        <USkeleton class="h-20 w-full" />
      </div>

      <div v-else-if="detailData" class="space-y-6 p-4">
        <!-- Header -->
        <div>
          <div class="flex items-start gap-2 mb-2">
            <UIcon
              :name="feedbackTypeIcons[detailData.type]"
              :class="`text-${feedbackTypeColors[detailData.type]}`"
              class="mt-0.5 shrink-0 size-5"
            />
            <h3 class="text-base font-semibold leading-snug">
              {{ detailData.title }}
            </h3>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <UBadge
              :label="feedbackTypeLabels[detailData.type]"
              :color="feedbackTypeColors[detailData.type]"
              variant="subtle"
              size="sm"
            />
            <UBadge
              :label="feedbackStatusLabels[detailData.status]"
              :color="feedbackStatusColors[detailData.status]"
              variant="subtle"
              size="sm"
            />
          </div>
          <p class="text-xs text-dimmed mt-2">
            Aberto em {{ formatDate(detailData.createdAt) }}
          </p>
        </div>

        <!-- Description -->
        <div>
          <h4 class="text-sm font-medium mb-1">
            Descricao
          </h4>
          <p class="text-sm text-muted whitespace-pre-wrap leading-relaxed">
            {{ detailData.description }}
          </p>
        </div>

        <!-- Media attachments -->
        <div v-if="detailData.attachments && detailData.attachments.length > 0">
          <h4 class="text-sm font-medium mb-2">
            Anexos ({{ detailData.attachments.length }})
          </h4>
          <div class="grid grid-cols-2 gap-2">
            <template v-for="att in detailData.attachments" :key="att.id">
              <a
                v-if="isImage(att)"
                :href="att.fileUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="relative aspect-video rounded-lg overflow-hidden border border-default block hover:opacity-90 transition-opacity"
              >
                <img
                  :src="att.fileUrl"
                  :alt="att.fileName"
                  class="w-full h-full object-cover"
                  loading="lazy"
                >
                <div class="absolute bottom-0 inset-x-0 bg-black/40 px-2 py-1">
                  <p class="text-[10px] text-white truncate">{{ att.fileName }}</p>
                </div>
              </a>
              <div
                v-else-if="isVideo(att)"
                class="relative aspect-video rounded-lg overflow-hidden border border-default bg-elevated"
              >
                <video
                  :src="att.fileUrl"
                  class="w-full h-full object-cover"
                  controls
                  preload="metadata"
                />
              </div>
              <a
                v-else
                :href="att.fileUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 rounded-lg border border-default bg-elevated p-3 hover:bg-elevated/60 transition-colors"
              >
                <UIcon name="i-lucide-paperclip" class="size-4 text-muted shrink-0" />
                <span class="text-sm text-primary truncate">{{ att.fileName }}</span>
              </a>
            </template>
          </div>
        </div>

        <!-- Conversation -->
        <div>
          <h4 class="text-sm font-medium mb-3">
            Conversa
            <span v-if="detailData.responses?.length" class="text-dimmed font-normal">({{ detailData.responses.length }})</span>
          </h4>

          <div v-if="detailData.responses && detailData.responses.length > 0" class="space-y-3 mb-4">
            <div
              v-for="resp in detailData.responses"
              :key="resp.id"
              class="rounded-lg border p-3"
              :class="resp.isAdmin ? 'bg-primary/5 border-primary/20' : 'bg-elevated border-default'"
            >
              <div class="flex items-center gap-2 mb-1.5">
                <UBadge
                  v-if="resp.isAdmin"
                  label="AutoPro"
                  color="primary"
                  variant="subtle"
                  size="xs"
                />
                <UBadge
                  v-else
                  label="Voce"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
                <span class="text-xs text-dimmed">{{ formatDate(resp.createdAt) }}</span>
              </div>
              <p class="text-sm whitespace-pre-wrap leading-relaxed">
                {{ resp.content }}
              </p>
            </div>
          </div>

          <p v-else class="text-sm text-dimmed mb-4">
            Nenhuma resposta ainda. Envie uma mensagem para o suporte.
          </p>

          <UForm
            v-if="detailData.status !== 'closed' && detailData.status !== 'resolved'"
            :schema="responseSchema"
            :state="responseState"
            @submit="onSubmitResponse"
          >
            <UFormField name="content">
              <UTextarea
                v-model="responseState.content"
                placeholder="Escreva sua mensagem..."
                :rows="3"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end mt-2">
              <UButton
                type="submit"
                size="sm"
                label="Enviar mensagem"
                :loading="sendingResponse"
                :disabled="sendingResponse"
              />
            </div>
          </UForm>

          <p v-else class="text-xs text-muted italic">
            Este chamado esta {{ feedbackStatusLabels[detailData.status] }} e nao aceita novas mensagens.
          </p>
        </div>

        <div
          v-if="detailData.status === 'submitted'"
          class="flex gap-2 pt-2 border-t border-default"
        >
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            label="Excluir chamado"
            icon="i-lucide-trash-2"
            @click="emit('delete', detailData.id)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
