// Home page tab: materials from every live job. Starts on urgent ones only; "All" shows everything, most urgent first.
import { useState } from 'react'
import { list, useVersion } from '../store'
import { UrgencyDot } from '../ui'
import { URGENCY } from '../util'
import { nav } from '../router'
import { jobStatus } from '../jobs'

const RANK = { red: 0, amber: 1, green: 2 }

export function MaterialsAllJobs() {
  useVersion()
  const [urgentOnly, setUrgentOnly] = useState(true)
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j]))
  const folders = Object.fromEntries(list('folder').map(f => [f.id, f]))
  const live = r => !r.job_id || (jobs[r.job_id] && jobStatus(jobs[r.job_id].data) !== 'finished')
  let rows = list('material', r => !r.data.done && r.data.text && folders[r.data.folder_id] && live(r))
  if (urgentOnly) rows = rows.filter(r => r.data.urgency === 'red')
  rows = [...rows].sort((a, b) => (RANK[a.data.urgency] ?? 3) - (RANK[b.data.urgency] ?? 3) || (a.data.date || '9999-99-99').localeCompare(b.data.date || '9999-99-99'))
  return (
    <main className="content home-content">
      <div className="section-head"><h2>Materials, all jobs</h2></div>
      <div className="seg small" style={{ gridTemplateColumns: '1fr 1fr', margin: '0 0 12px' }}>
        <button className={urgentOnly ? 'on' : ''} onClick={() => setUrgentOnly(true)}>Urgent</button>
        <button className={!urgentOnly ? 'on' : ''} onClick={() => setUrgentOnly(false)}>All materials</button>
      </div>
      {rows.length === 0 && <p className="muted small">{urgentOnly ? 'Nothing marked urgent.' : 'No materials on any job yet.'}</p>}
      {rows.map(r => {
        const j = jobs[r.job_id]
        return (
          <div key={r.id} className="up-row" onClick={() => nav(`/job/${r.job_id}/folder/${r.data.folder_id}`)} style={{ cursor: 'pointer' }}>
            <UrgencyDot value={r.data.urgency} size={14} />
            <span className="text">
              {r.data.text}
              <br /><span className="small muted">{j?.data.name || 'No job'}{r.data.urgency ? ` · ${URGENCY[r.data.urgency].label}` : ''}</span>
            </span>
          </div>
        )
      })}
    </main>
  )
}
