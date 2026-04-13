// @ts-nocheck

import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import { uint8ToBase64 } from './reportFileUtils.ts'

const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const MARGIN_X = 28
const MARGIN_TOP = 28
const MARGIN_BOTTOM = 24
const TITLE_SIZE = 14
const SUBTITLE_SIZE = 9
const HEADER_SIZE = 8
const BODY_SIZE = 7
const ROW_HEIGHT = 15

function clipText(text: string, maxWidth: number, font: any, size: number) {
  const value = String(text || '')
  if (font.widthOfTextAtSize(value, size) <= maxWidth) {
    return value
  }

  const ellipsis = '...'
  let clipped = value

  while (clipped.length > 0) {
    const nextValue = `${clipped}${ellipsis}`
    if (font.widthOfTextAtSize(nextValue, size) <= maxWidth) {
      return nextValue
    }
    clipped = clipped.slice(0, -1)
  }

  return ellipsis
}

export async function buildTablePdfBase64({
  title,
  subtitle,
  columns,
  rows,
  footerRows
}: {
  title: string
  subtitle?: string
  columns: Array<{ header: string, widthRatio: number, align?: 'left' | 'right' }>
  rows: string[][]
  footerRows?: Array<{ label: string, value: string }>
}) {
  const pdfDocument = await PDFDocument.create()
  const fontRegular = await pdfDocument.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDocument.embedFont(StandardFonts.HelveticaBold)
  const usableWidth = PAGE_WIDTH - (MARGIN_X * 2)
  const normalizedColumns = columns.map(column => ({
    ...column,
    width: usableWidth * column.widthRatio
  }))

  let page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN_TOP

  const drawHeader = () => {
    page.drawText(title, {
      x: MARGIN_X,
      y,
      size: TITLE_SIZE,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.22)
    })
    y -= 16

    if (subtitle) {
      page.drawText(subtitle, {
        x: MARGIN_X,
        y,
        size: SUBTITLE_SIZE,
        font: fontRegular,
        color: rgb(0.34, 0.39, 0.45)
      })
      y -= 18
    } else {
      y -= 10
    }

    let x = MARGIN_X
    for (const column of normalizedColumns) {
      page.drawText(column.header, {
        x,
        y,
        size: HEADER_SIZE,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.22)
      })
      x += column.width
    }

    y -= 6
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: PAGE_WIDTH - MARGIN_X, y },
      thickness: 0.8,
      color: rgb(0.75, 0.79, 0.84)
    })
    y -= 10
  }

  const addPage = () => {
    page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN_TOP
    drawHeader()
  }

  drawHeader()

  for (const row of rows) {
    if (y <= MARGIN_BOTTOM + ROW_HEIGHT) {
      addPage()
    }

    let x = MARGIN_X
    row.forEach((cell, index) => {
      const column = normalizedColumns[index]
      if (!column) return
      const maxWidth = Math.max(8, column.width - 6)
      const clipped = clipText(String(cell ?? ''), maxWidth, fontRegular, BODY_SIZE)
      const measuredWidth = fontRegular.widthOfTextAtSize(clipped, BODY_SIZE)
      const drawX = column.align === 'right'
        ? x + column.width - measuredWidth - 2
        : x

      page.drawText(clipped, {
        x: drawX,
        y,
        size: BODY_SIZE,
        font: fontRegular,
        color: rgb(0.18, 0.22, 0.27)
      })

      x += column.width
    })

    y -= ROW_HEIGHT
  }

  // Draw footer summary rows
  if (footerRows && footerRows.length > 0) {
    if (y <= MARGIN_BOTTOM + ROW_HEIGHT * (footerRows.length + 1)) {
      addPage()
    }

    y -= 8
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: PAGE_WIDTH - MARGIN_X, y },
      thickness: 0.6,
      color: rgb(0.75, 0.79, 0.84)
    })
    y -= 12

    for (const footerRow of footerRows) {
      page.drawText(String(footerRow.label || ''), {
        x: MARGIN_X,
        y,
        size: BODY_SIZE + 1,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.22)
      })

      const valueText = String(footerRow.value || '')
      const valueWidth = fontBold.widthOfTextAtSize(valueText, BODY_SIZE + 1)
      page.drawText(valueText, {
        x: PAGE_WIDTH - MARGIN_X - valueWidth,
        y,
        size: BODY_SIZE + 1,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.22)
      })

      y -= ROW_HEIGHT
    }
  }

  const bytes = await pdfDocument.save()
  return uint8ToBase64(bytes)
}
