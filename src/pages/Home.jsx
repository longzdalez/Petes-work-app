import { useState } from 'react'
import { put, update, removeDeep, useList, useStatus, useVersion, cloudEnabled, list, get } from '../store'
import { Icon, Sheet, Field, TopBar, Empty, useLongPress, confirmDelete, SwipeRow, Logo } from '../ui'
import { ProfitRing, Glyph } from '../ui2'
import { jobMoney, shortMoney, todayItems, unpaidInvoices, urgentCount } from '../summary'
import { useSettings } from './Settings'
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
import { VehicleSheet, CarIcon } from '../Vehicle'

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
  const m = jobMoney(job)
  return (
    <div className="job-card2" {...lp} role="button" tabIndex={0}>
      <div className={'jc-cover st-' + st}>
        {d.cover ? <img src={d.cover} alt="" /> : <span className="jc-initials">{initials(d.name)}</span>}
        <span className={'status-pill on-cover st-' + st}>{JOB_STATUS[st]}</span>
      </div>
      <div className="jc-body">
        <div className="jc-main">
          <div className="job-name">{d.name || 'Untitled job'}</div>
          <div className="job-meta">{[d.client, d.address?.split('\n')[0]].filter(Boolean).join(' · ') || 'Hold to add details'}</div>
          {prog && st !== 'finished' ? <>
            <div className="progress"><div style={{ width: prog.pct + '%' }} /></div>
            <div className="job-start">{prog.label}</div>
          </> : st === 'finished' ? (d.finish && <div className="job-start">Finished {niceDate(d.finish)}</div>)
            : d.start && <div className="job-start">Starts {niceDate(d.start)}</div>}
        </div>
        {m.quote > 0 && <div className="jc-ring"><ProfitRing pct={m.left} /><span>{m.spent ? 'left of ' : 'of '}{shortMoney(m.quote)}</span></div>}
      </div>
      {m.warn && <div className="budget-warn"><Glyph name="warn" size={18} /> Costs are eating the profit: {money(m.spent)} spent so far</div>}
    </div>
  )
}

// Pick which job a receipt or payment is for
function JobPickSheet({ action, onClose }) {
  const jobs = useList('job', r => jobStatus(r.data) !== 'finished', (a, b) => (b.data.created || '').localeCompare(a.data.created || ''))
  if (!action) return null
  const go = j => { onClose(); nav(`/job/${j.id}/money?do=${action}`) }
  return (
    <Sheet open onClose={onClose} title={action === 'scan' ? 'Which job is the receipt for?' : 'Which job is the money for?'}>
      {jobs.length === 0 && <p className="muted">Make a job first, then add money to it.</p>}
      <div className="pick-list">
        {jobs.map(j => <button key={j.id} className="pick-row" onClick={() => go(j)}><span className="job-avatar small">{j.data.cover ? <img src={j.data.cover} alt="" /> : initials(j.data.name)}</span><span className="text"><b>{j.data.name || 'Untitled job'}</b><span>{j.data.client}</span></span><Icon name="right" size={20} /></button>)}
      </div>
      <p className="small muted">For business payments not tied to a job, like van finance, use Repeat payments on the home page.</p>
    </Sheet>
  )
}

function TodayCard() {
  useVersion()
  const items = todayItems()
  const shown = items.slice(0, 8)
  return (
    <section className="card today2">
      <div className="card-head"><h2>Today</h2><span className="pill">{items.length ? `${items.length} thing${items.length > 1 ? 's' : ''}` : 'All clear'}</span></div>
      {items.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nothing booked for today. Work from the Schedule, to-dos, urgent materials and payments due show here.</p>}
      {shown.map(it => (
        <button key={it.id} className="t-row" onClick={() => it.url && nav(it.url)}>
          <span className={'t-when' + (it.late || it.urgent ? ' late' : '')}>{it.label}</span>
          <span className="t-dot" style={{ background: it.color, boxShadow: `0 0 0 3px ${it.color}26` }} />
          <span className="t-text"><b>{it.title}{it.urgent && <em className="urgent-tag">Urgent</em>}</b>{it.sub && <span>{it.sub}</span>}</span>
          {it.amount ? <span className={'t-amt ' + (it.dir === 'in' ? 'pos' : 'neg')}>{it.dir === 'in' ? '+' : '−'}{money(it.amount)}</span> : null}
        </button>
      ))}
      {items.length > shown.length && <p className="small muted" style={{ margin: '8px 0 0' }}>…and {items.length - shown.length} more</p>}
    </section>
  )
}

// Jobs in the order the owner set (newest unmoved jobs first, then the ones that have been moved)
const sortJobs = (a, b) => {
  const ao = a.data.order, bo = b.data.order
  if (ao != null && bo != null) return ao - bo
  if (ao != null) return 1
  if (bo != null) return -1
  return (b.data.created || '').localeCompare(a.data.created || '')
}
// Move a job one place up (-1) or down (+1) among the jobs on show
function moveJob(id, dir, shown) {
  const all = list('job').sort(sortJobs)
  all.forEach((j, i) => { if (j.data.order !== i) update(j.id, { order: i }) })
  const at = shown.findIndex(j => j.id === id), other = shown[at + dir]
  if (at < 0 || !other) return
  const a = all.findIndex(j => j.id === id), b = all.findIndex(j => j.id === other.id)
  update(id, { order: b }); update(other.id, { order: a })
}

function ReorderRow({ job, first, last, onMove }) {
  const d = job.data
  return (
    <div className="reorder-row">
      <span className="job-avatar small">{d.cover ? <img src={d.cover} alt="" /> : initials(d.name)}</span>
      <span className="text"><b>{d.name || 'Untitled job'}</b><span>{JOB_STATUS[jobStatus(d)]}{d.client ? ` · ${d.client}` : ''}</span></span>
      <button className="move-btn" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${d.name || 'job'} up`}><Icon name="up" size={22} stroke={2.6} /></button>
      <button className="move-btn" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${d.name || 'job'} down`}><Icon name="down" size={22} stroke={2.6} /></button>
    </div>
  )
}

// The Finished jobs folder: every job set to Finished, newest first
export function FinishedJobs() {
  const jobs = useList('job', r => r.data.status === 'finished', (a, b) => (b.data.finish || b.data.created || '').localeCompare(a.data.finish || a.data.created || ''))
  const [editing, setEditing] = useState(null)
  const editJob = jobs.find(j => j.id === editing)
  return (
    <div className="page">
      <TopBar title="Finished jobs" sub={`${jobs.length} job${jobs.length === 1 ? '' : 's'}`} onBack={() => nav('/')} />
      <main className="content">
        {jobs.length === 0
          ? <Empty icon="folder" title="No finished jobs yet" text="When a job is done, set it to Finished and it moves into this folder." />
          : <div className="job-list">{jobs.map(j => <JobCard key={j.id} job={j} onLong={j => setEditing(j.id)} />)}</div>}
        {jobs.length > 0 && <p className="hint">Tap a job to open it. Hold it to change its details. Set it back to On site to move it out of this folder.</p>}
      </main>
      <JobDetailsSheet job={editJob} onClose={() => setEditing(null)} />
    </div>
  )
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

// Everything that needs attention across every job
export default function Home() {
  const jobs = useList('job', r => r.data.status !== 'finished', sortJobs)
  const allJobs = useList('job')
  const finished = allJobs.filter(j => j.data.status === 'finished')
  const [ordering, setOrdering] = useState(false)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState(null)
  const [car, setCar] = useState(false)
  const st = useStatus()
  const settings = useSettings()
  const editJob = jobs.find(j => j.id === editing)
  const owed = unpaidInvoices()
  const owedTotal = owed.reduce((s, r) => s + invoiceTotals(r.data).total, 0)
  const urgent = urgentCount()
  const onsite = allJobs.filter(j => jobStatus(j.data) === 'onsite')
  const t = today()
  const people = new Set(list('task', r => r.data.date === t && r.data.trade_id && onsite.some(j => j.id === r.job_id)).map(r => r.data.trade_id)).size
  const summary = [onsite.length ? `${onsite.length} job${onsite.length > 1 ? 's' : ''} on site` : 'No jobs on site', urgent ? `${urgent} urgent` : 'nothing urgent'].join(' · ')
  return (
    <div className="page">
      <header className="home-hero">
        <div className="hh-top">
          <Logo />
          <button className="hh-btn" onClick={() => nav('/search')} aria-label="Search"><Icon name="search" size={20} /></button>
          <button className="hh-btn" onClick={() => nav('/settings')} aria-label="Settings">
            {cloudEnabled && <span className={'sync-dot ' + (st.signedIn && !st.error ? 'ok' : 'bad')} />}
            <Icon name="settings" size={20} /></button>
        </div>
        <div className="hh-greet">{greeting()}{settings.owners[0] ? `, ${settings.owners[0]}` : ''}</div>
        <div className="hh-sum">{summary}</div>
      </header>
      <main className="content home-content">
        <div className="hero-stats">
          <div className="hs"><span>Owed to you</span><b className="pos">{shortMoney(owedTotal)}</b><small>{owed.length} invoice{owed.length === 1 ? '' : 's'}</small></div>
          <div className={'hs' + (urgent ? ' hot' : '')}><span>Urgent</span><b>{urgent}</b><small>due in 2 days</small></div>
          <div className="hs"><span>On site</span><b className="pos">{onsite.length} job{onsite.length === 1 ? '' : 's'}</b><small>{people ? `${people} ${people === 1 ? 'person' : 'people'} today` : 'nobody booked'}</small></div>
        </div>
        <div className="quick">
          <button onClick={() => setPick('scan')}><span className="q-ic orange"><Icon name="receipt" size={24} /></span>Scan receipt</button>
          <button onClick={() => setPick('add')}><span className="q-ic green"><Icon name="money" size={24} /></span>Add money</button>
          <button onClick={() => setCar(true)} aria-label="Vehicle costs: ULEZ, congestion, fuel, tickets"><span className="q-ic white"><CarIcon /></span></button>
          <button onClick={() => setAdding(true)}><span className="q-ic white"><Icon name="plus" size={24} /></span>New job</button>
          <button onClick={() => document.getElementById('home-todo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span className="q-ic white"><Icon name="check" size={24} /></span>To-do</button>
        </div>
        <BackupReminder />
        <TodayCard />
        <div id="home-todo" className="anchor"><TodoList title="To-do" /></div>
        <GeneralCashFlow />
        <div className="home-tools">
          <button className="btn ghost" onClick={() => nav('/contacts')}><Icon name="users" size={18} /> Contacts</button>
          <button className="btn ghost" onClick={() => nav('/renewals')}><Icon name="shield" size={18} /> Renewals</button>
          <button className="btn ghost" onClick={() => nav('/cashflow')}><Icon name="money" size={18} /> Repeat payments</button>
        </div>
        <div className="section-head">
          <h2>Jobs</h2>
          <div className="head-btns">
            {jobs.length > 1 && <button className={'btn small ' + (ordering ? 'orange' : 'ghost')} onClick={() => setOrdering(o => !o)}>{ordering ? 'Done' : <><Icon name="up" size={16} /> Reorder</>}</button>}
            {!ordering && <button className="btn primary small" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> New job</button>}
          </div>
        </div>
        {jobs.length === 0
          ? <Empty icon="folder" title={finished.length ? 'No current jobs' : 'No jobs yet'} text="Press New job to add one. Each job has its own pages for Materials, Money and Schedule, plus Documents, Invoices and more under More at the bottom of the job." />
          : ordering
            ? <div className="reorder-list">{jobs.map((j, i) => <ReorderRow key={j.id} job={j} first={i === 0} last={i === jobs.length - 1} onMove={dir => moveJob(j.id, dir, jobs)} />)}</div>
            : <div className="job-list">{jobs.map(j => <JobCard key={j.id} job={j} onLong={j => setEditing(j.id)} />)}</div>}
        {jobs.length > 0 && <p className="hint">{ordering ? 'Use the arrows to put your most important jobs first. Tap Done when finished.' : 'Tap a job to open it. Press and hold to change its details or status. Tap Reorder to move jobs up or down. Finished jobs go into the folder below.'}</p>}
        {!ordering && <button className="finished-folder" onClick={() => nav('/finished')}>
          <span className="ff-ic"><Icon name="folder" size={26} /></span>
          <span className="ff-text"><b>Finished jobs</b><small>{finished.length ? `${finished.length} job${finished.length === 1 ? '' : 's'} done` : 'Jobs set to Finished go in here'}</small></span>
          <span className="pill">{finished.length}</span>
          <Icon name="right" size={20} />
        </button>}
      </main>
      <JobDetailsSheet job={editJob} onClose={() => setEditing(null)} />
      <NewJobSheet open={adding} onClose={() => setAdding(false)} />
      <JobPickSheet action={pick} onClose={() => setPick(null)} />
      <VehicleSheet open={car} onClose={() => setCar(false)} />
    </div>
  )
}
