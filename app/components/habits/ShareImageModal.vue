<script setup lang="ts">
import { toPng } from 'html-to-image'
import type { ShareFormat } from './ShareImageCard.vue'
import type { SharedHabitsProgress } from '~/types/habits'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { fetchSharedProgress } = useHabits()
const { user } = useAuth()
const toast = useToast()

const cardRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const generating = ref(false)
const progress = ref<SharedHabitsProgress | null>(null)
const selectedFormat = ref<ShareFormat>('square')

const formatOptions: { label: string; value: ShareFormat; icon: string; desc: string }[] = [
  { label: 'Quadrado', value: 'square', icon: 'i-lucide-square', desc: '1080×1080 · Instagram Feed' },
  { label: 'Story', value: 'story', icon: 'i-lucide-smartphone', desc: '1080×1920 · Instagram/WhatsApp' },
  { label: 'Paisagem', value: 'landscape', icon: 'i-lucide-monitor', desc: '1200×630 · WhatsApp/X' },
]

const userName = computed(() => user.value?.user_metadata?.name as string | undefined)

const todayISO = computed(() => new Date().toISOString().split('T')[0]!)

const previewScale = computed(() => {
  const w = selectedFormat.value === 'landscape' ? 1200 : 1080
  return 360 / w
})

const previewHeight = computed(() => {
  const sizes: Record<ShareFormat, number> = { square: 1080, story: 1920, landscape: 630 }
  return sizes[selectedFormat.value] * previewScale.value
})

watch(() => props.open, async (open) => {
  if (!open) return
  loading.value = true
  progress.value = null

  // Fetch from user's own data via API that uses their token
  try {
    const data = await $fetch<SharedHabitsProgress>('/api/habits/share/my-progress')
    progress.value = data
  } catch {
    toast.add({ title: 'Erro', description: 'Não foi possível carregar os dados.', color: 'error' })
  } finally {
    loading.value = false
  }
})

async function generateImage(): Promise<Blob | null> {
  if (!cardRef.value) return null
  generating.value = true
  try {
    const dataUrl = await toPng(cardRef.value, {
      pixelRatio: 1,
      cacheBust: true,
    })
    const res = await fetch(dataUrl)
    return await res.blob()
  } catch {
    toast.add({ title: 'Erro', description: 'Não foi possível gerar a imagem.', color: 'error' })
    return null
  } finally {
    generating.value = false
  }
}

async function download() {
  const blob = await generateImage()
  if (!blob) return

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `habitos-${selectedFormat.value}-${todayISO.value}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.add({ title: 'Imagem salva!', description: 'Compartilhe nas suas redes sociais.', color: 'success' })
}

async function shareNative() {
  const blob = await generateImage()
  if (!blob) return

  const file = new File([blob], `habitos-${selectedFormat.value}.png`, { type: 'image/png' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Meu progresso de hábitos',
        text: 'Construindo consistência — Second Brain',
        files: [file],
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.add({ title: 'Erro', description: 'Não foi possível compartilhar.', color: 'error' })
      }
    }
  } else {
    await download()
  }
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Compartilhar progresso"
    description="Gere uma imagem para compartilhar nas redes sociais"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Format selector -->
        <div class="space-y-2">
          <p class="text-sm font-medium text-highlighted">Formato</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="opt in formatOptions"
              :key="opt.value"
              type="button"
              :icon="opt.icon"
              :label="opt.label"
              size="sm"
              :color="selectedFormat === opt.value ? 'primary' : 'neutral'"
              :variant="selectedFormat === opt.value ? 'solid' : 'outline'"
              @click="selectedFormat = opt.value"
            />
          </div>
          <p class="text-xs text-muted">
            {{ formatOptions.find(o => o.value === selectedFormat)?.desc }}
          </p>
        </div>

        <!-- Preview -->
        <div class="space-y-2">
          <p class="text-sm font-medium text-highlighted">Pré-visualização</p>

          <template v-if="loading">
            <div class="flex items-center justify-center rounded-lg border border-default bg-elevated/50" :style="{ height: previewHeight + 'px' }">
              <USkeleton class="h-full w-full rounded-lg" />
            </div>
          </template>

          <template v-else-if="progress">
            <div
              class="mx-auto overflow-hidden rounded-lg border border-default shadow-lg"
              :style="{ width: '360px', height: previewHeight + 'px' }"
            >
              <div :style="{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }">
                <div ref="cardRef">
                  <HabitsShareImageCard
                    :format="selectedFormat"
                    :user-name="userName"
                    :habits="progress.habits"
                    :completion-rate7d="progress.completionRate7d"
                    :completion-rate30d="progress.completionRate30d"
                    :total-habits="progress.totalHabits"
                    :date="todayISO"
                  />
                </div>
              </div>
            </div>
          </template>

          <div v-else class="flex flex-col items-center justify-center gap-2 py-8">
            <UIcon name="i-lucide-image-off" class="size-8 text-muted" />
            <p class="text-sm text-muted">Não foi possível carregar os dados.</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          icon="i-lucide-x"
          label="Fechar"
          color="neutral"
          variant="subtle"
          @click="emit('update:open', false)"
        />
        <UButton
          icon="i-lucide-download"
          label="Baixar"
          color="neutral"
          :loading="generating"
          :disabled="!progress || loading"
          @click="download"
        />
        <UButton
          icon="i-lucide-share-2"
          label="Compartilhar"
          :loading="generating"
          :disabled="!progress || loading"
          @click="shareNative"
        />
      </div>
    </template>
  </UModal>
</template>
