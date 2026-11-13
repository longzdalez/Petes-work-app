// Numbers and lists worked out from the saved records, shared by the home page and the job pages.
import { list } from './store'
import { num, today, parseYmd, ymd, shortDate, URGENCY } from './util'
import { invoiceTotals } from './pdf'
import { jobStatus } from './jobs'
import { occurrences } from './pages/CashFlow'

const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d) }

// Invoices that have been sent but not paid yet
export const unpaidInvoices = jobId => list('invoice', r => r.data.type === 'invoice' && r.data.status === 'sent' && (!jobId || r.job_id === jobId))

// Quote, money spent, money paid to you and money still owed on one job
export function jobMoney(job) {
  const id = job.id
  const paid = list('money', r => r.job_id === id && r.data.status !== 'upcoming')
  const spent = paid.filter(r => r.data.dir === 'out').reduce((s, r) => s + num(r.data.amount), 0)
  const paidIn = paid.filter(r => r.data.dir === 'in').reduce((s, r) => s + num(r.data.amount), 0)
  const owed = unpaidInvoices(id).reduce((s, r) => s + invoiceTotals(r.data).total, 0)
  const quote = num(job.data.value)
  const left = quote ? Math.max(0, Math.round(((quote - spent) / quote) * 100)) : null
  return { quote, spent, paidIn, owed, left, warn: quote > 0 && spent >= quote * 0.8 && jobStatus(job.data) !== 'finished' }
}

// Short money label for small spaces: £48.5k, £950
export function shortMoney(n) {
  n = Math.round(num(n))
  if (Math.abs(n) >= 1000) return '£' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return '£' + n
}

// Everything happening today across every job, for the home page
export function todayItems() {
  const t = today(), soon = addDays(t, 2)
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j]))
  const live = r => !r.job_id || (jobs[r.job_id] && jobStatus(jobs[r.job_id].data) !== 'finished')
  const jobName = r => (r.job_id && jobs[r.job_id]?.data.name) || ''
  const trades = Object.fromEntries(list('trade').map(x => [x.id, x]))
  const folders = Object.fromEntries(list('folder').map(f => [f.id, f]))
  const out = []

  list('task', r => r.data.date === t && !r.data.done && live(r)).forEach(r => {
    const tr = trades[r.data.trade_id]
    out.push({ id: r.id, order: 1, label: 'Today', color: tr?.data.color || '#ff9f55', title: tr ? `${tr.data.name}${tr.data.trade ? ', ' + tr.data.trade.toLowerCase() : ''}: ${r.data.text}` : r.data.text, sub: jobName(r), url: `/job/${r.job_id}/schedule` })
  })
  list('todo', r => !r.data.done && r.data.date && r.data.date <= t && live(r)).forEach(r => {
    const late = r.data.date < t
    out.push({ id: r.id, order: r.data.time ? 0 : 2, time: r.data.time || '', label: r.data.time || (late ? 'Late' : 'To-do'), late, color: URGENCY[r.data.urgency]?.color || '#ff9f55', title: r.data.text, sub: ['To-do', jobName(r)].filter(Boolean).join(' · '), url: r.job_id ? `/job/${r.job_id}/todos` : '' })
  })
  list('material', r => !r.data.done && r.data.urgency === 'red' && r.data.date && r.data.date <= soon && r.data.text && folders[r.data.folder_id] && live(r)).forEach(r => {
    out.push({ id: r.id, order: 3, label: 'Order', urgent: true, color: URGENCY.red.color, title: (r.data.qty ? r.data.qty + ' x ' : '') + r.data.text, sub: [`Needed ${r.data.date === t ? 'today' : shortDate(r.data.date)}`, jobName(r)].filter(Boolean).join(' · '), url: `/job/${r.job_id}/folder/${r.data.folder_id}` })
  })
  list('genpay').forEach(rec => occurrences(rec, t, t).filter(o => !o.paid).forEach(o => {
    out.push({ id: rec.id + o.date, order: 4, label: rec.data.dir === 'in' ? 'Due' : 'Pay', color: '#3b9268', title: rec.data.desc, sub: 'Repeat payments', amount: num(rec.data.amount), dir: rec.data.dir || 'out', url: '/cashflow' })
  }))
  list('money', r => r.data.status === 'upcoming' && r.data.date && r.data.date <= t && live(r)).forEach(r => {
    out.push({ id: r.id, order: 4, label: r.data.dir === 'in' ? 'Due' : 'Pay', late: r.data.date < t, color: '#3b9268', title: r.data.desc || (r.data.dir === 'in' ? 'Money due in' : 'Bill to pay'), sub: jobName(r), amount: num(r.data.amount), dir: r.data.dir, url: `/job/${r.job_id}/money` })
  })
  unpaidInvoices().filter(r => r.data.due && r.data.due <= t && live(r)).forEach(r => {
    const late = r.data.due < t
    out.push({ id: r.id, order: 5, label: late ? 'Late' : 'Due', late, color: late ? URGENCY.red.color : '#3b9268', title: `Invoice ${r.data.number}${late ? ' is overdue' : ' due today'}`, sub: jobName(r), amount: invoiceTotals(r.data).total, dir: 'in', url: `/job/${r.job_id}/invoice/${r.id}` })
  })
  return out.sort((a, b) => a.order - b.order || (a.time || '').localeCompare(b.time || ''))
}

// Undone urgent things due within two days (same rule as the phone reminders)
export function urgentCount() {
  const t = today(), soon = addDays(t, 2)
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j]))
  const live = r => !r.job_id || (jobs[r.job_id] && jobStatus(jobs[r.job_id].data) !== 'finished')
  const folders = Object.fromEntries(list('folder').map(f => [f.id, f]))
  const due = r => r.data.urgency === 'red' && !r.data.done && r.data.date && r.data.date <= soon && live(r)
  return list('material', r => due(r) && folders[r.data.folder_id] && r.data.text).length
    + list('todo', r => due(r) && r.data.text).length
    + list('task', r => due(r) && r.data.text).length
}

// Monday to Friday of this week, as yyyy-mm-dd
export function thisWeek() {
  const d = parseYmd(today())
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 5 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return ymd(x) })
}
