<script setup lang="ts">
import type {
  ServiceOrderDetailFull,
  ServiceOrderItem,
} from "~/types/service-orders";
import {
  formatCurrency,
  formatDate,
  formatPhone,
} from "~/utils/service-orders";

type OrganizationData = {
  name?: string | null;
  trade_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  address_zip_code?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
};

const props = defineProps<{
  open: boolean;
  orderId: string | null;
  quoteMode?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const toast = useToast();
const detail = ref<ServiceOrderDetailFull | null>(null);
const organization = ref<OrganizationData | null>(null);
const isLoading = ref(false);
const isDownloading = ref(false);
const paperRef = ref<HTMLElement | null>(null);

const workshopName = computed(
  () =>
    organization.value?.trade_name?.trim() ||
    organization.value?.name?.trim() ||
    "AutoPro",
);

const subtotal = computed(() =>
  (detail.value?.order.items ?? []).reduce(
    (total, item) => total + getItemTotal(item),
    0,
  ),
);

const totalAmount = computed(() =>
  Number(detail.value?.order.total_amount ?? 0),
);
const discountAmount = computed(() =>
  Number(detail.value?.order.discount ?? 0),
);

watch(
  () => props.open,
  (opened) => {
    if (opened) loadData();
    else {
      detail.value = null;
      organization.value = null;
    }
  },
);

async function loadData() {
  if (!props.orderId) return;

  isLoading.value = true;
  detail.value = null;

  try {
    const [detailResponse, organizationResponse] = await Promise.all([
      $fetch<{ data: ServiceOrderDetailFull }>(
        `/api/service-orders/${props.orderId}`,
      ),
      $fetch<OrganizationData>("/api/organizations"),
    ]);

    detail.value = detailResponse.data;
    organization.value = organizationResponse;
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string };
      statusMessage?: string;
    };
    toast.add({
      title: "Erro ao carregar orçamento",
      description:
        err?.data?.statusMessage || err?.statusMessage || "Tente novamente.",
      color: "error",
    });
    emit("update:open", false);
  } finally {
    isLoading.value = false;
  }
}

function close() {
  emit("update:open", false);
}

function getItemTotal(item: ServiceOrderItem) {
  return Number(item.total_price ?? item.total_amount ?? item.unit_price * item.quantity);
}

function getClientPhone() {
  return (
    detail.value?.client?.mobile_phone || detail.value?.client?.phone || null
  );
}

function formatTaxId(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }
  return value || "—";
}

function formatZipCode(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 8) {
    return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
  }
  return value || "—";
}

function sanitizeFileNamePart(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function downloadPdf() {
  if (!paperRef.value || !detail.value || isDownloading.value) return;

  isDownloading.value = true;

  try {
    const [{ toPng }, { PDFDocument }] = await Promise.all([
      import("html-to-image"),
      import("pdf-lib"),
    ]);

    const dataUrl = await toPng(paperRef.value, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const image = await pdf.embedPng(dataUrl);
    const imageWidth = image.width;
    const imageHeight = image.height;
    const margin = 24;
    const scale = Math.min(
      (page.getWidth() - margin * 2) / imageWidth,
      (page.getHeight() - margin * 2) / imageHeight,
    );
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const x = (page.getWidth() - width) / 2;
    const y = page.getHeight() - margin - height;

    page.drawImage(image, { x, y, width, height });

    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const clientPart =
      sanitizeFileNamePart(detail.value.client?.name) || "Cliente";
    const numberPart = sanitizeFileNamePart(detail.value.order.number) || "OS";
    const datePart = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `${clientPart}_${numberPart}_${datePart}.pdf`;
    link.click();
    URL.revokeObjectURL(url);

    toast.add({ title: "PDF gerado com sucesso", color: "success" });
  } catch {
    toast.add({
      title: "Erro ao gerar PDF",
      description: "Não foi possível gerar o documento do orçamento.",
      color: "error",
    });
  } finally {
    isDownloading.value = false;
  }
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{
      overlay: 'bg-default/92 backdrop-blur-sm',
      content:
        'sm:max-h-[100dvh] max-h-[100dvh] m-0 max-w-none w-screen h-dvh rounded-none flex flex-col overflow-hidden',
      header: 'p-0 border-b border-default shrink-0',
      body: 'flex-1 min-h-0 overflow-y-auto p-0 bg-[linear-gradient(180deg,rgba(var(--ui-bg),1),rgba(var(--ui-bg-elevated),0.92))]',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div
        class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-6 lg:py-5 w-full justify-between"
      >
        <div class="min-w-0 space-y-3">
          <div class="space-y-1.5">
            <p
              class="font-semibold uppercase tracking-[0.22em] text-primary/80"
            >
              {{ quoteMode !== false ? "Visualização do Orçamento" : "Visualização da OS" }}
            </p>
            <div
              class="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between"
            >
              <div class="min-w-0">
                <h1
                  class="truncate text-xl font-bold text-highlighted lg:text-2xl"
                >
                  {{
                    detail?.order.number
                      ? `OS #${detail.order.number}`
                      : (quoteMode !== false ? "Orçamento de serviços" : "Ordem de Serviço")
                  }}
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-start justify-end">
          <div
            class="flex w-full max-w-[280px] items-center justify-end gap-2 rounded-2xl p-2 lg:w-auto"
          >
            <UButton
              label="Baixar PDF"
              icon="i-lucide-download"
              color="primary"
              size="sm"
              class="flex-1 lg:flex-none"
              :loading="isDownloading"
              :disabled="isLoading || !detail"
              @click="downloadPdf"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              square
              @click="close"
            />
          </div>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="isLoading" class="space-y-4 p-6 lg:p-8">
        <USkeleton
          class="mx-auto h-[1120px] w-full max-w-[860px] rounded-[32px]"
        />
      </div>

      <div v-else-if="detail" class="px-4 py-6 lg:px-8 lg:py-8">
        <div class="mx-auto max-w-[900px]">
          <article
            ref="paperRef"
            class="mx-auto overflow-hidden rounded-[32px] border border-slate-200 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.14)]"
          >
            <div
              class="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] px-8 py-7 lg:px-10"
            >
              <div class="flex items-center gap-4">
                <div
                  class="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-white shadow-lg"
                >
                  <img
                    v-if="organization?.logo_url"
                    :src="organization.logo_url"
                    alt="Logo da oficina"
                    class="h-full w-full object-contain"
                  />
                  <UIcon v-else name="i-lucide-wrench" class="size-8" />
                </div>

                <div class="min-w-0 flex-1">
                  <h2
                    class="mt-1 text-3xl font-black tracking-tight text-slate-950"
                  >
                    {{ workshopName }}
                  </h2>
                </div>
              </div>
            </div>

            <div class="space-y-4 px-8 py-8 lg:px-10 lg:py-10">
              <div class="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <section class="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3
                      class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500"
                    >
                      Dados da Ordem
                    </h3>
                    <div class="mt-3 space-y-2 text-sm text-slate-700">
                      <p>
                        <span class="font-semibold text-slate-950">OS Nº:</span>
                        {{ detail.order.number ?? "—" }}
                      </p>
                      <p>
                        <span class="font-semibold text-slate-950">Data:</span>
                        {{ formatDate(detail.order.entry_date) }}
                      </p>
                      <p>
                        <span class="font-semibold text-slate-950"
                          >Previsão:</span
                        >
                        {{ formatDate(detail.order.expected_date) }}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3
                      class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500"
                    >
                      Cliente
                    </h3>
                    <div class="mt-3 space-y-2 text-sm text-slate-700">
                      <p>
                        <span class="font-semibold text-slate-950">Nome:</span>
                        {{ detail.client?.name ?? "—" }}
                      </p>
                      <p>
                        <span class="font-semibold text-slate-950"
                          >Telefone:</span
                        >
                        {{ formatPhone(getClientPhone()) }}
                      </p>
                      <p v-if="detail.client?.email">
                        <span class="font-semibold text-slate-950">Email:</span>
                        {{ detail.client.email }}
                      </p>
                    </div>
                  </div>
                </section>

                <section
                  class="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 text-right"
                >
                  <h3
                    class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Dados da Empresa
                  </h3>
                  <div class="mt-3 space-y-2 text-sm text-slate-700">
                    <p v-if="organization?.tax_id">
                      <span class="font-semibold text-slate-950"
                        >CNPJ/CPF:</span
                      >
                      {{ formatTaxId(organization.tax_id) }}
                    </p>
                    <p v-if="organization?.phone">
                      <span class="font-semibold text-slate-950"
                        >Telefone:</span
                      >
                      {{ formatPhone(organization.phone) }}
                    </p>
                    <p v-if="organization?.mobile_phone">
                      <span class="font-semibold text-slate-950"
                        >WhatsApp:</span
                      >
                      {{ formatPhone(organization.mobile_phone) }}
                    </p>
                    <p v-if="organization?.email">
                      <span class="font-semibold text-slate-950">Email:</span>
                      {{ organization.email }}
                    </p>
                    <p v-if="organization?.website">
                      <span class="font-semibold text-slate-950">Site:</span>
                      {{ organization.website }}
                    </p>
                    <div
                      v-if="
                        organization?.address_street ||
                        organization?.address_city
                      "
                      class="pt-1 leading-relaxed"
                    >
                      <p v-if="organization?.address_street">
                        {{ organization.address_street
                        }}{{
                          organization.address_number
                            ? `, ${organization.address_number}`
                            : ""
                        }}
                      </p>
                      <p v-if="organization?.address_neighborhood">
                        {{ organization.address_neighborhood }}
                      </p>
                      <p
                        v-if="
                          organization?.address_city ||
                          organization?.address_state
                        "
                      >
                        {{ organization?.address_city ?? ""
                        }}{{
                          organization?.address_state
                            ? ` - ${organization.address_state}`
                            : ""
                        }}
                      </p>
                      <p v-if="organization?.address_zip_code">
                        CEP: {{ formatZipCode(organization.address_zip_code) }}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <div
                v-if="quoteMode !== false"
                class="rounded-[24px] border border-slate-200 bg-slate-50 px-6 py-4 text-center"
              >
                <p class="text-lg font-black tracking-[0.18em] text-slate-950">
                  ORÇAMENTO DE SERVIÇOS
                </p>
              </div>

              <section v-if="detail.vehicle" class="space-y-3">
                <h3
                  class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500"
                >
                  Veículo
                </h3>
                <div
                  class="grid gap-3 rounded-[24px] border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4 p-5"
                >
                  <p class="text-sm text-slate-700">
                    <span class="font-semibold text-slate-950"
                      >Marca/Modelo:</span
                    >
                    {{ detail.vehicle.brand }} {{ detail.vehicle.model }}
                  </p>
                  <p class="text-sm text-slate-700">
                    <span class="font-semibold text-slate-950">Placa:</span>
                    {{ detail.vehicle.license_plate ?? "—" }}
                  </p>
                  <p class="text-sm text-slate-700">
                    <span class="font-semibold text-slate-950">Ano:</span>
                    {{ detail.vehicle.year ?? "—" }}
                  </p>
                  <p class="text-sm text-slate-700">
                    <span class="font-semibold text-slate-950"
                      >Combustível:</span
                    >
                    {{ detail.vehicle.fuel_type ?? "—" }}
                  </p>
                </div>
              </section>

              <section
                v-if="detail.masterProduct"
                class="rounded-[24px] border border-violet-200 bg-violet-50/70 p-5"
              >
                <h3
                  class="text-sm font-bold uppercase tracking-[0.2em] text-violet-700"
                >
                  Produto Master
                </h3>
                <div class="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span class="font-semibold text-slate-950">Nome:</span>
                    {{ detail.masterProduct.name }}
                  </p>
                  <p v-if="detail.masterProduct.description">
                    <span class="font-semibold text-slate-950">Descrição:</span>
                    {{ detail.masterProduct.description }}
                  </p>
                  <p v-if="detail.masterProduct.notes">
                    <span class="font-semibold text-slate-950"
                      >Observações:</span
                    >
                    {{ detail.masterProduct.notes }}
                  </p>
                </div>
              </section>

              <section
                class="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5"
              >
                <h3
                  class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500"
                >
                  Problema Relatado
                </h3>
                <p class="mt-3 text-sm leading-relaxed text-slate-700">
                  {{ detail.order.reported_defect || "Não informado" }}
                </p>
              </section>

              <section class="space-y-3">
                <h3
                  class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500"
                >
                  Serviços e Produtos
                </h3>
                <div
                  class="overflow-hidden rounded-[24px] border border-slate-200"
                >
                  <table class="min-w-full divide-y divide-slate-200">
                    <thead class="bg-slate-50">
                      <tr>
                        <th
                          class="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                        >
                          Descrição
                        </th>
                        <th
                          class="px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                        >
                          Qtd
                        </th>
                        <th
                          class="px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                        >
                          Valor Unit.
                        </th>
                        <th
                          class="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                        >
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 bg-white">
                      <tr
                        v-for="(item, index) in detail.order.items ?? []"
                        :key="`${index}-${item.name ?? item.description ?? 'item'}`"
                      >
                        <td class="px-4 py-3 text-sm text-slate-700">
                          {{ item.description || item.name || "—" }}
                        </td>
                        <td
                          class="px-4 py-3 text-center text-sm text-slate-700"
                        >
                          {{ item.quantity }}
                        </td>
                        <td
                          class="px-4 py-3 text-center text-sm text-slate-700"
                        >
                          {{ formatCurrency(item.unit_price) }}
                        </td>
                        <td
                          class="px-4 py-3 text-right text-sm font-semibold text-slate-950"
                        >
                          {{ formatCurrency(getItemTotal(item)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <div class="flex justify-end">
                <div
                  class="w-full max-w-[320px] rounded-[24px] border border-slate-200 bg-slate-50/80 p-5"
                >
                  <div
                    class="flex items-center justify-between py-2 text-sm text-slate-700"
                  >
                    <span>Subtotal</span>
                    <span class="font-semibold text-slate-950">{{
                      formatCurrency(subtotal)
                    }}</span>
                  </div>
                  <div
                    v-if="discountAmount > 0"
                    class="flex items-center justify-between py-2 text-sm text-rose-600"
                  >
                    <span>Desconto</span>
                    <span class="font-semibold"
                      >- {{ formatCurrency(discountAmount) }}</span
                    >
                  </div>
                  <div
                    class="mt-2 flex items-center justify-between border-t-2 border-slate-200 pt-4 text-base font-bold text-slate-950"
                  >
                    <span>TOTAL</span>
                    <span class="text-xl text-emerald-600">{{
                      formatCurrency(totalAmount)
                    }}</span>
                  </div>
                </div>
              </div>

              <footer class="border-t border-slate-200 pt-6 text-center">
                <p v-if="quoteMode !== false" class="text-sm font-medium text-slate-600">
                  Este orçamento tem validade de 30 dias.
                </p>
                <p class="mt-1 text-sm text-slate-500">
                  {{ workshopName }} - Sistema de Gestão
                </p>
              </footer>
            </div>
          </article>
        </div>
      </div>
    </template>
  </UModal>
</template>
