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

export function buildPdf(inv, business) {
  const d = inv.data, b = business || {}
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 16
  const navy = [47, 122, 87]
  let y = M

  // Header: logo left, business details right
  if (b.logo) {
    try {
      const p = doc.getImageProperties(b.logo)
      const h = 24, w = Math.min(60, (p.width / p.height) * h)
      doc.addImage(b.logo, 'PNG', M, y, w, h)
    } catch { }
  } else if (b.name) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...navy)
    doc.text(b.name, M, y + 8)
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60)
  const right = [b.logo ? b.name : null, ...(b.address || '').split('\n'), b.phone, b.phone2, b.email, b.vatNo && `VAT no. ${b.vatNo}`].filter(Boolean)
  if (!right.length) right.push('[Your business name, address and phone]')
  right.forEach((t, i) => { if (i === 0 && b.logo) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal'); doc.text(t, W - M, y + 4 + i * 4.6, { align: 'right' }) })
  y = Math.max(y + 30, y + 6 + right.length * 4.6)

  // Title band
  doc.setFillColor(...navy); doc.rect(M, y, W - 2 * M, 12, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(d.type === 'quote' ? 'QUOTE' : 'INVOICE', M + 4, y + 8.2)
  doc.setFontSize(10)
  doc.text(`${d.number || ''}`, W - M - 4, y + 8, { align: 'right' })
  y += 20

  // Client + dates
  doc.setTextColor(110); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text(d.type === 'quote' ? 'QUOTE FOR' : 'BILL TO', M, y)
  doc.text('DETAILS', 130, y)
  doc.setTextColor(30); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  const cl = [d.clientName, ...(d.clientAddress || '').split('\n'), d.clientPhone, d.clientEmail].filter(Boolean)
  cl.forEach((t, i) => doc.text(t, M, y + 5.5 + i * 4.8))
  const meta = [['Date', niceDate(d.date)], [d.type === 'quote' ? 'Valid until' : 'Due', niceDate(d.due)], d.jobName && ['Job', d.jobName]].filter(x => x && x[1])
  meta.forEach(([k, v], i) => { doc.setTextColor(110); doc.text(k, 130, y + 5.5 + i * 4.8); doc.setTextColor(30); doc.text(v, W - M, y + 5.5 + i * 4.8, { align: 'right' }) })
  y += 8 + Math.max(cl.length, meta.length) * 4.8 + 4

  // Lines
  const lines = (d.lines || []).filter(l => l.item || num(l.materials) || num(l.labour))
  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Item', 'Location', 'Materials', 'Labour', 'Total']],
    body: lines.map(l => [l.item || '', l.location || '', money(num(l.materials)), money(num(l.labour)), money(num(l.materials) + num(l.labour))]),
    styles: { fontSize: 9.5, cellPadding: 2.6, textColor: 30, lineColor: [225, 230, 238], lineWidth: 0.2 },
    headStyles: { fillColor: [230, 244, 236], textColor: navy, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 34 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' } },
  })
  y = doc.lastAutoTable.finalY + 6

  // Totals
  const t = invoiceTotals(d)
  const rows = [['Materials', money(t.mat)], ['Labour', money(t.lab)], ['Subtotal', money(t.sub)]]
  if (num(d.vatRate)) rows.push([`VAT (${num(d.vatRate)}%)`, money(t.vat)])
  doc.setFontSize(10)
  rows.forEach(([k, v]) => { doc.setTextColor(90); doc.text(k, 140, y); doc.setTextColor(30); doc.text(v, W - M, y, { align: 'right' }); y += 5.5 })
  doc.setFillColor(...navy); doc.rect(130, y - 1, W - M - 130, 10, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('Total', 134, y + 5.6); doc.text(money(t.total), W - M - 3, y + 5.6, { align: 'right' })
  y += 18

  // Bank + notes
  const notes = [d.notes, b.terms].filter(Boolean).join('\n\n')
  if (y > 250) { doc.addPage(); y = M }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(110)
  if (d.type !== 'quote' || b.bankName) {
    doc.text('PAYMENT DETAILS', M, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30); doc.setFontSize(10)
    const bank = [b.bankName && `Account name: ${b.bankName}`, b.sortCode && `Sort code: ${b.sortCode}`, b.accountNo && `Account no: ${b.accountNo}`, d.number && `Reference: ${d.number}`].filter(Boolean)
    if (!b.bankName && !b.sortCode) bank.unshift('[Add your bank details in Settings]')
    bank.forEach((s, i) => doc.text(s, M, y + 5.5 + i * 5))
    y += 8 + bank.length * 5
  }
  if (notes) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80)
    doc.text(doc.splitTextToSize(notes, W - 2 * M), M, y + 2)
  }
  return doc
}

export function pdfFile(inv, business) {
  const doc = buildPdf(inv, business)
  const name = `${inv.data.type === 'quote' ? 'Quote' : 'Invoice'} ${inv.data.number || ''} ${inv.data.clientName || ''}`.trim().replace(/[^\w\- ]+/g, '') + '.pdf'
  return new File([doc.output('blob')], name, { type: 'application/pdf' })
}
