import { useState } from 'react'
import { put, update, removeDeep, useList, useStatus, cloudEnabled, list, get } from '../store'
import { Icon, Sheet, Field, TopBar, Empty, useLongPress, confirmDelete, SwipeRow, Logo } from '../ui'
import { niceDate, today, initials, money, parseYmd, ymd, shortDate } from '../util'
import { nav } from '../router'
import { BackupReminder } from '../Backup'
import { JOB_STATUS, jobProgress, applyTemplate, smallImage, jobStatus } from '../jobs'
import { pickFile } from '../files'
import { invoiceTotals } from '../pdf'
import { extraTotal } from './Extras'
import { daysUntil } from './Contacts'
import { TodoList } from '../Todos'
import { ScopeAndValue } from './Job'
import { GeneralCashFlow } from './CashFlow'

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
      <ScopeAndValue job={job} compact />
      <label className="field"><span>Status</span>
        <div className="chips">{Object.entries(JOB_STATUS).map(([k, l]) => <button key={k} className={'chip' + (jobStatus(d) === k ? ' on' : '')} onClick={() => set({ status: k })}>{l}</button>)}</div>
      </label>
      <button className="btn ghost wide" style={{ marginBottom: 6 }} onClick={async () => { const [f] = await pickFile(); if (f) set({ cover: await smallImage(f, 900) }) }}>
        <Icon name="camera" size={18} /> {d.cover ? 'Change cover photo' : 'Add a cover photo'}
      </button>
      <div className="sheet-actions">
        <button className="btn danger" onClick={() => { if (confirmDelete('this job and everything in it')) { removeDeep(job.id); onClose() } }}>
          <Icon name="trash" size={18} /> Delete job
        </button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
}

function NewJobSheet({ open, onClose }) {
  const templates = useList('template', null, (a, b) => b.data.created.localeCompare(a.data.created))
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [start, setStart] = useState('')
  const [tpl, setTpl] = useState('')
  if (!open) return null
  const create = () => {
    const j = put('job', { name: name.trim() || 'New job', client: client.trim(), start })
    const t = templates.find(t => t.id === tpl)
    if (t) applyTemplate(t, j.id, start)
    else put('folder', { name: 'General', order: 0 }, { job_id: j.id })
    setName(''); setClient(''); setStart(''); setTpl('')
    onClose(); nav(`/job/${j.id}`)
  }
  return (
    <Sheet open onClose={onClose} title="New job">
      <label className="field"><span>Job name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Smith rear extension" /></label>
      <div className="two">
        <label className="field"><span>Client</span><input value={client} onChange={e => setClient(e.target.value)} /></label>
        <label className="field"><span>Start date</span><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      </div>
      {templates.length > 0 && <label className="field"><span>Start from a template</span>
        <div className="chips">
          <button className={'chip' + (!tpl ? ' on' : '')} onClick={() => setTpl('')}>Blank job</button>
          {templates.map(t => <button key={t.id} className={'chip' + (tpl === t.id ? ' on' : '')} onClick={() => setTpl(t.id)}>{t.data.name}</button>)}
        </div>
      </label>}
      <button className="btn primary wide big" onClick={create}><Icon name="plus" size={18} /> Create job</button>
    </Sheet>
  )
}

function JobCard({ job, onLong }) {
  const d = job.data
  const lp = useLongPress(() => onLong(job), () => nav(`/job/${job.id}`))
  const prog = jobProgress(d)
  const st = jobStatus(d)
  return (
    <div className="job-card" {...lp} role="button" tabIndex={0}>
      <div className="job-avatar">{d.cover ? <img src={d.cover} alt="" /> : initials(d.name)}</div>
      <div className="job-main">
        <div className="job-top"><div className="job-name">{d.name || 'Untitled job'}</div><span className={'status-pill st-' + st}>{JOB_STATUS[st]}</span></div>
        <div className="job-meta">{[d.client, d.address].filter(Boolean).join(' · ') || 'Hold to add details'}</div>
        {prog && st !== 'finished' ? <>
          <div className="progress"><div style={{ width: prog.pct + '%' }} /></div>
          <div className="job-start">{prog.label}</div>
        </> : d.start && <div className="job-start">Starts {niceDate(d.start)}</div>}
      </div>
    </div>
  )
}

// Everything that needs attention across every job
export default function Home() {
  const [filter, setFilter] = useState('active')
  const jobs = useList('job', r => filter === 'all' || (filter === 'finished' ? r.data.status === 'finished' : r.data.status !== 'finished'),
    (a, b) => (b.data.created || '').localeCompare(a.data.created || ''))
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const st = useStatus()
  const editJob = jobs.find(j => j.id === editing)
  return (
    <div className="page">
      <TopBar title={<Logo />}
        right={<>
          <button className="icon-btn" onClick={() => nav('/search')} aria-label="Search"><Icon name="search" /></button>
          <button className="icon-btn" onClick={() => nav('/settings')} aria-label="Settings">
            {cloudEnabled && <span className={'sync-dot ' + (st.signedIn && !st.error ? 'ok' : 'bad')} />}
            <Icon name="settings" /></button>
        </>} />
      <main className="content">
        <BackupReminder />
        <div className="home-tools">
          <button className="btn ghost" onClick={() => nav('/contacts')}><Icon name="users" size={18} /> Contacts</button>
          <button className="btn ghost" onClick={() => nav('/renewals')}><Icon name="shield" size={18} /> Renewals</button>
          <button className="btn ghost" onClick={() => nav('/search')}><Icon name="search" size={18} /> Search</button>
        </div>
        <TodoList title="To-do" />
        <GeneralCashFlow />
        <div className="section-head">
          <h2>Jobs</h2>
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> New job</button>
        </div>
        <div className="seg small" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[['active', 'Current'], ['finished', 'Finished'], ['all', 'All']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        {jobs.length === 0
          ? <Empty icon="folder" title={filter === 'finished' ? 'No finished jobs' : 'No jobs yet'} text="Press New job to add one. Each job has its own pages for Documents, Materials, Money, Schedule and Invoices, which open from the toolbar at the bottom of the job." />
          : <div className="job-list">{jobs.map(j => <JobCard key={j.id} job={j} onLong={j => setEditing(j.id)} />)}</div>}
        {jobs.length > 0 && <p className="hint">Tap a job to open it. Press and hold to change its details or status. Set a job to Finished to move it off this list.</p>}
      </main>
      <JobDetailsSheet job={editJob} onClose={() => setEditing(null)} />
      <NewJobSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
