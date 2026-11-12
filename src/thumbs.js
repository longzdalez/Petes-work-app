// Make a small preview picture for a document
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const SIZE = 320

function canvasFor(w, h) {
  const scale = Math.min(1, SIZE / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale); c.height = Math.round(h * scale)
  return [c, scale]
}

export async function makeThumb(file) {
  try {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
      const [c] = canvasFor(img.naturalWidth, img.naturalHeight)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      return c.toDataURL('image/jpeg', 0.7)
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
      const page = await pdf.getPage(1)
      const vp = page.getViewport({ scale: 1 })
      const [c, scale] = canvasFor(vp.width, vp.height)
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise
      return c.toDataURL('image/jpeg', 0.7)
    }
  } catch (e) { console.warn('thumbnail failed', e) }
  return null
}

// Shrink big phone photos before upload so they're quick to sync
export async function shrinkImage(file, max = 2000) {
  if (!file.type.startsWith('image/') || file.size < 1.5e6 || file.type === 'image/gif') return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    URL.revokeObjectURL(url)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

// Text of a PDF (first 3 pages), rebuilt into lines, for reading downloaded receipts and invoices
export async function pdfText(file) {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const out = []
  for (let n = 1; n <= Math.min(3, pdf.numPages); n++) {
    const page = await pdf.getPage(n)
    const { items } = await page.getTextContent()
    const rows = []
    items.filter(i => i.str.trim()).forEach(i => {
      const y = i.transform[5], x = i.transform[4]
      let r = rows.find(r => Math.abs(r.y - y) < 3)
      if (!r) rows.push(r = { y, parts: [] })
      r.parts.push([x, i.str])
    })
    rows.sort((a, b) => b.y - a.y).forEach(r => out.push(r.parts.sort((a, b) => a[0] - b[0]).map(p => p[1]).join(' ')))
  }
  return out.join('\n')
}

// First page of a PDF as a picture (for scanned PDFs with no text in them)
export async function pdfCanvas(file) {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await pdf.getPage(1)
  const vp = page.getViewport({ scale: 1 })
  const s = Math.min(3, 2000 / Math.max(vp.width, vp.height))
  const v = page.getViewport({ scale: s })
  const c = document.createElement('canvas'); c.width = v.width; c.height = v.height
  await page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise
  return c
}
