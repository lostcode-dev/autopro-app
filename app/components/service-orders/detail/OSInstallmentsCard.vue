<script setup lang="ts">
import type { ServiceOrderInstallment } from "~/types/service-orders";
import { formatCurrency, formatDate } from "~/utils/service-orders";

const props = defineProps<{
  installments: ServiceOrderInstallment[];
  orderId: string;
  canUpdate?: boolean;
}>();

const emit = defineEmits<{ paid: [] }>();

const toast = useToast();

const installmentStatusColor: Record<string, string> = {
  paid: "success",
  pending: "warning",
  overdue: "error",
};

const installmentStatusLabel: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

const confirmingId = ref<string | null>(null);
const payingId = ref<string | null>(null);

function requestPay(id: string) {
  confirmingId.value = id;
}

async function confirmPay() {
  if (!confirmingId.value) return;
  const id = confirmingId.value;
  payingId.value = id;
  confirmingId.value = null;

  try {
    await $fetch(
      `/api/service-orders/${props.orderId}/installments/${id}/pay`,
      { method: "POST" },
    );
    toast.add({ title: "Parcela paga com sucesso", color: "success" });
    emit("paid");
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } };
    toast.add({
      title: "Erro ao pagar parcela",
      description: err?.data?.statusMessage || "Tente novamente.",
      color: "error",
    });
  } finally {
    payingId.value = null;
  }
}
</script>

<template>
  <UCard v-if="installments.length" variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-credit-card" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Parcelas ({{ installments.length }})
        </h3>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="installment in installments"
        :key="installment.id"
        class="rounded-lg border p-3"
        :class="
          installment.status === 'paid'
            ? 'border-success/30 bg-success/5'
            : installment.status === 'overdue'
              ? 'border-error/30 bg-error/5'
              : 'border-default bg-elevated'
        "
      >
        <div class="flex items-center justify-between gap-2">
          <UBadge
            :color="installmentStatusColor[installment.status] ?? 'neutral'"
            :label="
              installmentStatusLabel[installment.status] ?? installment.status
            "
            variant="soft"
            size="xs"
          />
          <span class="font-semibold text-highlighted">
            {{ formatCurrency(installment.amount) }}
          </span>
        </div>

        <div class="mt-2 grid grid-cols-2">
          <div class="space-y-1 text-xs text-muted">
            <p>Venc.: {{ formatDate(installment.due_date) }}</p>
            <p v-if="installment.payment_date">
              Pago: {{ formatDate(installment.payment_date) }}
            </p>
          </div>

          <div
            v-if="canUpdate && installment.status !== 'paid'"
            class="mt-3 flex items-center justify-end"
          >
            <UButton
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              label="Pagar"
              :loading="payingId === installment.id"
              :disabled="!!payingId"
              @click="requestPay(installment.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </UCard>

  <AppConfirmModal
    :open="!!confirmingId"
    title="Confirmar pagamento"
    confirm-label="Pagar parcela"
    confirm-color="success"
    @update:open="confirmingId = null"
    @confirm="confirmPay"
  >
    <template #description>
      <p class="text-sm text-muted">
        Deseja registrar o pagamento desta parcela? O saldo da conta bancária
        será atualizado.
      </p>
    </template>
  </AppConfirmModal>
</template>
