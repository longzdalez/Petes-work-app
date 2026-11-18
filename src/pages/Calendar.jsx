// Overall schedule for the home screen: each day shows the live jobs booked on it, from each job's start and finish dates
import { useState } from 'react'
import { useList } from '../store'
import { Icon, Sheet } from '../ui'
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

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function JobCalendar() {
  const jobs = useList('job', r => r.data.status !== 'finished')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [day, setDay] = useState(null)
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
            {jobsOn(jobs, c).map(j => <span key={j.id} className="cal-job">{j.data.client || j.data.name || 'Untitled job'}</span>)}
          </button>
          : <span key={'blank' + i} className="cal-blank" />)}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>Tap a day to see every live job booked on it.</p>
      {day && <Sheet open onClose={() => setDay(null)} title={`Booked on ${niceDate(day)}`}>
        {dayJobs.length === 0 && <p className="muted">No live jobs booked on this day.</p>}
        <div className="pick-list">
          {dayJobs.map(j => (
            <button key={j.id} className="pick-row" onClick={() => { setDay(null); nav(`/job/${j.id}`) }}>
              <span className="text"><b>{j.data.client || j.data.name || 'Untitled job'}</b>
                <span>{j.data.name && j.data.client ? `${j.data.name} · ` : ''}{j.data.address?.split('\n')[0] || 'No address yet'}</span>
                <span>{shortDate(j.data.start)}{j.data.finish ? ` to ${shortDate(j.data.finish)}` : ''}</span></span>
              <Icon name="right" size={20} />
            </button>
          ))}
        </div>
      </Sheet>}
    </section>
  )
}
