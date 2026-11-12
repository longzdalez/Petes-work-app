// Read a receipt photo on the phone (no internet service needed) and pull out the total, VAT, shop and date.
import { createWorker } from 'tesseract.js'

let workerP = null
function getWorker() {
  if (!workerP) {
    const base = new URL('./ocr/', location.href).href
    workerP = createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base,
      langPath: base,
      gzip: true,
      workerBlobURL: false,
    })
  }
  return workerP
}

// Make the photo easier to read: greyscale, more contrast, sensible size
async function prepare(file) {
  const url = URL.createObjectURL(file)
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height)
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data
  for (let i = 0; i < p.length; i += 4) {
    const g = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]
    const v = Math.max(0, Math.min(255, (g - 128) * 1.6 + 140))
    p[i] = p[i + 1] = p[i + 2] = v
  }
  ctx.putImageData(d, 0, 0)
  URL.revokeObjectURL(url)
  return c
}

const AMT = /(?:£|GBP)?\s*(-?\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2}))(?!\d)/g
const amounts = line => [...line.matchAll(AMT)].map(m => parseFloat(m[1].replace(/[\s,](?=\d{3}\b)/g, '').replace(',', '.'))).filter(n => !isNaN(n))

export function parseReceipt(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const low = lines.map(l => l.toLowerCase())
  let total = null, vat = null
  // 1. The total: the best line that says total / amount due / balance / to pay
  const totalWords = [/grand total|total due|amount due|balance due|total to pay|amount payable|total payable|to pay/, /\btotal\b(?!.*(ex|excl|before|net|items|savings|vat\b))/, /\b(balance|card|visa|mastercard|contactless|debit|paid)\b/]
  for (const re of totalWords) {
    for (let i = 0; i < lines.length && total == null; i++) {
      if (re.test(low[i]) && !/sub ?total/.test(low[i])) {
        const a = amounts(lines[i]).concat(i + 1 < lines.length && !amounts(lines[i]).length ? amounts(lines[i + 1]) : [])
        if (a.length) total = Math.max(...a)
      }
    }
    if (total != null) break
  }
  // 2. VAT: a line mentioning VAT with an amount that isn't the rate or the total
  for (let i = 0; i < lines.length; i++) {
    if (/\bv\.?a\.?t\b|\btax\b/.test(low[i]) && !/vat (no|number|reg)|reg(istration)? no/.test(low[i])) {
      const a = amounts(lines[i]).filter(n => n !== 20 && n !== 5 && n !== 0 && (total == null || n < total))
      if (a.length) {
        // On "VAT 20% £10.00 £2.00" style lines the VAT is usually the smaller amount
        const guess = total ? a.filter(n => n <= total * 0.21 + 0.01) : a
        if (guess.length) { vat = Math.max(...guess); break }
      }
    }
  }
  // Fall back to the biggest amount on the receipt
  if (total == null) { const all = lines.flatMap(amounts).filter(n => n > 0 && n < 100000); if (all.length) total = Math.max(...all) }
  // If it says VAT 20% but we couldn't find the amount, work it out from the total
  if (vat == null && total && /vat|v\.a\.t/.test(text.toLowerCase()) && /20(\.0+)?\s?%/.test(text)) vat = Math.round(total / 6 * 100) / 100
  // 3. Shop name: first line with real letters that isn't an address or phone number
  const shop = lines.find(l => /[a-z]{3,}/i.test(l) && !/\d{3,}|street|road|tel|www|vat|receipt|invoice|^\W/i.test(l)) || ''
  // 4. Date
  let date = ''
  const dm = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/)
  if (dm) {
    let [, d, m, y] = dm.map(Number); if (y < 100) y += 2000
    if (m > 12 && d <= 12) [d, m] = [m, d]
    const dt = new Date(y, m - 1, d)
    if (!isNaN(dt) && y > 2000 && dt <= new Date(Date.now() + 864e5)) date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return { total, vat, shop: shop.replace(/[^\w &'.-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40), date, text }
}

const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')

export async function readReceipt(file, onProgress) {
  onProgress && onProgress('Getting ready…')
  if (isPdf(file)) {
    const { pdfText, pdfCanvas } = await import('./thumbs')
    const text = await pdfText(file)
    if (amounts(text).length) return parseReceipt(text)
    // A scanned PDF: read the picture of the first page instead
    const w = await getWorker()
    onProgress && onProgress('Reading the document…')
    const { data } = await w.recognize(await pdfCanvas(file))
    return parseReceipt(data.text || '')
  }
  const w = await getWorker()
  onProgress && onProgress('Reading the receipt…')
  const canvas = await prepare(file)
  const { data } = await w.recognize(canvas)
  return parseReceipt(data.text || '')
}
