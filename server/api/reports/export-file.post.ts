import { defineEventHandler, readBody, createError } from 'h3'
import { buildTablePdfBase64, csvEscape, textToBase64, toLocalDateOnly } from '../../utils/report-export'

/**
 * POST /api/reports/export-file
 * Generic report file export (PDF or CSV) from pre-built columns & rows.
 * Migrated from: supabase/functions/exportReportFile
 */

export default defineEventHandler(async (event) => {
  const payload = (await readBody(event)) || {}
  const format = payload?.format === 'pdf' ? 'pdf' : 'csv'
  const title = String(payload?.title || 'Relatório').trim() || 'Relatório'
  const subtitle = String(payload?.subtitle || '').trim()
  const fileNameBase = String(payload?.fileNameBase || 'relatorio').trim() || 'relatorio'
  const columns = Array.isArray(payload?.columns) ? payload.columns : []
  const rows = Array.isArray(payload?.rows) ? payload.rows : []

  if (columns.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'As colunas do relatório são obrigatórias.' })
  }

  if (rows.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Não há dados para exportar.' })
  }

  const normalizedColumns = columns.map((column: any) => ({
    header: String(column?.header || ''),
    widthRatio: Number(column?.widthRatio || 0) > 0 ? Number(column.widthRatio) : 1 / columns.length,
    align: column?.align === 'right' ? ('right' as const) : ('left' as const),
  }))

  const normalizedRows = rows.map((row: any) =>
    (Array.isArray(row) ? row : []).map((cell: unknown) => String(cell ?? ''))
  )

  const today = toLocalDateOnly(new Date())

  if (format === 'csv') {
    const csv = [
      normalizedColumns.map((column: any) => csvEscape(column.header)).join(','),
      ...normalizedRows.map((row: string[]) => row.map(csvEscape).join(',')),
    ].join('\n')

    return {
      success: true,
      data: {
        fileName: `${fileNameBase}_${today}.csv`,
        contentType: 'text/csv;charset=utf-8;',
        base64: textToBase64(csv),
      },
    }
  }

  const base64 = await buildTablePdfBase64({
    title,
    subtitle: subtitle || undefined,
    columns: normalizedColumns,
    rows: normalizedRows,
  })

  return {
    success: true,
    data: {
      fileName: `${fileNameBase}_${today}.pdf`,
      contentType: 'application/pdf',
      base64,
    },
  }
})
