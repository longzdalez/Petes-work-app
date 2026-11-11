import { useEffect, useState } from 'react'
import { put, update, remove, useRecord, useList, list } from '../store'
import { Icon, Field, Empty, confirmDelete, Sheet } from '../ui'
import { whatsApp, shareText } from '../files'
import { addExtrasToInvoice } from './Extras'
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
export const isOverdue = d => d.type === 'invoice' && d.status !== 'paid' && d.status !== 'draft' && d.due && d.due < today()
const addDays = n => { const x = new Date(); x.setDate(x.getDate() + n); return ymd(x) }

// Turn an accepted quote into one invoice, or into stage-payment invoices
export function quoteToInvoice(quote, job) {
  const inv = newInvoice(job, 'invoice')
  update(inv.id, { lines: quote.data.lines, vatRate: quote.data.vatRate, notes: quote.data.notes, fromQuote: quote.data.number })
  update(quote.id, { status: 'accepted' })
  return inv
}

function StageSheet({ quote, job, onClose }) {
  const t = invoiceTotals(quote.data)
  const [stages, setStages] = useState([
    { name: 'Deposit', pct: 25, due: today() },
    { name: 'Stage payment', pct: 35, due: addDays(30) },
    { name: 'Final payment', pct: 40, due: job.data.finish || addDays(60) },
  ])
  const total = stages.reduce((s, x) => s + num(x.pct), 0)
  const setS = (i, p) => setStages(st => st.map((x, j) => j === i ? { ...x, ...p } : x))
  const create = () => {
    if (Math.round(total) !== 100) return alert(`The stages add up to ${total}%. Please make them add up to 100%.`)
    stages.forEach((st, i) => {
      const inv = newInvoice(job, 'invoice')
      update(inv.id, {
        due: st.due, vatRate: quote.data.vatRate, fromQuote: quote.data.number,
        lines: [{ item: `${st.name} (${num(st.pct)}% of quote ${quote.data.number})`, location: '', materials: '', labour: (t.sub * num(st.pct) / 100).toFixed(2) }],
        notes: `Stage ${i + 1} of ${stages.length} for quote ${quote.data.number}.`,
      })
    })
    update(quote.id, { status: 'accepted' })
    onClose(); nav(`/job/${job.id}/invoices`)
  }
  return (
    <Sheet open onClose={onClose} title="Stage payments">
      <p className="small muted" style={{ marginTop: 0 }}>Split quote {quote.data.number} ({money(t.total)}) into stage invoices. Each one is made ready to send on its date, and shows in Money as expected income.</p>
      {stages.map((st, i) => (
        <div key={i} className="stage-row">
          <input value={st.name} onChange={e => setS(i, { name: e.target.value })} />
          <input inputMode="decimal" value={st.pct} onChange={e => setS(i, { pct: e.target.value })} aria-label="Percent" />
          <input type="date" value={st.due} onChange={e => setS(i, { due: e.target.value })} />
          <button className="icon-btn small" onClick={() => setStages(s => s.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="close" size={16} /></button>
        </div>
      ))}
      <button className="add-line" onClick={() => setStages(s => [...s, { name: 'Stage payment', pct: 0, due: addDays(45) }])}><Icon name="plus" size={18} /> Add a stage</button>
      <div className="kv"><span>Adds up to</span><b className={Math.round(total) === 100 ? 'pos' : 'neg'}>{total}%</b></div>
      <button className="btn primary wide big" style={{ marginTop: 12 }} onClick={create}>Create {stages.length} invoices</button>
    </Sheet>
  )
}


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
                {isOverdue(i.data) ? <span className="status overdue">Overdue</span> : <span className={'status ' + (i.data.status || 'draft')}>{STATUS[i.data.status || 'draft']}</span>}
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
  const [staging, setStaging] = useState(false)
  const unbilled = useList('extra', r => r.job_id === id && r.data.status === 'approved' && !r.data.invoiced)
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
      {isOverdue(d) && <div className="notice" style={{ marginBottom: 14 }}>
        <b>Overdue by {Math.round((new Date(today()) - new Date(d.due)) / 864e5)} days.</b> Send the client a friendly reminder:
        <button className="btn orange wide" style={{ marginTop: 10 }} onClick={() => {
          const msg = `Hi${d.clientName ? ' ' + d.clientName.split(' ')[0] : ''}, just a friendly reminder that ${label.toLowerCase()} ${d.number} for ${money(t.total)} was due on ${niceDate(d.due)}. ${settings.business.bankName ? `Bank details: ${settings.business.bankName}, sort code ${settings.business.sortCode}, account ${settings.business.accountNo}. ` : ''}Thanks, ${settings.business.name || ''}`.trim()
          d.clientPhone ? whatsApp(d.clientPhone, msg) : shareText(msg, 'Payment reminder')
          set({ reminded: today() })
        }}><Icon name="chat" size={18} /> Send reminder on WhatsApp</button>
        {d.reminded && <div className="small" style={{ marginTop: 6 }}>Last reminder sent {niceDate(d.reminded)}</div>}
      </div>}
      {d.type === 'quote' && d.status !== 'accepted' && <section className="card">
        <div className="card-head"><h2>Client accepted?</h2></div>
        <div className="two">
          <button className="btn primary" onClick={() => { const i = quoteToInvoice(inv, job); nav(`/job/${id}/invoice/${i.id}`) }}>Turn into invoice</button>
          <button className="btn ghost" onClick={() => setStaging(true)}>Stage payments</button>
        </div>
      </section>}
      {d.type === 'invoice' && unbilled.length > 0 && d.status !== 'paid' && <button className="btn soft-orange wide" style={{ marginBottom: 14 }} onClick={() => addExtrasToInvoice(id, iid)}><Icon name="extra" size={18} /> Add {unbilled.length} approved extra{unbilled.length > 1 ? 's' : ''} to this invoice</button>}
      {staging && <StageSheet quote={inv} job={job} onClose={() => setStaging(false)} />}
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
