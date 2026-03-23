import { useDebounceFn } from '@vueuse/core'
import type {
  CreateIdeaListPayload,
  CreateIdeaPayload,
  CreateIdeaTagPayload,
  CreateSubtaskPayload,
  Idea,
  IdeaDetail,
  IdeaList,
  IdeaListResponse,
  IdeaTag,
  UpdateIdeaListPayload,
  UpdateIdeaPayload,
  UpdateSubtaskPayload
} from '~/types/ideas'
import {
  IDEA_PRIORITY_META,
  IDEA_STATUS_META,
  IdeaPriority,
  IdeaStatus
} from '~/types/ideas'

export function useIdeas() {
  const toast = useToast()

  // ─── Ideas list (paginated) ─────────────────────────────────────────────────
  const page = ref(1)
  const pageSize = ref(30)
  const searchQuery = ref('')
  const filters = reactive({
    status: '' as string,
    priority: '' as string,
    listId: '' as string,
    tagId: '' as string,
    sort: 'updated_at' as string,
    order: 'desc' as string
  })

  const queryParams = computed(() => {
    const params: Record<string, string | number> = {
      page: page.value,
      pageSize: pageSize.value,
      sort: filters.sort,
      order: filters.order
    }
    if (searchQuery.value) params.search = searchQuery.value
    if (filters.status) params.status = filters.status
    if (filters.priority) params.priority = filters.priority
    if (filters.listId) params.listId = filters.listId
    if (filters.tagId) params.tagId = filters.tagId
    return params
  })

  const {
    data: ideasData,
    status: ideasStatus,
    refresh: refreshIdeas
  } = useFetch<IdeaListResponse>('/api/ideas', {
    query: queryParams,
    lazy: true,
    default: () => ({ data: [], total: 0, page: 1, pageSize: 30 })
  })

  // Reset page on filter change
  watch([() => filters.status, () => filters.priority, () => filters.listId, () => filters.tagId, searchQuery], () => {
    page.value = 1
  })

  // ─── Lists ──────────────────────────────────────────────────────────────────
  const {
    data: lists,
    refresh: refreshLists
  } = useFetch<IdeaList[]>('/api/ideas/lists', {
    lazy: true,
    default: () => []
  })

  // ─── Tags ──────────────────────────────────────────────────────────────────
  const {
    data: tags,
    refresh: refreshTags
  } = useFetch<IdeaTag[]>('/api/ideas/tags', {
    lazy: true,
    default: () => []
  })

  // ─── CRUD: Ideas ───────────────────────────────────────────────────────────

  async function createIdea(payload: CreateIdeaPayload): Promise<Idea | null> {
    try {
      const idea = await $fetch<Idea>('/api/ideas', { method: 'POST', body: payload })
      toast.add({ title: 'Ideia criada', description: idea.title, color: 'success' })
      refreshIdeas()
      return idea
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar a ideia', color: 'error' })
      return null
    }
  }

  async function updateIdea(id: string, payload: UpdateIdeaPayload): Promise<Idea | null> {
    try {
      const idea = await $fetch<Idea>(`/api/ideas/${id}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Ideia atualizada', color: 'success' })
      refreshIdeas()
      return idea
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar a ideia', color: 'error' })
      return null
    }
  }

  async function deleteIdea(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/ideas/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Ideia excluída', color: 'success' })
      refreshIdeas()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível excluir a ideia', color: 'error' })
      return false
    }
  }

  async function fetchIdeaDetail(id: string): Promise<IdeaDetail | null> {
    try {
      return await $fetch<IdeaDetail>(`/api/ideas/${id}`)
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível buscar detalhes', color: 'error' })
      return null
    }
  }

  // ─── Quick status update ────────────────────────────────────────────────────

  async function updateIdeaStatus(id: string, status: IdeaStatus): Promise<boolean> {
    try {
      await $fetch(`/api/ideas/${id}`, { method: 'PUT', body: { status } })
      refreshIdeas()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar status', color: 'error' })
      return false
    }
  }

  // ─── CRUD: Subtasks ────────────────────────────────────────────────────────

  async function createSubtask(ideaId: string, payload: CreateSubtaskPayload): Promise<boolean> {
    try {
      const endpoint: string = `/api/ideas/${ideaId}/subtasks`
      await $fetch(endpoint, { method: 'POST', body: payload })
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar subtarefa', color: 'error' })
      return false
    }
  }

  async function updateSubtask(subtaskId: string, payload: UpdateSubtaskPayload): Promise<boolean> {
    try {
      await $fetch(`/api/ideas/subtasks/${subtaskId}`, { method: 'PUT', body: payload })
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar subtarefa', color: 'error' })
      return false
    }
  }

  async function deleteSubtask(subtaskId: string): Promise<boolean> {
    try {
      await $fetch(`/api/ideas/subtasks/${subtaskId}`, { method: 'DELETE' })
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível excluir subtarefa', color: 'error' })
      return false
    }
  }

  // ─── CRUD: Lists ───────────────────────────────────────────────────────────

  async function createList(payload: CreateIdeaListPayload): Promise<IdeaList | null> {
    try {
      const list = await $fetch<IdeaList>('/api/ideas/lists', { method: 'POST', body: payload })
      toast.add({ title: 'Lista criada', description: list.name, color: 'success' })
      refreshLists()
      return list
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar a lista', color: 'error' })
      return null
    }
  }

  async function updateList(id: string, payload: UpdateIdeaListPayload): Promise<boolean> {
    try {
      await $fetch(`/api/ideas/lists/${id}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Lista atualizada', color: 'success' })
      refreshLists()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar a lista', color: 'error' })
      return false
    }
  }

  async function deleteList(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/ideas/lists/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Lista excluída', color: 'success' })
      refreshLists()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível excluir a lista', color: 'error' })
      return false
    }
  }

  // ─── CRUD: Tags ─────────────────────────────────────────────────────────────

  async function createTag(payload: CreateIdeaTagPayload): Promise<IdeaTag | null> {
    try {
      const tag = await $fetch<IdeaTag>('/api/ideas/tags', { method: 'POST', body: payload })
      toast.add({ title: 'Tag criada', description: tag.name, color: 'success' })
      refreshTags()
      return tag
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar a tag', color: 'error' })
      return null
    }
  }

  async function deleteTag(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/ideas/tags/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Tag excluída', color: 'success' })
      refreshTags()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível excluir a tag', color: 'error' })
      return false
    }
  }

  // ─── Options for selects ────────────────────────────────────────────────────

  const statusOptions = Object.values(IdeaStatus).map(s => ({
    label: IDEA_STATUS_META[s].label,
    value: s,
    icon: IDEA_STATUS_META[s].icon
  }))

  const priorityOptions = Object.values(IdeaPriority).map(p => ({
    label: IDEA_PRIORITY_META[p].label,
    value: p,
    icon: IDEA_PRIORITY_META[p].icon
  }))

  const listOptions = computed(() =>
    (lists.value ?? []).map(l => ({ label: l.name, value: l.id }))
  )

  const tagOptions = computed(() =>
    (tags.value ?? []).map(t => ({ label: `#${t.name}`, value: t.id }))
  )

  // ─── Debounced search ───────────────────────────────────────────────────────

  const debouncedSetSearch = useDebounceFn((val: string) => {
    searchQuery.value = val
  }, 400)

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getStatusMeta(status: string) {
    return IDEA_STATUS_META[status as IdeaStatus] ?? IDEA_STATUS_META[IdeaStatus.Backlog]
  }

  function getPriorityMeta(priority: string | null) {
    if (!priority) return null
    return IDEA_PRIORITY_META[priority as IdeaPriority] ?? null
  }

  // ─── Return ─────────────────────────────────────────────────────────────────

  return {
    // Data
    ideasData,
    ideasStatus,
    lists,
    tags,
    page,
    pageSize,
    searchQuery,
    filters,

    // Refresh
    refreshIdeas,
    refreshLists,
    refreshTags,

    // Ideas CRUD
    createIdea,
    updateIdea,
    deleteIdea,
    fetchIdeaDetail,
    updateIdeaStatus,

    // Subtasks
    createSubtask,
    updateSubtask,
    deleteSubtask,

    // Lists CRUD
    createList,
    updateList,
    deleteList,

    // Tags CRUD
    createTag,
    deleteTag,

    // Options
    statusOptions,
    priorityOptions,
    listOptions,
    tagOptions,

    // Search
    debouncedSetSearch,

    // Helpers
    getStatusMeta,
    getPriorityMeta
  }
}
