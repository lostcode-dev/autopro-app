// ─── Enums ────────────────────────────────────────────────────────────────────

export enum HabitFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Custom = 'custom'
}

export enum HabitDifficulty {
  Tiny = 'tiny',
  Normal = 'normal',
  Hard = 'hard'
}

export enum HabitType {
  Positive = 'positive',
  Negative = 'negative'
}

export enum CueType {
  Time = 'time',
  Location = 'location',
  PreviousHabit = 'previous_habit',
  Emotion = 'emotion'
}

export enum RewardType {
  Points = 'points',
  Badge = 'badge',
  Unlockable = 'unlockable'
}

// ─── Icon & Color Mappings ────────────────────────────────────────────────────

export const DIFFICULTY_META: Record<HabitDifficulty, { label: string; icon: string; color: 'success' | 'warning' | 'error' }> = {
  [HabitDifficulty.Tiny]: { label: 'Pequeno', icon: 'i-lucide-feather', color: 'success' },
  [HabitDifficulty.Normal]: { label: 'Normal', icon: 'i-lucide-shield', color: 'warning' },
  [HabitDifficulty.Hard]: { label: 'Difícil', icon: 'i-lucide-mountain', color: 'error' }
}

export const FREQUENCY_META: Record<HabitFrequency, { label: string; icon: string }> = {
  [HabitFrequency.Daily]: { label: 'Diário', icon: 'i-lucide-calendar-days' },
  [HabitFrequency.Weekly]: { label: 'Semanal', icon: 'i-lucide-calendar-range' },
  [HabitFrequency.Custom]: { label: 'Personalizado', icon: 'i-lucide-calendar-cog' }
}

export const HABIT_TYPE_META: Record<HabitType, { label: string; icon: string; color: 'success' | 'error' }> = {
  [HabitType.Positive]: { label: 'Positivo', icon: 'i-lucide-thumbs-up', color: 'success' },
  [HabitType.Negative]: { label: 'Negativo', icon: 'i-lucide-thumbs-down', color: 'error' }
}

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface Identity {
  id: string
  userId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface Habit {
  id: string
  userId: string
  identityId: string | null
  name: string
  description: string | null
  frequency: HabitFrequency
  difficulty: HabitDifficulty
  habitType: HabitType
  customDays: number[] | null
  sortOrder: number
  timezone: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  // Populated via joins
  identity?: Identity | null
  streak?: HabitStreak | null
}

export interface HabitChangeHistory {
  id: string
  habitId: string
  userId: string
  field: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface HabitCue {
  id: string
  userId: string
  type: CueType
  timeOfDay: string | null
  location: string | null
  previousHabitId: string | null
  description: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface HabitReward {
  id: string
  userId: string
  type: RewardType
  points: number | null
  badgeKey: string | null
  unlockKey: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface HabitSettings {
  habitId: string
  cueId: string | null
  rewardId: string | null
  updatedAt: string
  cue?: HabitCue | null
  reward?: HabitReward | null
}

export interface HabitStack {
  id: string
  userId: string
  triggerHabitId: string
  newHabitId: string
  createdAt: string
  archivedAt: string | null
  triggerHabit?: Habit | null
  newHabit?: Habit | null
}

export interface HabitLog {
  id: string
  userId: string
  habitId: string
  logDate: string
  completed: boolean
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface HabitStreak {
  habitId: string
  userId: string
  currentStreak: number
  longestStreak: number
  lastCompletedDate: string | null
  updatedAt: string
}

export interface HabitReflection {
  id: string
  userId: string
  weekKey: string
  wins: string | null
  improvements: string | null
  createdAt: string
  updatedAt: string
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface CreateHabitPayload {
  name: string
  description?: string
  frequency: HabitFrequency
  difficulty: HabitDifficulty
  habitType?: HabitType
  identityId?: string
  customDays?: number[]
}

export interface UpdateHabitPayload {
  name?: string
  description?: string
  frequency?: HabitFrequency
  difficulty?: HabitDifficulty
  habitType?: HabitType
  identityId?: string | null
  customDays?: number[]
  sortOrder?: number
}

export interface LogHabitPayload {
  habitId: string
  logDate: string
  completed: boolean
  note?: string
}

export interface CreateIdentityPayload {
  name: string
  description?: string
}

export interface CreateReflectionPayload {
  weekKey: string
  wins?: string
  improvements?: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface HabitListResponse {
  data: Habit[]
  total: number
  page: number
  pageSize: number
}

export interface TodayHabit extends Habit {
  log?: HabitLog | null
}

export interface TodayHabitsResponse {
  habits: TodayHabit[]
  completedCount: number
  totalCount: number
}

export interface HabitInsights {
  completionRate7d: number
  completionRate30d: number
  averageStreak: number
  bestDay: string | null
  identityProgress: IdentityProgress[]
}

export interface IdentityProgress {
  identity: Identity
  score: number
  totalHabits: number
  completedLogs: number
  scheduledLogs: number
}

export interface CalendarDay {
  date: string
  completed: boolean
  note: string | null
}
