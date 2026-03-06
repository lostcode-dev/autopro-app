<script setup lang="ts">
definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Conhecimento'
})

const {
  notesData,
  notesStatus,
  tags,
  graphData,
  graphStatus,
  searchQuery,
  searchResults,
  searching,
  page,
  filters,
  refreshNotes,
  refreshGraph,
  noteTypeOptions
} = useKnowledge()

// ─── State ────────────────────────────────────────────────────────────────────

const selectedNoteId = ref<string | null>(null)
const activeView = ref<'editor' | 'graph'>('editor')
const createModalOpen = ref(false)
const sidebarTab = ref<'notes' | 'tags'>('notes')

// ─── Handlers ─────────────────────────────────────────────────────────────────

function onSelectNote(noteId: string): void {
  selectedNoteId.value = noteId
  activeView.value = 'editor'
}

function onNoteSaved(note: { id: string }): void {
  createModalOpen.value = false
  selectedNoteId.value = note.id
  activeView.value = 'editor'
}

function onNoteUpdated(): void {
  refreshNotes()
}

function onNoteDeleted(): void {
  selectedNoteId.value = null
  refreshNotes()
}

function onNavigateNote(noteId: string): void {
  selectedNoteId.value = noteId
  activeView.value = 'editor'
}

function onGraphSelectNote(noteId: string): void {
  selectedNoteId.value = noteId
  activeView.value = 'editor'
}

function switchToGraph(): void {
  activeView.value = 'graph'
  refreshGraph()
}
</script>

<template>
  <UDashboardPanel id="knowledge" class="!flex-row">
    <!-- Left sidebar: notes list + tags -->
    <div class="w-72 shrink-0 flex flex-col border-r border-default h-full">
      <!-- Sidebar header -->
      <div class="px-3 py-2 border-b border-default">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-highlighted">Conhecimento</h2>
          <div class="flex items-center gap-1">
            <UButton
              icon="i-lucide-plus"
              size="xs"
              @click="createModalOpen = true"
            />
            <UButton
              :icon="activeView === 'graph' ? 'i-lucide-file-text' : 'i-lucide-network'"
              size="xs"
              variant="ghost"
              :color="activeView === 'graph' ? 'primary' : 'neutral'"
              @click="activeView === 'graph' ? activeView = 'editor' : switchToGraph()"
            />
          </div>
        </div>

        <!-- Search -->
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Buscar notas..."
          size="xs"
          class="w-full"
        />
      </div>

      <!-- Sidebar tabs: Notes / Tags -->
      <div class="flex border-b border-default">
        <button
          class="flex-1 px-3 py-1.5 text-xs font-medium transition-colors"
          :class="sidebarTab === 'notes' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-default'"
          @click="sidebarTab = 'notes'"
        >
          Notas
        </button>
        <button
          class="flex-1 px-3 py-1.5 text-xs font-medium transition-colors"
          :class="sidebarTab === 'tags' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-default'"
          @click="sidebarTab = 'tags'"
        >
          Tags
        </button>
      </div>

      <!-- Sidebar content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Search results -->
        <div v-if="searchQuery && searchQuery.length >= 2" class="p-2">
          <div v-if="searching" class="space-y-2 p-2">
            <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
          </div>
          <div v-else-if="searchResults.length > 0" class="space-y-1">
            <button
              v-for="result in searchResults"
              :key="result.id"
              class="w-full text-left rounded px-2 py-2 hover:bg-elevated transition-colors"
              :class="selectedNoteId === result.id ? 'bg-elevated ring-1 ring-primary' : ''"
              @click="onSelectNote(result.id)"
            >
              <p class="text-sm font-medium text-highlighted truncate">{{ result.title }}</p>
              <p v-if="result.excerpt" class="text-xs text-muted truncate mt-0.5">{{ result.excerpt }}</p>
            </button>
          </div>
          <p v-else class="text-xs text-muted text-center py-4">Nenhum resultado</p>
        </div>

        <!-- Notes list -->
        <div v-else-if="sidebarTab === 'notes'">
          <KnowledgeNotesList
            :notes="notesData?.data ?? []"
            :total="notesData?.total ?? 0"
            :page="page"
            :loading="notesStatus === 'pending'"
            :selected-id="selectedNoteId"
            @select="onSelectNote"
            @create="createModalOpen = true"
            @update:page="page = $event"
            @deleted="onNoteDeleted"
          />
        </div>

        <!-- Tags -->
        <div v-else class="p-3">
          <KnowledgeTagManager />
        </div>
      </div>

      <!-- Filters (below notes tab) -->
      <div v-if="sidebarTab === 'notes' && !searchQuery" class="border-t border-default px-3 py-2">
        <div class="flex items-center gap-2">
          <USelect
            v-model="filters.type"
            :items="[{ label: 'Todos tipos', value: '' }, ...noteTypeOptions]"
            value-key="value"
            size="xs"
            class="flex-1"
          />
          <UButton
            :icon="filters.pinned ? 'i-lucide-pin' : 'i-lucide-pin-off'"
            size="xs"
            :variant="filters.pinned ? 'solid' : 'ghost'"
            :color="filters.pinned ? 'primary' : 'neutral'"
            @click="filters.pinned = filters.pinned ? '' : 'true'"
          />
        </div>
      </div>
    </div>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col h-full min-w-0">
      <!-- Top navbar -->
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
          <span class="ml-2 text-sm font-medium text-highlighted">
            {{ activeView === 'graph' ? 'Grafo de Conhecimento' : 'Editor' }}
          </span>
        </template>

        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>

      <!-- Content -->
      <div class="flex-1 overflow-hidden">
        <!-- Graph View -->
        <KnowledgeGraphView
          v-if="activeView === 'graph'"
          :graph-data="graphData"
          :loading="graphStatus === 'pending'"
          @select-note="onGraphSelectNote"
        />

        <!-- Note Editor -->
        <KnowledgeNoteEditor
          v-else
          :note-id="selectedNoteId"
          :tags="tags ?? []"
          @updated="onNoteUpdated"
          @deleted="onNoteDeleted"
          @navigate-note="onNavigateNote"
        />
      </div>
    </div>

    <!-- Create Modal -->
    <KnowledgeNoteCreateModal
      :open="createModalOpen"
      @update:open="createModalOpen = $event"
      @saved="onNoteSaved"
    />
  </UDashboardPanel>
</template>
