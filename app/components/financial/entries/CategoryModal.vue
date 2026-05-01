<script setup lang="ts">
type CategoryCustom = { id: string; name: string; type: "income" | "expense" };

const props = defineProps<{
  open: boolean;
  currentType: "income" | "expense";
  customCategories: CategoryCustom[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  updated: [];
}>();

const toast = useToast();

const DEFAULT_CATEGORIES = [
  { name: "Vendas", type: "income" as const },
  { name: "Serviços", type: "income" as const },
  { name: "Outros", type: "income" as const },
  { name: "Aluguel", type: "expense" as const },
  { name: "Salários", type: "expense" as const },
  { name: "Fornecedores", type: "expense" as const },
  { name: "Impostos", type: "expense" as const },
  { name: "Marketing", type: "expense" as const },
  { name: "Outros", type: "expense" as const },
];

const activeType = ref<"income" | "expense">(props.currentType);
const newCategoryName = ref("");
const isCreating = ref(false);
const deletingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (open) {
      activeType.value = props.currentType;
      newCategoryName.value = "";
      confirmDeleteId.value = null;
    }
  },
);

const defaultsForType = computed(() =>
  DEFAULT_CATEGORIES.filter((c) => c.type === activeType.value),
);

const customForType = computed(() =>
  props.customCategories.filter((c) => c.type === activeType.value),
);

async function createCategory() {
  const name = newCategoryName.value.trim();
  if (!name) return;

  const alreadyExists = [
    ...DEFAULT_CATEGORIES.filter((c) => c.type === activeType.value),
    ...customForType.value,
  ].some((c) => c.name.toLowerCase() === name.toLowerCase());

  if (alreadyExists) {
    toast.add({ title: "Categoria já existe", color: "warning" });
    return;
  }

  isCreating.value = true;
  try {
    await $fetch("/api/financial/categories", {
      method: "POST",
      body: { name, type: activeType.value },
    });
    newCategoryName.value = "";
    toast.add({ title: "Categoria criada", color: "success" });
    emit("updated");
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string };
      statusMessage?: string;
    };
    toast.add({
      title: "Erro",
      description:
        err?.data?.statusMessage ||
        err?.statusMessage ||
        "Não foi possível criar",
      color: "error",
    });
  } finally {
    isCreating.value = false;
  }
}

async function deleteCategory(id: string) {
  deletingId.value = id;
  try {
    await $fetch(`/api/financial/categories/${id}`, { method: "DELETE" });
    confirmDeleteId.value = null;
    toast.add({ title: "Categoria removida", color: "success" });
    emit("updated");
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string };
      statusMessage?: string;
    };
    toast.add({
      title: "Erro",
      description:
        err?.data?.statusMessage ||
        err?.statusMessage ||
        "Não foi possível remover",
      color: "error",
    });
  } finally {
    deletingId.value = null;
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="Gerenciar Categorias"
    description="Crie categorias para entradas e consulte as categorias disponíveis."
    :ui="{ overlay: 'z-50', content: 'z-60' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Tipo toggle -->
        <div class="flex overflow-hidden rounded-lg border border-default">
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors focus:outline-none"
            :class="
              activeType === 'income'
                ? 'bg-success/10 text-success'
                : 'text-muted hover:bg-elevated'
            "
            @click="activeType = 'income'"
          >
            <UIcon name="i-lucide-trending-up" class="size-4" />
            Entrada
          </button>
          <div class="w-px bg-border" />
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors focus:outline-none"
            :class="
              activeType === 'expense'
                ? 'bg-error/10 text-error'
                : 'text-muted hover:bg-elevated'
            "
            @click="activeType = 'expense'"
          >
            <UIcon name="i-lucide-trending-down" class="size-4" />
            Saída
          </button>
        </div>

        <!-- Nova categoria -->
        <div>
          <p class="mb-1.5 text-sm font-medium">Nova categoria</p>
          <div class="flex gap-2">
            <UInput
              v-model="newCategoryName"
              class="flex-1"
              placeholder="Digite o nome da nova categoria"
              @keydown.enter.prevent="createCategory"
            />
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              :loading="isCreating"
              :disabled="!newCategoryName.trim()"
              @click="createCategory"
            />
          </div>
        </div>

        <!-- Categorias disponíveis -->
        <div>
          <p class="mb-2 text-sm font-medium">Categorias disponíveis</p>

          <div class="rounded-lg border border-default divide-y divide-default">
            <!-- Padrão -->
            <div class="p-3">
              <p
                class="mb-2 text-xs font-medium text-muted uppercase tracking-wide"
              >
                Padrão
              </p>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="cat in defaultsForType"
                  :key="cat.name"
                  color="neutral"
                  variant="outline"
                  :label="cat.name"
                />
              </div>
            </div>

            <!-- Personalizadas -->
            <div class="p-3">
              <p
                class="mb-2 text-xs font-medium text-muted uppercase tracking-wide"
              >
                Personalizadas
              </p>

              <div v-if="customForType.length === 0" class="text-sm text-muted">
                Nenhuma categoria
                {{
                  activeType === "income" ? "de entrada" : "de saída"
                }}
                personalizada.
              </div>

              <div v-else class="space-y-1">
                <div
                  v-for="cat in customForType"
                  :key="cat.id"
                  class="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-elevated group"
                >
                  <span class="text-sm">{{ cat.name }}</span>

                  <template v-if="confirmDeleteId === cat.id">
                    <div class="flex items-center gap-1">
                      <span class="text-xs text-muted">Confirmar?</span>
                      <UButton
                        size="xs"
                        color="error"
                        variant="ghost"
                        icon="i-lucide-check"
                        :loading="deletingId === cat.id"
                        @click="deleteCategory(cat.id)"
                      />
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-x"
                        @click="confirmDeleteId = null"
                      />
                    </div>
                  </template>
                  <template v-else>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      class="opacity-0 group-hover:opacity-100 transition-opacity"
                      @click="confirmDeleteId = cat.id"
                    />
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton
          label="Fechar"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>
