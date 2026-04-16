<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'imported': []
}>()

const toast = useToast()

const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const importResult = ref<{ imported: number; errors: { row: number; message: string }[] } | null>(null)

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

watch(() => props.open, (v) => {
  if (!v) {
    file.value = null
    importResult.value = null
    isImporting.value = false
  }
})

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  importResult.value = null
}

const TEMPLATE_FIELDS = [
  'nome',
  'telefone',
  'tipo_pessoa',
  'email',
  'celular',
  'cpf_cnpj',
  'data_nascimento',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'observacoes',
]

const CSV_FIELD_MAP: Record<string, string> = {
  nome: 'name',
  telefone: 'phone',
  tipo_pessoa: 'person_type',
  email: 'email',
  celular: 'mobile_phone',
  cpf_cnpj: 'tax_id',
  data_nascimento: 'birth_date',
  cep: 'zip_code',
  logradouro: 'street',
  numero: 'address_number',
  complemento: 'address_complement',
  bairro: 'neighborhood',
  cidade: 'city',
  estado: 'state',
  observacoes: 'notes',
}

function downloadTemplate() {
  const exampleRow = [
    'João Silva',
    '11912345678',
    'pf',
    'joao@email.com',
    '',
    '12345678901',
    '',
    '',
    '',
    '',
    '',
    '',
    'São Paulo',
    'SP',
    '',
  ]
  const csv = [TEMPLATE_FIELDS.join(','), exampleRow.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo_clientes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      const apiField = CSV_FIELD_MAP[header] ?? header
      row[apiField] = values[i] ?? ''
    })
    return row
  }).filter((row) => Object.values(row).some((v) => v !== ''))
}

async function startImport() {
  if (!file.value || isImporting.value) return

  isImporting.value = true
  importResult.value = null

  try {
    const text = await file.value.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      toast.add({ title: 'Arquivo vazio', description: 'Nenhum dado encontrado no arquivo CSV.', color: 'warning' })
      return
    }

    const result = await $fetch<{ imported: number; errors: { row: number; message: string }[] }>(
      '/api/clients/batch',
      { method: 'POST', body: { rows } },
    )

    importResult.value = result

    if (result.imported > 0) {
      toast.add({
        title: `${result.imported} cliente(s) importado(s)`,
        color: 'success',
      })
      emit('imported')
    }

    if (result.errors.length === 0) {
      isOpen.value = false
    }
  }
  catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({
      title: 'Erro na importação',
      description: e?.data?.statusMessage || e?.statusMessage || 'Ocorreu um erro inesperado.',
      color: 'error',
    })
  }
  finally {
    isImporting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Importar Clientes em Massa"
    description="Siga os passos abaixo para importar seus clientes de um arquivo CSV."
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Instruções -->
        <div class="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <p class="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
            <UIcon name="i-lucide-clipboard-list" class="size-4" />
            Instruções Importantes
          </p>
          <ul class="space-y-1 text-xs text-warning/80">
            <li>• <strong>Campos obrigatórios:</strong> nome, telefone</li>
            <li>• <strong>tipo_pessoa:</strong> use <code class="rounded bg-warning/10 px-1">"pf"</code> para Pessoa Física ou <code class="rounded bg-warning/10 px-1">"pj"</code> para Pessoa Jurídica</li>
            <li>• <strong>telefone:</strong> apenas números (será formatado automaticamente)</li>
            <li>• <strong>cpf_cnpj:</strong> apenas números (será formatado automaticamente)</li>
          </ul>
        </div>

        <!-- Passo 1 -->
        <div class="rounded-xl border border-info/30 bg-info/5 p-4">
          <p class="mb-2 flex items-center gap-2 text-sm font-semibold text-info">
            <UIcon name="i-lucide-list-ordered" class="size-4" />
            Passo 1: Baixe o Modelo
          </p>
          <p class="mb-3 text-xs text-info/70">
            Use nosso arquivo modelo para garantir que seus dados estejam no formato correto.
          </p>
          <UButton
            label="Baixar Modelo (CSV)"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            class="w-full"
            @click="downloadTemplate"
          />
        </div>

        <!-- Passo 2 -->
        <div class="rounded-xl border border-success/30 bg-success/5 p-4">
          <p class="mb-2 flex items-center gap-2 text-sm font-semibold text-success">
            <UIcon name="i-lucide-file-up" class="size-4" />
            Passo 2: Envie o Arquivo
          </p>
          <p class="mb-3 text-xs text-success/70">
            Após preencher o modelo, salve-o como CSV e envie aqui.
          </p>
          <label
            class="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-default/60 bg-default px-4 py-3 transition-colors hover:bg-elevated"
            @click="fileInput?.click()"
          >
            <UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-muted" />
            <span class="truncate text-sm" :class="file ? 'text-highlighted' : 'text-muted'">
              {{ file ? file.name : 'Nenhum arquivo selecionado' }}
            </span>
            <UButton
              label="Escolher arquivo"
              color="neutral"
              variant="outline"
              size="xs"
              class="ml-auto shrink-0"
              @click.stop="fileInput?.click()"
            />
          </label>
          <input
            ref="fileInput"
            type="file"
            accept=".csv,text/csv"
            class="hidden"
            @change="onFileChange"
          />
        </div>

        <!-- Resultado da importação -->
        <template v-if="importResult">
          <div v-if="importResult.imported > 0" class="rounded-xl border border-success/30 bg-success/5 p-3">
            <p class="flex items-center gap-2 text-sm font-medium text-success">
              <UIcon name="i-lucide-check-circle-2" class="size-4" />
              {{ importResult.imported }} cliente(s) importado(s) com sucesso
            </p>
          </div>
          <div v-if="importResult.errors.length > 0" class="rounded-xl border border-error/30 bg-error/5 p-3">
            <p class="mb-2 flex items-center gap-2 text-sm font-medium text-error">
              <UIcon name="i-lucide-alert-circle" class="size-4" />
              {{ importResult.errors.length }} erro(s) encontrado(s)
            </p>
            <ul class="space-y-1">
              <li
                v-for="e in importResult.errors"
                :key="e.row"
                class="text-xs text-error/80"
              >
                Linha {{ e.row }}: {{ e.message }}
              </li>
            </ul>
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="isOpen = false"
        />
        <UButton
          label="Iniciar Importação"
          icon="i-lucide-upload"
          color="neutral"
          :loading="isImporting"
          :disabled="!file || isImporting"
          @click="startImport"
        />
      </div>
    </template>
  </UModal>
</template>
