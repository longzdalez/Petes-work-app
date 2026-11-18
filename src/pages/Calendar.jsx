// Overall schedule for the home screen: each day shows the live jobs booked on it, from each job's start and finish dates
import { useState } from 'react'
import { put, update, removeDeep, useList } from '../store'
import { Icon, Sheet, Field, confirmDelete } from '../ui'
import { nav } from '../router'
import { today, ymd, parseYmd, shortDate, niceDate, MONTHS } from '../util'

// Live jobs (not finished) booked on a day: from the start date to the finish date (or just the start day if there's no finish)
export function jobsOn(jobs, day) {
  return jobs.filter(j => {
    const s = j.data.start
    if (!s) return false
    const e = j.data.finish && j.data.finish >= s ? j.data.finish : s
    return day >= s && day <= e
  })
}

// What a job shows on one day: its own details, unless that day has been edited on the calendar.
// Day edits live in job.data.calDays[day] and never change the job's start or finish dates.
export function dayView(job, day) {
  const d = job.data, o = d.calDays?.[day] || {}
  return {
    name: o.name ?? d.name ?? '',
    client: o.client ?? d.client ?? '',
    address: o.address ?? d.address ?? '',
    edited: !!d.calDays?.[day],
  }
}
const labelOf = v => v.client || v.name || 'Untitled job'

function setDayEdit(job, day, patch) {
  const cur = job.data.calDays || {}
  update(job.id, { calDays: { ...cur, [day]: { ...(cur[day] || {}), ...patch } } })
}

// Put a single day back to the job's own details
function resetDay(job, day) {
  const rest = { ...(job.data.calDays || {}) }
  delete rest[day]
  update(job.id, { calDays: rest })
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Edit one day's entry for a job. Only that day changes; the job's dates stay as they are.
function DayJobEditor({ job, day, onClose }) {
  const v = dayView(job, day)
  const set = patch => setDayEdit(job, day, patch)
  return (
    <Sheet open onClose={onClose} title={`Edit on ${niceDate(day)}`}>
      <p className="small muted" style={{ marginTop: 0 }}>Changes here only apply to this day. The job's own details and start and finish dates don't change.</p>
      <Field label="Job name" value={v.name} onChange={x => set({ name: x })} />
      <Field label="Client name" value={v.client} onChange={x => set({ client: x })} />
      <Field label="Address" value={v.address} onChange={x => set({ address: x })} multiline />
      <div className="sheet-actions">
        {v.edited && <button className="btn ghost" onClick={() => resetDay(job, day)}>Use job details</button>}
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
}

// Add a job booked on the day that was tapped, then open it for editing
function addJobOn(day) {
  const j = put('job', { name: 'New job', client: '', start: day })
  put('folder', { name: 'General', order: 0 }, { job_id: j.id })
  return j
}

export function JobCalendar() {
  const jobs = useList('job', r => r.data.status !== 'finished')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [day, setDay] = useState(null)
  const [editing, setEditing] = useState(null)
  const first = parseYmd(month + '-01')
  const offset = (first.getDay() + 6) % 7 // weeks start on Monday
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]
  while (cells.length % 7) cells.push(null)
  const t = today()
  const shift = n => { const d = parseYmd(month + '-01'); d.setMonth(d.getMonth() + n); setMonth(ymd(d).slice(0, 7)) }
  const dayJobs = day ? jobsOn(jobs, day) : []
  const editJob = editing ? jobs.find(j => j.id === editing) || null : null
  const addHere = () => setEditing(addJobOn(day).id)
  return (
    <section className="card cal-card">
      <div className="month-pick">
        <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}><Icon name="left" size={20} /></button>
        <b>{MONTHS[first.getMonth()]} {first.getFullYear()}</b>
        <button className="icon-btn" aria-label="Next month" onClick={() => shift(1)}><Icon name="right" size={20} /></button>
      </div>
      <div className="cal-week">{WEEK.map(w => <span key={w}>{w}</span>)}</div>
      <div className="cal-grid">
        {cells.map((c, i) => c
          ? <button key={c} className={'cal-day' + (c === t ? ' today' : '')} onClick={() => setDay(c)}>
            <span className="cal-num">{+c.slice(8)}</span>
            {jobsOn(jobs, c).map(j => <span key={j.id} className="cal-job">{labelOf(dayView(j, c))}</span>)}
          </button>
          : <span key={'blank' + i} className="cal-blank" />)}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>Tap a day to see, add, edit or remove the jobs booked on it.</p>
      {day && !editJob && <Sheet open onClose={() => setDay(null)} title={`Booked on ${niceDate(day)}`}>
        {dayJobs.length === 0 && <p className="muted">No live jobs booked on this day.</p>}
        <div className="pick-list">
          {dayJobs.map(j => {
            const v = dayView(j, day)
            return (
              <div key={j.id} className="cal-job-row">
                <div className="text"><b>{labelOf(v)}{v.edited && <em className="urgent-tag" style={{ background: 'var(--line)', color: 'var(--muted)' }}>Edited</em>}</b>
                  <span>{v.name && v.client ? `${v.name} · ` : ''}{v.address?.split('\n')[0] || 'No address yet'}</span>
                  <span>{shortDate(j.data.start)}{j.data.finish ? ` to ${shortDate(j.data.finish)}` : ''}</span></div>
                <div className="cal-job-acts">
                  <button className="btn ghost small" onClick={() => setEditing(j.id)}><Icon name="edit" size={16} /> Edit</button>
                  <button className="btn ghost small" onClick={() => { setDay(null); nav(`/job/${j.id}`) }}>Open</button>
                  <button className="btn danger small" aria-label={`Remove ${labelOf(v)}`} onClick={() => { if (confirmDelete('this job and everything in it')) removeDeep(j.id) }}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="sheet-actions">
          <button className="btn primary" onClick={addHere}><Icon name="plus" size={18} /> Add a job on this day</button>
        </div>
      </Sheet>}
      {editJob && day && <DayJobEditor job={editJob} day={day} onClose={() => setEditing(null)} />}
    </section>
  )
}
