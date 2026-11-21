// One-time move of the old Starting point into ordinary payments (see moveOpeningToPayments)
import { list, put } from './store'
import { num, today } from './util'
import { OPENING_ROWS } from './ledger'

// The old Starting point (lump sums and lines kept in Settings) becomes ordinary payments marked catchup,
// so every amount can be seen, changed or deleted like any other. Runs once; the old values are kept in openingMoved.
export function moveOpeningToPayments(owners) {
  const s = list('settings')[0]
  const o = s?.data?.opening
  if (!o || !owners.length) return false
  const base = { status: 'paid', catchup: true }
  const day = e => e?.date || o.date || today()
  const add = data => put('money', { ...base, ...data }, { job_id: null })
  const kindData = (k, payer, amount, desc, date) => k === 'in'
    ? add({ dir: 'in', cat: 'client', payer, against: payer, person: '', amount, desc, date })
    : add({ dir: 'out', cat: k === 'wages' ? 'wages' : k === 'materials' ? 'materials' : 'other', payer, person: '', amount, desc, date })
  OPENING_ROWS.forEach(r => owners.forEach(n => { const a = num(o[r.k]?.[n]); if (a > 0) kindData(r.k, n, a, `Starting point: ${r.l.toLowerCase()}`, day()) }))
  ;(o.entries || []).forEach(e => {
    const a = num(e.amount); if (!a) return
    const row = OPENING_ROWS.find(r => r.k === e.kind) || OPENING_ROWS[0]
    kindData(row.k, owners.includes(e.payer) ? e.payer : owners[0], a, e.desc || `Starting point: ${row.l.toLowerCase()}`, day(e))
  })
  const ow = o.owed || {}
  if (num(ow.amount) > 0 && owners.includes(ow.by) && owners.includes(ow.to) && ow.by !== ow.to)
    add({ dir: 'out', cat: 'transfer', payer: ow.to, person: ow.by, amount: num(ow.amount), desc: `Starting point: ${ow.by} already owed ${ow.to}`, date: day() })
  owners.forEach(n => {
    const a = num(o.between?.[n]), to = owners.find(x => x !== n)
    if (a > 0 && to) add({ dir: 'out', cat: 'transfer', payer: n, person: to, amount: a, desc: `Starting point: ${n} paid ${to}`, date: day() })
  })
  put('settings', { opening: null, openingMoved: o }, { id: s.id })
  return true
}
