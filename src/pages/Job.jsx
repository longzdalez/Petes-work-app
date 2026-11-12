import { useState } from 'react'
import { useRecord, update, useList } from '../store'
import { Icon, TopBar, Field, Empty, PromptSheet } from '../ui'
import { nav } from '../router'
import { niceDate, money } from '../util'
import { JOB_STATUS, jobProgress, saveTemplate, smallImage, jobStatus } from '../jobs'
import { pickFile } from '../files'
import { TodoList } from '../Todos'

export const TABS = [
  { key: '', label: 'Overview', icon: 'info' },
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

function HubTile({ icon, label, onClick, badge, orange }) {
  return (
    <button className={'hub-tile' + (orange ? ' orange' : '')} onClick={onClick}>
      {badge ? <span className="hub-badge">{badge}</span> : null}
      <span className="hub-ic"><Icon name={icon} size={22} /></span>
      {label}
    </button>
  )
}

export function JobTodos({ id }) {
  const job = useRecord(id)
  return (
    <JobShell job={job} tab="" title="Job to-dos" onBack={() => nav(`/job/${id}`)}>
      <TodoList jobId={id} title="To-do for this job" />
      <p className="hint">These also show on the job's Schedule calendar in orange, and on the home page when they're due.</p>
    </JobShell>
  )
}

// What's being done and what it's worth: shown on the job page and in the hold-down details
export function ScopeAndValue({ job, compact }) {
  const d = job.data
  const set = patch => update(job.id, patch)
  const vt = d.valueType || 'quote'
  const body = <>
    <Field label={compact ? "Scope of works" : "What needs doing"} value={d.scope} onChange={v => set({ scope: v })} multiline rows={compact ? 4 : 6} placeholder="What needs doing on this job, e.g. strip out kitchen, move radiator, first and second fix electrics, plaster, fit units" />
    <label className="field"><span>Job value</span>
      <div className="seg small" style={{ margin: 0 }}>
        <button className={vt === 'estimate' ? 'on' : ''} onClick={() => set({ valueType: 'estimate' })}>Estimate</button>
        <button className={vt === 'quote' ? 'on' : ''} onClick={() => set({ valueType: 'quote' })}>Quotation</button>
      </div>
    </label>
    <Field label={vt === 'estimate' ? 'Estimate £' : 'Quotation £'} inputMode="decimal" value={d.value ?? ''} onChange={v => set({ value: v === '' ? '' : Number(String(v).replace(/[£,\s]/g, '')) || 0 })} placeholder="0.00" />
    <Field label="Details (optional)" value={d.valueNotes} onChange={v => set({ valueNotes: v })} multiline rows={2} placeholder="e.g. Includes materials, excludes kitchen units" />
  </>
  if (compact) return body
  return (
    <section className="card scope-card">
      <div className="card-head"><h2>Scope of works</h2>{d.value ? <span className="pill orange">{vt === 'estimate' ? 'Estimate' : 'Quote'} {money(d.value)}</span> : null}</div>
      {body}
    </section>
  )
}

export default function JobInfo({ id }) {
  const job = useRecord(id)
  const extras = useList('extra', r => r.job_id === id && r.data.status === 'pending')
  const snags = useList('snag', r => r.job_id === id && !r.data.done)
  const photos = useList('photo', r => r.job_id === id)
  const todos = useList('todo', r => r.job_id === id && !r.data.done)
  const [tpl, setTpl] = useState(false)
  if (!job) return <JobShell job={null} />
  const d = job.data
  const set = patch => update(job.id, patch)
  const prog = jobProgress(d)
  const go = p => nav(`/job/${id}/${p}`)
  const cover = async () => { const [f] = await pickFile({ accept: 'image/*' }); if (f) set({ cover: await smallImage(f, 900) }) }
  return (
    <JobShell job={job} tab="">
      <div className="job-hero">
        {d.cover && <img src={d.cover} alt="" onClick={cover} />}
        <div className="job-hero-body">
          <div className="small muted" style={{ fontWeight: 700, margin: '0 0 4px 2px' }}>Where is this job up to? Tap one:</div>
          <div className="status-row">
            {Object.entries(JOB_STATUS).map(([k, l]) => (
              <button key={k} className={'chip' + (jobStatus(d) === k ? ' on' : '')} onClick={() => set({ status: k })}>{l}</button>
            ))}
          </div>
          <div className="small muted" style={{ margin: '6px 0 0 2px' }}>{{ quoting: "You're still pricing this job up.", booked: 'The job is agreed and booked in.', onsite: "You're working on this job now.", finished: 'Done. It moves to the Finished list on the home page.' }[jobStatus(d)]}</div>
          {prog && <>
            <div className="progress"><div style={{ width: prog.pct + '%' }} /></div>
            <div className="small muted" style={{ marginTop: 6 }}>{prog.label}{d.finish ? ` · finishes ${niceDate(d.finish, { noYear: true })}` : ''}</div>
          </>}
          {!d.cover && <button className="btn ghost small" style={{ marginTop: 10 }} onClick={cover}><Icon name="camera" size={16} /> Add a cover photo</button>}
        </div>
      </div>

      <div className="hub">
        <HubTile icon="extra" label="Extras" badge={extras.length} orange onClick={() => go('extras')} />
        <HubTile icon="camera" label="Photo diary" badge={0} onClick={() => go('photos')} />
        <HubTile icon="snag" label="Snagging" badge={snags.length} onClick={() => go('snags')} />
        <HubTile icon="clock" label="Hours" onClick={() => go('hours')} />
        <HubTile icon="copy" label="Save as template" onClick={() => setTpl(true)} />
        <HubTile icon="check" label="To-do" badge={todos.length} onClick={() => go('todos')} />
      </div>
      {photos.length > 0 && <p className="hint" style={{ marginTop: -4 }}>{photos.length} progress photo{photos.length > 1 ? 's' : ''} in the diary</p>}
      <ScopeAndValue job={job} />

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
        {d.cover && <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => set({ cover: '' })}>Remove cover photo</button>}
      </section>
      <section className="card">
        <div className="card-head"><h2>Professional services</h2></div>
        {PROS.map(p => <ProBox key={p.key} job={job} pro={p} />)}
      </section>
      <section className="card">
        <div className="card-head"><h2>Notes</h2></div>
        <Field label="Anything else about this job" value={d.notes} onChange={v => set({ notes: v })} multiline />
      </section>
      <PromptSheet open={tpl} onClose={() => setTpl(false)} title="Save as a template" label="Template name" initial={d.name ? d.name + ' template' : ''}
        placeholder="e.g. Kitchen fit" saveLabel="Save template" onSave={n => { saveTemplate(id, n || 'Template'); alert('Template saved. Pick it next time you make a new job.') }}>
        <p className="small muted">This remembers this job's material folders and items, and the schedule, so your next similar job starts filled in.</p>
      </PromptSheet>
    </JobShell>
  )
}
