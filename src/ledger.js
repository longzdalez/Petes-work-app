// Money centre maths: every payment in the app, whose account it came out of or went into (B or P), and who is owed what.
// There's no business account: all the money is in Brian's or Pete's account, and the Money centre adds them together.
// Money in can also be "set against" one of them (data.against), which decides who it counts for in who owes who.
// Profits are split 50/50 between the two owners.
import { list } from './store'
import { num, today } from './util'

// Who paid (money out) or whose account it went into (money in). Empty = not marked yet. ('business' is from before, and counts as not marked.)
// Car costs saved before this existed kept the payer in `person`.
export const payerOf = d => d.payer || (d.cat === 'vehicle' ? d.person : '') || ''

// Every paid item, newest first
export function allItems(owners) {
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j.data.name]))
  const clients = Object.fromEntries(list('job').map(j => [j.id, j.data.client || '']))
  const t = today()
  const out = []
  list('money', r => r.data.status !== 'upcoming').forEach(r => {
    const d = r.data, a = num(d.amount)
    if (!a) return
    let kind = d.dir === 'in' ? 'income' : 'expense'
    if (d.cat === 'transfer') kind = 'transfer'
    else if (d.dir === 'out' && d.cat === 'wages' && owners.includes(d.person)) kind = 'drawing'
    out.push({ key: r.id, id: r.id, src: 'money', kind, amount: a, date: d.date || '', desc: d.desc || '', cat: d.cat, payer: payerOf(d), to: d.person || '', job: r.job_id, jobName: jobs[r.job_id] || '', against: d.against || '', from: d.dir === 'in' ? (d.person || clients[r.job_id] || '') : '', receipt: !!d.receipt, vtype: d.vtype || '', vat: num(d.vat), cis: d.cat === 'contractor' && num(d.cisRate) ? Math.round(num(d.cisLabour || d.amount) * num(d.cisRate)) / 100 : 0 })
  })
  list('genpay').forEach(r => {
    const d = r.data, a = num(d.amount)
    if (!a) return
    ;(d.paid || []).filter(x => x <= t).forEach(date => out.push({ key: r.id + date, id: r.id, src: 'genpay', kind: d.dir === 'in' ? 'income' : 'expense', amount: a, date, desc: d.desc || 'Repeat payment', cat: 'repeat', payer: d.payer || '', against: d.against || '', from: '', to: '', job: null, jobName: '' }))
  })
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

// Each owner's running position. Positive balance = owed to them, negative = they've had too much.
export function tally(items, owners) {
  const acc = Object.fromEntries(owners.map(n => [n, { name: n, putIn: 0, received: 0, drew: 0, sent: 0, got: 0 }]))
  const isOwner = n => !!acc[n]
  let moneyIn = 0, moneyOut = 0, unmarked = 0
  items.forEach(it => {
    const a = it.amount
    if (it.kind === 'expense') { moneyOut += a; if (isOwner(it.payer)) acc[it.payer].putIn += a; else unmarked++ }
    else if (it.kind === 'income') { moneyIn += a; const who = againstOf(it, owners); if (who) acc[who].received += a; else unmarked++ }
    else if (it.kind === 'drawing') { acc[it.to].drew += a; if (isOwner(it.payer)) acc[it.payer].sent += a }
    else if (it.kind === 'transfer') { if (isOwner(it.payer)) acc[it.payer].sent += a; if (isOwner(it.to)) acc[it.to].got += a }
  })
  const profit = moneyIn - moneyOut
  const share = owners.length ? profit / owners.length : 0
  const people = owners.map(n => { const p = acc[n]; return { ...p, share, balance: p.putIn + p.sent + share - p.received - p.drew - p.got } })
  return { moneyIn, moneyOut, profit, share, people, unmarked }
}

// Who a payment in counts for: who it's set against, or (if that isn't chosen) whose account it went into. '' = not marked.
export const againstOf = (it, owners) => owners.includes(it.against) ? it.against : owners.includes(it.payer) ? it.payer : ''

const r2 = v => Math.round(v * 100) / 100

// Plain-English "who owes who" line, plus the settle-up payment that squares it.
// Half the gap between the two balances moves from one to the other, which leaves you both even.
export function settle(people, fmt) {
  const [a, b] = people
  if (!a || !b) return { lines: [], pay: null }
  const diff = r2((a.balance - b.balance) / 2)
  if (Math.abs(diff) < 1) return { lines: ['You\'re all square. Nobody owes anybody.'], pay: null }
  const [up, down] = diff > 0 ? [a, b] : [b, a], amount = Math.abs(diff)
  return { lines: [`${down.name} owes ${up.name} ${fmt(amount)}.`], pay: { from: down.name, to: up.name, amount } }
}

// Settled months can be locked so nothing in them changes by accident
export const lockedUntil = () => list('settings')[0]?.data?.lockedUntil || ''
export const isLocked = date => { const l = lockedUntil(); return !!(l && date && date <= l) }
export const lockMsg = date => `Payments up to ${niceUk(lockedUntil())} are locked because that month has been settled. Unlock it in the Money centre first if you really need to change this.`
const niceUk = s => s ? new Date(s + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

// Another payment with the same amount and either the same description or within 3 days
export function findDuplicate({ amount, desc, date, id }) {
  const a = num(amount), dsc = (desc || '').trim().toLowerCase()
  if (!a) return null
  const day = s => new Date((s || '') + 'T12:00').getTime()
  return list('money', r => r.id !== id && r.data.cat !== 'transfer' && Math.abs(num(r.data.amount) - a) < 0.005 &&
    ((dsc && (r.data.desc || '').trim().toLowerCase() === dsc) || Math.abs(day(r.data.date) - day(date)) <= 3 * 864e5))[0] || null
}

// UK tax year containing a date: 6 April to 5 April
export function taxYear(date = today()) {
  const y = +date.slice(0, 4), start = date >= `${y}-04-06` ? y : y - 1
  return { from: `${start}-04-06`, to: `${start + 1}-04-05`, label: `${start}/${String(start + 1).slice(2)}` }
}
