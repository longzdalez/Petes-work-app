import { useState } from 'react'
import { put, update, remove, useRecord, useList, list } from '../store'
import { Icon, Sheet, Field, Empty, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { nav } from '../router'
import { money, num, niceDate, today, parseYmd, ymd } from '../util'
import { useSettings } from './Settings'

const weekStart = s => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d) }

function HoursSheet({ entry, jobId, people, onClose }) {
  const isNew = !entry.id
  const lastRate = name => list('hours', r => r.data.person === name).sort((a, b) => b.data.created.localeCompare(a.data.created))[0]?.data.rate || ''
  const [d, setD] = useState({ date: today(), person: people[0] || '', hours: '8', rate: lastRate(people[0] || ''), notes: '', ...entry.data })
  const set = p => setD(x => ({ ...x, ...p }))
  const save = () => {
    if (!d.person.trim() || !num(d.hours)) return alert('Please add who and how many hours')
    const data = { ...d, person: d.person.trim(), hours: num(d.hours), rate: num(d.rate) }
    if (isNew) put('hours', data, { job_id: jobId }); else update(entry.id, data)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Log hours' : 'Hours'}>
      <label className="field"><span>Who</span>
        <div className="chips" style={{ marginBottom: 8 }}>{people.map(p => <button key={p} className={'chip' + (d.person === p ? ' on' : '')} onClick={() => set({ person: p, rate: d.rate || lastRate(p) })}>{p}</button>)}</div>
        <input value={d.person} onChange={e => set({ person: e.target.value })} placeholder="Or type a name" />
      </label>
      <div className="three">
        <Field label="Date" type="date" value={d.date} onChange={v => set({ date: v })} />
        <Field label="Hours" inputMode="decimal" value={d.hours} onChange={v => set({ hours: v })} />
        <Field label="£ per hour" inputMode="decimal" value={d.rate} onChange={v => set({ rate: v })} />
      </div>
      <Field label="What they did (optional)" value={d.notes} onChange={v => set({ notes: v })} />
      <div className="kv"><span>Cost</span><b>{money(num(d.hours) * num(d.rate))}</b></div>
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { if (confirmDelete('these hours')) { remove(entry.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

export default function Hours({ id }) {
  const job = useRecord(id)
  const settings = useSettings()
  const entries = useList('hours', r => r.job_id === id, (a, b) => b.data.date.localeCompare(a.data.date))
  const [edit, setEdit] = useState(null)
  if (!job) return <JobShell job={null} />
  const known = [...new Set([...settings.owners, ...list('hours').map(h => h.data.person), ...list('contact', c => c.data.role === 'trade').map(c => c.data.name)].filter(Boolean))].slice(0, 12)
  const unpaid = {}
  entries.filter(e => !e.data.paid).forEach(e => { const p = e.data.person; unpaid[p] ||= { hours: 0, cost: 0, ids: [] }; unpaid[p].hours += e.data.hours; unpaid[p].cost += e.data.hours * e.data.rate; unpaid[p].ids.push(e.id) })
  const pay = (person, u) => {
    if (!confirm(`Pay ${person} ${money(u.cost)} for ${u.hours} hours? This adds it to Money as wages.`)) return
    const m = put('money', { dir: 'out', cat: settings.owners.includes(person) ? 'wages' : 'contractor', person, amount: Math.round(u.cost * 100) / 100, date: today(), desc: `${u.hours} hours`, status: 'paid' }, { job_id: id })
    u.ids.forEach(i => update(i, { paid: true, money_id: m.id }))
  }
  const weeks = {}
  entries.forEach(e => (weeks[weekStart(e.data.date)] ||= []).push(e))
  return (
    <JobShell job={job} tab="" title="Workers' hours" onBack={() => nav(`/job/${id}`)}>
      <button className="btn orange wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Log hours</button>
      {Object.keys(unpaid).length > 0 && <section className="card">
        <div className="card-head"><h2>Still to pay</h2></div>
        {Object.entries(unpaid).map(([p, u]) => (
          <div key={p} className="kv">
            <span><b>{p}</b><br /><span className="small muted">{u.hours} hours</span></span>
            <button className="btn primary small" onClick={() => pay(p, u)}>Pay {money(u.cost)}</button>
          </div>
        ))}
      </section>}
      {entries.length === 0 && <Empty icon="clock" title="No hours logged" text="Log who worked and for how long each day. When you pay them, one tap adds it to the job's Money as wages." />}
      {Object.entries(weeks).map(([w, es]) => {
        const tot = es.reduce((s, e) => s + e.data.hours, 0)
        return (
          <section key={w} className="card">
            <div className="week-head"><span>Week of {niceDate(w, { noYear: true })}</span><span className="pill">{tot} hrs · {money(es.reduce((s, e) => s + e.data.hours * e.data.rate, 0))}</span></div>
            {es.map(e => (
              <div key={e.id} className="up-row tap" onClick={() => setEdit(e)}>
                <span className="small muted nowrap">{niceDate(e.data.date, { noYear: true, weekday: true })}</span>
                <span className="text"><b>{e.data.person}</b>{e.data.notes && <span className="muted small"> · {e.data.notes}</span>}</span>
                <span className="nowrap">{e.data.hours}h</span>
                {e.data.paid ? <span className="status paid">Paid</span> : <span className="status">Unpaid</span>}
              </div>
            ))}
          </section>
        )
      })}
      {edit && <HoursSheet entry={edit} jobId={id} people={known} onClose={() => setEdit(null)} />}
    </JobShell>
  )
}
