import { useState } from 'react'
import { put, update, removeDeep, useList, useStatus, cloudEnabled, list } from '../store'
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
import { canNotify, remindersOn, enableReminders } from '../reminders'

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
function TodayCard() {
  useList('job')
  const [remindersPrompt, setRP] = useState(() => canNotify() && !remindersOn() && localStorage.getItem('pw_notify_ask') !== 'no')
  const t = today()
  const plus = n => { const d = parseYmd(t); d.setDate(d.getDate() + n); return ymd(d) }
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j]))
  const live = r => jobs[r.job_id] && jobStatus(jobs[r.job_id].data) !== 'finished'
  const jn = r => jobs[r.job_id]?.data.name || ''
  const groups = []
  const work = list('task', r => live(r) && r.data.date === t && !r.data.done)
  const jobTodos = list('todo', r => live(r) && !r.data.done && (r.data.date || t) <= t)
  if (jobTodos.length) groups.push({ title: 'Job to-dos', rows: jobTodos.map(r => ({ id: r.id, icon: 'check', tone: r.data.date < t ? 'red' : '', text: r.data.text, sub: `${jn(r)}${r.data.time ? ' · ' + r.data.time : ''}${r.data.date < t ? ' · from ' + shortDate(r.data.date) : ''}`, go: `/job/${r.job_id}/todos` })) })
  if (work.length) groups.push({ title: 'On site today', rows: work.map(r => ({ id: r.id, icon: 'schedule', text: r.data.text, sub: jn(r), go: `/job/${r.job_id}/schedule` })) })
  const folders = Object.fromEntries(list('folder').map(f => [f.id, f]))
  const mats = list('material', r => live(r) && folders[r.data.folder_id] && !r.data.done && r.data.date && r.data.text && r.data.date <= plus(7)).sort((a, b) => a.data.date.localeCompare(b.data.date))
  if (mats.length) groups.push({
    title: 'Materials to order', rows: mats.map(r => {
      const soon = r.data.date <= plus(2)
      return { id: r.id, icon: 'materials', tone: r.data.date < t ? 'red' : soon ? 'orange' : '', text: r.data.text, sub: `${jn(r)} · needed ${r.data.date < t ? 'by ' : ''}${shortDate(r.data.date)}${soon ? (r.data.date < t ? ' (late)' : ' (order now)') : ''}`, go: `/job/${r.job_id}/folder/${r.data.folder_id}` }
    })
  })
  const invs = list('invoice', r => jobs[r.job_id] && r.data.type === 'invoice' && r.data.status !== 'paid' && r.data.status !== 'draft' && r.data.due && r.data.due <= plus(7))
  const money_ = list('money', r => jobs[r.job_id] && r.data.status === 'upcoming' && r.data.date <= plus(7))
  const pay = [
    ...invs.map(r => ({ id: r.id, icon: 'invoice', tone: r.data.due < t ? 'red' : 'orange', text: `${r.data.number} · ${money(invoiceTotals(r.data).total)}`, sub: `${jn(r)} · ${r.data.due < t ? 'overdue since' : 'due'} ${shortDate(r.data.due)}`, go: `/job/${r.job_id}/invoice/${r.id}` })),
    ...money_.map(r => ({ id: r.id, icon: 'money', tone: r.data.date < t ? 'red' : '', text: `${r.data.dir === 'in' ? 'Coming in' : 'To pay'}: ${money(r.data.amount)}`, sub: `${jn(r)} · ${r.data.desc || ''} ${shortDate(r.data.date)}`, go: `/job/${r.job_id}/money` })),
  ]
  if (pay.length) groups.push({ title: 'Money due', rows: pay })
  const extras = list('extra', r => jobs[r.job_id] && r.data.status === 'pending')
  if (extras.length) groups.push({ title: 'Extras waiting for client OK', rows: extras.map(r => ({ id: r.id, icon: 'extra', tone: 'orange', text: `${r.data.text} · ${money(extraTotal(r.data))}`, sub: jn(r), go: `/job/${r.job_id}/extras` })) })
  const ren = list('renewal', r => daysUntil(r.data.expiry) <= 30)
  if (ren.length) groups.push({ title: 'Renewals', rows: ren.map(r => { const n = daysUntil(r.data.expiry); return { id: r.id, icon: 'shield', tone: n < 0 ? 'red' : 'orange', text: r.data.name, sub: n < 0 ? `Expired ${niceDate(r.data.expiry)}` : `Expires in ${n} days`, go: '/renewals' } }) })
  return (
    <section className="card today-card">
      <div className="card-head"><h2>Today</h2><span className="pill orange">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
      <p className="small muted" style={{ margin: '-4px 0 10px' }}>This fills itself in from all your jobs: work planned for today, materials to order, job to-dos, money due, extras waiting and renewals. You don't add to it directly.</p>
      {groups.length === 0 && <div className="all-clear"><Icon name="check" size={18} /> Nothing needs you today.</div>}
      {remindersPrompt && <div className="remind-prompt">
        <span className="small"><b>Get a phone reminder</b> 2 days before anything marked urgent.</span>
        <button className="btn primary small" onClick={async () => { try { await enableReminders(); setRP(false) } catch (e) { alert(e.message) } }}>Turn on</button>
        <button className="icon-btn small" onClick={() => { localStorage.setItem('pw_notify_ask', 'no'); setRP(false) }} aria-label="Not now"><Icon name="close" size={16} /></button>
      </div>}
      {groups.map(g => (
        <div key={g.title} className="today-group">
          <h3>{g.title}</h3>
          {g.rows.slice(0, 5).map(r => (
            <div key={r.id} className="today-row" onClick={() => nav(r.go)} role="button">
              <span className={'today-ic ' + (r.tone || '')}><Icon name={r.icon} size={17} /></span>
              <span className="text"><b>{r.text}</b><span>{r.sub}</span></span>
              <Icon name="right" size={18} style={{ color: '#a3b3aa' }} />
            </div>
          ))}
          {g.rows.length > 5 && <div className="small muted" style={{ paddingLeft: 6 }}>and {g.rows.length - 5} more</div>}
        </div>
      ))}
    </section>
  )
}

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
        <TodayCard />
        <div className="home-tools">
          <button className="btn ghost" onClick={() => nav('/contacts')}><Icon name="users" size={18} /> Contacts</button>
          <button className="btn ghost" onClick={() => nav('/renewals')}><Icon name="shield" size={18} /> Renewals</button>
          <button className="btn ghost" onClick={() => nav('/search')}><Icon name="search" size={18} /> Search</button>
        </div>
        <TodoList title="To-do" />
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
