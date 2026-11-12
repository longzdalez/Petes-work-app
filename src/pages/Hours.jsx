import { useState } from 'react'
import { put, update, remove, useRecord, useList, list } from '../store'
import { Icon, Sheet, Field, Empty, confirmDelete, useLongPress } from '../ui'
import { JobShell } from './Job'
import { nav } from '../router'
import { money, num, niceDate, today, parseYmd, ymd } from '../util'
import { useSettings } from './Settings'

const weekStart = s => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d) }

const PAY_TYPES = [{ k: 'hour', l: 'Hourly rate' }, { k: 'day', l: 'Day rate' }, { k: 'fixed', l: 'Set amount' }]
// What an entry costs, whichever way the person is paid
export const hoursCost = d => {
  const t = d.payType || 'hour'
  if (t === 'fixed') return num(d.amount)
  if (t === 'day') return num(d.days ?? 1) * num(d.rate)
  return num(d.hours) * num(d.rate)
}
const howLong = d => (d.payType === 'day' ? `${num(d.days ?? 1)} day${num(d.days ?? 1) === 1 ? '' : 's'}` : d.payType === 'fixed' ? (num(d.hours) ? `${num(d.hours)}h` : 'Set price') : `${num(d.hours)}h`)

function HoursSheet({ entry, jobId, people, onClose }) {
  const isNew = !entry.id
  const last = name => list('hours', r => r.data.person === name).sort((a, b) => b.data.created.localeCompare(a.data.created))[0]?.data
  const fromLast = name => { const l = last(name); return l ? { payType: l.payType || 'hour', rate: l.rate || '' } : {} }
  const [d, setD] = useState(() => ({ date: today(), person: people[0] || '', hours: '8', days: '1', payType: 'hour', rate: '', amount: '', payBy: '', notes: '', ...(isNew ? fromLast(people[0] || '') : {}), ...entry.data }))
  const set = p => setD(x => ({ ...x, ...p }))
  const t = d.payType || 'hour'
  const save = () => {
    if (!d.person.trim()) return alert('Please add who it was')
    if (t === 'hour' && !num(d.hours)) return alert('Please add how many hours')
    const data = { ...d, person: d.person.trim(), payType: t, hours: num(d.hours), days: num(d.days), rate: num(d.rate), amount: num(d.amount) }
    if (isNew) put('hours', data, { job_id: jobId }); else update(entry.id, data)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Log work' : `Edit: ${d.person || 'work'}`}>
      <label className="field"><span>Who</span>
        {people.length > 0 && <div className="chips" style={{ marginBottom: 8 }}>{people.map(p => <button key={p} className={'chip' + (d.person === p ? ' on' : '')} onClick={() => set({ person: p, ...(isNew ? fromLast(p) : {}) })}>{p}</button>)}</div>}
        <input value={d.person} onChange={e => set({ person: e.target.value })} placeholder="Or type a name" />
      </label>
      <label className="field"><span>How are they paid?</span>
        <div className="seg small three" style={{ margin: 0 }}>{PAY_TYPES.map(p => <button key={p.k} className={t === p.k ? 'on' : ''} onClick={() => set({ payType: p.k })}>{p.l}</button>)}</div>
      </label>
      <div className="two">
        {t === 'hour' && <><Field label="Hours" inputMode="decimal" value={d.hours} onChange={v => set({ hours: v })} /><Field label="£ per hour" inputMode="decimal" value={d.rate} onChange={v => set({ rate: v })} /></>}
        {t === 'day' && <><Field label="Days" inputMode="decimal" value={d.days} onChange={v => set({ days: v })} /><Field label="£ per day" inputMode="decimal" value={d.rate} onChange={v => set({ rate: v })} /></>}
        {t === 'fixed' && <><Field label="Amount £" inputMode="decimal" value={d.amount} onChange={v => set({ amount: v })} /><Field label="Hours (optional)" inputMode="decimal" value={d.hours} onChange={v => set({ hours: v })} /></>}
      </div>
      <div className="two">
        <Field label="Date of the work" type="date" value={d.date} onChange={v => set({ date: v })} />
        <Field label="Pay by" type="date" value={d.payBy} onChange={v => set({ payBy: v })} />
      </div>
      <Field label="What they did (optional)" value={d.notes} onChange={v => set({ notes: v })} />
      <div className="kv"><span>To pay</span><b>{money(hoursCost(d))}</b></div>
      {entry.data?.paid && <p className="small muted">Already paid. Changing it here doesn't change the payment in Money.</p>}
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { if (confirmDelete('this entry')) { remove(entry.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

// Hold (or tap the pencil) to edit; tap the button to pay
function OwedRow({ person, u, onEdit, onPay }) {
  const lp = useLongPress(onEdit, onEdit)
  const due = u.payBy.sort()[0]
  return (
    <div className="kv owed">
      <span className="tap" {...lp}><b>{person}</b> <Icon name="edit" size={14} style={{ color: 'var(--muted)' }} /><br />
        <span className="small muted">{u.what.join(', ')}{due && <> · pay by <b className={due < today() ? 'neg' : ''}>{niceDate(due, { noYear: true })}</b></>}</span>
      </span>
      {u.cost > 0
        ? <button className="btn primary small" onClick={onPay}>Pay {money(u.cost)}</button>
        : <button className="btn orange small" onClick={onEdit}>Set pay</button>}
    </div>
  )
}

function EntryRow({ e, onEdit }) {
  const lp = useLongPress(onEdit, onEdit)
  return (
    <div className="up-row tap" {...lp}>
      <span className="small muted nowrap">{niceDate(e.data.date, { noYear: true, weekday: true })}</span>
      <span className="text"><b>{e.data.person}</b>{e.data.notes && <span className="muted small"> · {e.data.notes}</span>}</span>
      <span className="nowrap">{howLong(e.data)}</span>
      <span className="nowrap small">{money(hoursCost(e.data))}</span>
      {e.data.paid ? <span className="status paid">Paid</span> : <span className="status">Unpaid</span>}
    </div>
  )
}

export default function Hours({ id }) {
  const job = useRecord(id)
  const settings = useSettings()
  const entries = useList('hours', r => r.job_id === id, (a, b) => b.data.date.localeCompare(a.data.date))
  const [edit, setEdit] = useState(null)
  const [pick, setPick] = useState(null)
  if (!job) return <JobShell job={null} />
  const known = [...new Set([...settings.owners, ...list('trade').map(t => t.data.name), ...list('hours').map(h => h.data.person), ...list('contact', c => c.data.role === 'trade').map(c => c.data.name)].filter(Boolean))].slice(0, 14)
  const unpaid = {}
  entries.filter(e => !e.data.paid).forEach(e => {
    const p = e.data.person; unpaid[p] ||= { hours: 0, cost: 0, ids: [], entries: [], what: [], payBy: [] }
    const u = unpaid[p]; u.hours += num(e.data.hours); u.cost += hoursCost(e.data); u.ids.push(e.id); u.entries.push(e)
    u.what.push(howLong(e.data)); if (e.data.payBy) u.payBy.push(e.data.payBy)
  })
  Object.values(unpaid).forEach(u => { if (u.what.length > 3) u.what = [`${u.what.length} entries`] })
  const pay = (person, u) => {
    if (!confirm(`Pay ${person} ${money(u.cost)}? This adds it to Money.`)) return
    const m = put('money', { dir: 'out', cat: settings.owners.includes(person) ? 'wages' : 'contractor', person, amount: Math.round(u.cost * 100) / 100, date: today(), desc: u.what.join(', '), status: 'paid' }, { job_id: id })
    u.ids.forEach(i => update(i, { paid: true, money_id: m.id }))
  }
  const editOwed = u => u.entries.length === 1 ? setEdit(u.entries[0]) : setPick(u)
  const weeks = {}
  entries.forEach(e => (weeks[weekStart(e.data.date)] ||= []).push(e))
  return (
    <JobShell job={job} tab="" title="Workers' hours" onBack={() => nav(`/job/${id}`)}>
      <button className="btn orange wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Log work</button>
      {Object.keys(unpaid).length > 0 && <section className="card">
        <div className="card-head"><h2>Still to pay</h2></div>
        <p className="small muted" style={{ margin: '-4px 0 6px' }}>Hold a name to change the hours, rate, amount or dates.</p>
        {Object.entries(unpaid).map(([p, u]) => <OwedRow key={p} person={p} u={u} onEdit={() => editOwed(u)} onPay={() => pay(p, u)} />)}
      </section>}
      {entries.length === 0 && <Empty icon="clock" title="No work logged" text="Log who worked, when, and how they're paid: by the hour, by the day, or a set amount. When you pay them, one tap adds it to the job's Money." />}
      {Object.entries(weeks).map(([w, es]) => (
        <section key={w} className="card">
          <div className="week-head"><span>Week of {niceDate(w, { noYear: true })}</span><span className="pill">{money(es.reduce((s, e) => s + hoursCost(e.data), 0))}</span></div>
          {es.map(e => <EntryRow key={e.id} e={e} onEdit={() => setEdit(e)} />)}
        </section>
      ))}
      {pick && <Sheet open onClose={() => setPick(null)} title="Which one?">
        {pick.entries.map(e => <EntryRow key={e.id} e={e} onEdit={() => { setPick(null); setEdit(e) }} />)}
      </Sheet>}
      {edit && <HoursSheet entry={edit} jobId={id} people={known} onClose={() => setEdit(null)} />}
    </JobShell>
  )
}
