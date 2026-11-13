// Repeat payments (was General cash flow): business payments that aren't tied to one job (van, insurance, phone, loan…), one-off or repeating
import { useState } from 'react'
import { put, update, remove, useList } from '../store'
import { Icon, Sheet, Field, TopBar, Empty, confirmDelete } from '../ui'
import { money, num, today, parseYmd, ymd, shortDate } from '../util'
import { nav, back } from '../router'

const REPEAT = [{ k: 'none', l: 'One-off' }, { k: 'weekly', l: 'Weekly' }, { k: 'monthly', l: 'Monthly' }, { k: 'yearly', l: 'Yearly' }]
const repeatLabel = k => REPEAT.find(r => r.k === k)?.l || 'One-off'
const step = (d, rep) => { const x = new Date(d); if (rep === 'weekly') x.setDate(x.getDate() + 7); else if (rep === 'monthly') x.setMonth(x.getMonth() + 1); else x.setFullYear(x.getFullYear() + 1); return x }
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d) }

// Every date a payment falls on between two dates (inclusive), with whether it's been ticked off
export function occurrences(rec, from, to) {
  const d = rec.data, out = []
  if (!d.date) return out
  const paid = d.paid || []
  if (!d.repeat || d.repeat === 'none') {
    if (d.date >= from && d.date <= to) out.push({ rec, date: d.date, paid: paid.includes(d.date) })
    return out
  }
  let cur = parseYmd(d.date)
  for (let i = 0; i < 600 && ymd(cur) <= to; i++) {
    const s = ymd(cur)
    if (d.until && s > d.until) break
    if (s >= from) out.push({ rec, date: s, paid: paid.includes(s) })
    cur = step(cur, d.repeat)
  }
  return out
}

function PaySheet({ entry, onClose }) {
  const isNew = !entry.id
  const [d, setD] = useState({ dir: 'out', amount: '', desc: '', date: today(), repeat: 'none', until: '', ...entry.data })
  const set = p => setD(x => ({ ...x, ...p }))
  const save = () => {
    if (!num(d.amount)) return alert('Please put in an amount')
    if (!d.desc.trim()) return alert('Please say what it is for')
    const data = { ...d, amount: num(d.amount), desc: d.desc.trim() }
    if (isNew) put('genpay', { ...data, paid: [] }, { job_id: null }); else update(entry.id, data)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add a payment' : 'Edit payment'}>
      <div className="seg">
        <button className={d.dir === 'out' ? 'on out' : ''} onClick={() => set({ dir: 'out' })}>Going out</button>
        <button className={d.dir === 'in' ? 'on in' : ''} onClick={() => set({ dir: 'in' })}>Coming in</button>
      </div>
      <div className="two">
        <label className="field"><span>Amount (£)</span><input inputMode="decimal" value={d.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" autoFocus={isNew} /></label>
        <label className="field"><span>{d.repeat === 'none' ? 'Date' : 'First payment'}</span><input type="date" value={d.date} onChange={e => set({ date: e.target.value })} /></label>
      </div>
      <label className="field"><span>What is it for?</span><input value={d.desc} onChange={e => set({ desc: e.target.value })} placeholder="e.g. Van finance, insurance, phone" /></label>
      <label className="field"><span>How often?</span>
        <div className="seg small" style={{ gridTemplateColumns: 'repeat(4, 1fr)', margin: 0 }}>{REPEAT.map(r => <button key={r.k} className={d.repeat === r.k ? 'on' : ''} onClick={() => set({ repeat: r.k })}>{r.l}</button>)}</div>
      </label>
      {d.repeat !== 'none' && <label className="field"><span>Last payment (leave empty if it keeps going)</span><input type="date" value={d.until || ''} onChange={e => set({ until: e.target.value })} /></label>}
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { if (confirmDelete('this payment')) { remove(entry.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

function OccRow({ o, onEdit }) {
  const d = o.rec.data
  const late = !o.paid && o.date < today()
  const tick = () => {
    const paid = d.paid || []
    update(o.rec.id, { paid: o.paid ? paid.filter(x => x !== o.date) : [...paid, o.date] })
  }
  return (
    <div className={'up-row' + (o.paid ? ' done' : '')}>
      <button className={'tick' + (o.paid ? ' on' : '')} onClick={tick} aria-label={o.paid ? 'Not paid' : 'Mark paid'}>{o.paid && <Icon name="check" size={16} stroke={3} />}</button>
      <span className="text tap" onClick={() => onEdit(o.rec)}>{d.desc}<br />
        <span className={'small ' + (late ? 'neg' : 'muted')}>{late ? 'Was due ' : ''}{shortDate(o.date)}{d.repeat && d.repeat !== 'none' ? ` · ${repeatLabel(d.repeat).toLowerCase()}` : ''}</span></span>
      <span className={'nowrap ' + (d.dir === 'in' ? 'pos' : 'neg')}>{d.dir === 'in' ? '+' : '−'}{money(d.amount)}</span>
    </div>
  )
}

const upcomingOcc = (pays, days) => {
  const t = today(), from = addDays(t, -60), to = addDays(t, days)
  // Missed payments only count from when the payment was added, so an old start date doesn't flag months gone by
  return pays.flatMap(p => { const c = (p.data.created || '').slice(0, 10); return occurrences(p, c > from ? c : from, to) }).filter(o => !o.paid || o.date >= t).sort((a, b) => a.date.localeCompare(b.date))
}

// The box on the home page
export function GeneralCashFlow() {
  const pays = useList('genpay')
  const [edit, setEdit] = useState(null)
  const next = upcomingOcc(pays, 30)
  const out = next.filter(o => !o.paid && o.rec.data.dir !== 'in').reduce((s, o) => s + num(o.rec.data.amount), 0)
  const inn = next.filter(o => !o.paid && o.rec.data.dir === 'in').reduce((s, o) => s + num(o.rec.data.amount), 0)
  return (
    <section className="card">
      <div className="card-head"><h2>Repeat payments</h2><button className="btn primary small" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={16} /> Add</button></div>
      {pays.length === 0 ? <p className="muted small" style={{ marginTop: 0 }}>Business payments that aren't for one job, like van finance, insurance or your phone. Add one-off payments or ones that repeat every week, month or year, and tick them off when they're paid.</p> : <>
        <div className="cf-sum">
          <div><span>Going out, next 30 days</span><b className="neg">{money(out)}</b></div>
          {inn > 0 && <div><span>Coming in</span><b className="pos">{money(inn)}</b></div>}
        </div>
        {next.slice(0, 5).map(o => <OccRow key={o.rec.id + o.date} o={o} onEdit={r => setEdit(r)} />)}
        {next.length === 0 && <p className="muted small">Nothing due in the next 30 days.</p>}
        <button className="btn ghost wide" style={{ marginTop: 10 }} onClick={() => nav('/cashflow')}><Icon name="money" size={18} /> See all payments</button>
      </>}
      {edit && <PaySheet entry={edit} onClose={() => setEdit(null)} />}
    </section>
  )
}

// Full page: every payment, the next 3 months, and monthly totals
export default function CashFlowPage() {
  const pays = useList('genpay', null, (a, b) => (a.data.desc || '').localeCompare(b.data.desc || ''))
  const [edit, setEdit] = useState(null)
  const next = upcomingOcc(pays, 92)
  const months = {}
  next.filter(o => !o.paid).forEach(o => { const k = o.date.slice(0, 7); months[k] ||= { in: 0, out: 0 }; months[k][o.rec.data.dir === 'in' ? 'in' : 'out'] += num(o.rec.data.amount) })
  const monthly = pays.filter(p => p.data.repeat !== 'none' && (!p.data.until || p.data.until >= today()))
    .reduce((s, p) => s + (p.data.dir === 'in' ? -1 : 1) * num(p.data.amount) * ({ weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[p.data.repeat] || 0), 0)
  return (
    <div className="page">
      <TopBar title="Repeat payments" sub="Payments not tied to a job" onBack={() => back('/')} />
      <main className="content">
        <button className="btn orange wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Add a payment</button>
        {pays.length === 0 && <Empty icon="money" title="No payments yet" text="Add things like van finance, insurance, phone or loan payments. Set them to repeat and they'll show up each time they're due." />}
        {pays.length > 0 && <section className="card">
          <div className="card-head"><h2>Coming up</h2><span className="pill orange">Regular: {money(monthly)} a month</span></div>
          {Object.entries(months).map(([k, v]) => <div key={k} className="kv"><span>{parseYmd(k + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span><b>{v.in ? <span className="pos">+{money(v.in)} </span> : null}<span className="neg">−{money(v.out)}</span></b></div>)}
          <h3 className="sub-h">Next 3 months</h3>
          {next.map(o => <OccRow key={o.rec.id + o.date} o={o} onEdit={r => setEdit(r)} />)}
        </section>}
        {pays.length > 0 && <section className="card">
          <div className="card-head"><h2>All payments</h2></div>
          {pays.map(p => (
            <div key={p.id} className="up-row tap" onClick={() => setEdit(p)}>
              <span className="text">{p.data.desc}<br /><span className="small muted">{repeatLabel(p.data.repeat)}{p.data.repeat === 'none' ? ` · ${shortDate(p.data.date)}` : ` from ${shortDate(p.data.date)}`}{p.data.until ? ` until ${shortDate(p.data.until)}` : ''}</span></span>
              <span className={'nowrap ' + (p.data.dir === 'in' ? 'pos' : 'neg')}>{p.data.dir === 'in' ? '+' : '−'}{money(p.data.amount)}</span>
            </div>
          ))}
        </section>}
      </main>
      {edit && <PaySheet entry={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
