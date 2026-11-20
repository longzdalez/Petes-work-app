// Home tab: for each booked-in or on-site job, what we've put in less what the customer has paid. Oldest start date first.
import { list, useVersion } from '../store'
import { allItems } from '../ledger'
import { useSettings } from './Settings'
import { money, niceDate } from '../util'
import { nav } from '../router'
import { jobStatus } from '../jobs'

const sm = v => (v < -0.004 ? '−' : '') + money(Math.abs(v))

export function OwedPage() {
  useVersion()
  const { owners } = useSettings()
  const items = allItems(owners)
  const rows = list('job', r => ['booked', 'onsite'].includes(jobStatus(r.data)))
    .map(j => {
      const mine = items.filter(it => it.job === j.id)
      const put = mine.filter(it => it.kind === 'expense').reduce((s, it) => s + it.amount, 0)
      const paid = mine.filter(it => it.kind === 'income').reduce((s, it) => s + it.amount, 0)
      return { j, put, paid, owed: put - paid }
    })
    .sort((a, b) => (a.j.data.start || '9999-99-99').localeCompare(b.j.data.start || '9999-99-99'))
  const total = rows.reduce((s, r) => s + r.owed, 0)
  return (
    <main className="content home-content">
      <div className="section-head"><h2>Owed</h2></div>
      {rows.length === 0 && <p className="muted small">No booked-in jobs yet.</p>}
      {rows.length > 0 && <section className="card"><div className="kv grand"><span>Total still to recover</span><b>{sm(total)}</b></div></section>}
      {rows.map(({ j, put, paid, owed }) => (
        <section key={j.id} className="card" style={{ cursor: 'pointer' }} onClick={() => nav(`/job/${j.id}/money`)}>
          <div className="card-head"><h2>{j.data.name || 'Untitled job'}</h2><b className={owed > 0 ? 'neg' : 'pos'}>{sm(owed)}</b></div>
          <div className="small muted">{j.data.client || 'No customer name'}{j.data.start ? ` · starts ${niceDate(j.data.start)}` : ''}</div>
          <div className="kv"><span>We've put in</span><b>{money(put)}</b></div>
          <div className="kv"><span>Customer has paid</span><b>{money(paid)}</b></div>
        </section>
      ))}
    </main>
  )
}
