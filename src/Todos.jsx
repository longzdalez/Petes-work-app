import { useState } from 'react'
import { put, update, remove, removeWithUndo, useList } from './store'
import { Icon, Sheet, Field, SwipeRow, MonthCalendar, useLongPress, UrgencyPicker } from './ui'
import { niceDate, today, shortDate, URGENCY, ymd, parseYmd } from './util'
import { remindersOn, enableReminders, canNotify, nowLocal, niceRemind } from './reminders'

const TODO_COLOUR = '#ff9f55'
const sortTodos = (a, b) => (a.data.done - b.data.done) || (a.data.date || '').localeCompare(b.data.date || '') || (a.data.time || '99').localeCompare(b.data.time || '99') || a.data.created.localeCompare(b.data.created)

// Which to-dos belong in a list: a job's own, or the general ones on the home page
const belongs = jobId => r => jobId ? r.job_id === jobId : !r.job_id

// 'YYYY-MM-DDTHH:MM' for a date and time
const at = (date, hm) => `${date}T${hm}`
const plusDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d) }
function inAnHour() { const d = new Date(Date.now() + 3600e3); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5); return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

// Set or change a to-do's reminder: a phone notification (with a buzz) at the date and time picked
export function ReminderSheet({ todo, onClose }) {
  const d = todo.data, t = today()
  const first = d.remind || (d.date && d.date > t ? at(d.date, d.time || '08:00') : inAnHour())
  const [v, setV] = useState(first)
  const [err, setErr] = useState('')
  const quick = [
    ['In 1 hour', inAnHour()],
    ...(nowLocal() < at(t, '18:00') ? [['This evening, 6pm', at(t, '18:00')]] : []),
    ['Tomorrow, 8am', at(plusDays(t, 1), '08:00')],
    ...(d.date && d.date > plusDays(t, 1) ? [[`${shortDate(d.date)}, 8am`, at(d.date, '08:00')]] : []),
    ...(d.date && d.time && at(d.date, d.time) > nowLocal() ? [[`${shortDate(d.date)}, ${d.time}`, at(d.date, d.time)]] : []),
  ]
  const save = async () => {
    if (!v || v.length < 16) return setErr('Pick a date and a time')
    if (v <= nowLocal()) return setErr('That time has already gone. Pick a later one.')
    update(todo.id, { remind: v })
    onClose()
    if (!remindersOn() && canNotify()) { try { await enableReminders() } catch (e) { alert(`Reminder saved, but ${e.message.charAt(0).toLowerCase() + e.message.slice(1)}`) } }
  }
  return (
    <Sheet open onClose={onClose} title="Set a reminder">
      <p className="small muted" style={{ marginTop: 0 }}><b>{d.text}</b></p>
      <div className="chips" style={{ marginBottom: 12 }}>{quick.map(([l, val]) => <button key={l} className={'chip' + (v === val ? ' on' : '')} onClick={() => { setV(val); setErr('') }}>{l}</button>)}</div>
      <label className="field"><span>Or pick a date and time</span><input type="datetime-local" value={v} min={nowLocal()} onChange={e => { setV(e.target.value); setErr('') }} /></label>
      {err && <p className="error">{err}</p>}
      {!canNotify() && <p className="notice small">This phone's browser can't show reminders. Open the app in Chrome to use them.</p>}
      <p className="small muted">Your phone will buzz and show the reminder at that time. It arrives right on time while the app is open or was used recently. If your phone has fully closed the app, it shows as soon as you open the app again.</p>
      <div className="sheet-actions">
        {d.remind && <button className="btn danger" onClick={() => { update(todo.id, { remind: '' }); onClose() }}><Icon name="trash" size={18} /> Remove</button>}
        <button className="btn primary" onClick={save}><Icon name="bell" size={18} /> Save reminder</button>
      </div>
    </Sheet>
  )
}

export function TodoEditSheet({ todo, onClose }) {
  const [rem, setRem] = useState(false)
  if (!todo) return null
  const d = todo.data
  return (
    <Sheet open onClose={onClose} title="To-do">
      <div className="created">Added {niceDate(d.created)}</div>
      <Field label="What needs doing?" value={d.text} onChange={v => update(todo.id, { text: v })} multiline />
      <div className="two">
        <Field label="Date" type="date" value={d.date} onChange={v => update(todo.id, { date: v })} />
        <label className="field"><span>Time (optional)</span>
          <input type="time" value={d.time || ''} onChange={e => update(todo.id, { time: e.target.value })} />
        </label>
      </div>
      <label className="field"><span>How urgent?</span>
        <div className="urgency-row small" style={{ margin: 0 }}>
          {Object.entries(URGENCY).map(([k, u]) => <button key={k} className={'urgency-btn' + (d.urgency === k ? ' on' : '')} style={{ background: u.color }} onClick={() => update(todo.id, { urgency: d.urgency === k ? '' : k })}>{u.label}</button>)}
        </div>
      </label>
      <label className="field"><span>Reminder</span>
        <button className={'btn wide ' + (d.remind ? 'soft-orange' : 'ghost')} onClick={() => setRem(true)}><Icon name="bell" size={18} /> {d.remind ? niceRemind(d.remind) : 'Set a reminder'}</button>
      </label>
      <Field label="Notes" value={d.notes} onChange={v => update(todo.id, { notes: v })} multiline />
      {rem && <ReminderSheet todo={todo} onClose={() => setRem(false)} />}
      <div className="sheet-actions">
        <button className="btn danger" onClick={() => { remove(todo.id); onClose() }}><Icon name="trash" size={18} /> Delete</button>
        <button className="btn ghost" onClick={() => update(todo.id, { done: !d.done, doneOn: today() })}>{d.done ? 'Not done' : 'Mark done'}</button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
}

function TodoRow({ td, onEdit }) {
  const t = today()
  const toggle = () => update(td.id, { done: !td.data.done, doneOn: t })
  const [pick, setPick] = useState(false)
  const [rem, setRem] = useState(false)
  const d = td.data
  const remindOn = d.remind && !d.done
  const u = URGENCY[d.urgency]
  const when = d.date && d.date !== t ? (d.date < t ? `from ${shortDate(d.date)}` : shortDate(d.date)) : ''
  return (
    <SwipeRow className={d.done ? 'done' : ''} title={d.text || 'To-do'} done={d.done} onTick={toggle} onEdit={() => onEdit(td.id)} onDelete={() => removeWithUndo(td.id, 'To-do')}>
      <button className={'tick' + (d.done ? ' on' : '')} onClick={toggle} aria-label="Tick">{d.done && <Icon name="check" size={16} stroke={3} />}</button>
      <span className="text todo-text">
        {d.text}
        {(when || d.time) && <span className={'todo-when' + (d.date < t && !d.done ? ' overdue' : '')}>{[when, d.time].filter(Boolean).join(' · ')}</span>}
        {remindOn && <span className="todo-remind"><Icon name="bell" size={12} /> {niceRemind(d.remind)}</span>}
      </span>
      <button className={'icon-btn small todo-bell' + (remindOn ? ' on' : '')} onClick={() => setRem(true)} aria-label={remindOn ? `Reminder ${niceRemind(d.remind)}` : 'Set a reminder'}><Icon name="bell" size={16} /></button>
      <button className="todo-urg" style={{ background: u && !d.done ? u.color : '#fff', borderColor: u && !d.done ? u.color : undefined }} onClick={() => setPick(true)} aria-label="Urgency" />
      <button className="icon-btn small" onClick={() => onEdit(td.id)} aria-label="Edit"><Icon name="edit" size={16} /></button>
      <UrgencyPicker open={pick} onClose={() => setPick(false)} value={d.urgency} onPick={v => update(td.id, { urgency: v })}>
      </UrgencyPicker>
      {rem && <ReminderSheet todo={td} onClose={() => setRem(false)} />}
    </SwipeRow>
  )
}

export function TodoList({ jobId, title = 'To-do', showCalendar = true, kind = 'todo' }) {
  const t = today()
  const all = useList(kind, belongs(jobId), sortTodos)
  const jobsList = useList('job', r => r.data.status !== 'finished', (a, b) => (a.data.name || '').localeCompare(b.data.name || ''))
  const [forJob, setForJob] = useState('')
  const shown = all.filter(r => !r.data.done || r.data.doneOn === t)
  const [text, setText] = useState('')
  const [date, setDate] = useState(t)
  const [edit, setEdit] = useState(null)
  const [big, setBig] = useState(false)
  const [day, setDay] = useState(null)
  const [month, setMonth] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth()] })
  const add = (txt = text, dt = date) => { if (!txt.trim()) return; put(kind, { text: txt.trim(), date: dt || t, done: false }, { job_id: jobId || forJob || null }); setText('') }
  const items = all.map(r => ({ date: r.data.date, text: r.data.text + (r.data.time ? ' ' + r.data.time : ''), color: URGENCY[r.data.urgency]?.color || TODO_COLOUR, done: r.data.done }))
  const editTodo = all.find(r => r.id === edit)
  const open = shown.filter(x => !x.data.done).length
  return (
    <section className="card todo-card">
      <div className="card-head"><h2>{title}</h2><span className="pill">{open} left</span></div>
      {shown.length === 0 && <p className="muted small" style={{ marginTop: 0 }}>Nothing yet. Add something below or use the microphone.</p>}
      <div className="checklist">
        {shown.map(td => <TodoRow key={td.id} td={td} onEdit={setEdit} />)}
      </div>
      <div className="add-row">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a to-do…" onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="btn primary" onClick={() => add()} aria-label="Add"><Icon name="plus" size={18} /></button>
      </div>
      <div className="todo-date-row">
        <span className="small muted">For</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        {date !== t && <button className="btn ghost small" onClick={() => setDate(t)}>Today</button>}
      </div>
      {!jobId && <div className="todo-date-row">
        <span className="small muted">Job</span>
        <select value={forJob} onChange={e => setForJob(e.target.value)} aria-label="Assign to a job"><option value="">General (no job)</option>{jobsList.map(j => <option key={j.id} value={j.id}>{j.data.name || 'Untitled job'}</option>)}</select>
      </div>}
      {shown.length > 0 && <p className="hint" style={{ margin: '10px 0 0' }}>Hold a to-do to tick, edit or delete it, or tap the pencil. Tap the bell to set a reminder.</p>}
      {showCalendar && <button className="btn ghost wide" style={{ marginTop: 12 }} onClick={() => setBig(true)}><Icon name="schedule" size={18} /> Open to-do calendar</button>}
      <Sheet open={big} onClose={() => setBig(false)} title={`${title} calendar`} full>
        <MonthCalendar items={items} month={month} setMonth={setMonth} onDay={setDay} />
        <p className="hint">Use the arrows to change month. Tap a day to see or add to-dos.</p>
      </Sheet>
      {day && <DaySheet date={day} todos={all.filter(r => r.data.date === day)} onAdd={txt => add(txt, day)} onEdit={setEdit} onClose={() => setDay(null)} />}
      <TodoEditSheet todo={editTodo} onClose={() => setEdit(null)} />
    </section>
  )
}

function DaySheet({ date, todos, onAdd, onEdit, onClose }) {
  const [text, setText] = useState('')
  return (
    <Sheet open onClose={onClose} title={niceDate(date, { weekday: true })}>
      <div className="checklist">
        {todos.map(td => <TodoRow key={td.id} td={td} onEdit={id => { onEdit(id) }} />)}
      </div>
      {todos.length === 0 && <p className="muted small">Nothing on this day yet.</p>}
      <div className="add-row">
        <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Add a to-do for this day…" onKeyDown={e => { if (e.key === 'Enter') { onAdd(text); setText('') } }} />
        <button className="btn primary" onClick={() => { onAdd(text); setText('') }} aria-label="Add"><Icon name="plus" size={18} /></button>
      </div>
    </Sheet>
  )
}

export { TODO_COLOUR }
