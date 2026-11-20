// Home tab: every job with the customer's name next to it. Opens to jobs still on the go; "Show all" adds finished ones.
import { useState } from 'react'
import { useList } from '../store'
import { nav } from '../router'
import { jobStatus } from '../jobs'
import { shortDate } from '../util'

export function JobListPage() {
  const [all, setAll] = useState(false)
  const jobs = useList('job', null, (a, b) => (a.data.name || '').localeCompare(b.data.name || ''))
  const shown = all ? jobs : jobs.filter(j => jobStatus(j.data) !== 'finished')
  return (
    <main className="content home-content">
      <section className="card">
      <div className="card-head"><h2>Job list</h2></div>
      <button className="btn ghost wide" style={{ marginBottom: 12 }} onClick={() => setAll(a => !a)}>{all ? 'Show current jobs only' : 'Show all jobs, including finished'}</button>
      {shown.length === 0 && <p className="muted small">No jobs yet.</p>}
      {shown.map(j => (
        <div key={j.id} className="up-row" style={{ cursor: 'pointer' }} onClick={() => nav(`/job/${j.id}`)}>
          <span className="text"><b>{j.data.name || 'Untitled job'}</b>{j.data.client && <span className="small muted"> · {j.data.client}</span>}</span>
          <span className="small muted" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{j.data.start ? `Starts ${shortDate(j.data.start)}` : 'No start date'}</span>
        </div>
      ))}
      </section>
    </main>
  )
}
