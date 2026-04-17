<script setup lang="ts">
const emit = defineEmits<{
  'update:open': [value: boolean]
  imported: []
}>()

defineProps<{ open: boolean }>()

const toast = useToast()

const isImporting = ref(false)
const parsedRows = ref<Record<string, string>[]>([])
const parseError = ref('')
const result = ref<{ created: number, errors: { row: number, message: string }[] } | null>(null)

const hasRows = computed(() => parsedRows.value.length > 0)

const TEMPLATE_CSV = [
  'nome,tipo_pessoa,nome_fantasia,cpf_cnpj,telefone,whatsapp,email,website,cep,logradouro,numero,complemento,bairro,cidade,estado,categoria,ativo,contato_nome,contato_cargo,contato_telefone,contato_email,prazo_pagamento_dias,limite_credito,observacoes',
  '"Autopecas Silva LTDA",pj,"Silva Peças","12.345.678/0001-99","(51) 3333-1234","(51) 99999-1234","contato@silva.com","https://silva.com","90000-000","Rua das Peças","100","Sala 1","Centro","Porto Alegre","RS","auto_parts","sim","João Silva","Gerente","(51) 99999-5678","joao@silva.com","30","5000.00","Cliente preferencial"'
].join('\n')

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo-importacao-fornecedores.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Simple CSV parser that handles quoted fields
  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0]!)
  return lines.slice(1).map((line) => {
    const values = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function onFileChange(event: Event) {
  parseError.value = ''
  parsedRows.value = []
  result.value = null

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    try {
      const rows = parseCSV(text)
      if (rows.length === 0) {
        parseError.value = 'Nenhuma linha encontrada no arquivo.'
        return
      }
      parsedRows.value = rows
    } catch {
      parseError.value = 'Erro ao ler o arquivo. Verifique o formato CSV.'
    }
  }
  reader.readAsText(file, 'UTF-8')
}

function buildImportRows() {
  return parsedRows.value.map(row => ({
    name: row.nome,
    person_type: row.tipo_pessoa || 'pj',
    trade_name: row.nome_fantasia || undefined,
    tax_id: row.cpf_cnpj || undefined,
    phone: row.telefone,
    whatsapp: row.whatsapp || undefined,
    email: row.email || undefined,
    website: row.website || undefined,
    zip_code: row.cep || undefined,
    street: row.logradouro || undefined,
    address_number: row.numero || undefined,
    address_complement: row.complemento || undefined,
    neighborhood: row.bairro || undefined,
    city: row.cidade || undefined,
    state: row.estado || undefined,
    category: row.categoria || undefined,
    is_active: row.ativo?.toLowerCase() !== 'nao',
    contact_name: row.contato_nome || undefined,
    contact_role: row.contato_cargo || undefined,
    contact_phone: row.contato_telefone || undefined,
    contact_email: row.contato_email || undefined,
    payment_term_days: row.prazo_pagamento_dias ? Number(row.prazo_pagamento_dias) : undefined,
    credit_limit: row.limite_credito ? Number(row.limite_credito) : undefined,
    notes: row.observacoes || undefined
  }))
}

async function runImport() {
  if (!hasRows.value || isImporting.value) return
  isImporting.value = true
  result.value = null

  try {
    const data = await $fetch<{ created: number, errors: { row: number, message: string }[] }>(
      '/api/suppliers/import',
      { method: 'POST', body: { rows: buildImportRows() } }
    )
    result.value = data

    if (data.created > 0) {
      toast.add({
        title: `${data.created} fornecedor(es) importado(s)`,
        color: 'success'
      })
      emit('imported')
    }

    if (data.errors.length === 0) {
      emit('update:open', false)
    }
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Erro na importação',
      description: e?.data?.statusMessage ?? 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isImporting.value = false
  }
}

function onClose(value: boolean) {
  if (!value) {
    parsedRows.value = []
    parseError.value = ''
    result.value = null
  }
  emit('update:open', value)
}
</script>

<template>
  <UModal
    :open="open"
    title="Importar Fornecedores em Massa"
    description="Siga os passos abaixo para importar seus fornecedores de um arquivo CSV."
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
    @update:open="onClose"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Step 1: Download template -->
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
          <div class="mb-3 flex items-center gap-2">
            <UIcon name="i-lucide-list-ordered" class="size-5 text-blue-600 dark:text-blue-400" />
            <p class="font-semibold text-blue-700 dark:text-blue-400">
              Passo 1: Baixe o Modelo
            </p>
          </div>
          <p class="mb-3 text-sm text-blue-600 dark:text-blue-400">
            Use nosso arquivo modelo para garantir que seus dados estejam no formato correto.
          </p>
          <UButton
            label="Baixar Modelo (CSV)"
            icon="i-lucide-download"
            color="info"
            variant="outline"
            block
            @click="downloadTemplate"
          />
        </div>

        <!-- Step 2: Upload file -->
        <div class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/40">
          <div class="mb-3 flex items-center gap-2">
            <UIcon name="i-lucide-file-up" class="size-5 text-green-600 dark:text-green-400" />
            <p class="font-semibold text-green-700 dark:text-green-400">
              Passo 2: Envie o Arquivo
            </p>
          </div>
          <p class="mb-3 text-sm text-green-600 dark:text-green-400">
            Após preencher o modelo, salve-o como CSV e envie aqui.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            class="block w-full rounded-md border border-green-300 bg-white px-3 py-2 text-sm text-default dark:border-green-700 dark:bg-elevated"
            @change="onFileChange"
          >
          <p v-if="parseError" class="mt-2 text-sm text-red-500">
            {{ parseError }}
          </p>
        </div>

        <!-- Preview -->
        <div v-if="hasRows" class="space-y-2">
          <p class="text-sm font-medium text-highlighted">
            Prévia — {{ parsedRows.length }} linha(s) encontrada(s)
          </p>
          <div class="max-h-40 overflow-auto rounded-lg border border-default">
            <table class="min-w-full text-xs">
              <thead class="bg-elevated">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Nome
                  </th>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Tipo
                  </th>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Telefone
                  </th>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Cidade
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="(row, i) in parsedRows" :key="i">
                  <td class="px-3 py-1.5 font-medium text-highlighted">
                    {{ row.nome || '—' }}
                  </td>
                  <td class="px-3 py-1.5 text-muted">
                    {{ row.tipo_pessoa?.toUpperCase() || '—' }}
                  </td>
                  <td class="px-3 py-1.5 text-muted">
                    {{ row.telefone || '—' }}
                  </td>
                  <td class="px-3 py-1.5 text-muted">
                    {{ row.cidade ? `${row.cidade}/${row.estado}` : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Result -->
        <div v-if="result">
          <UAlert
            v-if="result.errors.length === 0"
            icon="i-lucide-check-circle"
            color="success"
            variant="subtle"
            :title="`${result.created} fornecedor(es) importado(s) com sucesso`"
          />
          <div v-else class="space-y-2">
            <UAlert
              icon="i-lucide-alert-triangle"
              color="warning"
              variant="subtle"
              :title="`${result.created} importado(s) · ${result.errors.length} erro(s)`"
            />
            <ul class="space-y-0.5 pl-2 text-xs text-red-500">
              <li v-for="err in result.errors" :key="err.row">
                Linha {{ err.row }}: {{ err.message }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="onClose(false)"
        />
        <UButton
          label="Iniciar Importação"
          icon="i-lucide-upload"
          :loading="isImporting"
          :disabled="!hasRows || isImporting"
          @click="runImport"
        />
      </div>
    </template>
  </UModal>
</template>
