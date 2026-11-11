import { useState } from 'react'
import { list, useVersion } from '../store'
import { Icon, TopBar, Empty } from '../ui'
import { nav, back } from '../router'
import { niceDate } from '../util'

const KINDS = {
  job: { l: 'Job', text: d => [d.name, d.client, d.address], go: r => `/job/${r.id}` },
  material: { l: 'Material', text: d => [d.text, d.supplier], go: r => `/job/${r.job_id}/folder/${r.data.folder_id}` },
  todo: { l: 'To-do', text: d => [d.text], go: () => '/' },
  task: { l: 'Schedule', text: d => [d.text], go: r => `/job/${r.job_id}/schedule` },
  money: { l: 'Money', text: d => [d.desc, d.person, String(d.amount)], go: r => `/job/${r.job_id}/money` },
  invoice: { l: 'Invoice', text: d => [d.number, d.clientName, ...(d.lines || []).map(l => l.item)], go: r => `/job/${r.job_id}/invoice/${r.id}` },
  doc: { l: 'Document', text: d => [d.name], go: r => `/job/${r.job_id}/docs` },
  extra: { l: 'Extra', text: d => [d.text, d.location], go: r => `/job/${r.job_id}/extras` },
  snag: { l: 'Snag', text: d => [d.text, d.location], go: r => `/job/${r.job_id}/snags` },
  photo: { l: 'Photo', text: d => [d.caption], go: r => `/job/${r.job_id}/photos` },
  contact: { l: 'Contact', text: d => [d.name, d.company, d.trade, d.phone, d.email], go: () => '/contacts' },
  renewal: { l: 'Renewal', text: d => [d.name], go: () => '/renewals' },
}

export default function Search() {
  useVersion()
  const [q, setQ] = useState('')
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j.data.name]))
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const results = []
  if (words.length) {
    for (const [kind, k] of Object.entries(KINDS)) {
      for (const r of list(kind)) {
        const parts = k.text(r.data).filter(Boolean)
        const hay = parts.join(' ').toLowerCase()
        if (words.every(w => hay.includes(w))) results.push({ r, k, title: parts[0] || k.l, sub: parts.slice(1).filter(x => x !== 'undefined').join(' · ') })
        if (results.length > 80) break
      }
    }
  }
  return (
    <div className="page">
      <TopBar title="Search" onBack={() => back('/')} />
      <main className="content">
        <div className="search-box"><Icon name="search" size={18} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search jobs, materials, invoices, contacts…" /></div>
        {!words.length && <Empty icon="search" title="Find anything" text="Type a client's name, a material, an invoice number or a supplier." />}
        {words.length > 0 && results.length === 0 && <Empty title="Nothing found" text="Try a different word." />}
        {results.map(({ r, k, title, sub }) => (
          <button key={r.id} className="list-card" onClick={() => nav(k.go(r))}>
            <div className="text">
              <b>{title}</b>
              <span>{[r.job_id && jobs[r.job_id], sub, niceDate(r.data.created, { noYear: true })].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="result-kind">{k.l}</span>
          </button>
        ))}
      </main>
    </div>
  )
}
