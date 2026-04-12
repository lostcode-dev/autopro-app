// @ts-nocheck

import { buildTablePdfBase64 } from './reportPdf.ts';
import { csvEscape, textToBase64, toLocalDateOnly } from './reportFileUtils.ts';

export async function buildReportDownloadData({
  format,
  title,
  subtitle,
  fileNameBase,
  columns,
  rows,
  footerRows,
}: {
  format: 'csv' | 'pdf';
  title: string;
  subtitle?: string;
  fileNameBase: string;
  columns: Array<{ header: string; widthRatio?: number; align?: 'left' | 'right' }>;
  rows: any[][];
  footerRows?: Array<{ label: string; value: string }>;
}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('As colunas do relatório são obrigatórias.');
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Não há dados para exportar.');
  }

  const normalizedColumns = columns.map((column) => ({
    header: String(column?.header || ''),
    widthRatio: Number(column?.widthRatio || 0) > 0 ? Number(column.widthRatio) : 1 / columns.length,
    align: column?.align === 'right' ? 'right' : 'left',
  }));

  const normalizedRows = rows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '')),
  );

  const today = toLocalDateOnly(new Date());

  if (format === 'csv') {
    const csvLines = [
      normalizedColumns.map((column) => csvEscape(column.header)).join(','),
      ...normalizedRows.map((row) => row.map(csvEscape).join(',')),
    ];

    // Append footer rows to CSV
    if (footerRows && footerRows.length > 0) {
      csvLines.push('');
      for (const footerRow of footerRows) {
        csvLines.push(`${csvEscape(footerRow.label)},${csvEscape(footerRow.value)}`);
      }
    }

    const csv = csvLines.join('\n');

    return {
      fileName: `${fileNameBase}_${today}.csv`,
      contentType: 'text/csv;charset=utf-8;',
      base64: textToBase64(csv),
    };
  }

  const base64 = await buildTablePdfBase64({
    title,
    subtitle: subtitle || undefined,
    columns: normalizedColumns,
    rows: normalizedRows,
    footerRows,
  });

  return {
    fileName: `${fileNameBase}_${today}.pdf`,
    contentType: 'application/pdf',
    base64,
  };
}