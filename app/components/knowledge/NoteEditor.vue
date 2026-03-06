<script setup lang="ts">
import type { KnowledgeNote, KnowledgeTag, NoteDetail } from '~/types/knowledge'
import { NOTE_TYPE_META, NoteType } from '~/types/knowledge'

const props = defineProps<{
  noteId: string | null
  tags: KnowledgeTag[]
}>()

const emit = defineEmits<{
  updated: []
  deleted: []
  'navigate-note': [noteId: string]
}>()

const {
  fetchNoteDetail,
  updateNote,
  deleteNote,
  linkNotes,
  unlinkNotes,
  noteTypeOptions,
  notesData
} = useKnowledge()

const noteDetail = ref<NoteDetail | null>(null)
const loading = ref(false)
const saving = ref(false)

// Editable state
const editTitle = ref('')
const editContent = ref('')
const editType = ref<NoteType>(NoteType.Note)
const editTagIds = ref<string[]>([])

// Link search
const linkSearchOpen = ref(false)
const linkSearchQuery = ref('')

const dirty = computed(() => {
  if (!noteDetail.value) return false
  return (
    editTitle.value !== noteDetail.value.title
    || editContent.value !== (noteDetail.value.content ?? '')
    || editType.value !== noteDetail.value.type
    || JSON.stringify(editTagIds.value.sort()) !== JSON.stringify((noteDetail.value.tags ?? []).map(t => t.id).sort())
  )
})

const typeMeta = computed(() => NOTE_TYPE_META[editType.value] ?? NOTE_TYPE_META[NoteType.Note])

// Tag options for select
const tagOptions = computed(() =>
  props.tags.map(t => ({ label: `#${t.name}`, value: t.id }))
)

// Available notes for linking (exclude current + already linked)
const availableNotesForLink = computed(() => {
  if (!notesData.value?.data || !noteDetail.value) return []
  const linkedIds = new Set([
    ...(noteDetail.value.links ?? []).map(l => l.targetNoteId),
    noteDetail.value.id
  ])
  return notesData.value.data
    .filter((n: KnowledgeNote) => !linkedIds.has(n.id))
    .filter((n: KnowledgeNote) => !linkSearchQuery.value || n.title.toLowerCase().includes(linkSearchQuery.value.toLowerCase()))
})

// ─── Load note detail ─────────────────────────────────────────────────────────
watch(() => props.noteId, async (id) => {
  if (!id) {
    noteDetail.value = null
    return
  }
  loading.value = true
  try {
    const detail = await fetchNoteDetail(id)
    noteDetail.value = detail
    if (detail) {
      editTitle.value = detail.title
      editContent.value = detail.content ?? ''
      editType.value = detail.type as NoteType
      editTagIds.value = (detail.tags ?? []).map((t: KnowledgeTag) => t.id)
    }
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

// ─── Actions ──────────────────────────────────────────────────────────────────

async function saveNote(): Promise<void> {
  if (!noteDetail.value || !dirty.value) return
  saving.value = true
  try {
    await updateNote(noteDetail.value.id, {
      title: editTitle.value,
      content: editContent.value || undefined,
      type: editType.value,
      tagIds: editTagIds.value
    })
    // Reload detail
    const detail = await fetchNoteDetail(noteDetail.value.id)
    noteDetail.value = detail
    emit('updated')
  }
  finally {
    saving.value = false
  }
}

async function onDelete(): Promise<void> {
  if (!noteDetail.value) return
  const success = await deleteNote(noteDetail.value.id)
  if (success) {
    noteDetail.value = null
    emit('deleted')
  }
}

async function addLink(targetId: string): Promise<void> {
  if (!noteDetail.value) return
  const success = await linkNotes(noteDetail.value.id, { targetNoteId: targetId })
  if (success) {
    const detail = await fetchNoteDetail(noteDetail.value.id)
    noteDetail.value = detail
    linkSearchOpen.value = false
    linkSearchQuery.value = ''
  }
}

async function removeLink(linkId: string): Promise<void> {
  if (!noteDetail.value) return
  const success = await unlinkNotes(linkId)
  if (success) {
    const detail = await fetchNoteDetail(noteDetail.value.id)
    noteDetail.value = detail
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Auto-save with debounce
let saveTimer: ReturnType<typeof setTimeout> | null = null

watch([editTitle, editContent, editType, editTagIds], () => {
  if (saveTimer) clearTimeout(saveTimer)
  if (dirty.value) {
    saveTimer = setTimeout(() => {
      saveNote()
    }, 2000)
  }
}, { deep: true })

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- No note selected -->
    <div v-if="!noteId" class="flex flex-col items-center justify-center h-full gap-4">
      <UIcon name="i-lucide-file-text" class="size-16 text-dimmed" />
      <p class="text-muted text-sm">Selecione ou crie uma nota para começar</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="p-6 space-y-4">
      <USkeleton class="h-8 w-2/3" />
      <USkeleton class="h-4 w-1/4" />
      <USkeleton class="h-64 w-full" />
    </div>

    <!-- Editor -->
    <div v-else-if="noteDetail" class="flex flex-col h-full">
      <!-- Toolbar -->
      <div class="flex items-center justify-between border-b border-default px-4 py-2">
        <div class="flex items-center gap-2">
          <UIcon :name="typeMeta.icon" :class="`text-${typeMeta.color}-500`" class="size-5" />
          <UBadge size="xs" :color="typeMeta.color" variant="subtle">
            {{ typeMeta.label }}
          </UBadge>
          <UBadge v-if="dirty" size="xs" color="warning" variant="subtle">
            <UIcon name="i-lucide-circle-dot" class="size-2.5 mr-0.5" />
            Não salvo
          </UBadge>
          <UBadge v-if="saving" size="xs" color="info" variant="subtle">
            <UIcon name="i-lucide-loader-2" class="size-2.5 mr-0.5 animate-spin" />
            Salvando...
          </UBadge>
        </div>
        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-save"
            label="Salvar"
            size="xs"
            :disabled="!dirty"
            :loading="saving"
            @click="saveNote"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            @click="onDelete"
          />
        </div>
      </div>

      <!-- Editor content area -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-6 py-4 space-y-4">
          <!-- Title -->
          <input
            v-model="editTitle"
            class="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder-muted text-highlighted"
            placeholder="Título da nota..."
          />

          <!-- Meta row -->
          <div class="flex flex-wrap items-center gap-2">
            <USelect
              v-model="editType"
              :items="noteTypeOptions"
              value-key="value"
              size="xs"
              class="w-32"
            />
            <USelect
              v-model="editTagIds"
              :items="tagOptions"
              value-key="value"
              multiple
              size="xs"
              placeholder="Tags..."
              class="min-w-40"
            />
            <span class="text-xs text-muted ml-auto">
              Atualizado {{ formatDate(noteDetail.updatedAt) }}
            </span>
          </div>

          <!-- Content editor -->
          <textarea
            v-model="editContent"
            class="w-full min-h-[400px] bg-transparent border-none resize-none outline-none text-sm leading-relaxed font-mono placeholder-muted text-default"
            placeholder="Escreva em Markdown...&#10;&#10;Use [[Nome da Nota]] para vincular notas&#10;Use #tag para categorizar"
          />
        </div>
      </div>

      <!-- Bottom panel: Links + Backlinks -->
      <div class="border-t border-default">
        <div class="max-w-4xl mx-auto px-6 py-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Outgoing Links -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-semibold text-muted uppercase tracking-wide">
                  <UIcon name="i-lucide-link" class="size-3 mr-1 inline" />
                  Vínculos ({{ noteDetail.links?.length ?? 0 }})
                </h4>
                <UButton
                  icon="i-lucide-plus"
                  size="xs"
                  variant="ghost"
                  @click="linkSearchOpen = !linkSearchOpen"
                />
              </div>

              <!-- Link search popup -->
              <div v-if="linkSearchOpen" class="mb-2 space-y-1">
                <UInput
                  v-model="linkSearchQuery"
                  icon="i-lucide-search"
                  placeholder="Buscar nota para vincular..."
                  size="xs"
                  autofocus
                />
                <div class="max-h-32 overflow-y-auto rounded-md border border-default">
                  <button
                    v-for="n in availableNotesForLink.slice(0, 10)"
                    :key="n.id"
                    class="w-full text-left px-2 py-1.5 text-xs hover:bg-elevated transition-colors truncate"
                    @click="addLink(n.id)"
                  >
                    {{ n.title }}
                  </button>
                  <p v-if="availableNotesForLink.length === 0" class="px-2 py-1.5 text-xs text-muted">
                    Nenhuma nota disponível
                  </p>
                </div>
              </div>

              <div v-if="noteDetail.links && noteDetail.links.length > 0" class="space-y-1">
                <div
                  v-for="link in noteDetail.links"
                  :key="link.id"
                  class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-elevated group"
                >
                  <button
                    class="truncate text-primary hover:underline"
                    @click="emit('navigate-note', link.targetNoteId)"
                  >
                    {{ link.targetNote?.title ?? 'Nota excluída' }}
                  </button>
                  <UButton
                    icon="i-lucide-x"
                    size="xs"
                    color="error"
                    variant="ghost"
                    class="opacity-0 group-hover:opacity-100"
                    @click="removeLink(link.id)"
                  />
                </div>
              </div>
              <p v-else class="text-xs text-muted">Sem vínculos</p>
            </div>

            <!-- Backlinks -->
            <div>
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                <UIcon name="i-lucide-corner-down-left" class="size-3 mr-1 inline" />
                Referenciado por ({{ noteDetail.backlinks?.length ?? 0 }})
              </h4>
              <div v-if="noteDetail.backlinks && noteDetail.backlinks.length > 0" class="space-y-1">
                <button
                  v-for="bl in noteDetail.backlinks"
                  :key="bl.id"
                  class="w-full text-left rounded px-2 py-1 text-xs text-primary hover:underline hover:bg-elevated truncate"
                  @click="emit('navigate-note', bl.sourceNoteId)"
                >
                  {{ bl.sourceNote?.title ?? 'Nota excluída' }}
                </button>
              </div>
              <p v-else class="text-xs text-muted">Nenhuma nota referencia esta</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
