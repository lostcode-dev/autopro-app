export type PermissionMap = Record<string, boolean>

export type WorkshopEntity = Record<string, any>

export type WorkshopAction = {
  id: string
  code: string
  name?: string | null
  description?: string | null
  resource?: string | null
  action_type?: string | null
} & WorkshopEntity

export type WorkshopRoleAction = {
  id: string
  role_id: string
  action_id: string
} & WorkshopEntity

export type WorkshopBootstrapResponse = {
  currentUser: WorkshopEntity | null
  userRole: WorkshopEntity | null
  organization: WorkshopEntity | null
  employee: WorkshopEntity | null
  roles: WorkshopEntity[]
  actions: WorkshopAction[]
  roleActions: WorkshopRoleAction[]
  permissions: PermissionMap
  organizationId: string | null
  isAdmin: boolean
  terminated: boolean
  termination_date: string | null
  termination_reason: string | null
  user: WorkshopEntity | null
  role: WorkshopEntity | null
}
