import { useState } from 'react'
import { jsPDF } from 'jspdf'
import { put, update, remove, useRecord, useList, deleteFile } from '../store'
import { Icon, Sheet, Field, Empty, SwipeRow, SignaturePad } from '../ui'
import { JobShell } from './Job'
import { nav } from '../router'
import { niceDate } from '../util'
import { storeFile, pickFile, shareOrDownload } from '../files'
import { useSettings } from './Settings'

function snagPdf(job, snags, business) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 16, W = 210
  let y = M
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(47, 122, 87)
  doc.text('Snagging list', M, y + 6)
  doc.setFontSize(10); doc.setTextColor(80); doc.setFont('helvetica', 'normal')
  doc.text([job.data.name, job.data.address, business.name].filter(Boolean).join(' · '), M, y + 13)
  doc.text(niceDate(new Date().toISOString()), W - M, y + 6, { align: 'right' })
  y += 22
  snags.forEach((s, i) => {
    const h = s.data.thumb ? 30 : 12
    if (y + h > 280) { doc.addPage(); y = M }
    doc.setDrawColor(210); doc.roundedRect(M, y, W - 2 * M, h, 3, 3)
    doc.setFontSize(11); doc.setTextColor(30); doc.setFont('helvetica', 'bold')
    doc.text(`${i + 1}. ${s.data.done ? '[Fixed] ' : ''}${s.data.text}`, M + 4, y + 7, { maxWidth: s.data.thumb ? 120 : W - 2 * M - 8 })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(100)
    if (s.data.location) doc.text(s.data.location, M + 4, y + 13)
    if (s.data.thumb) { try { doc.addImage(s.data.thumb, 'JPEG', W - M - 36, y + 2, 34, 26) } catch { } }
    y += h + 4
  })
  const so = job.data.snagSignoff
  if (so) {
    if (y > 240) { doc.addPage(); y = M }
    doc.setFontSize(11); doc.setTextColor(30); doc.text(`Signed off by ${so.name} on ${niceDate(so.at)}`, M, y + 8)
    try { doc.addImage(so.signature, 'PNG', M, y + 11, 60, 22) } catch { }
  }
  return new File([doc.output('blob')], `Snagging ${job.data.name || ''}.pdf`.replace(/[^\w .-]+/g, ''), { type: 'application/pdf' })
}

function SnagSheet({ snag, jobId, onClose }) {
  const isNew = !snag.id
  const [d, setD] = useState({ text: '', location: '', done: false, ...snag.data })
  const [busy, setBusy] = useState(false)
  const set = p => setD(x => ({ ...x, ...p }))
  const photo = async () => {
    const [f] = await pickFile({ accept: 'image/*', capture: 'environment' }); if (!f) return
    setBusy(true); const s = await storeFile(f, `${jobId}/snags`); set({ path: s.path, thumb: s.thumb }); setBusy(false)
  }
  const save = () => { if (!d.text.trim()) return alert("Please say what needs fixing"); if (isNew) put('snag', d, { job_id: jobId }); else update(snag.id, d); onClose() }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'New snag' : 'Snag'}>
      <Field label="What needs fixing?" value={d.text} onChange={v => set({ text: v })} placeholder="e.g. Touch up paint by back door" multiline />
      <Field label="Where?" value={d.location} onChange={v => set({ location: v })} placeholder="e.g. Hallway" />
      <button className="receipt-pick" onClick={photo}>{d.thumb ? <img src={d.thumb} alt="" /> : <Icon name="camera" />} {busy ? 'Saving photo…' : d.thumb ? 'Change photo' : 'Add a photo'}</button>
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { remove(snag.id); if (d.path) deleteFile(d.path).catch(() => {}); onClose() }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

export default function Snags({ id }) {
  const job = useRecord(id)
  const snags = useList('snag', r => r.job_id === id, (a, b) => (a.data.done - b.data.done) || a.data.created.localeCompare(b.data.created))
  const settings = useSettings()
  const [edit, setEdit] = useState(null)
  const [signing, setSigning] = useState(false)
  if (!job) return <JobShell job={null} />
  const open = snags.filter(s => !s.data.done).length
  const so = job.data.snagSignoff
  return (
    <JobShell job={job} tab="" title="Snagging" onBack={() => nav(`/job/${id}`)}>
      <button className="btn orange wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Add a snag</button>
      {snags.length === 0 ? <Empty icon="snag" title="No snags" text="Walk round with the client near the end, add anything that needs fixing with a photo, then tick them off. Get the client to sign it off when it's all done." /> : (
        <section className="card">
          <div className="card-head"><h2>{open ? `${open} to fix` : 'All fixed'}</h2><span className="pill">{snags.length} total</span></div>
          <div className="checklist">
            {snags.map(s => (
              <SwipeRow key={s.id} onTick={() => update(s.id, { done: !s.data.done })} onDelete={() => remove(s.id)} className={s.data.done ? 'done' : ''}>
                <button className={'tick' + (s.data.done ? ' on' : '')} onClick={() => update(s.id, { done: !s.data.done })} aria-label="Fixed">{s.data.done && <Icon name="check" size={16} stroke={3} />}</button>
                <span className="text" onClick={() => setEdit(s)}>{s.data.text}{s.data.location && <span className="muted small"> · {s.data.location}</span>}</span>
                {s.data.thumb && <img className="thumb-sm" src={s.data.thumb} alt="" onClick={() => setEdit(s)} />}
              </SwipeRow>
            ))}
          </div>
          <p className="hint" style={{ margin: '4px 0 0' }}>Swipe right to tick, left to delete. Tap to edit.</p>
        </section>
      )}
      {snags.length > 0 && <section className="card">
        <div className="card-head"><h2>Client sign-off</h2></div>
        {so ? <div className="signed"><img src={so.signature} alt="Signature" /><div className="small"><b>Signed off by {so.name}</b><br />{niceDate(so.at)}</div></div>
          : <button className="btn primary wide" onClick={() => setSigning(true)}><Icon name="edit" size={18} /> Client signs off the snag list</button>}
        {so && <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => update(id, { snagSignoff: null })}>Clear sign-off</button>}
        <button className="btn ghost wide" style={{ marginTop: 10 }} onClick={() => shareOrDownload(snagPdf(job, snags, settings.business), 'Snagging list')}><Icon name="share" size={18} /> Send snag list as PDF</button>
      </section>}
      {edit && <SnagSheet snag={edit} jobId={id} onClose={() => setEdit(null)} />}
      {signing && <Sheet open onClose={() => setSigning(false)} title="Sign off snagging">
        <p className="small">By signing, the client agrees the snagging list is complete{open ? ` (${open} still open)` : ''}.</p>
        <SignaturePad onCancel={() => setSigning(false)} onDone={sig => { update(id, { snagSignoff: sig }); setSigning(false) }} />
      </Sheet>}
    </JobShell>
  )
}
