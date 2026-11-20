// Home tab: every job still on the go, with the customer's name next to it. Finished jobs live in the Finished jobs folder.
import { useList } from '../store'
import { nav } from '../router'
import { jobStatus } from '../jobs'
import { shortDate } from '../util'

export function JobListPage() {
  const shown = useList('job', r => jobStatus(r.data) !== 'finished', (a, b) => (a.data.name || '').localeCompare(b.data.name || ''))
  return (
    <main className="content home-content">
      <section className="card">
      <div className="card-head"><h2>Job list</h2></div>
      {shown.length === 0 && <p className="muted small">No current jobs. Finished jobs are in the Finished jobs folder on the Jobs tab.</p>}
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
