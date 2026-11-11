import { useState } from 'react'
import { put, update, remove, useRecord, useList, list } from '../store'
import { Icon, Sheet, Field, Empty, SignaturePad, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { nav } from '../router'
import { money, num, niceDate } from '../util'
import { whatsApp, shareText } from '../files'
import { newInvoice } from './Invoices'

const STATUS = { pending: 'Waiting for OK', approved: 'Approved', declined: 'Declined' }
export const extraTotal = d => num(d.materials) + num(d.labour)

// Put approved extras that haven't been billed yet onto an invoice
export function addExtrasToInvoice(jobId, invId) {
  const inv = list('invoice', r => r.id === invId)[0]
  const extras = list('extra', r => r.job_id === jobId && r.data.status === 'approved' && !r.data.invoiced)
  if (!inv || !extras.length) return 0
  const lines = (inv.data.lines || []).filter(l => l.item || num(l.materials) || num(l.labour))
  extras.forEach(e => lines.push({ item: `Extra: ${e.data.text}`, location: e.data.location || '', materials: e.data.materials || '', labour: e.data.labour || '' }))
  update(invId, { lines })
  extras.forEach(e => update(e.id, { invoiced: invId }))
  return extras.length
}

function ExtraSheet({ extra, jobId, job, onClose }) {
  const isNew = !extra.id
  const [d, setD] = useState({ text: '', location: '', materials: '', labour: '', notes: '', status: 'pending', ...extra.data })
  const [signing, setSigning] = useState(false)
  const set = p => setD(x => ({ ...x, ...p }))
  const save = (patch = {}) => {
    const data = { ...d, ...patch }
    if (!data.text.trim()) return alert('Please say what the extra work is')
    if (isNew) put('extra', data, { job_id: jobId }); else update(extra.id, data)
    onClose()
  }
  const msg = () => `Hi${job.data.client ? ' ' + job.data.client.split(' ')[0] : ''}, as discussed, extra work at ${job.data.address || 'the job'}:\n\n${d.text}${d.location ? ' (' + d.location + ')' : ''}\nPrice: ${money(extraTotal(d))}\n\nPlease reply OK to confirm you're happy for us to go ahead. Thanks`
  if (signing) return (
    <Sheet open onClose={() => setSigning(false)} title="Client approval">
      <p className="small">{d.text}: <b>{money(extraTotal(d))}</b></p>
      <SignaturePad onCancel={() => setSigning(false)} onDone={sig => save({ status: 'approved', approval: { ...sig, how: 'signed' } })} />
    </Sheet>
  )
  return (
    <Sheet open onClose={onClose} title={isNew ? 'New extra or change' : 'Extra work'}>
      {!isNew && <div className="created">Added {niceDate(d.created)} · <span className={'status ' + d.status}>{STATUS[d.status]}</span></div>}
      <Field label="What's the extra work?" value={d.text} onChange={v => set({ text: v })} placeholder="e.g. Move radiator to other wall" multiline />
      <Field label="Location" value={d.location} onChange={v => set({ location: v })} placeholder="e.g. Kitchen" />
      <div className="two">
        <Field label="Materials £" inputMode="decimal" value={d.materials} onChange={v => set({ materials: v })} />
        <Field label="Labour £" inputMode="decimal" value={d.labour} onChange={v => set({ labour: v })} />
      </div>
      <div className="kv grand" style={{ fontSize: 17 }}><span>Price to client</span><b>{money(extraTotal(d))}</b></div>
      <Field label="Notes" value={d.notes} onChange={v => set({ notes: v })} multiline />
      {d.approval && <div className="signed">
        {d.approval.signature && <img src={d.approval.signature} alt="Signature" />}
        <div className="small"><b>{d.approval.how === 'signed' ? `Signed by ${d.approval.name}` : `Approved by ${d.approval.name || 'client'} (${d.approval.how})`}</b><br />{niceDate(d.approval.at)}</div>
      </div>}
      {d.invoiced && <p className="small muted">Added to an invoice already.</p>}
      {d.status !== 'approved' && <>
        <button className="btn primary wide big" style={{ marginTop: 12 }} onClick={() => { if (!d.text.trim()) return alert('Please say what the extra work is'); setSigning(true) }}><Icon name="edit" size={18} /> Client signs to approve</button>
        <div className="two">
          <button className="btn ghost" onClick={() => job.data.clientPhone ? whatsApp(job.data.clientPhone, msg()) : shareText(msg(), 'Extra work')}><Icon name="chat" size={18} /> Ask on WhatsApp</button>
          <button className="btn ghost" onClick={() => save({ status: 'approved', approval: { name: job.data.client || '', how: 'by message', at: new Date().toISOString() } })}><Icon name="check" size={18} /> They said OK</button>
        </div>
      </>}
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { if (confirmDelete('this extra')) { remove(extra.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        {!isNew && d.status === 'pending' && <button className="btn ghost" onClick={() => save({ status: 'declined' })}>Client said no</button>}
        <button className="btn primary" onClick={() => save()}>Save</button>
      </div>
    </Sheet>
  )
}

export default function Extras({ id }) {
  const job = useRecord(id)
  const extras = useList('extra', r => r.job_id === id, (a, b) => b.data.created.localeCompare(a.data.created))
  const [edit, setEdit] = useState(null)
  if (!job) return <JobShell job={null} />
  const approved = extras.filter(e => e.data.status === 'approved')
  const unbilled = approved.filter(e => !e.data.invoiced)
  const sum = arr => arr.reduce((s, e) => s + extraTotal(e.data), 0)
  const bill = () => {
    const inv = newInvoice(job, 'invoice')
    addExtrasToInvoice(id, inv.id)
    nav(`/job/${id}/invoice/${inv.id}`)
  }
  return (
    <JobShell job={job} tab="" title="Extras & changes" onBack={() => nav(`/job/${id}`)}>
      <div className="stat-row">
        <div className="stat in"><span>Approved extras</span><b>{money(sum(approved))}</b></div>
        <div className="stat out"><span>Not billed yet</span><b>{money(sum(unbilled))}</b></div>
      </div>
      <button className="btn orange wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Add an extra</button>
      {unbilled.length > 0 && <button className="btn ghost wide" style={{ marginBottom: 14 }} onClick={bill}><Icon name="invoice" size={18} /> Put {unbilled.length} approved extra{unbilled.length > 1 ? 's' : ''} on a new invoice</button>}
      {extras.length === 0 && <Empty icon="extra" title="No extras yet" text="When the client asks for something extra, add it here with a price and get their OK. Approved extras go straight onto an invoice so nothing gets forgotten." />}
      {extras.map(e => (
        <button key={e.id} className="list-card" onClick={() => setEdit(e)}>
          <div className="text">
            <b>{e.data.text}</b>
            <span>{[e.data.location, niceDate(e.data.created, { noYear: true }), e.data.invoiced && 'On invoice'].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="r">
            <div style={{ fontWeight: 900 }}>{money(extraTotal(e.data))}</div>
            <span className={'status ' + e.data.status}>{STATUS[e.data.status]}</span>
          </div>
        </button>
      ))}
      {edit && <ExtraSheet extra={edit} job={job} jobId={id} onClose={() => setEdit(null)} />}
    </JobShell>
  )
}
