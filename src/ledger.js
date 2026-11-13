// Money centre maths: every payment in the app, who paid it (B or P, or the business account), and who is owed what.
// Profits are split 50/50 between the two owners.
import { list } from './store'
import { num, today } from './util'

// Who paid (money out) or who it was paid into (money in). Empty = the business account.
// Car costs saved before this existed kept the payer in `person`.
export const payerOf = d => d.payer || (d.cat === 'vehicle' ? d.person : '') || ''

// Every paid item, newest first
export function allItems(owners) {
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j.data.name]))
  const t = today()
  const out = []
  list('money', r => r.data.status !== 'upcoming').forEach(r => {
    const d = r.data, a = num(d.amount)
    if (!a) return
    let kind = d.dir === 'in' ? 'income' : 'expense'
    if (d.cat === 'transfer') kind = 'transfer'
    else if (d.dir === 'out' && d.cat === 'wages' && owners.includes(d.person)) kind = 'drawing'
    out.push({ key: r.id, id: r.id, src: 'money', kind, amount: a, date: d.date || '', desc: d.desc || '', cat: d.cat, payer: payerOf(d), to: d.person || '', job: r.job_id, jobName: jobs[r.job_id] || '' })
  })
  list('genpay').forEach(r => {
    const d = r.data, a = num(d.amount)
    if (!a) return
    ;(d.paid || []).filter(x => x <= t).forEach(date => out.push({ key: r.id + date, id: r.id, src: 'genpay', kind: d.dir === 'in' ? 'income' : 'expense', amount: a, date, desc: d.desc || 'Repeat payment', cat: 'repeat', payer: d.payer || '', to: '', job: null, jobName: '' }))
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
    else if (it.kind === 'income') { moneyIn += a; if (isOwner(it.payer)) acc[it.payer].received += a; else unmarked++ }
    else if (it.kind === 'drawing') { acc[it.to].drew += a; if (isOwner(it.payer)) acc[it.payer].sent += a }
    else if (it.kind === 'transfer') { if (isOwner(it.payer)) acc[it.payer].sent += a; if (isOwner(it.to)) acc[it.to].got += a }
  })
  const profit = moneyIn - moneyOut
  const share = owners.length ? profit / owners.length : 0
  const people = owners.map(n => { const p = acc[n]; return { ...p, share, balance: p.putIn + p.sent + share - p.received - p.drew - p.got } })
  // What's sitting in the business account that belongs to the owners (or, if negative, what it's short)
  const business = people.reduce((s, p) => s + p.balance, 0)
  return { moneyIn, moneyOut, profit, share, people, business, unmarked }
}

const r2 = v => Math.round(v * 100) / 100

// Plain-English "who owes who" lines, plus the suggested settle-up payment if there is one
export function settle(people, fmt) {
  const [a, b] = people
  if (!a || !b) return { lines: [], pay: null }
  const A = r2(a.balance), B = r2(b.balance)
  const lines = []
  let pay = null
  if (Math.abs(A) < 1 && Math.abs(B) < 1) return { lines: ['You\'re all square. Nobody owes anybody.'], pay }
  if ((A > 0 && B < 0) || (A < 0 && B > 0)) {
    const [up, down] = A > 0 ? [a, b] : [b, a]
    const amt = r2(Math.min(Math.abs(A), Math.abs(B)))
    pay = { from: down.name, to: up.name, amount: amt }
    lines.push(`${down.name} owes ${up.name} ${fmt(amt)}.`)
    const rest = r2(A + B)
    if (rest >= 1) lines.push(`The business account also owes ${up.name} ${fmt(rest)}.`)
    else if (rest <= -1) lines.push(`${down.name} also owes the business account ${fmt(-rest)}.`)
  } else {
    const bits = [a, b].map(p => { const v = r2(p.balance); return v >= 1 ? `the business account owes ${p.name} ${fmt(v)}` : v <= -1 ? `${p.name} owes the business account ${fmt(-v)}` : '' }).filter(Boolean)
    lines.push(`Nobody owes the other. ${bits.join(' and ').replace(/^./, c => c.toUpperCase())}.`)
  }
  return { lines, pay }
}
