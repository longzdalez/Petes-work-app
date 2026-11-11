import { useEffect, useState } from 'react'
import { takeSharedFiles, useList } from '../store'
import { TopBar, Empty, Icon } from '../ui'
import { nav } from '../router'
import { addDocs } from './Docs'

export default function Share() {
  const [files, setFiles] = useState(null)
  const [busy, setBusy] = useState(false)
  const jobs = useList('job', null, (a, b) => (b.data.created || '').localeCompare(a.data.created || ''))
  useEffect(() => { takeSharedFiles().then(list => setFiles(list.map(f => new File([f.blob], f.name || 'file', { type: f.type || f.blob.type })))) }, [])
  const pick = async job => { setBusy(true); await addDocs(job.id, files); nav(`/job/${job.id}/docs`) }
  return (
    <div className="page">
      <TopBar title="Save to a job" onBack={() => nav('/')} />
      <main className="content">
        {files === null ? <p className="muted">Loading…</p> : files.length === 0 ? <Empty title="Nothing to save" text="Nothing was shared to the app." /> : <>
          <section className="card"><div className="card-head"><h2>{files.length} file{files.length > 1 ? 's' : ''}</h2></div>
            {files.map((f, i) => <div key={i} className="up-row"><Icon name="docs" size={18} /><span className="text">{f.name}</span></div>)}
          </section>
          <h2 className="pad">Which job is it for?</h2>
          {busy ? <p className="muted">Saving…</p> : <div className="job-list">{jobs.map(j => (
            <button key={j.id} className="job-card" onClick={() => pick(j)}><div className="job-main"><div className="job-name">{j.data.name}</div><div className="job-meta">{j.data.client}</div></div><Icon name="right" /></button>
          ))}</div>}
          {jobs.length === 0 && <Empty title="No jobs yet" text="Make a job first, then share the file again." />}
        </>}
      </main>
    </div>
  )
}
