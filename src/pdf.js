import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { money, num, niceDate } from './util'

export function invoiceTotals(d) {
  const lines = d.lines || []
  const mat = lines.reduce((s, l) => s + num(l.materials), 0)
  const lab = lines.reduce((s, l) => s + num(l.labour), 0)
  const sub = mat + lab
  const vat = sub * (num(d.vatRate) / 100)
  return { mat, lab, sub, vat, total: sub + vat }
}

// The BP Builders logo (the home-screen icon), read once so every invoice has it even when nothing is set in Settings
let LOGO = null
export const logoReady = (async () => {
  try {
    const blob = await (await fetch(new URL('icons/icon-512.png', document.baseURI))).blob()
    LOGO = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
  } catch { }
})()

const GREEN = [47, 122, 87], ORANGE = [255, 159, 85], INK = [30, 40, 36], MUTED = [100, 112, 106], LINE = [205, 216, 210], PALE = [236, 246, 240], ZEBRA = [249, 252, 250], WHITE = [255, 255, 255]

export function buildPdf(inv, business) {
  const d = inv.data, b = business || {}
  const quote = d.type === 'quote'
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 14, R = W - M
  const FOOT = H - 40 // footer rule; the tables stop above it
  const t = invoiceTotals(d)
  const logo = b.logo || LOGO
  doc.setProperties({ title: `${quote ? 'Quote' : 'Invoice'} ${d.number || ''}`.trim(), author: b.name || 'BP Builders' })
  const grid = { lineColor: LINE, lineWidth: 0.2, textColor: INK, cellPadding: 2.6, fontSize: 9.5, font: 'helvetica' }
  const head = { fillColor: PALE, textColor: GREEN, fontStyle: 'bold', lineColor: LINE, lineWidth: 0.2 }
  let y = M

  // ---- Header: logo and name on the left, the document title on the right
  let nameX = M
  if (logo) {
    try {
      const p = doc.getImageProperties(logo)
      const h = 22, w = Math.min(60, (p.width / p.height) * h)
      doc.addImage(logo, 'PNG', M, y, w, h)
      nameX = M + w + 5
    } catch { }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...GREEN)
  doc.text(b.name || 'BP Builders', nameX, y + 10)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
  doc.text('Building and property work', nameX, y + 16)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(...GREEN)
  doc.text(quote ? 'QUOTE' : 'INVOICE', R, y + 11, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED)
  doc.text(d.number || '', R, y + 17, { align: 'right' })
  doc.setFillColor(...ORANGE); doc.rect(M, y + 26, R - M, 1.2, 'F')
  y += 30

  // ---- Client and details, as a grid
  const cl = [d.clientName, ...(d.clientAddress || '').split('\n'), d.clientPhone, d.clientEmail].filter(Boolean)
  const meta = [[quote ? 'Quote no.' : 'Invoice no.', d.number], ['Date', niceDate(d.date)], [quote ? 'Valid until' : 'Due', niceDate(d.due)], d.jobName && ['Job', d.jobName]].filter(x => x && x[1])
  const rows = Math.max(cl.length, meta.length)
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, bottom: 46 }, theme: 'grid', styles: grid,
    head: [[{ content: quote ? 'Quote for' : 'Bill to', styles: { halign: 'left' } }, { content: 'Details', colSpan: 2, styles: { halign: 'left' } }]],
    headStyles: head,
    body: Array.from({ length: rows }, (_, i) => [
      i === 0 ? { content: cl[0] || '', styles: { fontStyle: 'bold' } } : (cl[i] || ''),
      meta[i] ? meta[i][0] : '',
      meta[i] ? { content: meta[i][1], styles: { halign: 'right' } } : '',
    ]),
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 36, textColor: MUTED }, 2: { cellWidth: 52 } },
  })
  y = doc.lastAutoTable.finalY + 6

  // ---- Line items
  const lines = (d.lines || []).filter(l => l.item || num(l.materials) || num(l.labour))
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, bottom: 46 }, theme: 'grid', styles: grid,
    head: [['Item', 'Location', 'Materials', 'Labour', 'Total']],
    headStyles: { ...head, fillColor: GREEN, textColor: WHITE },
    alternateRowStyles: { fillColor: ZEBRA },
    body: lines.map(l => [l.item || '', l.location || '', money(num(l.materials)), money(num(l.labour)), money(num(l.materials) + num(l.labour))]),
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 34 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' } },
  })
  y = doc.lastAutoTable.finalY + 2

  // ---- Totals, as a grid under the lines on the right
  const totals = [['Materials', money(t.mat)], ['Labour', money(t.lab)], ['Subtotal', money(t.sub)]]
  if (num(d.vatRate)) totals.push([`VAT (${num(d.vatRate)}%)`, money(t.vat)])
  autoTable(doc, {
    startY: y, margin: { left: R - 84, right: M, bottom: 46 }, theme: 'grid', styles: grid,
    body: [
      ...totals.map(([k, v]) => [{ content: k, styles: { textColor: MUTED } }, { content: v, styles: { halign: 'right' } }]),
      [{ content: quote ? 'Quote total' : 'Total due', styles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 11 } }, { content: money(t.total), styles: { halign: 'right', fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 11 } }],
    ],
    columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 36 } },
  })
  y = doc.lastAutoTable.finalY + 6

  // ---- Payment details, as a grid (not for quotes unless bank details are set)
  if (!quote || b.bankName) {
    const lab = t => ({ content: t, styles: { textColor: MUTED } })
    autoTable(doc, {
      startY: y, margin: { left: M, right: M, bottom: 46 }, theme: 'grid', styles: grid,
      head: [[{ content: 'Payment details', colSpan: 4, styles: { halign: 'left' } }]], headStyles: head,
      body: [
        [lab('Account name'), b.bankName || '[Add in Settings]', lab('Sort code'), b.sortCode || '[Add in Settings]'],
        [lab('Account number'), b.accountNo || '[Add in Settings]', lab('Reference'), d.number || ''],
      ],
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 28 }, 3: { cellWidth: 46 } },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // ---- Notes
  const notes = [d.notes, b.terms].filter(Boolean).join('\n\n')
  if (notes) {
    if (y > FOOT - 14) { doc.addPage(); y = M }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(notes, R - M), M, y + 2)
  }

  // ---- Footer on every page: contact details at the bottom
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.5); doc.line(M, FOOT, R, FOOT)
    const left = [b.name || 'BP Builders', ...(b.address || '').split('\n').filter(Boolean)]
    const right = [b.phone, b.phone2, b.email, b.vatNo && `VAT no. ${b.vatNo}`].filter(Boolean)
    doc.setFontSize(8.5); doc.setTextColor(...INK)
    left.forEach((s, i) => { doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.text(s, M, FOOT + 6 + i * 4.2) })
    right.forEach((s, i) => { doc.setFont('helvetica', 'normal'); doc.text(s, R, FOOT + 6 + i * 4.2, { align: 'right' }) })
    doc.setFontSize(7.5); doc.setTextColor(...MUTED)
    doc.text(`Page ${p} of ${pages}`, R, H - 8, { align: 'right' })
  }
  return doc
}

export function pdfFile(inv, business) {
  const doc = buildPdf(inv, business)
  const name = `${inv.data.type === 'quote' ? 'Quote' : 'Invoice'} ${inv.data.number || ''} ${inv.data.clientName || ''}`.trim().replace(/[^\w\- ]+/g, '') + '.pdf'
  return new File([doc.output('blob')], name, { type: 'application/pdf' })
}
