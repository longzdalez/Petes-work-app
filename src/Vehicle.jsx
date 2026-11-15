// Van and car costs (ULEZ, congestion charge, fuel, tickets) and who paid them, plus the B/P "who pays" picker
import { useState } from 'react'
import { put, remove, useList } from './store'
import { Icon, Sheet, confirmDelete } from './ui'
import { money, num, today, shortDate } from './util'
import { isLocked, lockMsg, findDuplicate } from './ledger'
import { useSettings } from './pages/Settings'

// The two owners as [{ name, letter }], e.g. B for Brian and P for Pete
export function usePayers() {
  const { owners } = useSettings()
  return owners.slice(0, 2).map(n => ({ name: n, letter: (n.trim()[0] || '?').toUpperCase() }))
    .sort((a, b) => a.letter.localeCompare(b.letter))
}

export const BIZ = 'business'
// Small buttons, e.g. B and P (plus "Biz" for the business account when biz is set). Tap one to pick; tap it again to clear.
export function PayerToggle({ value, onChange, big, biz, disabled }) {
  const payers = usePayers()
  const opts = [...payers.map(p => ({ v: p.name, l: p.letter, t: p.name })), ...(biz ? [{ v: BIZ, l: 'Biz', t: 'Business account' }] : [])]
  return (
    <span className={'payer-toggle' + (big ? ' big' : '') + (disabled ? ' locked' : '')} onClick={e => e.stopPropagation()}>
      {opts.map(o => (
        <button key={o.v} type="button" disabled={disabled} className={(value === o.v ? 'on' : '') + (o.v === BIZ ? ' biz' : '')} aria-pressed={value === o.v}
          aria-label={o.t} title={o.t} onClick={() => onChange(value === o.v ? '' : o.v)}>{o.l}</button>
      ))}
    </span>
  )
}

// Asks who paid / whose account money went into. onPick(name | 'business'); onSkip optional (e.g. "Don't add to money")
export function WhoPaidSheet({ title, text, into, onPick, onSkip, onClose }) {
  const payers = usePayers()
  return (
    <Sheet open onClose={onClose} title={title}>
      {text && <p className="small muted" style={{ marginTop: 0 }}>{text}</p>}
      <div className="who-grid">
        {payers.map(p => <button key={p.name} className="btn primary big" onClick={() => onPick(p.name)}><b>{p.letter}</b> {into ? `Into ${p.name}'s account` : `${p.name} paid`}</button>)}
        <button className="btn ghost big" onClick={() => onPick(BIZ)}>{into ? 'Into the business account' : 'Business account paid'}</button>
        {onSkip && <button className="btn ghost" onClick={onSkip}>Don't add it to money</button>}
      </div>
    </Sheet>
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
    if (missing) return alert(`Tap ${payers.map(p => p.letter).join(', ')} or Biz to say who paid for ${label(missing.k)}`)
    if (isLocked(date)) return alert(lockMsg(date))
    for (const v of filled) { const dup = findDuplicate({ amount: num(form[v.k].amount), desc: label(v.k), date }); if (dup && !confirm(`${label(v.k)} ${money(num(form[v.k].amount))} looks like one already saved on ${shortDate(dup.data.date)}. Save it anyway?`)) return }
    filled.forEach(v => put('money', { dir: 'out', cat: 'vehicle', vtype: v.k, desc: label(v.k), amount: num(form[v.k].amount), person: form[v.k].payer === 'business' ? '' : form[v.k].payer, payer: form[v.k].payer, date, status: 'paid' }, { job_id: null }))
    try { localStorage.setItem(LAST, form[filled[filled.length - 1].k].payer) } catch { }
    setMsg(`Saved ${filled.length} payment${filled.length > 1 ? 's' : ''}.`)
    setForm(blank())
  }
  const month = today().slice(0, 7)
  const thisMonth = rows.filter(r => (r.data.date || '').startsWith(month))
  const total = who => thisMonth.filter(r => (r.data.payer || r.data.person) === who).reduce((s, r) => s + num(r.data.amount), 0)
  return (
    <Sheet open onClose={() => { setMsg(''); onClose() }} title="Vehicle costs">
      <label className="field"><span>Date paid</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <div className="veh-list">
        {VEHICLE.map(v => (
          <div key={v.k} className="veh-row">
            <span className="veh-name">{v.l}</span>
            <span className="veh-amt"><span>£</span><input inputMode="decimal" placeholder="0.00" aria-label={`${v.l} amount`} value={form[v.k].amount} onChange={e => { setMsg(''); setRow(v.k, { amount: e.target.value }) }} /></span>
            <PayerToggle big biz value={form[v.k].payer} onChange={p => setRow(v.k, { payer: p })} />
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: '4px 0 10px' }}>Fill in what you paid, and tap {payers.map(p => `${p.letter} for ${p.name}`).join(', ')} or Biz for the business account.</p>
      <button className="btn primary wide big" onClick={save}><Icon name="check" size={18} /> Save</button>
      {msg && <p className="notice small" style={{ marginTop: 10 }}>{msg}</p>}

      {rows.length > 0 && <>
        <h3 className="sub-h">This month</h3>
        <div className="cf-sum">{payers.map(p => <div key={p.name}><span>{p.name}</span><b className="neg">{money(total(p.name))}</b></div>)}</div>
        {rows.slice(0, 12).map(r => (
          <div key={r.id} className="up-row">
            <span className="small muted nowrap">{shortDate(r.data.date)}</span>
            <span className="text">{r.data.desc}</span>
            <span className="payer-chip">{r.data.payer === 'business' ? '£' : (r.data.payer || r.data.person || '?')[0].toUpperCase()}</span>
            <span className="nowrap neg">−{money(r.data.amount)}</span>
            <button className="icon-btn small" aria-label={`Delete ${r.data.desc}`} onClick={() => { if (isLocked(r.data.date)) return alert(lockMsg(r.data.date)); if (confirmDelete('this payment')) remove(r.id) }}><Icon name="trash" size={16} /></button>
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
