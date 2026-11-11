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
