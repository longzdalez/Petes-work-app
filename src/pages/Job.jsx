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
import { useSettings } from './Settings'
import '../quote-lines.css'

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
  { key: 'photos', label: 'Photo', icon: 'camera' },
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

function HubTile({ icon, label, onClick, badge, color }) {
  return (
    <button className="hub-tile" onClick={onClick}>
      {badge ? <span className="hub-badge">{badge}</span> : null}
      <span className="hub-ic" style={color ? { background: color, color: '#fff' } : undefined}><Icon name={icon} size={22} /></span>
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
  const [quoting, setQuoting] = useState(false)
  const [costing, setCosting] = useState(false)
  const qlines = Array.isArray(d.quoteLines) ? d.quoteLines : []
  const costs = Array.isArray(d.refCosts) ? d.refCosts : []
  const r2 = n => Math.round(n * 100) / 100
  // Saving the quote lines sets Materials £, Labour £ and so the job value. No lines left = back to typed figures.
  const saveQuote = ls => {
    const m = r2(ls.reduce((t, l) => t + num(l.materials), 0)), lb = r2(ls.reduce((t, l) => t + num(l.labour), 0))
    set({ quoteLines: ls, ...(ls.length ? { valueMaterials: m, valueLabour: lb, value: r2(m + lb) } : {}) })
  }
  const cm = r2(costs.filter(c => c.kind !== 'labour').reduce((t, c) => t + num(c.amount), 0))
  const cl = r2(costs.filter(c => c.kind === 'labour').reduce((t, c) => t + num(c.amount), 0))
  const body = <>
    <Field label={compact ? "Scope of works" : "What needs doing"} value={d.scope} onChange={v => set({ scope: v })} multiline rows={compact ? 4 : 6} placeholder="What needs doing on this job, e.g. strip out kitchen, move radiator, first and second fix electrics, plaster, fit units" />
    <label className="field"><span>Job value</span>
      <div className="seg small" style={{ margin: 0 }}>
        <button className={vt === 'estimate' ? 'on' : ''} onClick={() => set({ valueType: 'estimate' })}>Estimate</button>
        <button className={vt === 'quote' ? 'on' : ''} onClick={() => set({ valueType: 'quote' })}>Quotation</button>
      </div>
    </label>
    {qlines.length > 0 ? <>
      <div className="ql-list">
        {qlines.map(l => (
          <button key={l.id} className="ql-row" onClick={() => setQuoting(true)}>
            <span className="ql-t"><b>{l.item || 'Item'}</b>{l.desc ? <small>{l.desc}</small> : null}</span>
            <span className="ql-n"><b>{money(num(l.materials) + num(l.labour))}</b><small>M {money(num(l.materials))} · L {money(num(l.labour))}</small></span>
          </button>
        ))}
      </div>
      <div className="two">
        <label className="field"><span>Materials £</span><button className="mat-lines-btn" onClick={() => setQuoting(true)}><b>{money(num(d.valueMaterials))}</b><small>from {qlines.length} line{qlines.length === 1 ? '' : 's'}</small></button></label>
        <label className="field"><span>Labour £</span><button className="mat-lines-btn" onClick={() => setQuoting(true)}><b>{money(num(d.valueLabour))}</b><small>tap to change</small></button></label>
      </div>
    </> : <>
      <div className="two">
        <Field label="Materials £" inputMode="decimal" value={d.valueMaterials ?? ''} onChange={v => setPart('valueMaterials', v)} placeholder="0.00" />
        <Field label="Labour £" inputMode="decimal" value={d.valueLabour ?? ''} onChange={v => setPart('valueLabour', v)} placeholder="0.00" />
      </div>
    </>}
    <button className="link-btn mat-lines-add" onClick={() => setQuoting(true)}><Icon name="plus" size={16} /> {qlines.length ? 'Edit quote lines' : 'Build the quote in lines (item, description, materials, labour)'}</button>
    <div className="worth-total"><span>{vt === 'estimate' ? 'Estimate' : 'Quotation'} total</span><b>{money(num(d.value))}</b></div>
    {!hasSplit && num(d.value) > 0 && <p className="small muted" style={{ marginTop: -6 }}>Put in the materials and labour above and the total adds itself up.</p>}
    <Field label="Details (optional)" value={d.valueNotes} onChange={v => set({ valueNotes: v })} multiline rows={2} placeholder="e.g. Includes materials, excludes kitchen units" />
    <div className="mycosts">
      <div className="mycosts-head"><b>My costs</b><span>Just for you. These are not in the {vt === 'estimate' ? 'estimate' : 'quote'}.</span></div>
      {costs.length > 0 && <div className="ql-list">
        {costs.map(c => (
          <button key={c.id} className="ql-row" onClick={() => setCosting(true)}>
            <span className="ql-t"><b>{c.desc || (c.kind === 'labour' ? 'Labour' : 'Materials')}</b></span>
            <span className={'cost-kind ' + (c.kind === 'labour' ? 'lab' : 'mat')}>{c.kind === 'labour' ? 'Labour' : 'Materials'}</span>
            <span className="ql-n"><b>{money(num(c.amount))}</b></span>
          </button>
        ))}
        <div className="cost-sums"><span>Materials <b>{money(cm)}</b></span><span>Labour <b>{money(cl)}</b></span><span>Total <b>{money(r2(cm + cl))}</b></span></div>
      </div>}
      <button className="link-btn mat-lines-add" onClick={() => setCosting(true)}><Icon name="plus" size={16} /> {costs.length ? 'Edit my costs' : 'Add my materials and labour costs'}</button>
    </div>
  </>
  const sheets = <>
    {quoting && <QuoteLinesSheet lines={qlines} d={d} onSave={saveQuote} onClose={() => setQuoting(false)} />}
    {costing && <CostsSheet costs={costs} onSave={ls => set({ refCosts: ls })} onClose={() => setCosting(false)} />}
  </>
  if (compact) return <>{body}{sheets}</>
  return (
    <section className="card scope-card">
      <div className="card-head"><h2>Scope of works</h2>{d.value ? <span className="pill orange">{vt === 'estimate' ? 'Estimate' : 'Quote'} {money(d.value)}</span> : null}</div>
      {body}
      {sheets}
    </section>
  )
}

let lineSeq = 0
const lineId = () => `l${Date.now().toString(36)}${lineSeq++}`
const newQuoteLine = (o = {}) => ({ id: lineId(), item: '', desc: '', materials: '', labour: '', ...o })
const amt = v => v === '' || v == null ? '' : String(v)
const money2 = e => e.target.value.replace(/[^\d.,]/g, '')

// The quote as lines: item, description, materials and labour. Their totals become Materials £, Labour £ and the job value.
function QuoteLinesSheet({ lines, d, onSave, onClose }) {
  // First time: carry over whatever is already in the job (material lines, typed materials and labour) so nothing is lost
  const [ls, setLs] = useState(() => {
    if (lines.length) return lines.map(l => ({ ...l, materials: amt(l.materials), labour: amt(l.labour) }))
    const old = Array.isArray(d.materialLines) ? d.materialLines : []
    const seed = old.length ? old.map(l => newQuoteLine({ item: l.desc, materials: amt(l.amount) }))
      : num(d.valueMaterials) > 0 ? [newQuoteLine({ item: 'Materials', materials: amt(d.valueMaterials) })] : []
    if (num(d.valueLabour) > 0) seed.push(newQuoteLine({ item: 'Labour', labour: amt(d.valueLabour) }))
    return [...seed, newQuoteLine()]
  })
  const [focus, setFocus] = useState(null)
  const setL = (id, p) => setLs(x => x.map(l => l.id === id ? { ...l, ...p } : l))
  const add = () => { const l = newQuoteLine(); setLs(x => [...x, l]); setFocus(l.id) }
  const tm = ls.reduce((t, l) => t + num(l.materials), 0), tl = ls.reduce((t, l) => t + num(l.labour), 0)
  const save = () => {
    const keep = ls.filter(l => l.item.trim() || l.desc.trim() || num(l.materials) || num(l.labour))
      .map(l => ({ id: l.id, item: l.item.trim(), desc: l.desc.trim(), materials: num(l.materials), labour: num(l.labour) }))
    onSave(keep); onClose()
  }
  return (
    <Sheet open onClose={onClose} title={(d.valueType === 'estimate' ? 'Estimate' : 'Quote') + ' lines'} full>
      <div className="ql-edit">
        {ls.map((l, i) => (
          <div key={l.id} className="ql-card">
            <div className="ql-top">
              <input className="ql-in" value={l.item} placeholder={i === 0 ? 'Item, e.g. Wardrobe carcasses' : 'Item'} autoFocus={focus === l.id} aria-label="Item" onChange={e => setL(l.id, { item: e.target.value })} />
              <button className="icon-btn" aria-label="Remove this line" onClick={() => setLs(x => x.filter(y => y.id !== l.id))}><Icon name="close" size={18} /></button>
            </div>
            <input className="ql-in" value={l.desc} placeholder="Description" aria-label="Description" onChange={e => setL(l.id, { desc: e.target.value })} />
            <div className="ql-amts">
              <label className="ml-amt-in"><em>Materials</em><span>£</span><input inputMode="decimal" value={l.materials} placeholder="0.00" aria-label="Materials in pounds" onChange={e => setL(l.id, { materials: money2(e) })} /></label>
              <label className="ml-amt-in"><em>Labour</em><span>£</span><input inputMode="decimal" value={l.labour} placeholder="0.00" aria-label="Labour in pounds" onChange={e => setL(l.id, { labour: money2(e) })} onKeyDown={e => e.key === 'Enter' && add()} /></label>
            </div>
          </div>
        ))}
        <button className="add-line" onClick={add}><Icon name="plus" size={18} /> Add line</button>
      </div>
      <div className="ql-sums"><span>Materials <b>{money(tm)}</b></span><span>Labour <b>{money(tl)}</b></span></div>
      <div className="worth-total"><span>{d.valueType === 'estimate' ? 'Estimate' : 'Quotation'} total</span><b>{money(tm + tl)}</b></div>
      <p className="small muted" style={{ marginTop: -6 }}>These totals become Materials £, Labour £ and the job value.</p>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

// Your own costs for the job (materials and labour). For reference only: they never change the job value.
function CostsSheet({ costs, onSave, onClose }) {
  const mk = (o = {}) => ({ id: lineId(), kind: 'materials', desc: '', amount: '', ...o })
  const [ls, setLs] = useState(() => costs.length ? costs.map(c => ({ ...c, amount: amt(c.amount) })) : [mk()])
  const [focus, setFocus] = useState(null)
  const setL = (id, p) => setLs(x => x.map(l => l.id === id ? { ...l, ...p } : l))
  const add = kind => { const l = mk({ kind: kind || ls[ls.length - 1]?.kind || 'materials' }); setLs(x => [...x, l]); setFocus(l.id) }
  const tm = ls.filter(l => l.kind !== 'labour').reduce((t, l) => t + num(l.amount), 0)
  const tl = ls.filter(l => l.kind === 'labour').reduce((t, l) => t + num(l.amount), 0)
  const save = () => {
    onSave(ls.filter(l => l.desc.trim() || num(l.amount)).map(l => ({ id: l.id, kind: l.kind, desc: l.desc.trim(), amount: num(l.amount) })))
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title="My costs" full>
      <p className="small muted" style={{ marginTop: 0 }}>For your reference only. Nothing here changes the quote or the job value.</p>
      <div className="ql-edit">
        {ls.map(l => (
          <div key={l.id} className="ql-card">
            <div className="ql-top">
              <div className="seg small" style={{ margin: 0, flex: 1 }}>
                <button className={l.kind !== 'labour' ? 'on' : ''} onClick={() => setL(l.id, { kind: 'materials' })}>Materials</button>
                <button className={l.kind === 'labour' ? 'on' : ''} onClick={() => setL(l.id, { kind: 'labour' })}>Labour</button>
              </div>
              <button className="icon-btn" aria-label="Remove this line" onClick={() => setLs(x => x.filter(y => y.id !== l.id))}><Icon name="close" size={18} /></button>
            </div>
            <div className="ql-top">
              <input className="ql-in" value={l.desc} placeholder={l.kind === 'labour' ? 'e.g. Fitter, 3 days' : 'e.g. Oak boards'} autoFocus={focus === l.id} aria-label="Description" onChange={e => setL(l.id, { desc: e.target.value })} />
              <label className="ml-amt-in" style={{ width: 110 }}><span>£</span><input inputMode="decimal" value={l.amount} placeholder="0.00" aria-label="Amount in pounds" onChange={e => setL(l.id, { amount: money2(e) })} onKeyDown={e => e.key === 'Enter' && add()} /></label>
            </div>
          </div>
        ))}
        <div className="ql-addrow">
          <button className="add-line" onClick={() => add('materials')}><Icon name="plus" size={18} /> Materials</button>
          <button className="add-line" onClick={() => add('labour')}><Icon name="plus" size={18} /> Labour</button>
        </div>
      </div>
      <div className="ql-sums"><span>Materials <b>{money(tm)}</b></span><span>Labour <b>{money(tl)}</b></span><span>Total <b>{money(tm + tl)}</b></span></div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
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

// Whose job it is: what's still owed on it shows as owed to that person in the Money centre
function WhoseJob({ job }) {
  const { owners } = useSettings()
  const who = job.data.owner || ''
  return <>
    <div className="small muted status-q">Whose job is it?</div>
    <div className="seg whose-seg">
      {owners.map(n => <button key={n} className={who === n ? 'on' : ''} onClick={() => update(job.id, { owner: who === n ? '' : n })}>{n}'s job</button>)}
    </div>
    <div className="small muted status-help">{who ? `What's still owed on this job counts as owed to ${who}.` : 'Pick one so the Money centre knows who this money is owed to.'}</div>
  </>
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
      <div className="home-pager">
      <section className="home-page">
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

      <WhoseJob job={job} />

      <div className="hub">
        <HubTile icon="materials" label="Materials" color="#4a90d9" onClick={() => go('materials')} />
        <HubTile icon="money" label="Money" color="#2fb8a6" onClick={() => go('money')} />
        <HubTile icon="schedule" label="Schedule" color="#e8a33d" onClick={() => go('schedule')} />
        <HubTile icon="camera" label="Photo" color="#9b7bff" onClick={() => go('photos')} />
        <HubTile icon="extra" label="Extras" color="#ff7a45" badge={extras.length} onClick={() => go('extras')} />
        <HubTile icon="check" label="To-do" color="#3fbf7f" badge={todos.length} onClick={() => go('todos')} />
      </div>
      <button className="link-btn" style={{ margin: '0 0 12px' }} onClick={() => setTpl(true)}>Save as template</button>
      {photos.length > 0 && <p className="hint" style={{ marginTop: -4 }}>{photos.length} progress photo{photos.length > 1 ? 's' : ''} in the diary</p>}

      <WeekOnSite id={id} />
      </section>
      <section className="home-page">
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
      </section>
      <section className="home-page">
      <ScopeAndValue job={job} />
      </section>
      <section className="home-page">
      <section className="card">
        <div className="card-head"><h2>Professional services</h2></div>
        {PROS.map(p => <ProBox key={p.key} job={job} pro={p} />)}
      </section>
      <section className="card">
        <div className="card-head"><h2>Notes</h2></div>
        <Field label="Anything else about this job" value={d.notes} onChange={v => set({ notes: v })} multiline />
      </section>
      </section>
      </div>
      <PromptSheet open={tpl} onClose={() => setTpl(false)} title="Save as a template" label="Template name" initial={d.name ? d.name + ' template' : ''}
        placeholder="e.g. Kitchen fit" saveLabel="Save template" onSave={n => { saveTemplate(id, n || 'Template'); alert('Template saved. Pick it next time you make a new job.') }}>
        <p className="small muted">This remembers this job's material folders and items, and the schedule, so your next similar job starts filled in.</p>
      </PromptSheet>
    </JobShell>
  )
}
