// Van and car costs (ULEZ, congestion charge, fuel, tickets) and who paid them, plus the B/P "who pays" picker
import { useState } from 'react'
import { put, remove, useList } from './store'
import { Icon, Sheet, confirmDelete } from './ui'
import { money, num, today, shortDate } from './util'
import { useSettings } from './pages/Settings'

// The two owners as [{ name, letter }], e.g. B for Brian and P for Pete
export function usePayers() {
  const { owners } = useSettings()
  return owners.slice(0, 2).map(n => ({ name: n, letter: (n.trim()[0] || '?').toUpperCase() }))
    .sort((a, b) => a.letter.localeCompare(b.letter))
}

// Two small buttons, e.g. B and P. Tap one to pick who pays; tap it again to clear.
export function PayerToggle({ value, onChange, big }) {
  const payers = usePayers()
  return (
    <span className={'payer-toggle' + (big ? ' big' : '')} onClick={e => e.stopPropagation()}>
      {payers.map(p => (
        <button key={p.name} type="button" className={value === p.name ? 'on' : ''} aria-pressed={value === p.name}
          aria-label={`Paid by ${p.name}`} title={p.name} onClick={() => onChange(value === p.name ? '' : p.name)}>{p.letter}</button>
      ))}
    </span>
  )
}

export const VEHICLE = [
  { k: 'ulez', l: 'ULEZ' },
  { k: 'congestion', l: 'Congestion charge' },
  { k: 'fuel', l: 'Fuel' },
  { k: 'tickets', l: 'Tickets' },
]
const label = k => VEHICLE.find(v => v.k === k)?.l || 'Vehicle'
const LAST = 'pw_vehicle_payer'

// Car button on the home page opens this. Saved as money out with no job, so it goes in the accountant's spreadsheet too.
export function VehicleSheet({ open, onClose }) {
  const payers = usePayers()
  const rows = useList('money', r => !r.job_id && r.data.cat === 'vehicle', (a, b) => (b.data.date || '').localeCompare(a.data.date || '') || b.data.created.localeCompare(a.data.created))
  const last = (() => { try { return localStorage.getItem(LAST) || '' } catch { return '' } })()
  const blank = () => Object.fromEntries(VEHICLE.map(v => [v.k, { amount: '', payer: last }]))
  const [form, setForm] = useState(blank)
  const [date, setDate] = useState(today())
  const [msg, setMsg] = useState('')
  if (!open) return null
  const setRow = (k, p) => setForm(f => ({ ...f, [k]: { ...f[k], ...p } }))
  const filled = VEHICLE.filter(v => num(form[v.k].amount) > 0)
  const save = () => {
    if (!filled.length) return alert('Put an amount in at least one box')
    const missing = filled.find(v => !form[v.k].payer)
    if (missing) return alert(`Tap ${payers.map(p => p.letter).join(' or ')} to say who paid for ${label(missing.k)}`)
    filled.forEach(v => put('money', { dir: 'out', cat: 'vehicle', vtype: v.k, desc: label(v.k), amount: num(form[v.k].amount), person: form[v.k].payer, date, status: 'paid' }, { job_id: null }))
    try { localStorage.setItem(LAST, form[filled[filled.length - 1].k].payer) } catch { }
    setMsg(`Saved ${filled.length} payment${filled.length > 1 ? 's' : ''}.`)
    setForm(blank())
  }
  const month = today().slice(0, 7)
  const thisMonth = rows.filter(r => (r.data.date || '').startsWith(month))
  const total = who => thisMonth.filter(r => r.data.person === who).reduce((s, r) => s + num(r.data.amount), 0)
  return (
    <Sheet open onClose={() => { setMsg(''); onClose() }} title="Vehicle costs">
      <label className="field"><span>Date paid</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <div className="veh-list">
        {VEHICLE.map(v => (
          <div key={v.k} className="veh-row">
            <span className="veh-name">{v.l}</span>
            <span className="veh-amt"><span>£</span><input inputMode="decimal" placeholder="0.00" aria-label={`${v.l} amount`} value={form[v.k].amount} onChange={e => { setMsg(''); setRow(v.k, { amount: e.target.value }) }} /></span>
            <PayerToggle big value={form[v.k].payer} onChange={p => setRow(v.k, { payer: p })} />
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: '4px 0 10px' }}>Fill in what you paid, and tap {payers.map(p => `${p.letter} for ${p.name}`).join(' or ')}.</p>
      <button className="btn primary wide big" onClick={save}><Icon name="check" size={18} /> Save</button>
      {msg && <p className="notice small" style={{ marginTop: 10 }}>{msg}</p>}

      {rows.length > 0 && <>
        <h3 className="sub-h">This month</h3>
        <div className="cf-sum">{payers.map(p => <div key={p.name}><span>{p.name}</span><b className="neg">{money(total(p.name))}</b></div>)}</div>
        {rows.slice(0, 12).map(r => (
          <div key={r.id} className="up-row">
            <span className="small muted nowrap">{shortDate(r.data.date)}</span>
            <span className="text">{r.data.desc}</span>
            <span className="payer-chip">{(r.data.person || '?')[0].toUpperCase()}</span>
            <span className="nowrap neg">−{money(r.data.amount)}</span>
            <button className="icon-btn small" aria-label={`Delete ${r.data.desc}`} onClick={() => { if (confirmDelete('this payment')) remove(r.id) }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </>}
    </Sheet>
  )
}

export const CarIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 13l2.1-5.6A2 2 0 0 1 7 6h10a2 2 0 0 1 1.9 1.4L21 13v4a1 1 0 0 1-1 1h-1M5 18H4a1 1 0 0 1-1-1v-4h18M9.5 18h5" /><circle cx="7.3" cy="18" r="2" /><circle cx="16.7" cy="18" r="2" />
  </svg>
)
