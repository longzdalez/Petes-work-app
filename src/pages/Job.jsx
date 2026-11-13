import { useState } from 'react'
import { useRecord, update, useList, list } from '../store'
import { Icon, TopBar, Field, Empty, PromptSheet, Sheet } from '../ui'
import { ProfitRing, Glyph } from '../ui2'
import { nav } from '../router'
import { niceDate, money, today, shortDate, num } from '../util'
import { JOB_STATUS, jobProgress, saveTemplate, smallImage, jobStatus } from '../jobs'
import { pickFile, whatsApp } from '../files'
import { jobMoney, thisWeek } from '../summary'
import { TodoList } from '../Todos'

export const TABS = [
  { key: '', label: 'Overview', icon: 'info' },
  { key: 'materials', label: 'Materials', icon: 'materials' },
  { key: 'money', label: 'Money', icon: 'money' },
  { key: 'schedule', label: 'Schedule', icon: 'schedule' },
]
// Everything else lives under More, so the tab bar stays roomy on a phone
export const MORE = [
  { key: 'docs', label: 'Documents', icon: 'docs' },
  { key: 'invoices', label: 'Invoices & quotes', icon: 'invoice' },
  { key: 'extras', label: 'Extras', icon: 'extra' },
  { key: 'photos', label: 'Photo diary', icon: 'camera' },
  { key: 'snags', label: 'Snagging', icon: 'snag' },
  { key: 'hours', label: 'Hours', icon: 'clock' },
  { key: 'todos', label: 'To-do', icon: 'check' },
]
const MORE_TABS = ['docs', 'invoices']

export function JobShell({ job, tab, title, onBack, right, children, hero }) {
  const [more, setMore] = useState(false)
  if (!job) return <div className="page"><TopBar title="Job not found" onBack={() => nav('/')} /><Empty title="This job has been deleted" /></div>
  const go = k => { setMore(false); nav(`/job/${job.id}${k ? '/' + k : ''}`) }
  return (
    <div className="page with-tabs">
      {hero || <TopBar title={title || job.data.name || 'Job'} sub={title ? job.data.name : job.data.client} onBack={onBack || (() => nav('/'))} right={right} />}
      <main className="content">{children}</main>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => go(t.key)}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
        <button className={MORE_TABS.includes(tab) ? 'on' : ''} onClick={() => setMore(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18.5" cy="12" r="2" /></svg>
          <span>More</span>
        </button>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="More for this job">
        <div className="more-grid">
          {MORE.map(m => (
            <button key={m.key} className={'more-tile' + (tab === m.key ? ' on' : '')} onClick={() => go(m.key)}>
              <span className="hub-ic"><Icon name={m.icon} size={22} /></span>{m.label}
            </button>
          ))}
        </div>
      </Sheet>
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
  const clean = v => v === '' ? '' : Number(String(v).replace(/[£,\s]/g, '')) || 0
  const hasSplit = d.valueMaterials !== undefined && d.valueMaterials !== '' || d.valueLabour !== undefined && d.valueLabour !== ''
  // Job value = materials + labour
  const setPart = (k, v) => { const p = { ...d, [k]: clean(v) }; set({ [k]: clean(v), value: num(p.valueMaterials) + num(p.valueLabour) }) }
  const body = <>
    <Field label={compact ? "Scope of works" : "What needs doing"} value={d.scope} onChange={v => set({ scope: v })} multiline rows={compact ? 4 : 6} placeholder="What needs doing on this job, e.g. strip out kitchen, move radiator, first and second fix electrics, plaster, fit units" />
    <label className="field"><span>Job value</span>
      <div className="seg small" style={{ margin: 0 }}>
        <button className={vt === 'estimate' ? 'on' : ''} onClick={() => set({ valueType: 'estimate' })}>Estimate</button>
        <button className={vt === 'quote' ? 'on' : ''} onClick={() => set({ valueType: 'quote' })}>Quotation</button>
      </div>
    </label>
    <div className="two">
      <Field label="Materials £" inputMode="decimal" value={d.valueMaterials ?? ''} onChange={v => setPart('valueMaterials', v)} placeholder="0.00" />
      <Field label="Labour £" inputMode="decimal" value={d.valueLabour ?? ''} onChange={v => setPart('valueLabour', v)} placeholder="0.00" />
    </div>
    <div className="worth-total"><span>{vt === 'estimate' ? 'Estimate' : 'Quotation'} total</span><b>{money(num(d.value))}</b></div>
    {!hasSplit && num(d.value) > 0 && <p className="small muted" style={{ marginTop: -6 }}>Put in the materials and labour above and the total adds itself up.</p>}
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

// The job's work this week, Monday to Friday, in each trade's colour
function WeekOnSite({ id }) {
  const days = thisWeek()
  const t = today()
  const trades = useList('trade', r => r.job_id === id)
  const tasks = useList('task', r => r.job_id === id && days.includes(r.data.date))
  const colour = tk => trades.find(x => x.id === tk.data.trade_id)?.data.color || '#ff9f55'
  const todays = tasks.filter(tk => tk.data.date === t)
  return (
    <section className="card">
      <div className="card-head"><h2>This week on site</h2><button className="link-btn" onClick={() => nav(`/job/${id}/schedule`)}>Schedule</button></div>
      <div className="week-strip">
        {days.map(d => {
          const cols = [...new Set(tasks.filter(tk => tk.data.date === d).map(colour))].slice(0, 3)
          const dt = new Date(d + 'T00:00')
          return (
            <button key={d} className={'week-day' + (d === t ? ' on' : '')} onClick={() => nav(`/job/${id}/schedule`)}>
              <span className="wd">{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <b>{dt.getDate()}</b>
              <span className="wbars">{cols.map(c => <i key={c} style={{ background: c }} />)}</span>
            </button>
          )
        })}
      </div>
      {tasks.length === 0
        ? <p className="small muted" style={{ margin: '12px 0 0' }}>Nothing planned this week. Add work on the Schedule.</p>
        : todays.length > 0 && <div className="today-work">
          {todays.map(tk => {
            const tr = trades.find(x => x.id === tk.data.trade_id)
            return <div key={tk.id} className={tk.data.done ? 'done' : ''}><i style={{ background: colour(tk) }} /><span><b>{tr ? tr.data.name : 'Today'}</b>{tr?.data.trade ? ` ${tr.data.trade.toLowerCase()}` : ''} · {tk.data.text}</span></div>
          })}
        </div>}
    </section>
  )
}

export default function JobInfo({ id }) {
  const job = useRecord(id)
  const extras = useList('extra', r => r.job_id === id && r.data.status === 'pending')
  const snags = useList('snag', r => r.job_id === id && !r.data.done)
  const photos = useList('photo', r => r.job_id === id)
  const todos = useList('todo', r => r.job_id === id && !r.data.done)
  useList('money', r => r.job_id === id)
  useList('invoice', r => r.job_id === id)
  const [tpl, setTpl] = useState(false)
  if (!job) return <JobShell job={null} />
  const d = job.data
  const set = patch => update(job.id, patch)
  const prog = jobProgress(d)
  const st = jobStatus(d)
  const m = jobMoney(job)
  const go = p => nav(`/job/${id}/${p}`)
  const cover = async () => { const [f] = await pickFile({ accept: 'image/*' }); if (f) set({ cover: await smallImage(f, 900) }) }
  const hero = (
    <header className="job-cover">
      {d.cover ? <img src={d.cover} alt="" /> : <div className="job-cover-blank">{(d.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</div>}
      <div className="job-cover-shade" />
      <div className="job-cover-top">
        <button className="cover-btn" onClick={() => nav('/')} aria-label="Back to jobs"><Icon name="back" size={24} /></button>
        <button className="cover-btn" onClick={cover} aria-label={d.cover ? 'Change cover photo' : 'Add a cover photo'}><Icon name="camera" size={20} /></button>
      </div>
      <div className="job-cover-text">
        <span className={'status-pill on-cover st-' + st}>{JOB_STATUS[st]}</span>
        <h1>{d.name || 'Untitled job'}</h1>
        {(d.client || d.address) && <div className="sub">{[d.client, d.address?.split('\n')[0]].filter(Boolean).join(' · ')}</div>}
      </div>
    </header>
  )
  return (
    <JobShell job={job} tab="" hero={hero}>
      <section className="card money-glance">
        <div className="mg-top">
          {m.quote > 0 ? <ProfitRing pct={m.left} size={86} sub="profit left" /> : <div className="mg-noquote">Add the job value in Scope of works to see the profit ring</div>}
          <div className="mg-grid">
            <div><span>{d.valueType === 'estimate' ? 'Estimate' : 'Quote'}</span><b>{m.quote ? money(m.quote) : '–'}</b></div>
            <div><span>Spent</span><b className="neg">{money(m.spent)}</b></div>
            <div><span>Paid to you</span><b className="pos">{money(m.paidIn)}</b></div>
            <div><span>Still owed</span><b className="pos">{money(m.owed)}</b></div>
          </div>
        </div>
        {m.quote > 0 && <div className="worth-row">
          <div><span>Materials</span><b>{d.valueMaterials !== undefined && d.valueMaterials !== '' ? money(num(d.valueMaterials)) : '–'}</b></div>
          <div><span>Labour</span><b>{d.valueLabour !== undefined && d.valueLabour !== '' ? money(num(d.valueLabour)) : '–'}</b></div>
          <div><span>Job worth</span><b>{money(m.quote)}</b></div>
        </div>}
        {m.warn && <div className="budget-warn"><Glyph name="warn" size={18} /> Costs are eating the profit: {money(m.spent)} spent so far</div>}
        {prog && <>
          <div className="progress big"><div style={{ width: prog.pct + '%' }} /></div>
          <div className="mg-prog"><span>{prog.label}</span>{d.finish && <span className="muted">Finishes {niceDate(d.finish, { noYear: true })}</span>}</div>
        </>}
      </section>

      <div className="small muted status-q">Where is this job up to?</div>
      <div className="status-grid">
        {Object.entries(JOB_STATUS).map(([k, l]) => (
          <button key={k} className={st === k ? 'on' : ''} onClick={() => set({ status: k })}>{l}</button>
        ))}
      </div>
      <div className="small muted status-help">{{ quoting: "You're still pricing this job up.", booked: 'The job is agreed and booked in.', onsite: "You're working on this job now.", finished: 'Done. It moves to the Finished list on the home page.' }[st]}</div>

      <div className="hub">
        <HubTile icon="extra" label="Extras" badge={extras.length} orange onClick={() => go('extras')} />
        <HubTile icon="camera" label="Photo diary" badge={0} onClick={() => go('photos')} />
        <HubTile icon="check" label="To-do" badge={todos.length} onClick={() => go('todos')} />
        <HubTile icon="clock" label="Hours" onClick={() => go('hours')} />
        <HubTile icon="snag" label="Snagging" badge={snags.length} onClick={() => go('snags')} />
        <HubTile icon="copy" label="Save as template" onClick={() => setTpl(true)} />
      </div>
      {photos.length > 0 && <p className="hint" style={{ marginTop: -4 }}>{photos.length} progress photo{photos.length > 1 ? 's' : ''} in the diary</p>}

      <WeekOnSite id={id} />
      <ScopeAndValue job={job} />

      <section className="card">
        <div className="card-head"><h2>Client</h2><span className="muted small">Job created {niceDate(d.created)}</span></div>
        {(d.clientPhone || d.clientEmail || d.address) && <div className="contact-row">
          {d.clientPhone && <a className="contact-act" href={`tel:${d.clientPhone}`}><span className="ca-ic green"><Icon name="phone" size={20} /></span>Call</a>}
          {d.clientPhone && <button className="contact-act" onClick={() => whatsApp(d.clientPhone, '')}><span className="ca-ic wa"><Icon name="chat" size={20} /></span>WhatsApp</button>}
          {d.clientEmail && <a className="contact-act" href={`mailto:${d.clientEmail}`}><span className="ca-ic orange"><Icon name="mail" size={20} /></span>Email</a>}
          {d.address && <a className="contact-act" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(d.address)}`}><span className="ca-ic white"><Glyph name="pin" size={20} /></span>Directions</a>}
        </div>}
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
        {d.cover && <button className="btn ghost small" onClick={() => set({ cover: '' })}>Remove cover photo</button>}
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
