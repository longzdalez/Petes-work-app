import { useEffect, useState } from 'react'
import { put, update, remove, useRecord, useList, list } from '../store'
import { Icon, Field, Empty, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { nav } from '../router'
import { money, num, niceDate, today, ymd } from '../util'
import { invoiceTotals, pdfFile } from '../pdf'
import { useSettings } from './Settings'

function nextNumber(type) {
  const prefix = type === 'quote' ? 'Q-' : 'INV-'
  const nums = list('invoice', r => r.data.type === type).map(r => parseInt(String(r.data.number || '').replace(/\D/g, '')) || 0)
  return prefix + String(Math.max(0, ...nums) + 1).padStart(3, '0')
}

export function newInvoice(job, type) {
  const due = new Date(); due.setDate(due.getDate() + (type === 'quote' ? 30 : 14))
  return put('invoice', {
    type, number: nextNumber(type), date: today(), due: ymd(due), status: 'draft',
    clientName: job.data.client || '', clientAddress: job.data.address || '', clientEmail: job.data.clientEmail || '', clientPhone: job.data.clientPhone || '',
    jobName: job.data.name || '', vatRate: 0, notes: '',
    lines: [{ item: '', location: '', materials: '', labour: '' }],
  }, { job_id: job.id })
}

const STATUS = { draft: 'Draft', sent: 'Sent', paid: 'Paid', accepted: 'Accepted' }

export default function Invoices({ id }) {
  const job = useRecord(id)
  const invs = useList('invoice', r => r.job_id === id, (a, b) => b.data.created.localeCompare(a.data.created))
  if (!job) return <JobShell job={null} />
  const make = type => { const r = newInvoice(job, type); nav(`/job/${id}/invoice/${r.id}`) }
  return (
    <JobShell job={job} tab="invoices" title="Invoices & quotes">
      <div className="two">
        <button className="btn primary big" onClick={() => make('invoice')}><Icon name="plus" size={18} /> New invoice</button>
        <button className="btn ghost big" onClick={() => make('quote')}><Icon name="plus" size={18} /> New quote</button>
      </div>
      {invs.length === 0
        ? <Empty icon="invoice" title="No invoices or quotes yet" text="Client details from the job are filled in for you." />
        : <div className="inv-list">{invs.map(i => {
          const t = invoiceTotals(i.data)
          return (
            <div key={i.id} className="inv-card" onClick={() => nav(`/job/${id}/invoice/${i.id}`)}>
              <div>
                <div className="inv-num">{i.data.type === 'quote' ? 'Quote' : 'Invoice'} {i.data.number}</div>
                <div className="muted small">{niceDate(i.data.date)} · {i.data.clientName || 'No client'}</div>
              </div>
              <div className="r">
                <div className="inv-total">{money(t.total)}</div>
                <span className={'status ' + (i.data.status || 'draft')}>{STATUS[i.data.status || 'draft']}</span>
              </div>
            </div>
          )
        })}</div>}
    </JobShell>
  )
}

export function InvoiceEdit({ id, iid }) {
  const job = useRecord(id)
  const inv = useRecord(iid)
  const settings = useSettings()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])
  if (!inv) return <JobShell job={job} tab="invoices" title="Invoice" onBack={() => nav(`/job/${id}/invoices`)}><Empty title="This invoice was deleted" /></JobShell>
  const d = inv.data
  const set = p => update(iid, p)
  const setLine = (i, p) => set({ lines: d.lines.map((l, j) => j === i ? { ...l, ...p } : l) })
  const t = invoiceTotals(d)
  const label = d.type === 'quote' ? 'Quote' : 'Invoice'

  const share = async () => {
    setBusy(true)
    try {
      const file = pdfFile(inv, settings.business)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name, text: `${label} ${d.number} from ${settings.business.name || 'us'}: ${money(t.total)}` })
        if (d.status === 'draft') set({ status: 'sent' })
      } else {
        download(file)
        alert('Your phone saved the PDF. You can now attach it in WhatsApp or email.')
      }
    } catch (e) { if (e.name !== 'AbortError') alert(e.message) }
    setBusy(false)
  }
  const download = file => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name
    document.body.appendChild(a); a.click(); a.remove()
  }
  const markPaid = () => {
    set({ status: 'paid' })
    if (confirm(`Add ${money(t.total)} to Money in for this job?`)) put('money', { dir: 'in', cat: 'client', amount: t.total, date: today(), desc: `${label} ${d.number}`, status: 'paid' }, { job_id: id })
  }
  return (
    <JobShell job={job} tab="invoices" title={`${label} ${d.number}`} onBack={() => nav(`/job/${id}/invoices`)}>
      <div className="action-row">
        <button className="btn primary" disabled={busy} onClick={share}><Icon name="share" size={18} /> Send</button>
        <button className="btn ghost" onClick={() => download(pdfFile(inv, settings.business))}><Icon name="download" size={18} /> Save PDF</button>
        <button className="btn ghost" onClick={() => setPreview(URL.createObjectURL(pdfFile(inv, settings.business)))}>Preview</button>
      </div>
      {preview && <div className="card"><iframe title="Preview" className="pdf-preview" src={preview} /><button className="btn ghost wide" onClick={() => window.open(preview)}>Open full screen</button></div>}
      {!settings.business.name && <p className="notice small">Your business name, logo and bank details aren't added yet. <a href="#/settings">Add them in Settings</a> and they'll appear on every invoice.</p>}

      <section className="card">
        <div className="two">
          <Field label={`${label} number`} value={d.number} onChange={v => set({ number: v })} />
          <label className="field"><span>Status</span>
            <select value={d.status || 'draft'} onChange={e => e.target.value === 'paid' ? markPaid() : set({ status: e.target.value })}>
              {Object.entries(STATUS).filter(([k]) => d.type === 'quote' ? k !== 'paid' : k !== 'accepted').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="two">
          <Field label="Date" type="date" value={d.date} onChange={v => set({ date: v })} />
          <Field label={d.type === 'quote' ? 'Valid until' : 'Payment due'} type="date" value={d.due} onChange={v => set({ due: v })} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Client</h2></div>
        <Field label="Client name" value={d.clientName} onChange={v => set({ clientName: v })} />
        <Field label="Client address" value={d.clientAddress} onChange={v => set({ clientAddress: v })} multiline />
        <div className="two">
          <Field label="Phone" type="tel" value={d.clientPhone} onChange={v => set({ clientPhone: v })} />
          <Field label="Email" type="email" value={d.clientEmail} onChange={v => set({ clientEmail: v })} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Work</h2></div>
        {d.lines.map((l, i) => (
          <div key={i} className="line-item">
            <div className="line-top">
              <Field label={`Item ${i + 1}`} value={l.item} onChange={v => setLine(i, { item: v })} placeholder="e.g. Fit new kitchen" />
              <button className="icon-btn small" onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })} aria-label="Remove line"><Icon name="trash" size={18} /></button>
            </div>
            <Field label="Location" value={l.location} onChange={v => setLine(i, { location: v })} placeholder="e.g. Kitchen" />
            <div className="two">
              <Field label="Materials £" value={l.materials} inputMode="decimal" onChange={v => setLine(i, { materials: v })} />
              <Field label="Labour £" value={l.labour} inputMode="decimal" onChange={v => setLine(i, { labour: v })} />
            </div>
            <div className="line-total">Line total <b>{money(num(l.materials) + num(l.labour))}</b></div>
          </div>
        ))}
        <button className="add-line" onClick={() => set({ lines: [...d.lines, { item: '', location: '', materials: '', labour: '' }] })}><Icon name="plus" size={18} /> Add line</button>
      </section>

      <section className="card totals">
        <div className="kv"><span>Materials</span><b>{money(t.mat)}</b></div>
        <div className="kv"><span>Labour</span><b>{money(t.lab)}</b></div>
        <div className="kv"><span>VAT %</span><input className="vat" inputMode="decimal" value={d.vatRate || ''} placeholder="0" onChange={e => set({ vatRate: e.target.value })} /></div>
        {num(d.vatRate) > 0 && <div className="kv"><span>VAT</span><b>{money(t.vat)}</b></div>}
        <div className="kv grand"><span>Total</span><b>{money(t.total)}</b></div>
      </section>

      <section className="card">
        <Field label="Notes for this one (optional)" value={d.notes} onChange={v => set({ notes: v })} multiline />
      </section>
      <button className="btn danger wide" onClick={() => { if (confirmDelete(`this ${label.toLowerCase()}`)) { remove(iid); nav(`/job/${id}/invoices`) } }}><Icon name="trash" size={18} /> Delete {label.toLowerCase()}</button>
    </JobShell>
  )
}
