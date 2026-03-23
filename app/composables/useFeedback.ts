import type {
  Feedback,
  FeedbackListResponse,
  FeedbackResponse,
  CreateFeedbackPayload,
  CreateFeedbackResponsePayload,
  AdminUpdateFeedbackPayload,
  CreateEntityLinkPayload,
  FeedbackEntityLink
} from '~/types/feedback'

export function useFeedback() {
  const toast = useToast()

  // ─── User: List own feedbacks ─────────────────────────
  const listPage = ref(1)
  const listPageSize = ref(20)
  const listType = ref('')
  const listStatus = ref('')
  const listSearch = ref('')

  const debouncedListSearch = refDebounced(listSearch, 400)

  watch([listType, listStatus, debouncedListSearch], () => {
    if (listPage.value !== 1) listPage.value = 1
  })

  const listParams = computed(() => {
    const p: Record<string, string | number> = {
      page: listPage.value,
      pageSize: listPageSize.value
    }
    if (listType.value) p.type = listType.value
    if (listStatus.value) p.status = listStatus.value
    if (debouncedListSearch.value) p.search = debouncedListSearch.value
    return p
  })

  const {
    data: listData,
    status: listFetchStatus,
    refresh: refreshList
  } = useFetch<FeedbackListResponse>('/api/feedback', {
    params: listParams,
    lazy: true,
    server: false,
    watch: [listPage, listPageSize, listType, listStatus, debouncedListSearch]
  })

  // ─── User: Create feedback ───────────────────────────
  async function createFeedback(payload: CreateFeedbackPayload) {
    try {
      const result = await $fetch<Feedback>('/api/feedback', { method: 'POST', body: payload })
      toast.add({ title: 'Feedback enviado', description: 'Obrigado pelo seu feedback!', color: 'success' })
      await refreshList()
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── User: Get feedback detail ─────────────────────────
  async function fetchFeedback(id: string) {
    try {
      return await $fetch<Feedback>(`/api/feedback/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── User: Delete feedback ────────────────────────────
  async function deleteFeedback(id: string) {
    try {
      const endpoint: string = `/api/feedback/${id}`
      await $fetch(endpoint, { method: 'DELETE' })
      toast.add({ title: 'Feedback excluído', description: 'Feedback removido com sucesso.', color: 'success' })
      await refreshList()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── User: Add response ──────────────────────────────
  async function addResponse(feedbackId: string, payload: CreateFeedbackResponsePayload) {
    try {
      const result = await $fetch<FeedbackResponse>(`/api/feedback/${feedbackId}/responses`, { method: 'POST', body: payload })
      toast.add({ title: 'Resposta adicionada', description: 'Sua resposta foi enviada.', color: 'success' })
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── Admin: List all feedbacks ────────────────────────
  const adminPage = ref(1)
  const adminPageSize = ref(20)
  const adminType = ref('')
  const adminStatus = ref('')
  const adminPriority = ref('')
  const adminSearch = ref('')

  const debouncedAdminSearch = refDebounced(adminSearch, 400)

  watch([adminType, adminStatus, adminPriority, debouncedAdminSearch], () => {
    if (adminPage.value !== 1) adminPage.value = 1
  })

  const adminParams = computed(() => {
    const p: Record<string, string | number> = {
      page: adminPage.value,
      pageSize: adminPageSize.value
    }
    if (adminType.value) p.type = adminType.value
    if (adminStatus.value) p.status = adminStatus.value
    if (adminPriority.value) p.priority = adminPriority.value
    if (debouncedAdminSearch.value) p.search = debouncedAdminSearch.value
    return p
  })

  const {
    data: adminListData,
    status: adminListFetchStatus,
    refresh: refreshAdminList
  } = useFetch<FeedbackListResponse>('/api/feedback/admin', {
    params: adminParams,
    lazy: true,
    server: false,
    watch: [adminPage, adminPageSize, adminType, adminStatus, adminPriority, debouncedAdminSearch]
  })

  // ─── Admin: Update status/priority ────────────────────
  async function adminUpdateFeedback(id: string, payload: AdminUpdateFeedbackPayload) {
    try {
      const result = await $fetch<Feedback>(`/api/feedback/admin/${id}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Feedback atualizado', description: 'Status/prioridade atualizados.', color: 'success' })
      await refreshAdminList()
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── Admin: Link entity ──────────────────────────────
  async function adminLinkEntity(feedbackId: string, payload: CreateEntityLinkPayload) {
    try {
      const result = await $fetch<FeedbackEntityLink>(`/api/feedback/admin/${feedbackId}/link`, { method: 'POST', body: payload })
      toast.add({ title: 'Vínculo criado', description: 'Entidade vinculada ao feedback.', color: 'success' })
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── Admin: Unlink entity ────────────────────────────
  async function adminUnlinkEntity(feedbackId: string, linkId: string) {
    try {
      const endpoint: string = `/api/feedback/admin/${feedbackId}/link`
      await $fetch(endpoint, { method: 'DELETE', params: { linkId } })
      toast.add({ title: 'Vínculo removido', description: 'Entidade desvinculada.', color: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  return {
    // User
    listData,
    listFetchStatus,
    listPage,
    listPageSize,
    listType,
    listStatus,
    listSearch,
    refreshList,
    createFeedback,
    fetchFeedback,
    deleteFeedback,
    addResponse,
    // Admin
    adminListData,
    adminListFetchStatus,
    adminPage,
    adminPageSize,
    adminType,
    adminStatus,
    adminPriority,
    adminSearch,
    refreshAdminList,
    adminUpdateFeedback,
    adminLinkEntity,
    adminUnlinkEntity
  }
}
