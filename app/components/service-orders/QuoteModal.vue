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
const printRef = ref<HTMLElement | null>(null);

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

const groupedItems = computed(() => {
  const items = detail.value?.order.items ?? [];
  const groups = new Map<string, ServiceOrderItem[]>();
  for (const item of items) {
    const cat = item.category_name?.trim() || "Serviços e Peças";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    items,
  }));
});

const flatPrintRows = computed(() => {
  const rows: { isCategory: boolean, label: string, item?: ServiceOrderItem }[] = []
  for (const group of groupedItems.value) {
    rows.push({ isCategory: true, label: group.category })
    for (const item of group.items) {
      rows.push({ isCategory: false, label: '', item })
    }
  }
  return rows
})

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
  if (!printRef.value || !detail.value || isDownloading.value) return;

  isDownloading.value = true;

  try {
    const [{ toPng }, { PDFDocument }] = await Promise.all([
      import("html-to-image"),
      import("pdf-lib"),
    ]);

    const dataUrl = await toPng(printRef.value, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });

    const pdf = await PDFDocument.create();
    const image = await pdf.embedPng(dataUrl);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 24;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    // Scale image to fit page width exactly; height grows naturally
    const scale = usableWidth / image.width;
    const scaledWidth = usableWidth;
    const scaledHeight = image.height * scale;

    const numPages = Math.ceil(scaledHeight / usableHeight);

    for (let i = 0; i < numPages; i++) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      // Shift image upward so each page reveals the next vertical slice
      const imageY = pageHeight - margin - scaledHeight + i * usableHeight;
      page.drawImage(image, {
        x: margin,
        y: imageY,
        width: scaledWidth,
        height: scaledHeight,
      });
    }

    const bytes = await pdf.save();
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/pdf' })
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
                      <template
                        v-for="group in groupedItems"
                        :key="group.category"
                      >
                        <tr class="bg-slate-100/80">
                          <td
                            colspan="4"
                            class="px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                          >
                            {{ group.category }}
                          </td>
                        </tr>
                        <tr
                          v-for="(item, index) in group.items"
                          :key="`${group.category}-${index}`"
                        >
                          <td class="px-4 py-2 text-sm text-slate-700">
                            {{ item.description || item.name || "—" }}
                          </td>
                          <td class="px-4 py-2 text-center text-sm text-slate-700">
                            {{ item.quantity }}
                          </td>
                          <td class="px-4 py-2 text-center text-sm text-slate-700">
                            {{ formatCurrency(item.unit_price) }}
                          </td>
                          <td class="px-4 py-2 text-right text-sm font-semibold text-slate-950">
                            {{ formatCurrency(getItemTotal(item)) }}
                          </td>
                        </tr>
                      </template>
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

  <!-- Hidden document-style template captured for PDF export -->
  <div
    v-if="detail"
    ref="printRef"
    style="position: absolute; top: -9999px; left: 0; width: 800px; background: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; padding: 36px 40px; box-sizing: border-box;"
  >
    <!-- Header -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
        <img
          v-if="organization?.logo_url"
          :src="organization.logo_url"
          alt="Logo"
          style="max-height: 40px; max-width: 160px; width: auto; height: auto; object-fit: contain; display: block; flex-shrink: 0;"
        />
        <div v-else style="height: 40px; width: 40px; background: #111; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: #fff; font-size: 18px; font-weight: 700;">{{ workshopName.charAt(0) }}</span>
        </div>
        <div style="min-width: 0;">
          <div style="font-size: 15px; font-weight: 800; letter-spacing: -0.2px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ workshopName }}</div>
          <div style="font-size: 10px; color: #555; margin-top: 1px; white-space: nowrap;">
            <span v-if="organization?.tax_id">{{ formatTaxId(organization.tax_id) }}</span>
            <span v-if="organization?.tax_id && (organization?.phone || organization?.email)"> · </span>
            <span v-if="organization?.phone">{{ formatPhone(organization.phone) }}</span>
            <span v-if="organization?.phone && organization?.email"> · </span>
            <span v-if="organization?.email">{{ organization.email }}</span>
          </div>
          <div v-if="organization?.address_city" style="font-size: 10px; color: #777; margin-top: 1px;">
            {{ organization.address_city }}{{ organization.address_state ? ` - ${organization.address_state}` : '' }}
          </div>
        </div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <div style="font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">
          {{ quoteMode !== false ? 'Orçamento' : 'Ordem de Serviço' }}
        </div>
        <div style="font-size: 11px; color: #333; margin-top: 2px;">Nº <strong>{{ detail.order.number ?? '—' }}</strong></div>
        <div style="font-size: 11px; color: #555; margin-top: 1px;">{{ formatDate(detail.order.entry_date) }}{{ detail.order.expected_date ? ` · Prev: ${formatDate(detail.order.expected_date)}` : '' }}</div>
      </div>
    </div>

    <!-- Client + Vehicle -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ccc; margin-bottom: 12px;">
      <div style="padding: 10px 14px; border-right: 1px solid #ccc;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 6px;">Cliente</div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 3px;">{{ detail.client?.name ?? '—' }}</div>
        <div v-if="getClientPhone()" style="font-size: 12px; color: #444;">{{ formatPhone(getClientPhone()) }}</div>
        <div v-if="detail.client?.email" style="font-size: 12px; color: #444;">{{ detail.client.email }}</div>
      </div>
      <div style="padding: 10px 14px;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 6px;">Veículo</div>
        <div v-if="detail.vehicle">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 3px;">{{ detail.vehicle.brand }} {{ detail.vehicle.model }}</div>
          <div style="font-size: 12px; color: #444;">
            Placa: {{ detail.vehicle.license_plate ?? '—' }}<span v-if="detail.vehicle.year"> · Ano: {{ detail.vehicle.year }}</span>
          </div>
          <div v-if="detail.vehicle.fuel_type" style="font-size: 12px; color: #444;">Combustível: {{ detail.vehicle.fuel_type }}</div>
        </div>
        <div v-else style="font-size: 12px; color: #888;">Não informado</div>
      </div>
    </div>

    <!-- Reported defect -->
    <div v-if="detail.order.reported_defect" style="border: 1px solid #ccc; padding: 10px 14px; margin-bottom: 12px;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 5px;">Problema Relatado</div>
      <div style="font-size: 12px; line-height: 1.5; color: #333;">{{ detail.order.reported_defect }}</div>
    </div>

    <!-- Items table -->
    <div style="margin-bottom: 12px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #111;">
            <th style="padding: 5px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff;">Descrição</th>
            <th style="padding: 5px 8px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; width: 44px;">Qtd</th>
            <th style="padding: 5px 8px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; width: 100px;">Val. Unit.</th>
            <th style="padding: 5px 8px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; width: 100px;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in flatPrintRows" :key="idx">
            <td
              v-if="row.isCategory"
              colspan="4"
              style="background: #e8e8e8; padding: 4px 8px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #444;"
            >
              {{ row.label }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; font-size: 11px; color: #333;"
            >
              {{ row.item?.description || row.item?.name || '—' }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; text-align: center; font-size: 11px; color: #333;"
            >
              {{ row.item?.quantity }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; text-align: right; font-size: 11px; color: #333;"
            >
              {{ row.item ? formatCurrency(row.item.unit_price) : '' }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; text-align: right; font-size: 11px; font-weight: 600; color: #111;"
            >
              {{ row.item ? formatCurrency(getItemTotal(row.item)) : '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
      <div style="width: 260px; border: 1px solid #ccc;">
        <div style="display: flex; justify-content: space-between; padding: 6px 12px; font-size: 12px; border-bottom: 1px solid #e5e5e5;">
          <span style="color: #555;">Subtotal</span>
          <span style="font-weight: 600;">{{ formatCurrency(subtotal) }}</span>
        </div>
        <div v-if="discountAmount > 0" style="display: flex; justify-content: space-between; padding: 6px 12px; font-size: 12px; color: #b00; border-bottom: 1px solid #e5e5e5;">
          <span>Desconto</span>
          <span style="font-weight: 600;">- {{ formatCurrency(discountAmount) }}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 12px; font-size: 14px; font-weight: 700; background: #f0f0f0; border-top: 2px solid #999;">
          <span>TOTAL</span>
          <span>{{ formatCurrency(totalAmount) }}</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div v-if="detail.order.notes" style="border: 1px solid #ccc; padding: 10px 14px; margin-bottom: 20px;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 5px;">Observações</div>
      <div style="font-size: 12px; line-height: 1.5; color: #333;">{{ detail.order.notes }}</div>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #ccc; padding-top: 16px;">
      <div v-if="quoteMode !== false" style="font-size: 11px; color: #555; margin-bottom: 24px;">
        Este orçamento tem validade de 30 dias a partir da data de emissão.
      </div>
      <div style="display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: flex-end;">
        <div>
          <div style="border-top: 1px solid #111; padding-top: 5px; font-size: 11px; color: #555; text-align: center;">
            Assinatura do Cliente
          </div>
        </div>
        <div style="font-size: 11px; color: #555; white-space: nowrap; padding-bottom: 5px;">
          Data: _____ / _____ / __________
        </div>
      </div>
    </div>
  </div>
</template>
