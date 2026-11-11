import { useState } from 'react'
import { put, update, remove, useRecord, useList } from '../store'
import { Icon, Sheet, Field, MonthCalendar, UrgencyDot } from '../ui'
import { JobShell } from './Job'
import { URGENCY, niceDate, shortDate, today, parseYmd } from '../util'

function DaySheet({ date, jobId, tasks, onClose }) {
  const [text, setText] = useState('')
  const [urg, setUrg] = useState('green')
  const add = () => { if (!text.trim()) return; put('task', { date, text: text.trim(), urgency: urg, done: false }, { job_id: jobId }); setText('') }
  return (
    <Sheet open onClose={onClose} title={niceDate(date, { weekday: true })}>
      <ul className="checklist">
        {tasks.map(t => (
          <li key={t.id} className={t.data.done ? 'done' : ''}>
            <button className={'tick' + (t.data.done ? ' on' : '')} onClick={() => update(t.id, { done: !t.data.done })}>{t.data.done && <Icon name="check" size={16} stroke={3} />}</button>
            <span className="text">{t.data.text}</span>
            <button className="urg-mini" onClick={() => { const k = ['green', 'amber', 'red']; update(t.id, { urgency: k[(k.indexOf(t.data.urgency) + 1) % 3] }) }} aria-label="Change urgency"><UrgencyDot value={t.data.urgency} size={20} /></button>
            <button className="icon-btn small" onClick={() => remove(t.id)} aria-label="Delete"><Icon name="close" size={16} /></button>
          </li>
        ))}
      </ul>
      {tasks.length === 0 && <p className="muted small">No work planned for this day yet.</p>}
      <label className="field"><span>Add work for this day</span>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. First fix electrics" onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
      </label>
      <div className="urgency-row small">
        {Object.entries(URGENCY).map(([k, u]) => (
          <button key={k} className={'urgency-btn' + (urg === k ? ' on' : '')} style={{ background: u.color }} onClick={() => setUrg(k)}>{u.label}</button>
        ))}
      </div>
      <button className="btn primary wide" onClick={add}><Icon name="plus" size={18} /> Add</button>
    </Sheet>
  )
}

export default function Schedule({ id }) {
  const job = useRecord(id)
  const tasks = useList('task', r => r.job_id === id, (a, b) => a.data.date.localeCompare(b.data.date))
  const [day, setDay] = useState(null)
  const [month, setMonth] = useState(() => {
    const s = job?.data.start && job.data.start > today() ? parseYmd(job.data.start) : new Date()
    return [s.getFullYear(), s.getMonth()]
  })
  if (!job) return <JobShell job={null} />
  const d = job.data
  const items = tasks.map(t => ({ date: t.data.date, text: t.data.text, color: URGENCY[t.data.urgency]?.color, done: t.data.done }))
  const weeks = d.start && d.finish ? Math.max(1, Math.round((parseYmd(d.finish) - parseYmd(d.start)) / 864e5 / 7 * 10) / 10) : null
  const next = tasks.filter(t => !t.data.done && t.data.date >= today()).slice(0, 6)
  return (
    <JobShell job={job} tab="schedule" title="Job schedule">
      <section className="card">
        <div className="two">
          <Field label="Job start" type="date" value={d.start} onChange={v => update(id, { start: v })} />
          <Field label="Job finish" type="date" value={d.finish} onChange={v => update(id, { finish: v })} />
        </div>
        {weeks && <p className="muted small" style={{ margin: '4px 0 0' }}>Planned length: about {weeks} weeks. The job period is shaded blue on the calendar.</p>}
      </section>
      <section className="card cal-card">
        <MonthCalendar items={items} range={d.start ? [d.start, d.finish || d.start] : null} onDay={setDay} month={month} setMonth={setMonth} />
        <p className="hint">Tap a day to plan the work. Swipe to change month.</p>
      </section>
      <section className="card">
        <div className="card-head"><h2>Coming up</h2></div>
        {next.length === 0 ? <p className="muted small">Nothing planned yet.</p> : next.map(t => (
          <div key={t.id} className="up-row tap" onClick={() => setDay(t.data.date)}>
            <UrgencyDot value={t.data.urgency} size={14} />
            <span className="text">{t.data.text}</span>
            <span className="small muted nowrap">{shortDate(t.data.date)}</span>
          </div>
        ))}
      </section>
      {day && <DaySheet date={day} jobId={id} tasks={tasks.filter(t => t.data.date === day)} onClose={() => setDay(null)} />}
    </JobShell>
  )
}
