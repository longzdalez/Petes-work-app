import { useState } from 'react'
import { put, update, remove, useRecord, useList, list } from '../store'
import { Icon, Sheet, Field, MonthCalendar, UrgencyDot, useLongPress, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { TODO_COLOUR } from '../Todos'
import { URGENCY, niceDate, today, parseYmd, money, num } from '../util'

// One colour per trade, so each shows up clearly on the calendar
export const TRADE_COLOURS = ['#3d7fd1', '#8a5cd6', '#e0559a', '#129c9c', '#f07f1e', '#6c8f1f', '#c4503a', '#4b5bd4', '#c99a06', '#5d6c7c']
const nextColour = used => TRADE_COLOURS.find(c => !used.includes(c)) || TRADE_COLOURS[used.length % TRADE_COLOURS.length]
const cycle = u => { const k = ['green', 'amber', 'red']; return k[(k.indexOf(u) + 1) % 3] }

function TradeSheet({ trade, jobId, used, onClose }) {
  const isNew = !trade.id
  const [d, setD] = useState({ name: '', trade: '', jobs: '', value: '', phone: '', color: nextColour(used), ...trade.data })
  const set = p => setD(x => ({ ...x, ...p }))
  const contacts = list('contact', c => c.data.role === 'trade')
  const save = () => {
    if (!d.name.trim()) return alert('Please put in a name')
    const data = { ...d, name: d.name.trim(), value: d.value === '' ? '' : num(d.value) }
    if (isNew) put('trade', { ...data, order: used.length }, { job_id: jobId }); else update(trade.id, data)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add a trade or worker' : d.name}>
      <Field label="Name" value={d.name} onChange={v => set({ name: v })} placeholder="e.g. Dave" list="trade-names" />
      <datalist id="trade-names">{contacts.map(c => <option key={c.id} value={c.data.name} />)}</datalist>
      <Field label="Trade" value={d.trade} onChange={v => set({ trade: v })} placeholder="e.g. Electrician" />
      <label className="field"><span>Jobs they're doing</span>
        <textarea rows={3} value={d.jobs} onChange={e => set({ jobs: e.target.value })} placeholder="e.g. First fix, second fix, consumer unit" />
      </label>
      <div className="two">
        <Field label="Quote or estimate £" inputMode="decimal" value={d.value} onChange={v => set({ value: v })} />
        <Field label="Phone (optional)" inputMode="tel" value={d.phone} onChange={v => set({ phone: v })} />
      </div>
      <label className="field"><span>Colour on the calendar</span>
        <div className="swatches">{TRADE_COLOURS.map(c => <button key={c} className={'swatch' + (d.color === c ? ' on' : '')} style={{ background: c }} onClick={() => set({ color: c })} aria-label="Colour" />)}</div>
      </label>
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => {
          if (!confirmDelete(d.name)) return
          list('task', t => t.data.trade_id === trade.id).forEach(t => update(t.id, { trade_id: null }))
          remove(trade.id); onClose()
        }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

function TradeRow({ t, onEdit }) {
  const lp = useLongPress(onEdit, onEdit)
  return (
    <div className="trade-row tap" {...lp}>
      <span className="trade-swatch" style={{ background: t.data.color }} />
      <span className="text"><b>{t.data.name}</b></span>
      {t.data.trade && <span className="small muted">{t.data.trade}</span>}
    </div>
  )
}

// What one trade (or general work) has to do on one day: tick, urgency, add more
function DayWork({ date, jobId, trade, tasks }) {
  const [text, setText] = useState('')
  const [urg, setUrg] = useState('green')
  const add = () => { if (!text.trim()) return; put('task', { date, text: text.trim(), urgency: urg, done: false, trade_id: trade?.id || null }, { job_id: jobId }); setText('') }
  return (
    <>
      <ul className="checklist">
        {tasks.map(t => (
          <li key={t.id} className={t.data.done ? 'done' : ''}>
            <button className={'tick' + (t.data.done ? ' on' : '')} onClick={() => update(t.id, { done: !t.data.done })}>{t.data.done && <Icon name="check" size={16} stroke={3} />}</button>
            <span className="text">{t.data.text}</span>
            <button className="urg-mini" onClick={() => update(t.id, { urgency: cycle(t.data.urgency) })} aria-label="Change urgency"><UrgencyDot value={t.data.urgency} size={22} /></button>
            <button className="icon-btn small" onClick={() => remove(t.id)} aria-label="Delete"><Icon name="close" size={16} /></button>
          </li>
        ))}
      </ul>
      <label className="field"><span>{trade ? `What does ${trade.data.name} need to do?` : 'Add work for this day'}</span>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. First fix electrics" onKeyDown={e => e.key === 'Enter' && add()} />
      </label>
      <div className="urgency-row small">
        {Object.entries(URGENCY).map(([k, u]) => <button key={k} className={'urgency-btn' + (urg === k ? ' on' : '')} style={{ background: u.color }} onClick={() => setUrg(k)}>{u.label}</button>)}
      </div>
      <button className="btn primary wide" onClick={add}><Icon name="plus" size={18} /> Add</button>
    </>
  )
}

function DayTrade({ trade, tasks, onWork }) {
  const [open, setOpen] = useState(false)
  const lp = useLongPress(onWork, () => setOpen(o => !o))
  const worst = ['red', 'amber', 'green'].find(u => tasks.some(t => !t.data.done && t.data.urgency === u))
  return (
    <div className={'day-trade' + (open ? ' open' : '')} style={{ '--tc': trade.data.color }}>
      <div className="day-trade-head tap" {...lp}>
        <span className="trade-swatch" style={{ background: trade.data.color }} />
        <span className="text"><b>{trade.data.name}</b>{trade.data.trade && <span className="small muted"> · {trade.data.trade}</span>}</span>
        {worst && <UrgencyDot value={worst} size={18} />}
        <Icon name={open ? 'up' : 'down'} size={18} />
      </div>
      {open && <div className="day-trade-body">
        {tasks.length === 0 ? <p className="small muted">Nothing set for today yet.</p> : tasks.map(t => (
          <div key={t.id} className={'up-row' + (t.data.done ? ' done' : '')}>
            <UrgencyDot value={t.data.urgency} size={16} />
            <span className="text">{t.data.text}</span>
            <span className="small muted">{URGENCY[t.data.urgency]?.label}</span>
          </div>
        ))}
        {trade.data.jobs && <p className="small"><b>Their jobs on this build:</b> {trade.data.jobs}</p>}
        {trade.data.value !== '' && trade.data.value != null && <p className="small"><b>Quote:</b> {money(trade.data.value)}</p>}
        <button className="btn ghost small" onClick={onWork}><Icon name="edit" size={16} /> Change what they're doing</button>
      </div>}
    </div>
  )
}

function DaySheet({ date, jobId, tasks, trades, onClose }) {
  const [work, setWork] = useState(null) // trade id, or 'general'
  const booked = trades.filter(t => tasks.some(x => x.data.trade_id === t.id))
  const others = trades.filter(t => !booked.includes(t))
  const general = tasks.filter(t => !t.data.trade_id || !trades.some(x => x.id === t.data.trade_id))
  const wt = work && work !== 'general' ? trades.find(t => t.id === work) : null
  return (
    <Sheet open full onClose={onClose} title={niceDate(date, { weekday: true })}>
      {booked.length === 0 && general.length === 0 && <p className="muted small">No one is booked in for this day yet.</p>}
      {booked.length > 0 && <p className="small muted" style={{ marginTop: 0 }}>Tap a trade to see their work. Hold it to change what they need to do.</p>}
      {booked.map(t => <DayTrade key={t.id} trade={t} tasks={tasks.filter(x => x.data.trade_id === t.id)} onWork={() => setWork(t.id)} />)}
      {general.length > 0 && <div className="day-trade" style={{ '--tc': 'var(--g300)' }}>
        <div className="day-trade-head tap" onClick={() => setWork('general')}><span className="text"><b>Other work</b></span><Icon name="edit" size={16} /></div>
        <div className="day-trade-body">{general.map(t => <div key={t.id} className={'up-row' + (t.data.done ? ' done' : '')}><UrgencyDot value={t.data.urgency} size={16} /><span className="text">{t.data.text}</span></div>)}</div>
      </div>}
      <h3 className="sub-h">Book someone in for this day</h3>
      {trades.length === 0 ? <p className="small muted">Add your trades and workers at the top of the schedule first.</p> :
        others.length === 0 ? <p className="small muted">Everyone on this job is booked in for this day.</p> : <div className="chips">{others.map(t => <button key={t.id} className="chip trade-chip" style={{ '--tc': t.data.color }} onClick={() => setWork(t.id)}>{t.data.name}</button>)}</div>}
      <button className="btn ghost wide" style={{ marginTop: 12 }} onClick={() => setWork('general')}><Icon name="plus" size={18} /> Other work, not a trade</button>
      {work && <Sheet open onClose={() => setWork(null)} title={wt ? `${wt.data.name}, ${niceDate(date, { noYear: true })}` : 'Other work'}>
        <DayWork date={date} jobId={jobId} trade={wt} tasks={wt ? tasks.filter(x => x.data.trade_id === wt.id) : general} />
      </Sheet>}
    </Sheet>
  )
}

export default function Schedule({ id }) {
  const job = useRecord(id)
  const tasks = useList('task', r => r.job_id === id, (a, b) => a.data.date.localeCompare(b.data.date))
  const trades = useList('trade', r => r.job_id === id, (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
  const todos = useList('todo', r => r.job_id === id)
  const [day, setDay] = useState(null)
  const [editTrade, setEditTrade] = useState(null)
  const [month, setMonth] = useState(() => {
    const s = job?.data.start && job.data.start > today() ? parseYmd(job.data.start) : new Date()
    return [s.getFullYear(), s.getMonth()]
  })
  if (!job) return <JobShell job={null} />
  const d = job.data
  const tradeOf = Object.fromEntries(trades.map(t => [t.id, t]))
  // On the calendar each booked trade shows as its name in its colour; other work shows its wording
  const items = []
  const seen = {}
  tasks.forEach(t => {
    const tr = tradeOf[t.data.trade_id]
    if (!tr) return items.push({ date: t.data.date, text: t.data.text, color: URGENCY[t.data.urgency]?.color, done: t.data.done })
    const k = t.data.date + tr.id
    if (seen[k]) { if (!t.data.done) seen[k].done = false; return }
    seen[k] = { date: t.data.date, text: tr.data.name, color: tr.data.color, done: t.data.done }
    items.push(seen[k])
  })
  todos.forEach(t => items.push({ date: t.data.date, text: '☐ ' + t.data.text, color: URGENCY[t.data.urgency]?.color || TODO_COLOUR, done: t.data.done }))
  const weeks = d.start && d.finish ? Math.max(1, Math.round((parseYmd(d.finish) - parseYmd(d.start)) / 864e5 / 7 * 10) / 10) : null
  return (
    <JobShell job={job} tab="schedule" title="Job schedule">
      <section className="card">
        <div className="two">
          <Field label="Job start" type="date" value={d.start} onChange={v => update(id, { start: v })} />
          <Field label="Job finish" type="date" value={d.finish} onChange={v => update(id, { finish: v })} />
        </div>
        {weeks && <p className="muted small" style={{ margin: '4px 0 0' }}>Planned length: about {weeks} weeks. The job period is shaded green on the calendar.</p>}
      </section>
      <section className="card">
        <div className="card-head"><h2>Trades and workers</h2><button className="btn primary small" onClick={() => setEditTrade({ data: {} })}><Icon name="plus" size={16} /> Add</button></div>
        {trades.length === 0 ? <p className="muted small">Add each trade or worker on this job. Each gets their own colour on the calendar. Hold a name to see or change their details.</p>
          : <div className="trade-list">{trades.map(t => <TradeRow key={t.id} t={t} onEdit={() => setEditTrade(t)} />)}</div>}
      </section>
      <section className="card cal-card">
        <MonthCalendar items={items} range={d.start ? [d.start, d.finish || d.start] : null} onDay={setDay} month={month} setMonth={setMonth} />
        <p className="hint">Tap a day to see who's in and what they're doing. Swipe to change month.</p>
      </section>
      {day && <DaySheet date={day} jobId={id} tasks={tasks.filter(t => t.data.date === day)} trades={trades} onClose={() => setDay(null)} />}
      {editTrade && <TradeSheet trade={editTrade} jobId={id} used={trades.filter(t => t.id !== editTrade.id).map(t => t.data.color)} onClose={() => setEditTrade(null)} />}
    </JobShell>
  )
}
