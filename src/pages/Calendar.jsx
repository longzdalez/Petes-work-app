// Overall schedule for the home screen: each day shows the live jobs booked on it, from each job's start and finish dates
import { useState } from 'react'
import { put, update, useList } from '../store'
import { Icon, Sheet, Field } from '../ui'
import { nav } from '../router'
import { today, ymd, parseYmd, shortDate, niceDate, MONTHS } from '../util'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_DAYS = 400 // longest run a single job can be booked for on the calendar

// Every booking on the calendar, keyed by the day it shows on. A job is booked on each day from its start to its finish.
// Each day can be edited on its own: its details (name, client, address), removed from that day (hidden),
// or moved to another date (moveTo). None of these touch the job's start or finish dates or any other day.
export function buildBookings(jobs) {
  const map = {}
  jobs.forEach(j => {
    const s = j.data.start
    if (!s) return
    const e = j.data.finish && j.data.finish >= s ? j.data.finish : s
    const cd = j.data.calDays || {}
    const cur = parseYmd(s)
    for (let i = 0; i < MAX_DAYS; i++) {
      const k = ymd(cur)
      if (k > e) break
      const o = cd[k] || {}
      if (!o.hidden) (map[o.moveTo || k] ||= []).push({ job: j, src: k })
      cur.setDate(cur.getDate() + 1)
    }
  })
  return map
}

// What a booking shows: the job's own details, unless that day has been edited on the calendar.
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

// Change one day's entry for a job, leaving every other day alone
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

// Edit one day's entry for a job. Only that day changes; the job's dates stay as they are.
function DayJobEditor({ job, day, onClose }) {
  const v = dayView(job, day)
  const set = patch => setDayEdit(job, day, patch)
  const cd = job.data.calDays?.[day] || {}
  return (
    <Sheet open onClose={onClose} title={`Edit ${niceDate(day)}`}>
      <p className="small muted" style={{ marginTop: 0 }}>Changes here only apply to this one day. The job's own details and start and finish dates don't change, and no other day moves.</p>
      <Field label="Job name" value={v.name} onChange={x => set({ name: x })} />
      <Field label="Client name" value={v.client} onChange={x => set({ client: x })} />
      <Field label="Address" value={v.address} onChange={x => set({ address: x })} multiline />
      <Field label="Move this day's booking to" type="date" value={cd.moveTo || ''} onChange={x => set({ moveTo: x || null })} />
      <div className="sheet-actions">
        {v.edited && <button className="btn ghost" onClick={() => resetDay(job, day)}>Use job details</button>}
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
}

// Add a job booked on the day that was tapped, then open that day for editing
function addJobOn(day) {
  const j = put('job', { name: 'New job', client: '', start: day })
  put('folder', { name: 'General', order: 0 }, { job_id: j.id })
  return j
}

export function JobCalendar() {
  const jobs = useList('job', r => r.data.status !== 'finished')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [day, setDay] = useState(null)
  const [editing, setEditing] = useState(null) // { id, day } of the booking being edited
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
  const bookings = buildBookings(jobs)
  const dayBookings = day ? bookings[day] || [] : []
  const removedHere = day ? jobs.filter(j => j.data.calDays?.[day]?.hidden) : []
  const movedAway = day ? jobs.filter(j => j.data.calDays?.[day]?.moveTo) : []
  const editJob = editing ? jobs.find(j => j.id === editing.id) || null : null
  const addHere = () => setEditing({ id: addJobOn(day).id, day })
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
            {(bookings[c] || []).map(b => <span key={b.job.id + b.src} className="cal-job">{labelOf(dayView(b.job, b.src))}</span>)}
          </button>
          : <span key={'blank' + i} className="cal-blank" />)}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>Tap a day to see, add, edit, move or remove the jobs booked on it. Changes only affect that day.</p>
      {day && !editing && <Sheet open onClose={() => setDay(null)} title={`Booked on ${niceDate(day)}`}>
        {dayBookings.length === 0 && <p className="muted">No live jobs booked on this day.</p>}
        <div className="pick-list">
          {dayBookings.map(({ job: j, src }) => {
            const v = dayView(j, src)
            return (
              <div key={j.id + src} className="cal-job-row">
                <div className="text"><b>{labelOf(v)}{v.edited && <em className="cal-tag">Edited</em>}{src !== day && <em className="cal-tag">Moved from {shortDate(src)}</em>}</b>
                  <span>{v.name && v.client ? `${v.name} · ` : ''}{v.address?.split('\n')[0] || 'No address yet'}</span>
                  <span>{shortDate(j.data.start)}{j.data.finish ? ` to ${shortDate(j.data.finish)}` : ''}</span></div>
                <div className="cal-job-acts">
                  <button className="btn ghost small" onClick={() => setEditing({ id: j.id, day: src })}><Icon name="edit" size={16} /> Edit</button>
                  <button className="btn ghost small" onClick={() => { setDay(null); nav(`/job/${j.id}`) }}>Open</button>
                  <button className="btn ghost small" onClick={() => setDayEdit(j, src, { hidden: true })}>Remove from this day</button>
                </div>
              </div>
            )
          })}
        </div>
        {removedHere.length > 0 && <>
          <h3 className="sub-h">Removed from this day</h3>
          {removedHere.map(j => (
            <div key={j.id} className="cal-job-row">
              <div className="text"><b>{labelOf(dayView(j, day))}</b></div>
              <div className="cal-job-acts"><button className="btn ghost small" onClick={() => setDayEdit(j, day, { hidden: null })}>Put back on this day</button></div>
            </div>
          ))}
        </>}
        {movedAway.length > 0 && <>
          <h3 className="sub-h">Moved off this day</h3>
          {movedAway.map(j => (
            <div key={j.id} className="cal-job-row">
              <div className="text"><b>{labelOf(dayView(j, day))}</b><span>Moved to {shortDate(j.data.calDays[day].moveTo)}</span></div>
              <div className="cal-job-acts"><button className="btn ghost small" onClick={() => setDayEdit(j, day, { moveTo: null })}>Put back on this day</button></div>
            </div>
          ))}
        </>}
        <div className="sheet-actions">
          <button className="btn primary" onClick={addHere}><Icon name="plus" size={18} /> Add a job on this day</button>
        </div>
      </Sheet>}
      {editJob && editing && <DayJobEditor job={editJob} day={editing.day} onClose={() => setEditing(null)} />}
    </section>
  )
}
