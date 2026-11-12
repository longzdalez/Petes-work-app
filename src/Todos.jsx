import { useState } from 'react'
import { put, update, remove, useList } from './store'
import { Icon, Sheet, Field, SwipeRow, MonthCalendar, useLongPress, UrgencyPicker } from './ui'
import { niceDate, today, shortDate, URGENCY } from './util'

const TODO_COLOUR = '#ff9f55'
const sortTodos = (a, b) => (a.data.done - b.data.done) || (a.data.date || '').localeCompare(b.data.date || '') || (a.data.time || '99').localeCompare(b.data.time || '99') || a.data.created.localeCompare(b.data.created)

// Which to-dos belong in a list: a job's own, or the general ones on the home page
const belongs = jobId => r => jobId ? r.job_id === jobId : !r.job_id

export function TodoEditSheet({ todo, onClose }) {
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
      <Field label="Notes" value={d.notes} onChange={v => update(todo.id, { notes: v })} multiline />
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
  const lp = useLongPress(() => onEdit(td.id), null)
  const [pick, setPick] = useState(false)
  const d = td.data
  const u = URGENCY[d.urgency]
  const when = d.date && d.date !== t ? (d.date < t ? `from ${shortDate(d.date)}` : shortDate(d.date)) : ''
  return (
    <SwipeRow className={d.done ? 'done' : ''} onTick={toggle} onDelete={() => remove(td.id)}>
      <button className={'tick' + (d.done ? ' on' : '')} onClick={toggle} aria-label="Tick">{d.done && <Icon name="check" size={16} stroke={3} />}</button>
      <span className="text todo-text" {...lp}>
        {d.text}
        {(when || d.time) && <span className={'todo-when' + (d.date < t && !d.done ? ' overdue' : '')}>{[when, d.time].filter(Boolean).join(' · ')}</span>}
      </span>
      <button className="todo-urg" style={{ background: u && !d.done ? u.color : '#fff', borderColor: u && !d.done ? u.color : undefined }} onClick={() => setPick(true)} aria-label="Urgency" />
      <button className="icon-btn small" onClick={() => onEdit(td.id)} aria-label="Edit"><Icon name="edit" size={16} /></button>
      <UrgencyPicker open={pick} onClose={() => setPick(false)} value={d.urgency} onPick={v => update(td.id, { urgency: v })}>
      </UrgencyPicker>
    </SwipeRow>
  )
}

export function TodoList({ jobId, title = 'To-do', showCalendar = true }) {
  const t = today()
  const all = useList('todo', belongs(jobId), sortTodos)
  const shown = all.filter(r => !r.data.done || r.data.doneOn === t)
  const [text, setText] = useState('')
  const [date, setDate] = useState(t)
  const [edit, setEdit] = useState(null)
  const [big, setBig] = useState(false)
  const [day, setDay] = useState(null)
  const [month, setMonth] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth()] })
  const add = (txt = text, dt = date) => { if (!txt.trim()) return; put('todo', { text: txt.trim(), date: dt || t, done: false }, { job_id: jobId || null }); setText('') }
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
      {shown.length > 0 && <p className="hint" style={{ margin: '10px 0 0' }}>Hold a to-do to change it, or tap the pencil. Swipe right to tick, left to delete.</p>}
      {showCalendar && <button className="btn ghost wide" style={{ marginTop: 12 }} onClick={() => setBig(true)}><Icon name="schedule" size={18} /> Open to-do calendar</button>}
      <Sheet open={big} onClose={() => setBig(false)} title={`${title} calendar`} full>
        <MonthCalendar items={items} month={month} setMonth={setMonth} onDay={setDay} />
        <p className="hint">Swipe to change month. Tap a day to see or add to-dos.</p>
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
