<script setup lang="ts">
import type { ServiceOrderDetailFull } from '~/types/service-orders'
import type { OrganizationData } from '~/types/organization'

const props = defineProps<{
  open: boolean
  orderId: string | null
  quoteMode?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const toast = useToast()
const detail = ref<ServiceOrderDetailFull | null>(null)
const organization = ref<OrganizationData | null>(null)
const isLoading = ref(false)
const isDownloading = ref(false)
const printDocRef = ref<{ el: HTMLElement | null } | null>(null)

watch(
  () => props.open,
  (opened) => {
    if (opened) loadData()
    else {
      detail.value = null
      organization.value = null
    }
  }
)

async function loadData() {
  if (!props.orderId) return

  isLoading.value = true
  detail.value = null

  try {
    const [detailResponse, organizationResponse] = await Promise.all([
      $fetch<{ data: ServiceOrderDetailFull }>(
        `/api/service-orders/${props.orderId}`
      ),
      $fetch<OrganizationData>('/api/organizations')
    ])

    detail.value = detailResponse.data
    organization.value = organizationResponse
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string }
      statusMessage?: string
    }
    toast.add({
      title: 'Erro ao carregar orçamento',
      description:
        err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
    emit('update:open', false)
  } finally {
    isLoading.value = false
  }
}

function close() {
  emit('update:open', false)
}

function sanitizeFileNamePart(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function downloadPdf() {
  const el = printDocRef.value?.el
  if (!el || !detail.value || isDownloading.value) return

  isDownloading.value = true

  try {
    const [{ toPng }, { PDFDocument }] = await Promise.all([
      import('html-to-image'),
      import('pdf-lib')
    ])

    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff'
    })

    const pdf = await PDFDocument.create()
    const image = await pdf.embedPng(dataUrl)

    const pageWidth = 595.28
    const pageHeight = 841.89
    const margin = 24
    const usableWidth = pageWidth - margin * 2
    const usableHeight = pageHeight - margin * 2

    const scale = usableWidth / image.width
    const scaledWidth = usableWidth
    const scaledHeight = image.height * scale

    const numPages = Math.ceil(scaledHeight / usableHeight)

    for (let i = 0; i < numPages; i++) {
      const page = pdf.addPage([pageWidth, pageHeight])
      const imageY = pageHeight - margin - scaledHeight + i * usableHeight
      page.drawImage(image, {
        x: margin,
        y: imageY,
        width: scaledWidth,
        height: scaledHeight
      })
    }

    const bytes = await pdf.save()
    const blob = new Blob(
      [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
      { type: 'application/pdf' }
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const clientPart = sanitizeFileNamePart(detail.value.client?.name) || 'Cliente'
    const numberPart = sanitizeFileNamePart(detail.value.order.number) || 'OS'
    const datePart = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `${clientPart}_${numberPart}_${datePart}.pdf`
    link.click()
    URL.revokeObjectURL(url)

    toast.add({ title: 'PDF gerado com sucesso', color: 'success' })
  } catch {
    toast.add({
      title: 'Erro ao gerar PDF',
      description: 'Não foi possível gerar o documento do orçamento.',
      color: 'error'
    })
  } finally {
    isDownloading.value = false
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
      body: 'flex-1 min-h-0 overflow-y-auto p-0 bg-[linear-gradient(180deg,rgba(var(--ui-bg),1),rgba(var(--ui-bg-elevated),0.92))]'
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div
        class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-6 lg:py-5 w-full justify-between"
      >
        <div class="min-w-0 space-y-3">
          <div class="space-y-1.5">
            <p class="font-semibold uppercase tracking-[0.22em] text-primary/80">
              {{ quoteMode !== false ? 'Visualização do Orçamento' : 'Visualização da OS' }}
            </p>
            <div
              class="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between"
            >
              <div class="min-w-0">
                <h1 class="truncate text-xl font-bold text-highlighted lg:text-2xl">
                  {{
                    detail?.order.number
                      ? `OS #${detail.order.number}`
                      : quoteMode !== false
                        ? 'Orçamento de serviços'
                        : 'Ordem de Serviço'
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
          <QuoteDocumentPreview
            :detail="detail"
            :organization="organization"
            :quote-mode="quoteMode"
          />
        </div>
      </div>
    </template>
  </UModal>

  <QuoteDocumentPrint
    v-if="detail"
    ref="printDocRef"
    :detail="detail"
    :organization="organization"
    :quote-mode="quoteMode"
  />
</template>
