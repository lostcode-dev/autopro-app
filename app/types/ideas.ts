// ═══════════════════════════════════════════════════════════════════════════════
// Ideas Module — Types
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum IdeaStatus {
  Backlog = 'backlog',
  Todo = 'todo',
  InProgress = 'in_progress',
  Done = 'done',
  Archived = 'archived'
}

export enum IdeaPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}

// ─── Meta mappings ────────────────────────────────────────────────────────────

export const IDEA_STATUS_META: Record<IdeaStatus, { label: string, icon: string, color: string }> = {
  [IdeaStatus.Backlog]: { label: 'Backlog', icon: 'i-lucide-inbox', color: 'neutral' },
  [IdeaStatus.Todo]: { label: 'A fazer', icon: 'i-lucide-circle', color: 'info' },
  [IdeaStatus.InProgress]: { label: 'Em progresso', icon: 'i-lucide-loader-2', color: 'warning' },
  [IdeaStatus.Done]: { label: 'Concluída', icon: 'i-lucide-check-circle', color: 'success' },
  [IdeaStatus.Archived]: { label: 'Arquivada', icon: 'i-lucide-archive', color: 'neutral' }
}

export const IDEA_PRIORITY_META: Record<IdeaPriority, { label: string, icon: string, color: string }> = {
  [IdeaPriority.Low]: { label: 'Baixa', icon: 'i-lucide-arrow-down', color: 'neutral' },
  [IdeaPriority.Medium]: { label: 'Média', icon: 'i-lucide-minus', color: 'info' },
  [IdeaPriority.High]: { label: 'Alta', icon: 'i-lucide-arrow-up', color: 'warning' },
  [IdeaPriority.Critical]: { label: 'Crítica', icon: 'i-lucide-alert-triangle', color: 'error' }
}

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface IdeaList {
  id: string
  userId: string
  name: string
  color: string | null
  createdAt: string
  ideaCount?: number
}

export interface IdeaTag {
  id: string
  userId: string
  name: string
  createdAt: string
}

export interface IdeaSubtask {
  id: string
  ideaId: string
  title: string
  completed: boolean
  position: number
  createdAt: string
}

export interface Idea {
  id: string
  userId: string
  listId: string | null
  title: string
  description: string | null
  priority: IdeaPriority | null
  status: IdeaStatus
  dueDate: string | null
  createdAt: string
  updatedAt: string
  // Joined
  list?: IdeaList | null
  tags?: IdeaTag[]
  subtasks?: IdeaSubtask[]
  subtaskCount?: number
  subtaskDoneCount?: number
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateIdeaPayload {
  title: string
  description?: string
  priority?: IdeaPriority
  status?: IdeaStatus
  listId?: string
  dueDate?: string
  tagIds?: string[]
}

export interface UpdateIdeaPayload {
  title?: string
  description?: string
  priority?: IdeaPriority | null
  status?: IdeaStatus
  listId?: string | null
  dueDate?: string | null
  tagIds?: string[]
}

export interface CreateIdeaListPayload {
  name: string
  color?: string
}

export interface UpdateIdeaListPayload {
  name?: string
  color?: string | null
}

export interface CreateSubtaskPayload {
  title: string
}

export interface UpdateSubtaskPayload {
  title?: string
  completed?: boolean
  position?: number
}

export interface CreateIdeaTagPayload {
  name: string
}

// ─── Responses ────────────────────────────────────────────────────────────────

export interface IdeaListResponse {
  data: Idea[]
  total: number
  page: number
  pageSize: number
}

export interface IdeaDetail extends Idea {
  tags: IdeaTag[]
  subtasks: IdeaSubtask[]
}
