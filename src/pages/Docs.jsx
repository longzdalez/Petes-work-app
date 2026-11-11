import { useEffect, useRef, useState } from 'react'
import { put, update, remove, useRecord, useList, saveFile, getFile, deleteFile, uid, status, cloudEnabled, useStatus } from '../store'
import { Icon, Sheet, Field, Empty, useLongPress, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { niceDate } from '../util'
import { makeThumb, shrinkImage } from '../thumbs'

const ext = name => (name.match(/\.(\w+)$/)?.[1] || 'file').toUpperCase()

export async function addDocs(jobId, files) {
  for (const f0 of files) {
    const f = await shrinkImage(f0)
    const id = uid()
    const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file'
    const path = `${jobId}/${id}-${safe}`
    const thumb = await makeThumb(f)
    let cloud = false
    try { await saveFile(path, f); cloud = cloudEnabled && status.signedIn } catch (e) { console.warn(e) }
    put('doc', { name: f0.name, type: f.type, size: f.size, path, thumb, cloud }, { id, job_id: jobId })
  }
}

async function openDoc(doc) {
  const w = window.open('', '_blank')
  try {
    const blob = await getFile(doc.data.path)
    if (!blob) throw new Error('File not found on this phone yet')
    const url = URL.createObjectURL(new Blob([blob], { type: doc.data.type || blob.type }))
    if (w) w.location = url; else location.href = url
  } catch (e) {
    if (w) w.close()
    alert("Couldn't open the file: " + e.message)
  }
}

function DocTile({ doc, onLong }) {
  const lp = useLongPress(() => onLong(doc), () => openDoc(doc))
  return (
    <div className="doc-tile" {...lp} role="button">
      <div className="doc-thumb">
        {doc.data.thumb ? <img src={doc.data.thumb} alt="" /> : <div className="doc-ext">{ext(doc.data.name)}</div>}
        {!doc.data.cloud && cloudEnabled && <span className="doc-badge" title="Waiting to upload"><Icon name="cloud" size={14} /></span>}
      </div>
      <div className="doc-name">{doc.data.name}</div>
    </div>
  )
}

export default function Docs({ id }) {
  const job = useRecord(id)
  const docs = useList('doc', r => r.job_id === id, (a, b) => b.data.created.localeCompare(a.data.created))
  const st = useStatus()
  const input = useRef()
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(null)
  const selDoc = docs.find(d => d.id === sel)

  // Retry uploads that happened while offline / signed out
  useEffect(() => {
    if (!cloudEnabled || !st.signedIn || !st.online) return
    docs.filter(d => !d.data.cloud).forEach(async d => {
      try { const b = await getFile(d.data.path); if (b) { await saveFile(d.data.path, b); update(d.id, { cloud: true }) } } catch { }
    })
  }, [st.signedIn, st.online, docs.length])

  const onFiles = async e => {
    const files = [...e.target.files]; e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try { await addDocs(id, files) } finally { setBusy(false) }
  }
  return (
    <JobShell job={job} tab="docs" title="Job documents">
      <div className="section-head">
        <p className="muted small" style={{ margin: 0 }}>Tap to open. Hold to rename or delete.</p>
        <button className="btn primary" onClick={() => input.current.click()} disabled={busy}>
          <Icon name="upload" size={18} /> {busy ? 'Adding…' : 'Add'}
        </button>
        <input ref={input} type="file" multiple hidden onChange={onFiles} />
      </div>
      {docs.length === 0
        ? <Empty icon="docs" title="No documents yet" text="Press Add to pick files, photos or PDFs from your phone. You can also share straight from WhatsApp or email: press Share, then choose Pete Work." />
        : <div className="doc-grid">{docs.map(d => <DocTile key={d.id} doc={d} onLong={d => setSel(d.id)} />)}</div>}
      {selDoc && (
        <Sheet open onClose={() => setSel(null)} title="Document">
          <div className="created">Added {niceDate(selDoc.data.created)} · {(selDoc.data.size / 1024 / 1024).toFixed(1)} MB</div>
          <Field label="Name" value={selDoc.data.name} onChange={v => update(selDoc.id, { name: v })} />
          <div className="sheet-actions">
            <button className="btn danger" onClick={async () => {
              if (!confirmDelete('this document')) return
              remove(selDoc.id); setSel(null); deleteFile(selDoc.data.path).catch(() => {})
            }}><Icon name="trash" size={18} /> Delete</button>
            <button className="btn primary" onClick={() => openDoc(selDoc)}>Open</button>
          </div>
        </Sheet>
      )}
    </JobShell>
  )
}
