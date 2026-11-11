import { useState } from 'react'
import { put, update, remove, useRecord, useList } from '../store'
import { Icon, Sheet, Field, Empty, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { money, num, today, shortDate, niceDate } from '../util'
import { useSettings } from './Settings'

const CATS_IN = [{ k: 'client', l: 'Client payment' }, { k: 'other', l: 'Other' }]
const CATS_OUT = [{ k: 'wages', l: 'Wages' }, { k: 'contractor', l: 'Contractor' }, { k: 'materials', l: 'Materials' }, { k: 'other', l: 'Other' }]
const catLabel = (dir, k) => (dir === 'in' ? CATS_IN : CATS_OUT).find(c => c.k === k)?.l || 'Other'
const byDate = (a, b) => (a.data.date || '').localeCompare(b.data.date || '') || a.data.created.localeCompare(b.data.created)

function EntrySheet({ entry, jobId, onClose, owners }) {
  const isNew = !entry.id
  const [d, setD] = useState({ dir: 'in', cat: 'client', date: today(), status: 'paid', amount: '', desc: '', person: '', ...entry.data })
  const set = p => setD(x => ({ ...x, ...p }))
  const cats = d.dir === 'in' ? CATS_IN : CATS_OUT
  const save = () => {
    if (!num(d.amount)) return alert('Please put in an amount')
    const data = { ...d, amount: num(d.amount) }
    if (isNew) put('money', data, { job_id: jobId }); else update(entry.id, data)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add money' : 'Edit entry'}>
      <div className="seg">
        <button className={d.dir === 'in' ? 'on in' : ''} onClick={() => set({ dir: 'in', cat: 'client' })}>Money in</button>
        <button className={d.dir === 'out' ? 'on out' : ''} onClick={() => set({ dir: 'out', cat: 'materials' })}>Money out</button>
      </div>
      <div className="seg small">
        <button className={d.status === 'paid' ? 'on' : ''} onClick={() => set({ status: 'paid' })}>Paid</button>
        <button className={d.status === 'upcoming' ? 'on' : ''} onClick={() => set({ status: 'upcoming' })}>Upcoming</button>
      </div>
      <div className="two">
        <label className="field"><span>Amount (£)</span><input inputMode="decimal" value={d.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" autoFocus={isNew} /></label>
        <label className="field"><span>Date</span><input type="date" value={d.date} onChange={e => set({ date: e.target.value })} /></label>
      </div>
      <label className="field"><span>Type</span>
        <div className="chips">{cats.map(c => <button key={c.k} className={'chip' + (d.cat === c.k ? ' on' : '')} onClick={() => set({ cat: c.k })}>{c.l}</button>)}</div>
      </label>
      {d.cat === 'wages' && (
        <label className="field"><span>Paid to</span>
          <div className="chips">{owners.map(o => <button key={o} className={'chip' + (d.person === o ? ' on' : '')} onClick={() => set({ person: o })}>{o}</button>)}</div>
        </label>
      )}
      {d.cat === 'contractor' && <label className="field"><span>Contractor name</span><input value={d.person} onChange={e => set({ person: e.target.value })} /></label>}
      <label className="field"><span>What was it for?</span><input value={d.desc} onChange={e => set({ desc: e.target.value })} placeholder={d.dir === 'in' ? 'e.g. Deposit' : 'e.g. Timber from Jewson'} /></label>
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { if (confirmDelete('this entry')) { remove(entry.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        {!isNew && d.status === 'upcoming' && <button className="btn ghost" onClick={() => { update(entry.id, { ...d, amount: num(d.amount), status: 'paid', date: today() }); onClose() }}>Mark paid today</button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

// Projected bank balance for this job, stepping at each upcoming payment
function Forecast({ start, upcoming }) {
  const [hover, setHover] = useState(null)
  if (!upcoming.length) return null
  const pts = [{ date: today(), bal: start, label: 'Now' }]
  let bal = start
  upcoming.forEach(e => { bal += e.data.dir === 'in' ? e.data.amount : -e.data.amount; pts.push({ date: e.data.date, bal, label: e.data.desc || catLabel(e.data.dir, e.data.cat), amt: e.data.amount, dir: e.data.dir }) })
  const W = 340, H = 170, P = { l: 52, r: 12, t: 14, b: 26 }
  const vals = pts.map(p => p.bal).concat(0)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const span = hi - lo || 1
  const x = i => P.l + (i * (W - P.l - P.r)) / Math.max(1, pts.length - 1)
  const y = v => P.t + ((hi - v) * (H - P.t - P.b)) / span
  // step line: flat until the next payment, then jump
  let d = `M${x(0)},${y(pts[0].bal)}`
  for (let i = 1; i < pts.length; i++) d += ` H${x(i)} V${y(pts[i].bal)}`
  const ticks = [hi, (hi + lo) / 2, lo]
  const h = hover != null ? pts[hover] : null
  return (
    <div className="forecast">
      <h3>Where the money is heading</h3>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Projected balance">
          {ticks.map((t, i) => <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e6eaf0" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6b7a90">{'£' + Math.round(t).toLocaleString('en-GB')}</text>
          </g>)}
          {lo < 0 && hi > 0 && <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="#9aa6b8" strokeDasharray="3 3" />}
          <path d={d} fill="none" stroke="#2c6bd6" strokeWidth="2" />
          {pts.map((p, i) => <g key={i}>
            <circle cx={x(i)} cy={y(p.bal)} r={hover === i ? 6 : 4} fill="#2c6bd6" stroke="#fff" strokeWidth="2" />
            <rect x={x(i) - 16} y={P.t} width="32" height={H - P.t - P.b} fill="transparent" onClick={() => setHover(hover === i ? null : i)} />
            {(i === 0 || i === pts.length - 1) && <text x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : 'end'} fontSize="10" fill="#6b7a90">{i === 0 ? 'Today' : shortDate(p.date)}</text>}
          </g>)}
        </svg>
        <div className="chart-tip">
          {h ? <><b>{h.label}</b> {h.amt != null && <span className={h.dir === 'in' ? 'pos' : 'neg'}>{h.dir === 'in' ? '+' : '−'}{money(h.amt)}</span>} on {niceDate(h.date, { noYear: true })} → balance <b>{money(h.bal)}</b></>
            : <span className="muted">Tap a dot to see the details. Balance after all upcoming payments: <b>{money(bal)}</b></span>}
        </div>
      </div>
    </div>
  )
}

export default function Money({ id }) {
  const job = useRecord(id)
  const settings = useSettings()
  const owners = settings.owners
  const entries = useList('money', r => r.job_id === id, byDate)
  const [edit, setEdit] = useState(null)
  const paid = entries.filter(e => e.data.status !== 'upcoming')
  const upcoming = entries.filter(e => e.data.status === 'upcoming')
  const sum = arr => arr.reduce((s, e) => s + (Number(e.data.amount) || 0), 0)
  const moneyIn = sum(paid.filter(e => e.data.dir === 'in'))
  const outs = paid.filter(e => e.data.dir === 'out')
  const moneyOut = sum(outs)
  const profit = moneyIn - moneyOut
  const breakdown = [
    ...owners.map(o => ({ l: `Wages: ${o}`, v: sum(outs.filter(e => e.data.cat === 'wages' && e.data.person === o)) })),
    { l: 'Wages: other', v: sum(outs.filter(e => e.data.cat === 'wages' && !owners.includes(e.data.person))) },
    { l: 'Contractors', v: sum(outs.filter(e => e.data.cat === 'contractor')) },
    { l: 'Materials', v: sum(outs.filter(e => e.data.cat === 'materials')) },
    { l: 'Other', v: sum(outs.filter(e => e.data.cat === 'other')) },
  ].filter((b, i) => b.v || i < owners.length)
  const contractors = {}
  outs.filter(e => e.data.cat === 'contractor').forEach(e => { const n = e.data.person || 'Unnamed'; contractors[n] = (contractors[n] || 0) + e.data.amount })
  let running = 0
  return (
    <JobShell job={job} tab="money" title="Money">
      <div className="stat-row">
        <div className="stat in"><span>Money in</span><b>{money(moneyIn)}</b></div>
        <div className="stat out"><span>Money out</span><b>{money(moneyOut)}</b></div>
      </div>
      <div className={'stat profit ' + (profit >= 0 ? 'pos' : 'neg')}><span>Profit so far</span><b>{money(profit)}</b></div>

      <button className="btn primary wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Add money in or out</button>

      <section className="card">
        <div className="card-head"><h2>Payments</h2></div>
        {paid.length === 0 ? <p className="muted small">No payments yet.</p> : (
          <table className="ledger">
            <thead><tr><th>Date</th><th>What</th><th className="r">Amount</th><th className="r">Balance</th></tr></thead>
            <tbody>{paid.map(e => {
              running += e.data.dir === 'in' ? e.data.amount : -e.data.amount
              return (
                <tr key={e.id} onClick={() => setEdit(e)}>
                  <td className="nowrap">{shortDate(e.data.date)}</td>
                  <td><div>{e.data.desc || catLabel(e.data.dir, e.data.cat)}</div><div className="muted small">{catLabel(e.data.dir, e.data.cat)}{e.data.person ? ` · ${e.data.person}` : ''}</div></td>
                  <td className={'r nowrap ' + (e.data.dir === 'in' ? 'pos' : 'neg')}>{e.data.dir === 'in' ? '+' : '−'}{money(e.data.amount)}</td>
                  <td className="r nowrap">{money(running)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Where the money went</h2></div>
        {breakdown.map(b => <div key={b.l} className="kv"><span>{b.l}</span><b>{money(b.v)}</b></div>)}
        {Object.keys(contractors).length > 0 && <>
          <h3 className="sub-h">Each contractor</h3>
          {Object.entries(contractors).map(([n, v]) => <div key={n} className="kv"><span>{n}</span><b>{money(v)}</b></div>)}
        </>}
      </section>

      <section className="card">
        <div className="card-head"><h2>Upcoming payments</h2></div>
        {upcoming.length === 0
          ? <p className="muted small">Add a payment you're expecting (in or out) and set it to Upcoming to see a forecast.</p>
          : <>
            {upcoming.map(e => (
              <div key={e.id} className="up-row tap" onClick={() => setEdit(e)}>
                <span className="small nowrap muted">{shortDate(e.data.date)}</span>
                <span className="text">{e.data.desc || catLabel(e.data.dir, e.data.cat)}</span>
                <span className={'nowrap ' + (e.data.dir === 'in' ? 'pos' : 'neg')}>{e.data.dir === 'in' ? '+' : '−'}{money(e.data.amount)}</span>
              </div>
            ))}
            <Forecast start={profit} upcoming={upcoming} />
          </>}
      </section>
      {edit && <EntrySheet entry={edit} jobId={id} owners={owners} onClose={() => setEdit(null)} />}
    </JobShell>
  )
}
