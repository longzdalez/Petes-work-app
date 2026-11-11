import { saveFile, getFile, uid, status, cloudEnabled } from './store'
import { makeThumb, shrinkImage } from './thumbs'

// Save a photo or file and return what to keep on the record
export async function storeFile(file0, folder) {
  const file = await shrinkImage(file0)
  const safe = (file.name || 'photo.jpg').replace(/[^\w.\-]+/g, '_').slice(-60)
  const path = `${folder}/${uid()}-${safe}`
  const thumb = await makeThumb(file)
  let cloud = false
  try { await saveFile(path, file); cloud = cloudEnabled && status.signedIn } catch (e) { console.warn(e) }
  return { path, thumb, type: file.type, size: file.size, name: file0.name, cloud }
}

export async function openPath(path, type) {
  const w = window.open('', '_blank')
  try {
    const blob = await getFile(path)
    if (!blob) throw new Error('File not found on this phone')
    const url = URL.createObjectURL(new Blob([blob], { type: type || blob.type }))
    if (w) w.location = url; else location.href = url
  } catch (e) { if (w) w.close(); alert("Couldn't open the file: " + e.message) }
}

export function pickFile({ accept = 'image/*', capture, multiple } = {}) {
  return new Promise(res => {
    const i = document.createElement('input')
    i.type = 'file'; i.accept = accept; if (capture) i.capture = capture; if (multiple) i.multiple = true
    i.onchange = () => res([...i.files])
    i.click()
  })
}

export function download(file) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file); a.download = file.name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

export async function shareOrDownload(file, text) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: file.name, text }); return 'shared' }
  } catch (e) { if (e.name === 'AbortError') return 'cancelled' }
  download(file); return 'downloaded'
}

// UK mobile 07… → 447… for WhatsApp links
export function waNumber(phone) {
  let p = String(phone || '').replace(/[^\d+]/g, '')
  if (p.startsWith('+')) p = p.slice(1)
  else if (p.startsWith('00')) p = p.slice(2)
  else if (p.startsWith('0')) p = '44' + p.slice(1)
  return p
}
export function whatsApp(phone, text) {
  const n = waNumber(phone)
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, '_blank')
}
export async function shareText(text, title) {
  if (navigator.share) { try { await navigator.share({ text, title }); return } catch (e) { if (e.name === 'AbortError') return } }
  try { await navigator.clipboard.writeText(text); alert('Copied. You can paste it into WhatsApp or a text.') } catch { alert(text) }
}
