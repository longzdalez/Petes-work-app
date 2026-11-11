import { useRecord, update } from '../store'
import { Icon, TopBar, Field, Empty } from '../ui'
import { nav } from '../router'
import { niceDate } from '../util'

export const TABS = [
  { key: '', label: 'Job', icon: 'info' },
  { key: 'docs', label: 'Documents', icon: 'docs' },
  { key: 'materials', label: 'Materials', icon: 'materials' },
  { key: 'money', label: 'Money', icon: 'money' },
  { key: 'schedule', label: 'Schedule', icon: 'schedule' },
  { key: 'invoices', label: 'Invoices', icon: 'invoice' },
]

export function JobShell({ job, tab, title, onBack, right, children }) {
  if (!job) return <div className="page"><TopBar title="Job not found" onBack={() => nav('/')} /><Empty title="This job has been deleted" /></div>
  return (
    <div className="page with-tabs">
      <TopBar title={title || job.data.name || 'Job'} sub={title ? job.data.name : job.data.client} onBack={onBack || (() => nav('/'))} right={right} />
      <main className="content">{children}</main>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => nav(`/job/${job.id}${t.key ? '/' + t.key : ''}`)}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const PROS = [
  { key: 'architect', label: 'Architect' },
  { key: 'engineer', label: 'Engineer' },
  { key: 'council', label: 'Local authority / council' },
]

function ProBox({ job, pro }) {
  const p = job.data.pros?.[pro.key] || {}
  const set = patch => update(job.id, { pros: { ...(job.data.pros || {}), [pro.key]: { ...p, ...patch } } })
  return (
    <details className="pro-box" open={!!(p.name || p.phone)}>
      <summary><span>{pro.label}</span><span className="muted small">{p.name || 'Tap to add'}</span></summary>
      <Field label="Name / company" value={p.name} onChange={v => set({ name: v })} />
      <div className="two">
        <Field label="Phone" type="tel" value={p.phone} onChange={v => set({ phone: v })} />
        <Field label="Email" type="email" value={p.email} onChange={v => set({ email: v })} />
      </div>
      <Field label="Reference / notes" value={p.notes} onChange={v => set({ notes: v })} multiline />
      {p.phone && <a className="btn ghost" href={`tel:${p.phone}`}><Icon name="phone" size={18} /> Call {pro.label.split(' ')[0]}</a>}
    </details>
  )
}

export default function JobInfo({ id }) {
  const job = useRecord(id)
  if (!job) return <JobShell job={null} />
  const d = job.data
  const set = patch => update(job.id, patch)
  return (
    <JobShell job={job} tab="">
      <section className="card">
        <div className="card-head"><h2>Job information</h2><span className="muted small">Created {niceDate(d.created)}</span></div>
        <Field label="Job name" value={d.name} onChange={v => set({ name: v })} />
        <Field label="Client name" value={d.client} onChange={v => set({ client: v })} />
        <div className="two">
          <Field label="Client phone" type="tel" value={d.clientPhone} onChange={v => set({ clientPhone: v })} />
          <Field label="Client email" type="email" value={d.clientEmail} onChange={v => set({ clientEmail: v })} />
        </div>
        <Field label="Address" value={d.address} onChange={v => set({ address: v })} multiline />
        <div className="two">
          <Field label="Start date" type="date" value={d.start} onChange={v => set({ start: v })} />
          <Field label="Finish date" type="date" value={d.finish} onChange={v => set({ finish: v })} />
        </div>
        {d.address && <a className="btn ghost" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(d.address)}`}>Open in maps</a>}
      </section>
      <section className="card">
        <div className="card-head"><h2>Professional services</h2></div>
        {PROS.map(p => <ProBox key={p.key} job={job} pro={p} />)}
      </section>
      <section className="card">
        <div className="card-head"><h2>Notes</h2></div>
        <Field label="Anything else about this job" value={d.notes} onChange={v => set({ notes: v })} multiline />
      </section>
    </JobShell>
  )
}
