import { useState } from 'react'
import { put, update, removeDeep, useList, useStatus, cloudEnabled } from '../store'
import { Icon, Sheet, Field, TopBar, Empty, useLongPress, confirmDelete } from '../ui'
import { niceDate, today, initials } from '../util'
import { nav } from '../router'

export function JobDetailsSheet({ job, onClose }) {
  if (!job) return null
  const d = job.data
  const set = patch => update(job.id, patch)
  return (
    <Sheet open onClose={onClose} title="Job details">
      <div className="created">Created {niceDate(d.created)}</div>
      <Field label="Job name" value={d.name} onChange={v => set({ name: v })} />
      <Field label="Client name" value={d.client} onChange={v => set({ client: v })} />
      <Field label="Address" value={d.address} onChange={v => set({ address: v })} multiline />
      <Field label="Start date" type="date" value={d.start} onChange={v => set({ start: v })} />
      <div className="sheet-actions">
        <button className="btn danger" onClick={() => { if (confirmDelete('this job and everything in it')) { removeDeep(job.id); onClose() } }}>
          <Icon name="trash" size={18} /> Delete job
        </button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
}

function JobCard({ job, onLong }) {
  const d = job.data
  const lp = useLongPress(() => onLong(job), () => nav(`/job/${job.id}`))
  return (
    <div className="job-card" {...lp} role="button" tabIndex={0}>
      <div className="job-avatar">{initials(d.name)}</div>
      <div className="job-main">
        <div className="job-name">{d.name || 'Untitled job'}</div>
        <div className="job-meta">{[d.client, d.address].filter(Boolean).join(' · ') || 'Hold to add details'}</div>
        {d.start && <div className="job-start">Starts {niceDate(d.start)}</div>}
      </div>
      <Icon name="right" style={{ color: '#9aa6b8' }} />
    </div>
  )
}

function TodoBox() {
  const t = today()
  const todos = useList('todo', r => !r.job_id && (!r.data.done || r.data.doneOn === t) && (r.data.date || t) <= t,
    (a, b) => (a.data.done - b.data.done) || a.data.created.localeCompare(b.data.created))
  const [text, setText] = useState('')
  const add = () => { if (!text.trim()) return; put('todo', { text: text.trim(), date: t, done: false }); setText('') }
  return (
    <section className="card todo-card">
      <div className="card-head"><h2>Today's to-do</h2><span className="pill">{todos.filter(x => !x.data.done).length} left</span></div>
      {todos.length === 0 && <p className="muted small">Nothing yet. Add something below or use the microphone.</p>}
      <ul className="checklist">
        {todos.map(td => (
          <li key={td.id} className={td.data.done ? 'done' : ''}>
            <button className={'tick' + (td.data.done ? ' on' : '')} onClick={() => update(td.id, { done: !td.data.done, doneOn: t })} aria-label="Tick">
              {td.data.done && <Icon name="check" size={16} stroke={3} />}
            </button>
            <span className="text">{td.data.text}{td.data.date < t && !td.data.done && <em className="overdue"> · from {niceDate(td.data.date, { noYear: true })}</em>}</span>
            <button className="icon-btn small" onClick={() => removeDeep(td.id)} aria-label="Delete"><Icon name="close" size={16} /></button>
          </li>
        ))}
      </ul>
      <div className="add-row">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a to-do…" onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="btn primary" onClick={add}><Icon name="plus" size={18} /></button>
      </div>
    </section>
  )
}

export default function Home() {
  const jobs = useList('job', null, (a, b) => (b.data.created || '').localeCompare(a.data.created || ''))
  const [editing, setEditing] = useState(null)
  const st = useStatus()
  const newJob = () => {
    const name = window.prompt('Name the new job')
    if (name === null) return
    const j = put('job', { name: name.trim() || 'New job' })
    put('folder', { name: 'General', order: 0 }, { job_id: j.id })
    nav(`/job/${j.id}`)
  }
  const editJob = jobs.find(j => j.id === editing)
  return (
    <div className="page">
      <TopBar title="Jobs" sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        right={<button className="icon-btn" onClick={() => nav('/settings')} aria-label="Settings">
          {cloudEnabled && <span className={'sync-dot ' + (st.signedIn && !st.error ? 'ok' : 'bad')} />}
          <Icon name="settings" /></button>} />
      <main className="content">
        <TodoBox />
        <div className="section-head">
          <h2>Your jobs</h2>
          <button className="btn primary" onClick={newJob}><Icon name="plus" size={18} /> New job</button>
        </div>
        {jobs.length === 0
          ? <Empty icon="folder" title="No jobs yet" text="Press New job to add your first one. Each job has its own pages for Documents, Materials, Money, Schedule and Invoices, which open from the toolbar at the bottom of the job." />
          : <div className="job-list">{jobs.map(j => <JobCard key={j.id} job={j} onLong={j => setEditing(j.id)} />)}</div>}
        {jobs.length > 0 && <p className="hint">Tap a job to open its Documents, Materials, Money, Schedule and Invoices. Press and hold to rename it or change its details.</p>}
      </main>
      <JobDetailsSheet job={editJob} onClose={() => setEditing(null)} />
    </div>
  )
}
