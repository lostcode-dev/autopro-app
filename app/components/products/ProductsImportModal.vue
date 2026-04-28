<script setup lang="ts">
const emit = defineEmits<{
  'update:open': [value: boolean]
  'imported': []
}>()

defineProps<{ open: boolean }>()

const toast = useToast()

const isImporting = ref(false)
const parsedRows = ref<Record<string, string>[]>([])
const parseError = ref('')
const result = ref<{ created: number, errors: { row: number, message: string }[] } | null>(null)

const hasRows = computed(() => parsedRows.value.length > 0)

const TEMPLATE_CSV = [
  'nome,codigo,tipo,categoria,preco_custo,preco_venda,controlar_estoque,estoque_inicial,produto_pai_codigo,item_descricao,item_quantidade,item_preco_custo,item_preco_venda,item_controlar_estoque,item_estoque_inicial',
  'Filtro de Oleo,101,unit,Filtros,10.00,25.00,true,5,,,,,,,',
  'Kit de Freios,102,group,Freios,,,,,,,,,,,,',
  ',,,,,,,,102,Pastilha Dianteira,2,15.00,35.00,true,4',
  ',,,,,,,,102,Disco de Freio,2,30.00,60.00,false,0'
].join('\n')

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo-importacao-produtos.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0]!.split(',').map(h => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map(v => v.trim())
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
    code: row.codigo ? Number(row.codigo) : undefined,
    type: row.tipo as 'unit' | 'group',
    category: row.categoria || undefined,
    cost_price: row.preco_custo ? Number(row.preco_custo) : undefined,
    sale_price: row.preco_venda ? Number(row.preco_venda) : undefined,
    track_inventory: row.controlar_estoque?.toLowerCase() === 'true',
    initial_stock: row.estoque_inicial ? Number(row.estoque_inicial) : undefined,
    parent_product_code: row.produto_pai_codigo ? Number(row.produto_pai_codigo) : undefined,
    item_description: row.item_descricao || undefined,
    item_quantity: row.item_quantidade ? Number(row.item_quantidade) : undefined,
    item_cost_price: row.item_preco_custo ? Number(row.item_preco_custo) : undefined,
    item_sale_price: row.item_preco_venda ? Number(row.item_preco_venda) : undefined,
    item_track_inventory: row.item_controlar_estoque?.toLowerCase() === 'true',
    item_initial_stock: row.item_estoque_inicial ? Number(row.item_estoque_inicial) : undefined
  }))
}

async function runImport() {
  if (!hasRows.value || isImporting.value) return
  isImporting.value = true
  result.value = null

  try {
    const data = await $fetch<{ created: number, errors: { row: number, message: string }[] }>(
      '/api/products/import',
      { method: 'POST', body: { rows: buildImportRows() } }
    )
    result.value = data

    if (data.created > 0) {
      toast.add({
        title: `${data.created} produto(s) importado(s)`,
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
    title="Importar Produtos em Massa"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
    @update:open="onClose"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Instructions -->
        <UAlert
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          title="Como importar"
          description="Baixe o modelo CSV, preencha os dados e faça o upload. Produtos unitários e de grupo são suportados."
        />

        <!-- CSV structure reference -->
        <div class="rounded-lg border border-default p-4 space-y-3">
          <p class="text-sm font-semibold text-highlighted">
            Estrutura do CSV
          </p>

          <div class="space-y-2 text-sm text-muted">
            <p class="font-medium text-default">
              Produto unitário
            </p>
            <div class="rounded bg-elevated px-3 py-2 font-mono text-xs overflow-x-auto">
              nome,codigo,tipo,categoria,preco_custo,preco_venda,controlar_estoque,estoque_inicial<br>
              Filtro de Oleo,101,unit,Filtros,10.00,25.00,true,5
            </div>
          </div>

          <div class="space-y-2 text-sm text-muted">
            <p class="font-medium text-default">
              Produto em grupo (linha pai + linhas de itens)
            </p>
            <div class="rounded bg-elevated px-3 py-2 font-mono text-xs overflow-x-auto">
              nome,codigo,tipo,...,produto_pai_codigo,item_descricao,item_quantidade,item_preco_custo,item_preco_venda,item_controlar_estoque,item_estoque_inicial<br>
              Kit de Freios,102,group,Freios,,,,,...<br>
              ,,,,,,,,102,Pastilha Dianteira,2,15.00,35.00,true,4
            </div>
          </div>
        </div>

        <!-- Download template -->
        <UButton
          label="Baixar Modelo CSV Completo"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          size="sm"
          @click="downloadTemplate"
        />

        <!-- File upload -->
        <UFormField label="Arquivo CSV">
          <input
            type="file"
            accept=".csv,text/csv"
            class="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accents-2 transition-colors"
            @change="onFileChange"
          >
        </UFormField>

        <p v-if="parseError" class="text-sm text-red-500">
          {{ parseError }}
        </p>

        <!-- Preview -->
        <div v-if="hasRows" class="space-y-2">
          <p class="text-sm font-medium text-highlighted">
            Prévia — {{ parsedRows.length }} linha(s) encontrada(s)
          </p>
          <div class="max-h-48 overflow-auto rounded-lg border border-default">
            <table class="min-w-full text-xs">
              <thead class="bg-elevated">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Nome
                  </th>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Código
                  </th>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Tipo
                  </th>
                  <th class="px-3 py-2 text-left font-medium text-muted">
                    Pai
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="(row, i) in parsedRows" :key="i">
                  <td class="px-3 py-1.5 text-highlighted">
                    {{ row.nome || row.item_descricao || '—' }}
                  </td>
                  <td class="px-3 py-1.5 text-muted">
                    {{ row.codigo || '—' }}
                  </td>
                  <td class="px-3 py-1.5 text-muted">
                    {{ row.tipo || '(item)' }}
                  </td>
                  <td class="px-3 py-1.5 text-muted">
                    {{ row.produto_pai_codigo || '—' }}
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
            :title="`${result.created} produto(s) importado(s) com sucesso`"
          />
          <div v-else class="space-y-2">
            <UAlert
              icon="i-lucide-alert-triangle"
              color="warning"
              variant="subtle"
              :title="`${result.created} importado(s) · ${result.errors.length} erro(s)`"
            />
            <ul class="text-xs text-red-500 space-y-0.5 pl-2">
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
          label="Importar"
          icon="i-lucide-upload"
          :loading="isImporting"
          :disabled="!hasRows || isImporting"
          @click="runImport"
        />
      </div>
    </template>
  </UModal>
</template>
