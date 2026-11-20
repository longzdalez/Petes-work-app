// Home tab: urgent (red) materials from every live job. "Show all" lists every material on live jobs, most urgent first.
import { useState } from 'react'
import { list, useVersion } from '../store'
import { UrgencyDot } from '../ui'
import { URGENCY } from '../util'
import { nav } from '../router'
import { jobStatus } from '../jobs'

const RANK = { red: 0, amber: 1, green: 2 }

export function MaterialsAllJobs() {
  useVersion()
  const [all, setAll] = useState(false)
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j]))
  const folders = Object.fromEntries(list('folder').map(f => [f.id, f]))
  const live = r => !r.job_id || (jobs[r.job_id] && jobStatus(jobs[r.job_id].data) !== 'finished')
  let rows = list('material', r => !r.data.done && r.data.text && folders[r.data.folder_id] && live(r))
  if (!all) rows = rows.filter(r => r.data.urgency === 'red')
  rows = [...rows].sort((a, b) => (RANK[a.data.urgency] ?? 3) - (RANK[b.data.urgency] ?? 3) || (a.data.date || '9999-99-99').localeCompare(b.data.date || '9999-99-99'))
  return (
    <main className="content home-content">
      <div className="section-head"><h2>Materials</h2></div>
      <button className="btn ghost wide" style={{ marginBottom: 12 }} onClick={() => setAll(a => !a)}>{all ? 'Show urgent only' : 'Show all materials'}</button>
      {rows.length === 0 && <p className="muted small">{all ? 'No materials on any job yet.' : 'Nothing marked urgent.'}</p>}
      {rows.map(r => {
        const j = jobs[r.job_id]
        const who = [j?.data.name, j?.data.client].filter(Boolean).join(' · ') || 'No job'
        return (
          <div key={r.id} className="up-row" style={{ cursor: 'pointer' }} onClick={() => nav(`/job/${r.job_id}/folder/${r.data.folder_id}`)}>
            <UrgencyDot value={r.data.urgency} size={14} />
            <span className="text">
              {r.data.text}
              <br /><span className="small muted">{who}{r.data.urgency ? ` · ${URGENCY[r.data.urgency].label}` : ''}</span>
            </span>
          </div>
        )
      })}
    </main>
  )
}
