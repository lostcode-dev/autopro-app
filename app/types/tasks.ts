// ─── Enums ────────────────────────────────────────────────────────────────────

export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Archived = 'archived'
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface TaskList {
  id: string
  userId: string
  name: string
  color: string | null
  createdAt: string
}

export interface Task {
  id: string
  userId: string
  listId: string | null
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  createdAt: string
  updatedAt: string
  // Populated via joins
  list?: TaskList | null
  subtasks?: TaskSubtask[]
  tags?: TaskTag[]
}

export interface TaskSubtask {
  id: string
  taskId: string
  title: string
  completed: boolean
  sortOrder: number
  createdAt: string
}

export interface TaskTag {
  id: string
  userId: string
  name: string
}

export interface TaskTagLink {
  taskId: string
  tagId: string
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface CreateTaskPayload {
  title: string
  description?: string
  priority?: TaskPriority
  listId?: string
  dueDate?: string
}

export interface UpdateTaskPayload {
  title?: string
  description?: string | null
  priority?: TaskPriority
  status?: TaskStatus
  listId?: string | null
  dueDate?: string | null
}

export interface CreateSubtaskPayload {
  title: string
}

export interface UpdateSubtaskPayload {
  title?: string
  completed?: boolean
}

export interface CreateTaskListPayload {
  name: string
  color?: string
}

export interface UpdateTaskListPayload {
  name?: string
  color?: string | null
}

export interface CreateTaskTagPayload {
  name: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface TaskListResponse {
  data: Task[]
  total: number
  page: number
  pageSize: number
}

export interface TaskInsights {
  totalTasks: number
  pendingTasks: number
  inProgressTasks: number
  completedTasks: number
  overdueTasks: number
  completionRate: number
  byPriority: TaskPriorityStat[]
  byList: TaskListStat[]
}

export interface TaskPriorityStat {
  priority: string
  label: string
  count: number
  completedCount: number
}

export interface TaskListStat {
  listId: string | null
  listName: string
  count: number
  completedCount: number
}
