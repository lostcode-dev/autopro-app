<script setup lang="ts">
import { DIFFICULTY_META, FREQUENCY_META } from '~/types/habits'

export type ShareFormat = 'square' | 'story' | 'landscape'

interface ShareHabitItem {
  name: string
  frequency: string
  difficulty: string
  streakCurrent: number
}

const props = defineProps<{
  format: ShareFormat
  userName?: string
  habits: ShareHabitItem[]
  completionRate7d: number
  completionRate30d: number
  totalHabits: number
  date: string
}>()

const formatSizes: Record<ShareFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: 'Instagram Feed' },
  story: { width: 1080, height: 1920, label: 'Instagram Story' },
  landscape: { width: 1200, height: 630, label: 'WhatsApp / X' },
}

const size = computed(() => formatSizes[props.format])

const maxHabits = computed(() => {
  if (props.format === 'story') return 10
  if (props.format === 'landscape') return 5
  return 7
})

const visibleHabits = computed(() => props.habits.slice(0, maxHabits.value))
const hasMore = computed(() => props.habits.length > maxHabits.value)

function getDifficultyLabel(d: string): string {
  return DIFFICULTY_META[d as keyof typeof DIFFICULTY_META]?.label ?? d
}

function getFrequencyLabel(f: string): string {
  return FREQUENCY_META[f as keyof typeof FREQUENCY_META]?.label ?? f
}

const formattedDate = computed(() => {
  const d = new Date(props.date + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
})

function rateColor(rate: number): string {
  if (rate >= 80) return '#22c55e'
  if (rate >= 50) return '#eab308'
  return '#ef4444'
}
</script>

<template>
  <div
    class="share-card"
    :style="{
      width: size.width + 'px',
      height: size.height + 'px',
    }"
  >
    <!-- Background pattern -->
    <div class="share-card__bg" />

    <!-- Content -->
    <div class="share-card__content">
      <!-- Header -->
      <div class="share-card__header">
        <div class="share-card__logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#6366f1" />
            <path d="M12 20C12 15.58 15.58 12 20 12s8 3.58 8 8-3.58 8-8 8-8-3.58-8-8z" stroke="#fff" stroke-width="2" fill="none" />
            <circle cx="20" cy="20" r="3" fill="#fff" />
          </svg>
          <span class="share-card__brand">Second Brain</span>
        </div>
        <p class="share-card__date">{{ formattedDate }}</p>
      </div>

      <!-- Title -->
      <div class="share-card__title-block">
        <h2 class="share-card__title">
          {{ userName ? `${userName} está` : 'Estou' }} construindo consistência
        </h2>
        <p class="share-card__subtitle">Progresso de hábitos</p>
      </div>

      <!-- Stats row -->
      <div class="share-card__stats">
        <div class="share-card__stat">
          <span class="share-card__stat-value" :style="{ color: rateColor(completionRate7d) }">
            {{ completionRate7d }}%
          </span>
          <span class="share-card__stat-label">últimos 7 dias</span>
        </div>
        <div class="share-card__stat-divider" />
        <div class="share-card__stat">
          <span class="share-card__stat-value" :style="{ color: rateColor(completionRate30d) }">
            {{ completionRate30d }}%
          </span>
          <span class="share-card__stat-label">últimos 30 dias</span>
        </div>
        <div class="share-card__stat-divider" />
        <div class="share-card__stat">
          <span class="share-card__stat-value">{{ totalHabits }}</span>
          <span class="share-card__stat-label">hábitos ativos</span>
        </div>
      </div>

      <!-- Habits list -->
      <div class="share-card__habits">
        <div
          v-for="(h, i) in visibleHabits"
          :key="i"
          class="share-card__habit"
        >
          <div class="share-card__habit-left">
            <span class="share-card__habit-index">{{ i + 1 }}</span>
            <span class="share-card__habit-name">{{ h.name }}</span>
          </div>
          <div class="share-card__habit-right">
            <span class="share-card__habit-tag">{{ getFrequencyLabel(h.frequency) }}</span>
            <span class="share-card__habit-tag">{{ getDifficultyLabel(h.difficulty) }}</span>
            <span v-if="h.streakCurrent > 0" class="share-card__habit-streak">
              🔥 {{ h.streakCurrent }}
            </span>
          </div>
        </div>
        <p v-if="hasMore" class="share-card__more">
          +{{ habits.length - maxHabits }} hábitos
        </p>
      </div>

      <!-- Footer -->
      <div class="share-card__footer">
        <p>Construa sistemas, não objetivos. — Atomic Habits</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-card {
  position: relative;
  overflow: hidden;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  color: #f1f5f9;
  background: linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
}

.share-card__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%);
  pointer-events: none;
}

.share-card__content {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 48px;
  box-sizing: border-box;
}

.share-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-card__logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.share-card__brand {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #e2e8f0;
}

.share-card__date {
  font-size: 16px;
  color: #94a3b8;
}

.share-card__title-block {
  text-align: center;
}

.share-card__title {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
  background: linear-gradient(135deg, #e2e8f0, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.share-card__subtitle {
  font-size: 18px;
  color: #94a3b8;
  margin-top: 8px;
}

.share-card__stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px 32px;
}

.share-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.share-card__stat-value {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #a78bfa;
}

.share-card__stat-label {
  font-size: 14px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.share-card__stat-divider {
  width: 1px;
  height: 48px;
  background: rgba(255, 255, 255, 0.1);
}

.share-card__habits {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  justify-content: center;
  min-height: 0;
}

.share-card__habit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.share-card__habit-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.share-card__habit-index {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.2);
  font-size: 13px;
  font-weight: 700;
  color: #a78bfa;
  flex-shrink: 0;
}

.share-card__habit-name {
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.share-card__habit-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.share-card__habit-tag {
  font-size: 12px;
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  color: #cbd5e1;
  text-transform: capitalize;
}

.share-card__habit-streak {
  font-size: 14px;
  font-weight: 700;
  color: #fb923c;
}

.share-card__more {
  text-align: center;
  font-size: 14px;
  color: #64748b;
  font-style: italic;
}

.share-card__footer {
  text-align: center;
  font-size: 14px;
  color: #64748b;
  font-style: italic;
}
</style>
