import { useEffect, useState } from 'react'
import { put, update, remove, useRecord, useList, getFile, deleteFile } from '../store'
import { Icon, Sheet, Field, Empty, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { nav } from '../router'
import { niceDate, today } from '../util'
import { storeFile, pickFile, shareOrDownload } from '../files'

export function useBlobUrl(path) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let u, live = true
    if (path) getFile(path).then(b => { if (b && live) { u = URL.createObjectURL(b); setUrl(u) } }).catch(() => {})
    return () => { live = false; u && URL.revokeObjectURL(u) }
  }, [path])
  return url
}

function PhotoSheet({ photo, onClose }) {
  const url = useBlobUrl(photo.data.path)
  return (
    <Sheet open onClose={onClose} title={niceDate(photo.data.date, { weekday: true })}>
      <img className="photo-big" src={url || photo.data.thumb} alt="" />
      <Field label="Caption" value={photo.data.caption} onChange={v => update(photo.id, { caption: v })} placeholder="e.g. Footings poured" />
      <div className="sheet-actions">
        <button className="btn danger" onClick={() => { if (confirmDelete('this photo')) { remove(photo.id); deleteFile(photo.data.path).catch(() => {}); onClose() } }}><Icon name="trash" size={18} /></button>
        <button className="btn primary" onClick={async () => { const b = await getFile(photo.data.path); if (b) shareOrDownload(new File([b], (photo.data.caption || 'photo').replace(/[^\w ]+/g, '') + '.jpg', { type: b.type || 'image/jpeg' }), photo.data.caption) }}><Icon name="share" size={18} /> Send</button>
      </div>
    </Sheet>
  )
}

export async function addPhotos(jobId, files, extra = {}) {
  for (const f of files) {
    const s = await storeFile(f, `${jobId}/photos`)
    put('photo', { path: s.path, thumb: s.thumb, type: s.type, cloud: s.cloud, date: today(), caption: '', ...extra }, { job_id: jobId })
  }
}

export default function Photos({ id }) {
  const job = useRecord(id)
  const photos = useList('photo', r => r.job_id === id, (a, b) => b.data.date.localeCompare(a.data.date) || b.data.created.localeCompare(a.data.created))
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(null)
  const add = async capture => {
    const files = await pickFile({ accept: 'image/*', capture: capture ? 'environment' : undefined, multiple: !capture })
    if (!files.length) return
    setBusy(true); try { await addPhotos(id, files) } finally { setBusy(false) }
  }
  const days = {}
  photos.forEach(p => (days[p.data.date] ||= []).push(p))
  const selP = photos.find(p => p.id === sel)
  return (
    <JobShell job={job} tab="" title="Photo diary" onBack={() => nav(`/job/${id}`)}>
      <div className="two">
        <button className="btn primary big" disabled={busy} onClick={() => add(true)}><Icon name="camera" size={20} /> {busy ? 'Saving…' : 'Take photo'}</button>
        <button className="btn ghost big" disabled={busy} onClick={() => add(false)}><Icon name="upload" size={20} /> From gallery</button>
      </div>
      {photos.length === 0 && <Empty icon="camera" title="No photos yet" text="Take progress photos as you go. They're kept by date, which is handy for client updates, building control and any disagreements later." />}
      {Object.entries(days).map(([d, ps]) => (
        <div key={d} className="photo-day">
          <h3>{niceDate(d, { weekday: true })} · {ps.length} photo{ps.length > 1 ? 's' : ''}</h3>
          <div className="photo-grid">
            {ps.map(p => <button key={p.id} onClick={() => setSel(p.id)} aria-label={p.data.caption || 'Photo'}><img src={p.data.thumb} alt="" /></button>)}
          </div>
        </div>
      ))}
      {selP && <PhotoSheet photo={selP} onClose={() => setSel(null)} />}
    </JobShell>
  )
}
