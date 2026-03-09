<script setup lang="ts">
import { toPng } from 'html-to-image'
import type { Habit, SharedHabitCardData } from '~/types/habits'

const props = defineProps<{
  open: boolean
  habit?: Habit | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { user } = useAuth()
const toast = useToast()

const exportCardRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const generating = ref(false)
const progress = ref<SharedHabitCardData | null>(null)

const userName = computed(() => user.value?.user_metadata?.name as string | undefined)
const userHandle = computed(() => {
  const metadata = user.value?.user_metadata as Record<string, unknown> | undefined
  const rawHandle = metadata?.user_name || metadata?.username || metadata?.preferred_username
  const fallbackEmail = typeof user.value?.email === 'string' ? user.value.email.split('@')[0] : undefined
  const base = (typeof rawHandle === 'string' && rawHandle.trim()) || fallbackEmail || userName.value || 'secondbrain'

  return `@${base
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '')
    .toLowerCase()}`
})
const userInitials = computed(() => {
  const base = userName.value?.trim() || userHandle.value.replace(/^@/, '')
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
})

const todayISO = computed(() => new Date().toISOString().split('T')[0]!)

const selectedHabitName = computed(() => props.habit?.name ?? 'habito')
const fileSafeHabitName = computed(() =>
  selectedHabitName.value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'habito'
)

watch(() => [props.open, props.habit?.id] as const, async ([open, habitId]) => {
  if (!open) return
  if (!habitId) {
    progress.value = null
    loading.value = false
    return
  }

  loading.value = true
  progress.value = null

  try {
    const data = await $fetch<SharedHabitCardData>('/api/habits/share/my-progress', {
      query: { habitId }
    })
    progress.value = data
  } catch {
    toast.add({ title: 'Erro', description: 'Não foi possível carregar os dados do hábito.', color: 'error' })
  } finally {
    loading.value = false
  }
})

async function generateImage(): Promise<Blob | null> {
  if (!exportCardRef.value) return null
  generating.value = true
  try {
    const dataUrl = await toPng(exportCardRef.value, {
      pixelRatio: 2,
      cacheBust: true,
      canvasWidth: 1080,
      canvasHeight: 1080
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
  a.download = `habito-${fileSafeHabitName.value}-${todayISO.value}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.add({ title: 'Imagem salva!', description: 'Compartilhe nas suas redes sociais.', color: 'success' })
}

async function shareNative() {
  const blob = await generateImage()
  if (!blob) return

  const file = new File([blob], `habito-${fileSafeHabitName.value}.png`, { type: 'image/png' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `Meu hábito: ${selectedHabitName.value}`,
        text: `Construindo consistência com ${selectedHabitName.value} — Second Brain`,
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
    title="Compartilhar hábito"
    description="Formato quadrado, pronto para baixar ou compartilhar"
    :ui="{
      overlay: 'z-[200] bg-elevated/75',
      content: 'z-[210]'
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="space-y-2">
          <p class="text-sm font-medium text-highlighted">Formato</p>
          <p class="text-sm text-muted">Quadrado 1080×1080, com foco em um único hábito.</p>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium text-highlighted">Pré-visualização</p>

          <template v-if="loading">
            <div class="flex h-[360px] items-center justify-center rounded-lg border border-default bg-elevated/50">
              <USkeleton class="h-full w-full rounded-lg" />
            </div>
          </template>

          <template v-else-if="progress">
            <div
              class="mx-auto overflow-hidden rounded-lg border border-default shadow-lg"
              :style="{ width: '360px', height: '360px' }"
            >
              <div :style="{ transform: 'scale(0.3333333)', transformOrigin: 'top left' }">
                <div>
                  <HabitsShareImageCard
                    :user-name="userName"
                    :user-handle="userHandle"
                    :user-initials="userInitials"
                    :data="progress"
                    :date="todayISO"
                  />
                </div>
              </div>
            </div>
          </template>

          <div v-else class="flex flex-col items-center justify-center gap-2 py-8">
            <UIcon name="i-lucide-image-off" class="size-8 text-muted" />
            <p class="text-sm text-muted">Selecione um hábito para compartilhar.</p>
          </div>
        </div>

        <div class="pointer-events-none fixed -left-[9999px] top-0">
          <div ref="exportCardRef">
            <HabitsShareImageCard
              v-if="progress"
              :user-name="userName"
              :user-handle="userHandle"
              :user-initials="userInitials"
              :data="progress"
              :date="todayISO"
            />
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
