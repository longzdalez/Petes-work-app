import { useEffect, useRef, useState } from 'react'
import { put, update, removeDeep, useList, useStatus, useVersion, cloudEnabled, list, get } from '../store'
import { Icon, Sheet, Field, TopBar, Empty, useLongPress, confirmDelete, SwipeRow, Logo } from '../ui'
import { ProfitRing, Glyph } from '../ui2'
import { jobMoney, shortMoney, todayItems, unpaidInvoices, urgentCount } from '../summary'
import { useSettings } from './Settings'
import { niceDate, today, initials, money, parseYmd, ymd, shortDate, URGENCY, vibrate } from '../util'
import { nav } from '../router'
import { BackupReminder } from '../Backup'
import { JOB_STATUS, jobProgress, applyTemplate, smallImage, jobStatus } from '../jobs'
import { pickFile } from '../files'
import { invoiceTotals } from '../pdf'
import { extraTotal } from './Extras'
import { daysUntil, ContactsBox } from './Contacts'
import { TodoList } from '../Todos'
import { ScopeAndValue } from './Job'
import { GeneralCashFlow } from './CashFlow'
import { MoneyCentreCard } from './MoneyCentre'
import { MaterialsAllJobs } from './MaterialsAll'
import { JobListPage } from './JobList'
import { VehicleSheet, CarIcon } from '../Vehicle'
import { JobCalendar } from './Calendar'
import QuickMoney, { SavedToast } from '../QuickMoney'
import '../home-pager.css'
import '../home-calendar.css'
import '../gestures.css'
import '../jobs-compact.css'

// The home pages. Swipe anywhere on the page to turn it, or scroll the bar and tap a tab to jump straight there
const PAGE_TABS = ['Today', 'To-do', 'To Get', 'Money', 'Job list', 'Materials', 'Jobs', 'Calendar', 'Contacts']
// Each tab keeps its own colour dot wherever it sits on the bar
const TAB_COLOUR = { Today: 0, 'To-do': 1, 'To Get': 2, Money: 3, 'Job list': 4, Materials: 5, Calendar: 7, Contacts: 8, Jobs: 9 }

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
    <Sheet open={open} onClose={onClose} title="New job">
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
        {d.cover && <img src={d.cover} alt="" />}
        <span className={'status-pill on-cover st-' + st}>{JOB_STATUS[st]}</span>
      </div>
      <div className="jc-body">
        <div className="jc-main">
          <div className="job-name">{d.client || d.name || 'Untitled job'}</div>
          <div className="job-meta">{d.address?.split('\n')[0] || 'No address yet'}</div>
          <div className="jc-scope">{d.scope || 'No scope of works yet'}</div>
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

// Most urgent first: red (urgent or late) at the top, then amber, then the rest
const urgencyRank = it => (it.urgent || it.late || it.color === URGENCY.red.color) ? 0 : it.color === URGENCY.amber.color ? 1 : 2

function TodayCard() {
  useVersion()
  const items = [...todayItems()].sort((a, b) => urgencyRank(a) - urgencyRank(b))
  const shown = items
  return (
    <section className="card today2">
      <div className="card-head"><h2>Today</h2><span className="pill">{items.length ? `${items.length} thing${items.length > 1 ? 's' : ''}` : 'All clear'}</span></div>
      {items.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nothing booked for today. Work from the Schedule, to-dos, urgent materials and payments due show here.</p>}
      {shown.map(it => (
        <div key={it.id} className="t-row" role="button" tabIndex={0} onClick={() => it.url && nav(it.url)}>
          <span className={'t-when' + (it.late || it.urgent ? ' late' : '')}>{it.label}</span>
          <span className="t-dot" style={{ background: it.color, boxShadow: `0 0 0 3px ${it.color}26` }} />
          <span className="t-text"><b>{it.title}{it.urgent && <em className="urgent-tag">Urgent</em>}</b>{it.sub && <span>{it.sub}</span>}</span>
          {it.amount ? <span className={'t-amt ' + (it.dir === 'in' ? 'pos' : 'neg')}>{it.dir === 'in' ? '+' : '−'}{money(it.amount)}</span> : null}
          {it.tick && <button className="t-tick" aria-label={`Done: ${it.title}`} onClick={e => { e.stopPropagation(); vibrate(20); update(it.id, { done: true, doneOn: today() }) }}><Icon name="check" size={18} stroke={3} /></button>}
        </div>
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

// Whose phone this is (Pete or Brian), chosen in Settings. Defaults to the first owner.
export const mePhone = owners => localStorage.getItem('pw_me') || owners[0] || 'Pete'

// True if the finger landed on a strip that scrolls sideways by itself (so it scrolls instead of turning the page)
function scrollsSideways(el, stop) {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true }
  }
  return false
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

// A slim job line for the Jobs page, so every booked and on-site job fits on screen at once
function JobRow({ job, onLong }) {
  const d = job.data
  const lp = useLongPress(() => onLong(job), () => nav(`/job/${job.id}`))
  const st = jobStatus(d)
  const prog = jobProgress(d)
  const m = jobMoney(job)
  const when = prog ? prog.label : d.start ? `Starts ${shortDate(d.start)}` : 'No start date'
  return (
    <div className={'jrow st-' + st} {...lp} role="button" tabIndex={0}>
      <span className="jrow-pic">{d.cover ? <img src={d.cover} alt="" /> : initials(d.client || d.name)}</span>
      <span className="jrow-main">
        <span className="jrow-top"><b>{d.client || d.name || 'Untitled job'}</b><em className={'jrow-st st-' + st}>{JOB_STATUS[st]}</em></span>
        <span className="jrow-sub">{[d.address?.split('\n')[0], when].filter(Boolean).join(' · ')}</span>
        {prog && prog.pct > 0 && <span className="jrow-bar"><i style={{ width: prog.pct + '%' }} /></span>}
      </span>
      {m.quote > 0 && <span className={'jrow-left' + (m.warn ? ' warn' : '')}><b>{Math.round(m.left)}%</b><small>left</small></span>}
    </div>
  )
}

// Everything that needs attention across every job
export default function Home() {
  const jobs = useList('job', r => r.data.status !== 'finished', sortJobs)
  const allJobs = useList('job')
  const finished = allJobs.filter(j => j.data.status === 'finished')
  const [page, setPage] = useState(0)
  const barRef = useRef(null)
  useEffect(() => { barRef.current?.querySelector('.pb.on')?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }) }, [page])
  // Whole-screen swipe: the page follows the finger, then settles on the next or previous tab
  const drag = useRef(null)
  const track = useRef(null)
  const setDx = x => { const el = track.current; if (!el) return; el.classList.toggle('dragging', !!x); el.style.transform = `translateX(calc(${-page * 100}% + ${x}px))` }
  const onTouchStart = e => {
    const t = e.target
    if (t.closest('input, textarea, select, [data-noswipe]') || scrollsSideways(t, e.currentTarget)) { drag.current = null; return }
    drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, lock: null, w: e.currentTarget.clientWidth }
  }
  const onTouchMove = e => {
    const d = drag.current; if (!d) return
    const x = e.touches[0].clientX - d.x, y = e.touches[0].clientY - d.y
    if (!d.lock && Math.hypot(x, y) > 10) d.lock = Math.abs(x) > Math.abs(y) * 1.2 ? 'x' : 'y'
    if (d.lock !== 'x') return
    const edge = (page === 0 && x > 0) || (page === PAGE_TABS.length - 1 && x < 0)
    setDx(edge ? x / 4 : x)
  }
  const onTouchEnd = e => {
    const d = drag.current; drag.current = null
    if (!d || d.lock !== 'x') return
    const x = e.changedTouches[0].clientX - d.x
    const next = Math.abs(x) > Math.min(80, d.w * 0.2) ? Math.max(0, Math.min(PAGE_TABS.length - 1, page + (x < 0 ? 1 : -1))) : page
    track.current.classList.remove('dragging')
    track.current.style.transform = `translateX(${-next * 100}%)`
    setPage(next)
  }
  const [ordering, setOrdering] = useState(false)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [qm, setQm] = useState(null)
  const [saved, setSaved] = useState(null)
  const scan = async () => { const [f] = await pickFile({ accept: 'image/*,application/pdf' }); if (f) setQm({ file: f, data: { dir: 'out', cat: 'materials' } }) }
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
  return (
    <div className="page home-screen">
      <header className="home-hero">
        <div className="hh-top">
          <Logo />
          <button className="hh-btn" onClick={() => nav('/search')} aria-label="Search"><Icon name="search" size={20} /></button>
          <button className="hh-btn" onClick={() => nav('/settings')} aria-label="Settings">
            {cloudEnabled && <span className={'sync-dot ' + (st.signedIn && !st.error ? 'ok' : 'bad')} />}
            <Icon name="settings" size={20} /></button>
        </div>
        <div className="hh-greet">{greeting()}{settings.owners[0] ? `, ${mePhone(settings.owners)}` : ''}</div>
      </header>
      <div className="pview" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => { drag.current = null; setDx(0) }}>
      <div className="pview-track" ref={track} style={{ transform: `translateX(${-page * 100}%)` }}>
        <section className="pview-page">
        <div className="quick">
          <button onClick={scan}><span className="q-ic orange"><Icon name="receipt" size={24} /></span>Scan receipt</button>
          <button onClick={() => setQm({})} aria-label="Add money in or out"><span className="q-ic green"><Icon name="money" size={24} /></span>£</button>
          <button onClick={() => setCar(true)} aria-label="Vehicle costs: ULEZ, congestion, fuel, tickets"><span className="q-ic white"><CarIcon /></span>Car</button>
          <button onClick={() => setAdding(true)}><span className="q-ic white"><Icon name="plus" size={24} /></span>New job</button>
          <button onClick={() => setPage(1)}><span className="q-ic white"><Icon name="check" size={24} /></span>To-do</button>
        </div>
        <div className="home-today"><TodayCard /></div>
        <BackupReminder />
        </section>
        <section className="pview-page">
          <TodoList title="To-do" />
        </section>
        <section className="pview-page">
          <TodoList title="To Get" kind="toget" showCalendar={false} />
        </section>
        <section className="pview-page">
          <MoneyCentreCard />
          <GeneralCashFlow />
        </section>
        <section className="pview-page">
          <JobListPage />
        </section>
        <section className="pview-page">
          <MaterialsAllJobs />
        </section>
        <section className="pview-page">
        <main className="content home-content home-jobs-page">
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
            : <div className="jrows">{jobs.map(j => <JobRow key={j.id} job={j} onLong={j => setEditing(j.id)} />)}</div>}
        {jobs.length > 0 && <p className="hint">{ordering ? 'Use the arrows to put your most important jobs first. Tap Done when finished.' : 'Tap a job to open it. Press and hold to change its details or status. Tap Reorder to move jobs up or down. Finished jobs go into the folder below.'}</p>}
        {!ordering && <button className="finished-folder" onClick={() => nav('/finished')}>
          <span className="ff-ic"><Icon name="folder" size={26} /></span>
          <span className="ff-text"><b>Finished jobs</b><small>{finished.length ? `${finished.length} job${finished.length === 1 ? '' : 's'} done` : 'Jobs set to Finished go in here'}</small></span>
          <span className="pill">{finished.length}</span>
          <Icon name="right" size={20} />
        </button>}
        </main>
        </section>
        <section className="pview-page">
          <JobCalendar />
        </section>
        <section className="pview-page">
          <ContactsBox />
        </section>
      </div></div>
      <nav className="pbar" ref={barRef}>
        {PAGE_TABS.map((n, i) => <button key={n} className={'pb pb' + TAB_COLOUR[n] + (page === i ? ' on' : '')} onClick={() => setPage(i)}>{n}</button>)}
      </nav>
      <JobDetailsSheet job={editJob} onClose={() => setEditing(null)} />
      <NewJobSheet open={adding} onClose={() => setAdding(false)} />
      {qm && <QuickMoney start={qm} onClose={() => setQm(null)} onSaved={setSaved} />}
      <SavedToast saved={saved} onDone={() => setSaved(null)} />
      <VehicleSheet open={car} onClose={() => setCar(false)} />
    </div>
  )
}
