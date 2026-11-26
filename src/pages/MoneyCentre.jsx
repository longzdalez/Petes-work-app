// Money centre: every payment in and out across all jobs, car costs and repeat payments, marked B or P,
// with the running tally of who has put in what, who has had what, and who owes who.
// There's no business account: all the money is in Brian's or Pete's account, and this adds them together.
import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { put, update, remove, useVersion, list } from '../store'
import { Icon, Sheet, TopBar, confirmDelete } from '../ui'
import { money, num, today, shortDate, niceDate, parseYmd, ymd, MONTHS } from '../util'
import { nav, back } from '../router'
import { useSettings } from './Settings'
import { PayerToggle, usePayers, BIZ } from '../Vehicle'
import { invoiceTotals } from '../pdf'
import { occurrences } from './CashFlow'
import { isOverdue } from './Invoices'
import { accountantCsv } from './Money'
import { whatsApp, shareText, shareOrDownload } from '../files'
import { allItems, tally, settle, againstOf, lockedUntil, isLocked, lockMsg, findDuplicate, taxYear } from '../ledger'
import { moveOpeningToPayments } from '../catchup'
import { jobStatus } from '../jobs'
import QuickMoney, { SavedToast } from '../QuickMoney'

const KIND = { income: 'Money in', expense: 'Money out', drawing: 'Paid themselves', transfer: 'Between you' }
const CAT = { materials: 'Materials', contractor: 'Subcontractor', wages: 'Wages', vehicle: 'Car', repeat: 'Repeat payment', other: 'Other', client: 'Client payment', transfer: 'Settle up' }
const setS = patch => put('settings', patch, { id: 'settings' })
const monthEnd = m => { const d = parseYmd(m + '-01'); d.setMonth(d.getMonth() + 1); d.setDate(0); return ymd(d) }
const monthName = m => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`
const addMonths = (m, n) => { const d = parseYmd(m + '-01'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7) }
const RECEIPT_OVER = 50
const needsReceipt = it => it.src === 'money' && it.kind === 'expense' && it.amount > RECEIPT_OVER && !it.receipt && !['ulez', 'congestion'].includes(it.vtype)
const sm = v => (v < -0.004 ? '−' : '') + money(Math.abs(v))
const neg = v => (v > 0.004 ? '-' : '') + money(v)
const whoLabel = p => p === BIZ ? '' : p

function useCentre() {
  useVersion()
  const settings = useSettings()
  const owners = settings.owners
  useEffect(() => { moveOpeningToPayments(owners) }, [owners.join()])
  const items = allItems(owners)
  return { settings, owners, items, t: tally(items, owners) }
}

// The box on the home page: the headline "who owes who", tap to open the full money centre
export function MoneyCentreCard() {
  const { items, t } = useCentre()
  const { lines } = settle(t.people, money)
  const late = list('invoice', r => isOverdue(r.data)).length
  const noRec = items.filter(needsReceipt).length
  return (
    <button className="card mc-card" onClick={() => nav('/money')}>
      <div className="card-head"><h2>Money centre</h2><Icon name="right" size={20} /></div>
      <div className="mc-mini">
        <div><span>In</span><b className="pos">{money(t.moneyIn)}</b></div>
        <div><span>Out</span><b className="neg">{money(t.moneyOut)}</b></div>
        <div><span>Profit</span><b>{sm(t.profit)}</b></div>
      </div>
      <p className="mc-line">{lines[0] || 'Add some payments and the tally shows here.'}</p>
      {t.moneyIn > 0 && <p className="small muted mc-against">Money in set against {t.people.map(p => `${p.name} ${money(p.received)}`).join(' · ')}</p>}
      {[t.unmarked && `${t.unmarked} not marked B or P`, late && `${late} invoice${late > 1 ? 's' : ''} overdue`, noRec && `${noRec} missing a receipt`].filter(Boolean).map(x => <span key={x} className="pill orange mc-flag">{x}</span>)}
    </button>
  )
}

// ---------- Tally tab ----------

// rel = what the other one owes them (+) or they owe the other one (−) to square up
function PersonCard({ p, rel }) {
  const minus = v => <b className={v ? 'neg' : ''}>{v ? '−' : ''}{money(v)}</b>
  return (
    <section className="card mc-person">
      <div className="card-head"><h2>{p.name}</h2></div>
      <div className="kv"><span>Paid for out of own pocket</span><b>{money(p.putIn)}</b></div>
      <div className="kv"><span>Half the profit</span><b>{sm(p.share)}</b></div>
      <div className="kv"><span>Money in set against them</span>{minus(p.received)}</div>
      <div className="kv"><span>Paid to themselves</span>{minus(p.drew)}</div>
      {(p.sent > 0 || p.got > 0) && <div className="kv"><span>Squared up between you</span><b>{p.sent - p.got >= 0 ? '+' : '−'}{money(Math.abs(p.sent - p.got))}</b></div>}
      <div className={'kv grand ' + (rel >= 0 ? 'pos' : 'neg')}><span>{rel >= 0 ? 'Owed to them' : 'Owes the other'}</span><b>{money(Math.abs(rel))}</b></div>
    </section>
  )
}

// What's still due by the end of this month (invoices in, repeat payments and bills out), and where that leaves each of you
function forecast(items, owners) {
  const t0 = today(), end = monthEnd(t0.slice(0, 7))
  const extra = []
  list('invoice', r => r.data.type === 'invoice' && r.data.status !== 'paid' && r.data.status !== 'draft' && (r.data.due || '') <= end)
    .forEach(r => extra.push({ kind: 'income', amount: invoiceTotals(r.data).total, payer: '', job: r.job_id, date: r.data.due }))
  list('genpay').forEach(r => {
    const c = (r.data.created || '').slice(0, 10), from = ymd(new Date(Date.now() - 60 * 864e5))
    occurrences(r, c > from ? c : from, end).filter(o => !o.paid).forEach(o => extra.push({ kind: r.data.dir === 'in' ? 'income' : 'expense', amount: num(r.data.amount), payer: r.data.payer || '', against: r.data.against || '', job: null, date: o.date }))
  })
  list('money', r => r.data.status === 'upcoming' && (r.data.date || '') <= end)
    .forEach(r => extra.push({ kind: r.data.dir === 'in' ? 'income' : 'expense', amount: num(r.data.amount), payer: r.data.payer || '', against: r.data.against || '', job: r.job_id, date: r.data.date }))
  return { end, count: extra.length, coming: extra.filter(x => x.kind === 'income').reduce((s, x) => s + x.amount, 0), going: extra.filter(x => x.kind === 'expense').reduce((s, x) => s + x.amount, 0), t: tally([...items, ...extra], owners) }
}

function LatePayers() {
  const { business } = useSettings()
  const late = list('invoice', r => isOverdue(r.data)).sort((a, b) => a.data.due.localeCompare(b.data.due))
  if (!late.length) return null
  const remind = r => {
    const d = r.data, t = invoiceTotals(d)
    const msg = `Hi${d.clientName ? ' ' + d.clientName.split(' ')[0] : ''}, just a friendly reminder that invoice ${d.number} for ${money(t.total)} was due on ${niceDate(d.due)}. ${business.bankName ? `Bank details: ${business.bankName}, sort code ${business.sortCode}, account ${business.accountNo}. ` : ''}Thanks, ${business.name || ''}`.trim()
    d.clientPhone ? whatsApp(d.clientPhone, msg) : shareText(msg, 'Payment reminder')
    update(r.id, { reminded: today() })
  }
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j.data.name]))
  return (
    <section className="card mc-late">
      <div className="card-head"><h2>Late payers</h2><span className="pill red">{money(late.reduce((s, r) => s + invoiceTotals(r.data).total, 0))}</span></div>
      {late.map(r => {
        const days = Math.round((parseYmd(today()) - parseYmd(r.data.due)) / 864e5)
        return (
          <div key={r.id} className="up-row">
            <span className="text tap" onClick={() => nav(`/job/${r.job_id}/invoice/${r.id}`)}>{r.data.clientName || jobs[r.job_id] || 'Invoice'} · {r.data.number}
              <br /><span className="small neg">{days} day{days === 1 ? '' : 's'} late{r.data.reminded ? ` · reminded ${shortDate(r.data.reminded)}` : ''}</span></span>
            <span className="nowrap">{money(invoiceTotals(r.data).total)}</span>
            <button className="icon-btn wa" aria-label="Send a reminder on WhatsApp" onClick={() => remind(r)}><Icon name="chat" size={20} /></button>
          </div>
        )
      })}
    </section>
  )
}

// One-page PDF for a month: totals, each person, who owes who at the end of the month, and every payment
function monthPdf(m, owners, business) {
  const end = monthEnd(m), all = allItems(owners)
  const inMonth = all.filter(it => it.date.startsWith(m)).reverse()
  const mt = tally(inMonth, owners), sofar = tally(all.filter(it => it.date <= end), owners)
  const { lines } = settle(sofar.people, money)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const green = [47, 122, 87], M = 16
  doc.setFillColor(...green); doc.rect(0, 0, 210, 26, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
  doc.text(`${business.name || 'BP Builders'}: money summary`, M, 12)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text(monthName(m), M, 20)
  doc.setTextColor(30)
  autoTable(doc, { startY: 32, theme: 'plain', styles: { fontSize: 11 }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    body: [['Money in this month', money(mt.moneyIn)], ['Money out this month', money(mt.moneyOut)], ['Profit this month', money(mt.profit)]] })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text(`Who's owed what at ${niceDate(end)} (all jobs to date)`, M, doc.lastAutoTable.finalY + 10)
  autoTable(doc, { startY: doc.lastAutoTable.finalY + 13, headStyles: { fillColor: green }, styles: { fontSize: 10 },
    head: [['', ...sofar.people.map(p => p.name)]],
    body: [['Paid out of own pocket', ...sofar.people.map(p => money(p.putIn))], ['Share of the profit', ...sofar.people.map(p => sm(p.share))],
      ['Money in set against them', ...sofar.people.map(p => neg(p.received))], ['Paid to themselves', ...sofar.people.map(p => neg(p.drew))],
      ['Squared up between you', ...sofar.people.map(p => sm(p.sent - p.got).replace('−', '-'))], ['Owed to them (- means owes the other)', ...sofar.people.map(p => sm(p.balance - (sofar.people.reduce((s, q) => s + q.balance, 0) / 2)).replace('−', '-'))]] })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  lines.forEach((l, i) => doc.text(l, M, doc.lastAutoTable.finalY + 9 + i * 6, { maxWidth: 178 }))
  autoTable(doc, { startY: doc.lastAutoTable.finalY + 12 + lines.length * 6, headStyles: { fillColor: green }, styles: { fontSize: 9 },
    head: [['Date', 'What', 'Job', 'Who', 'Amount']],
    body: inMonth.length ? inMonth.map(it => [shortDate(it.date), it.desc || CAT[it.cat] || KIND[it.kind], it.jobName, it.kind === 'drawing' ? `to ${it.to}` : it.kind === 'transfer' ? `${it.payer} to ${it.to}` : it.kind === 'income' ? `Into ${whoLabel(it.payer) || '?'}, set against ${againstOf(it, owners) || '?'}` : whoLabel(it.payer) || 'Not marked', (it.kind === 'income' ? '+' : it.kind === 'transfer' ? '' : '-') + money(it.amount)]) : [['', 'No payments this month', '', '', '']],
    columnStyles: { 4: { halign: 'right' } } })
  return new File([doc.output('blob')], `BP Builders money ${monthName(m)}.pdf`, { type: 'application/pdf' })
}

function MonthTools({ owners, business }) {
  const [m, setM] = useState(addMonths(today().slice(0, 7), -1))
  const lock = lockedUntil()
  const send = async () => { const f = monthPdf(m, owners, business); await shareOrDownload(f, `Money summary for ${monthName(m)}`) }
  return (
    <section className="card">
      <div className="card-head"><h2>Monthly summary</h2></div>
      <div className="month-pick">
        <button className="icon-btn" aria-label="Previous month" onClick={() => setM(addMonths(m, -1))}><Icon name="left" size={20} /></button>
        <b>{monthName(m)}</b>
        <button className="icon-btn" aria-label="Next month" disabled={m >= today().slice(0, 7)} onClick={() => setM(addMonths(m, 1))}><Icon name="right" size={20} /></button>
      </div>
      <button className="btn primary wide" onClick={send}><Icon name="share" size={18} /> Send {monthName(m)} summary (PDF)</button>
      <p className="small muted">A one-page PDF of the month's money and who owes who. Share it on WhatsApp with each other.</p>
      <h3 className="sub-h">Lock settled months</h3>
      {lock ? <p className="small">Everything up to <b>{niceDate(lock)}</b> is locked, so it can't be changed by accident.</p>
        : <p className="small muted">Once you've settled up for a month, lock it so nobody changes those payments by mistake.</p>}
      <div className="two">
        <button className="btn orange" onClick={() => { const e = monthEnd(m); if (confirm(`Lock every payment up to ${niceDate(e)}?`)) setS({ lockedUntil: e }) }}><Icon name="shield" size={18} /> Lock to end of {MONTHS[+m.slice(5) - 1].slice(0, 3)}</button>
        {lock && <button className="btn ghost" onClick={() => { if (confirm('Unlock all months? Payments in them can then be changed again.')) setS({ lockedUntil: '' }) }}>Unlock</button>}
      </div>
    </section>
  )
}

// ---------- Owed between you ----------

// Quick notes of who owes who ("Brian owes Pete £40 for the skip"). They keep their own running total and only
// count in the Money centre once ticked. Ticking one counts it as if the one owed had paid the other that much.
function IouSheet({ start, owners, onClose }) {
  const [a, b] = owners
  const [d, setD] = useState({ from: b, to: a, amount: '', desc: '', date: today(), ticked: false, ...(start.data || {}) })
  const set = p => setD(x => ({ ...x, ...p }))
  const save = () => {
    const amount = num(d.amount)
    if (!amount) return alert('Please put in an amount')
    if (!d.desc.trim()) return alert('Please say what it is for')
    if (d.ticked && isLocked(d.date)) return alert(lockMsg(d.date))
    put('iou', { ...d, amount, desc: d.desc.trim() }, start.id ? { id: start.id } : {})
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={start.id ? 'Change what\'s owed' : 'Who owes who'}>
      <div className="seg">
        {[[b, a], [a, b]].map(([f, t]) => <button key={f} className={d.from === f ? 'on' : ''} onClick={() => set({ from: f, to: t })}>{f} owes {t}</button>)}
      </div>
      <label className="qm-amount"><span>£</span><input inputMode="decimal" value={d.amount} placeholder="0.00" autoFocus={!start.id} aria-label="Amount in pounds" style={{ width: `${Math.max(4, String(d.amount).length) + 0.5}ch` }} onChange={e => set({ amount: e.target.value.replace(/[^\d.,]/g, '') })} /></label>
      <label className="field"><span>What's it for?</span><input value={d.desc} onChange={e => set({ desc: e.target.value })} placeholder="e.g. Half the skip hire" /></label>
      <label className="field"><span>Date</span><input type="date" value={d.date} onChange={e => e.target.value && set({ date: e.target.value })} /></label>
      <div className="sheet-actions">
        {start.id && <button className="btn danger" onClick={() => { if (confirmDelete('this note')) { remove(start.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

function OwedBetween({ owners }) {
  const [a, b] = owners
  const [edit, setEdit] = useState(null)
  const [showTicked, setShowTicked] = useState(false)
  const notes = list('iou', r => num(r.data.amount) > 0).sort((x, y) => (y.data.date || '').localeCompare(x.data.date || ''))
  const open = notes.filter(r => !r.data.ticked), ticked = notes.filter(r => r.data.ticked)
  const sum = (rows, from) => rows.filter(r => r.data.from === from).reduce((s, r) => s + num(r.data.amount), 0)
  const bOwes = sum(open, b), aOwes = sum(open, a), net = bOwes - aOwes
  const tick = r => {
    if (isLocked(r.data.date)) return alert(lockMsg(r.data.date))
    update(r.id, { ticked: !r.data.ticked, tickedOn: r.data.ticked ? '' : today() })
  }
  if (!a || !b) return null
  const Row = ({ r }) => (
    <div className={'iou-row' + (r.data.ticked ? ' done' : '')}>
      <button className={'tick' + (r.data.ticked ? ' on' : '')} onClick={() => tick(r)} aria-label={r.data.ticked ? 'Untick' : 'Tick to count it in the Money centre'}>{r.data.ticked && <Icon name="check" size={16} stroke={3} />}</button>
      <button className="iou-text" onClick={() => setEdit({ id: r.id, data: r.data })}>
        <b>{r.data.desc}</b><span>{r.data.from} owes {r.data.to} · {shortDate(r.data.date)}{r.data.ticked ? ' · counted' : ''}</span>
      </button>
      <span className="iou-amt">{money(num(r.data.amount))}</span>
    </div>
  )
  return (
    <section className="card iou-card">
      <div className="card-head"><h2>Owed between you</h2><button className="btn primary small" onClick={() => setEdit({})}><Icon name="plus" size={16} /> Add</button></div>
      <div className="iou-tots">
        <div><span>{b} owes {a}</span><b>{money(bOwes)}</b></div>
        <div><span>{a} owes {b}</span><b>{money(aOwes)}</b></div>
      </div>
      {open.length > 0 && <p className="iou-net">{Math.abs(net) < 0.005 ? 'These cancel each other out.' : `Overall ${net > 0 ? b : a} owes ${net > 0 ? a : b} ${money(Math.abs(net))}`}</p>}
      {open.map(r => <Row key={r.id} r={r} />)}
      {open.length === 0 && <p className="small muted" style={{ margin: '4px 0 0' }}>Nothing waiting. Tap Add to note something one of you owes the other.</p>}
      {ticked.length > 0 && <button className="link-btn" style={{ marginTop: 8 }} onClick={() => setShowTicked(s => !s)}>{showTicked ? 'Hide ticked' : `Show ticked (${ticked.length})`}</button>}
      {showTicked && ticked.map(r => <Row key={r.id} r={r} />)}
      <p className="small muted" style={{ marginBottom: 0 }}>These don't count in the figures below until you tick them. Tap one to change it.</p>
      {edit && <IouSheet start={edit} owners={owners} onClose={() => setEdit(null)} />}
    </section>
  )
}

// ---------- BP Owed: still owed on jobs ----------

// What clients still owe: each job's worth, less the invoices on it that are ticked as paid (paid to either of you).
// BP Owed is jobs on site or finished; Coming up is jobs booked in but not started. Jobs still being quoted aren't in either.
export function jobsOwed(statuses) {
  const paid = {}
  list('invoice', r => r.data.type === 'invoice' && r.data.status === 'paid').forEach(r => { paid[r.job_id] = (paid[r.job_id] || 0) + invoiceTotals(r.data).total })
  const rows = list('job', j => num(j.data.value) > 0 && statuses.includes(jobStatus(j.data))).map(j => {
    const worth = num(j.data.value), inv = paid[j.id] || 0
    return { j, worth, inv, owed: Math.round((worth - inv) * 100) / 100 }
  }).filter(x => x.owed > 0.004).sort((a, b) => b.owed - a.owed)
  return { rows, total: rows.reduce((s, x) => s + x.owed, 0) }
}

const OWED_KINDS = {
  owed: { title: 'BP Owed', statuses: ['onsite', 'finished'], cls: '', empty: 'Jobs on site or finished show here, with what\'s still to be paid', note: 'Jobs on site or finished: each job\'s worth, less the invoices ticked as paid.', none: 'Nothing owed on jobs that are on site or finished.' },
  coming: { title: 'Coming up', statuses: ['booked'], cls: ' coming', empty: 'Jobs booked in but not on site yet show here', note: 'Jobs booked in but not on site yet: each job\'s worth, less any invoices already ticked as paid.', none: 'No booked jobs waiting to start.' },
}

function JobsOwedCard({ kind }) {
  const k = OWED_KINDS[kind]
  const [open, setOpen] = useState(false)
  const { rows, total } = jobsOwed(k.statuses)
  return <>
    <button className={'card owed-jobs' + k.cls} onClick={() => setOpen(true)}>
      <div className="card-head"><h2>{k.title}</h2><Icon name="right" size={20} /></div>
      <b className="owed-jobs-total">{money(total)}</b>
      <span className="small muted">{rows.length ? `${rows.length} job${rows.length === 1 ? '' : 's'} · tap to see each one` : k.empty}</span>
    </button>
    {open && <Sheet open onClose={() => setOpen(false)} title={k.title} full>
      <div className="ml-head"><div><span>Total {k.title}</span><b>{money(total)}</b></div></div>
      <p className="small muted" style={{ marginTop: -4 }}>{k.note} Tap a job to open its invoices.</p>
      {rows.length === 0 && <p className="muted small">{k.none}</p>}
      <div className="ml-list">{rows.map(({ j, worth, inv, owed }) => (
        <button key={j.id} className="ml-row" onClick={() => { setOpen(false); nav(`/job/${j.id}/invoices`) }}>
          <span className="ml-text"><b>{j.data.name || 'Job'}</b><span>{[j.data.client, kind === 'coming' && j.data.start ? `Starts ${shortDate(j.data.start)}` : '', `Worth ${money(worth)}`, inv ? `${money(inv)} paid` : 'Nothing paid yet'].filter(Boolean).join(' · ')}</span></span>
          <span className={'ml-amt' + (kind === 'owed' ? ' pos' : '')}>{money(owed)}</span>
        </button>
      ))}</div>
    </Sheet>}
  </>
}

// ---------- Overview: who owes who, and the lists ----------

// Every payment in one list, newest first, with buttons to show just one kind
function paymentViews(items, owners) {
  const [a, b] = owners
  const isOwner = n => owners.includes(n)
  const between = (x, y) => items.filter(it => (it.kind === 'transfer' || it.kind === 'drawing') && it.src !== 'iou' && it.payer === x && it.to === y)
  const notes = (x, y) => list('iou', r => r.data.from === x && r.data.to === y && num(r.data.amount) > 0)
    .map(r => ({ key: r.id, id: r.id, src: 'iounote', kind: 'iou', date: r.data.date || '', desc: r.data.desc || '', amount: num(r.data.amount), payer: x, to: y, ticked: !!r.data.ticked, rec: r }))
    .sort((p, q) => q.date.localeCompare(p.date))
  // Money in is only money from someone else (clients). Anything one of you paid the other, if it was put in as money in, is left off this list.
  const fromOwner = it => {
    if (isOwner(it.from)) return true
    const to = againstOf(it, owners), txt = (it.desc || '').toLowerCase()
    return owners.some(n => n !== to && new RegExp(`\\b${n.toLowerCase()}\\b`).test(txt))
  }
  const spent = (n, cats) => items.filter(it => it.kind === 'expense' && it.payer === n && cats.includes(it.cat))
  const pairs = a && b ? [[b, a], [a, b]] : []
  const people = b ? [b, a] : [a]
  const views = [
    { k: 'all', title: 'All payments', rows: items, add: {} },
    ...pairs.map(([x, y]) => ({ k: `pay-${x}`, title: `${x} paid ${y}`, rows: between(x, y), add: { data: { dir: 'between', payer: x, person: y } } })),
    ...pairs.map(([x, y]) => ({ k: `owe-${x}`, title: `${x} owes ${y}`, rows: notes(x, y), iou: { from: x, to: y }, owes: true })),
    ...people.map(n => ({ k: `mat-${n}`, title: `${n} materials paid`, rows: spent(n, ['materials']), add: { data: { dir: 'out', cat: 'materials', payer: n } } })),
    ...people.map(n => ({ k: `sub-${n}`, title: `${n} subcontractor payments`, rows: spent(n, ['contractor']), add: { data: { dir: 'out', cat: 'contractor', payer: n } } })),
    { k: 'in', title: 'Money in', rows: items.filter(it => it.kind === 'income' && !fromOwner(it)), add: { data: { dir: 'in' } }, hidden: items.filter(it => it.kind === 'income' && fromOwner(it)).length },
    { k: 'bal', title: 'Balance to date', balance: true },
  ]
  const unmarked = items.filter(it => (it.kind === 'income' && !againstOf(it, owners)) || (it.kind === 'expense' && !isOwner(it.payer)))
  if (unmarked.length) views.push({ k: 'unmarked', title: 'Not marked B or P', rows: unmarked, warn: true })
  return views.map(v => ({ ...v, total: (v.rows || []).reduce((s, it) => s + (v.owes && it.ticked ? 0 : it.amount), 0) }))
}

// One line: date, what it was, who paid who (or for what), and the amount
function ListRow({ it, owners, onOpen }) {
  const pp = n => owners.includes(n) ? n : ''
  let what, who
  if (it.kind === 'iou') { what = `${it.payer} owes ${it.to}`; who = it.ticked ? 'Ticked, counted in the balance' : 'Not ticked yet' }
  else if (it.src === 'iou') { what = it.desc; who = 'Owed between you, ticked' }
  else if (it.kind === 'transfer' || it.kind === 'drawing') { what = `${it.payer} paid ${it.to}`; who = '' }
  else if (it.kind === 'income') { const g = againstOf(it, owners), into = pp(it.payer); what = it.from ? `From ${it.from}` : 'Money in'; who = g ? (into && into !== g ? `Into ${into}, counts for ${g}` : `Paid to ${g}`) : 'Not marked B or P' }
  else { what = CAT[it.cat] || 'Money out'; who = pp(it.payer) ? `Paid by ${it.payer}` : 'Not marked B or P' }
  const sign = it.kind === 'income' ? '+' : it.kind === 'expense' ? '−' : ''
  const title = it.src === 'iou' ? it.desc : (it.desc || what)
  return (
    <button className={'ml-row' + (isLocked(it.date) ? ' locked' : '') + (it.kind === 'iou' && it.ticked ? ' done' : '')} onClick={() => onOpen(it)}>
      <span className="ml-date">{shortDate(it.date)}</span>
      <span className="ml-text"><b>{title}</b><span>{[title === what ? '' : what, who, it.jobName].filter(Boolean).join(' · ')}{needsReceipt(it) ? ' · no receipt' : ''}</span></span>
      <span className={'ml-amt ' + (it.kind === 'income' ? 'pos' : it.kind === 'expense' ? 'neg' : '')}>{sign}{money(it.amount)}</span>
    </button>
  )
}

function PaymentsCard({ items, t, owners, setQm, onOpen }) {
  const [sel, setSel] = useState('all')
  const [shown, setShown] = useState(40)
  const [iou, setIou] = useState(null)
  const views = paymentViews(items, owners)
  const v = views.find(x => x.k === sel) || views[0]
  const { lines } = settle(t.people, money)
  const pick = k => { setSel(k === sel ? 'all' : k); setShown(40) }
  // Notes of who owes who open their own little form; everything else opens as usual
  const open = it => {
    if (it.src === 'iounote' || it.src === 'iou') { const r = list('iou').find(x => x.id === it.id); if (r) return setIou({ id: r.id, data: r.data }) }
    onOpen(it)
  }
  const add = () => v.iou ? setIou({ data: { from: v.iou.from, to: v.iou.to } }) : setQm(v.add)
  return (
    <section className="card pay-card">
      <div className="card-head"><h2>Payments</h2>{sel !== 'all' && <button className="link-btn" onClick={() => pick('all')}>Show all</button>}</div>
      <div className="pay-btns">
        {views.filter(x => x.k !== 'all').map(x => (
          <button key={x.k} className={'pay-btn' + (sel === x.k ? ' on' : '') + (x.warn ? ' warn' : '') + (x.balance ? ' bal' : '')} onClick={() => pick(x.k)}>
            <span>{x.title}</span><b>{x.balance ? (lines[0] || 'All square') : money(x.total)}</b>
          </button>
        ))}
      </div>
      {v.balance ? <div className="pay-bal">
        <p className="mc-big">{lines[0] || 'Nothing owed either way yet.'}</p>
        <div className="mc-people">{t.people.map(p => <PersonCard key={p.name} p={p} rel={(p.balance - (t.people.reduce((s, q) => s + q.balance, 0) - p.balance)) / 2} />)}</div>
        <p className="small muted" style={{ margin: 0 }}>Everything to date. Notes in Owed between you only count once ticked.</p>
      </div> : <>
        <div className="ml-head">
          <div><span>{v.k === 'all' ? 'Newest first' : v.title}</span><b>{v.k === 'all' ? `${v.rows.length} payment${v.rows.length === 1 ? '' : 's'}` : money(v.total)}</b></div>
          {(v.add || v.iou) && <button className="btn primary" onClick={add}><Icon name="plus" size={18} /> Add</button>}
        </div>
        {v.k === 'in' && <p className="small muted" style={{ marginTop: -4 }}>Only money paid to {owners.join(' or ')} by someone else.{v.hidden ? ` ${v.hidden} payment${v.hidden === 1 ? '' : 's'} between you ${v.hidden === 1 ? 'is' : 'are'} left off; ${v.hidden === 1 ? "it's" : "they're"} still in the full list.` : ''}</p>}
        {v.owes && <p className="small muted" style={{ marginTop: -4 }}>Total is what's not ticked yet. Ticked ones are already in the balance.</p>}
        {v.rows.length === 0 && <p className="muted small">Nothing here yet.</p>}
        <div className="ml-list">{v.rows.slice(0, shown).map(it => <ListRow key={it.key} it={it} owners={owners} onOpen={open} />)}</div>
        {v.rows.length > shown && <button className="btn ghost wide" style={{ marginTop: 10 }} onClick={() => setShown(s => s + 100)}>Show more ({v.rows.length - shown} left)</button>}
        {v.rows.length > 0 && <p className="small muted" style={{ marginBottom: 0 }}>Tap any line to change the amount, date, who paid, what it was for or the job, or to delete it.</p>}
      </>}
      {iou && <IouSheet start={iou} owners={owners} onClose={() => setIou(null)} />}
    </section>
  )
}

function Overview({ items, t, owners, settings, setQm, onOpen }) {
  const { lines, pay } = settle(t.people, money)
  const f = forecast(items, owners)
  return <>
    <OwedBetween owners={owners} />

    <section className="card mc-owed mc-hero">
      <p className="mc-big">{lines[0] || 'Add some payments and who owes who shows here.'}</p>
      <div className="mc-mini">
        <div><span>In</span><b className="pos">{money(t.moneyIn)}</b></div>
        <div><span>Out</span><b className="neg">{money(t.moneyOut)}</b></div>
        <div><span>Profit</span><b>{sm(t.profit)}</b></div>
      </div>
      <div className="mc-hero-btns">
        <button className="btn primary" onClick={() => setQm({})}><Icon name="plus" size={20} /> Add money</button>
        <button className="btn white" onClick={() => setQm(pay ? { data: { dir: 'between', payer: pay.from, person: pay.to, amount: pay.amount.toFixed(2), desc: 'Squaring up' } } : { data: { dir: 'between' } })}><Icon name="check" size={20} /> Settle up</button>
      </div>
      <details className="mc-how">
        <summary>How it's worked out</summary>
        <div className="mc-people">{t.people.map(p => <PersonCard key={p.name} p={p} rel={(p.balance - (t.people.reduce((s, q) => s + q.balance, 0) - p.balance)) / 2} />)}</div>
        <p className="small muted" style={{ margin: 0 }}>Profit (money in minus money out) is split 50/50. What each of you paid out is added back, and money paid to you is taken off. The difference between you, halved, is what one owes the other.</p>
      </details>
    </section>

    <JobsOwedCard kind="owed" />
    <JobsOwedCard kind="coming" />

    <PaymentsCard items={items} t={t} owners={owners} setQm={setQm} onOpen={onOpen} />
    <p className="small muted" style={{ margin: '0 4px 14px' }}>Catching up on older payments? Tap a button, then Add, and pick the date it was paid.</p>

    <LatePayers />

    <section className="card">
      <div className="card-head"><h2>Spending by type</h2></div>
      <SpendChart items={items} />
    </section>

    {f.count > 0 && <details className="card mc-more">
      <summary><h2>By the end of {MONTHS[+f.end.slice(5, 7) - 1]}</h2></summary>
      <div className="kv"><span>Still to come in</span><b className="pos">+{money(f.coming)}</b></div>
      <div className="kv"><span>Still to go out</span><b className="neg">−{money(f.going)}</b></div>
      <div className="kv"><span>Then</span><b>{settle(f.t.people, money).lines[0]}</b></div>
    </details>}

    <MonthTools owners={owners} business={settings.business} />
  </>
}

// ---------- Jobs tab ----------

function JobsTab({ items, owners }) {
  const jobs = list('job').map(j => {
    const its = items.filter(it => it.job === j.id && (it.kind === 'income' || it.kind === 'expense'))
    const inn = its.filter(it => it.kind === 'income').reduce((s, it) => s + it.amount, 0)
    const out = its.filter(it => it.kind === 'expense').reduce((s, it) => s + it.amount, 0)
    return { j, inn, out, profit: inn - out, n: its.length, worth: num(j.data.value) }
  }).filter(x => x.n || x.worth).sort((a, b) => b.profit - a.profit)
  const general = items.filter(it => !it.job && (it.kind === 'income' || it.kind === 'expense')).reduce((s, it) => s + (it.kind === 'income' ? it.amount : -it.amount), 0)
  return <>
    <p className="small muted" style={{ margin: '0 4px 12px' }}>Best paying jobs first. Every job's profit is split 50/50.</p>
    {jobs.length === 0 && <p className="muted small">No job payments yet.</p>}
    {jobs.map(({ j, inn, out, profit, worth }) => (
      <section key={j.id} className="card mc-job">
        <div className="card-head"><h2 className="tap" onClick={() => nav(`/job/${j.id}/money`)}>{j.data.name}</h2><b className={profit >= 0 ? 'pos' : 'neg'}>{sm(profit)}</b></div>
        <div className="mc-mini">
          <div><span>In</span><b className="pos">{money(inn)}</b></div>
          <div><span>Out</span><b className="neg">{money(out)}</b></div>
          <div><span>Margin</span><b>{inn ? Math.round(profit / inn * 100) + '%' : '–'}</b></div>
        </div>
        {worth > 0 && <div className="small muted">Job worth {money(worth)} · {money(inn)} paid so far</div>}
        <div className="mc-split">
          {owners.map(n => <span key={n}>{n}: <b>{sm(profit / owners.length)}</b></span>)}
        </div>
      </section>
    ))}
    {general !== 0 && <section className="card"><div className="kv"><span>Not for one job (car, repeat payments…)</span><b className={general >= 0 ? 'pos' : 'neg'}>{sm(general)}</b></div><p className="small muted" style={{ margin: 0 }}>Shared 50/50.</p></section>}
  </>
}

// ---------- Tax tab ----------

function TaxTab({ items, owners, settings }) {
  const [yr, setYr] = useState(taxYear())
  const pct = settings.taxPct ?? 25
  const its = items.filter(it => it.date >= yr.from && it.date <= yr.to)
  const t = tally(its, owners)
  const vatPaid = its.filter(it => it.kind === 'expense').reduce((s, it) => s + (it.vat || 0), 0)
  const vatCharged = list('invoice', r => r.data.type === 'invoice' && r.data.status === 'paid' && (r.data.date || '') >= yr.from && (r.data.date || '') <= yr.to).reduce((s, r) => s + invoiceTotals(r.data).vat, 0)
  const cis = its.reduce((s, it) => s + (it.cis || 0), 0)
  const prev = () => setYr(taxYear(`${+yr.from.slice(0, 4) - 1}-06-01`)), next = () => setYr(taxYear(`${+yr.from.slice(0, 4) + 1}-06-01`))
  const csv = async () => { const { file, count } = accountantCsv(yr.from, yr.to); if (!count) return alert('No payments in this tax year yet.'); await shareOrDownload(file, `Accounts ${yr.label}`) }
  return <>
    <div className="month-pick">
      <button className="icon-btn" aria-label="Previous tax year" onClick={prev}><Icon name="left" size={20} /></button>
      <b>Tax year {yr.label}</b>
      <button className="icon-btn" aria-label="Next tax year" disabled={yr.to >= taxYear().to} onClick={next}><Icon name="right" size={20} /></button>
    </div>
    <p className="small muted" style={{ margin: '-6px 4px 12px', textAlign: 'center' }}>{niceDate(yr.from)} to {niceDate(yr.to)}</p>

    <section className="card">
      <div className="card-head"><h2>Tax pot</h2></div>
      <p className="small muted" style={{ marginTop: 0 }}>Roughly what each of you should keep back for your tax bill, from your share of this year's profit.</p>
      <div className="chips" style={{ marginBottom: 10 }}>{[20, 25, 30, 35].map(p => <button key={p} className={'chip' + (pct === p ? ' on' : '')} onClick={() => setS({ taxPct: p })}>{p}%</button>)}</div>
      {t.people.map(p => <div key={p.name} className="kv"><span>{p.name}<br /><span className="small muted">profit share {sm(p.share)}</span></span><b className="orange-ink">Keep back {money(Math.max(0, p.share) * pct / 100)}</b></div>)}
      <p className="small muted" style={{ marginBottom: 0 }}>This is only a rough guide. Your accountant will work out the real figure.</p>
    </section>

    <section className="card">
      <div className="card-head"><h2>VAT</h2></div>
      <div className="kv"><span>VAT on paid invoices</span><b>{money(vatCharged)}</b></div>
      <div className="kv"><span>VAT you've paid on receipts</span><b>{money(vatPaid)}</b></div>
      <div className="kv grand"><span>{vatCharged - vatPaid >= 0 ? 'Roughly owed to HMRC' : 'Roughly owed back'}</span><b>{money(Math.abs(vatCharged - vatPaid))}</b></div>
      <p className="small muted" style={{ marginBottom: 0 }}>Only matters if you're VAT registered, and only counts receipts where the VAT was filled in.</p>
    </section>

    <section className="card">
      <div className="card-head"><h2>CIS</h2></div>
      <div className="kv"><span>Taken off subcontractors' pay</span><b>{money(cis)}</b></div>
      <p className="small muted" style={{ marginBottom: 0 }}>This has to be paid to HMRC by the 22nd of the following month.</p>
    </section>

    <button className="btn orange wide big" onClick={csv}><Icon name="download" size={20} /> Spreadsheet for the accountant</button>
    <p className="small muted" style={{ textAlign: 'center' }}>Every payment for {yr.label}, with who paid it, plus a summary for each of you.</p>
  </>
}

// ---------- Payments tab ----------

const GROUPS = [
  { k: 'materials', l: 'Materials', c: '#2f7a57' },
  { k: 'contractor', l: 'Subcontractors', c: '#7cc4a0' },
  { k: 'vehicle', l: 'Car', c: '#ff8a3d' },
  { k: 'repeat', l: 'Repeat', c: '#f6c28b' },
  { k: 'other', l: 'Other', c: '#b7c9bf' },
]
const groupOf = it => GROUPS.find(g => g.k === it.cat)?.k || 'other'

function SpendChart({ items }) {
  const [tip, setTip] = useState(null)
  const cur = today().slice(0, 7)
  const months = Array.from({ length: 6 }, (_, i) => addMonths(cur, i - 5))
  const data = months.map(m => { const row = Object.fromEntries(GROUPS.map(g => [g.k, 0])); items.filter(it => it.kind === 'expense' && it.date.startsWith(m)).forEach(it => { row[groupOf(it)] += it.amount }); return { m, row, total: Object.values(row).reduce((s, v) => s + v, 0) } })
  const hi = Math.max(1, ...data.map(d => d.total))
  if (data.every(d => !d.total)) return <p className="muted small">Spending shows here once you've some money out.</p>
  const W = 340, H = 170, P = { l: 8, r: 8, t: 10, b: 24 }, bw = (W - P.l - P.r) / 6
  const sel = tip != null ? data[tip] : null
  return <>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spending by type, last 6 months">
      {data.map((d, i) => {
        let y = H - P.b
        const x = P.l + i * bw + bw * 0.18, w = bw * 0.64
        return <g key={d.m} onClick={() => setTip(tip === i ? null : i)} opacity={tip == null || tip === i ? 1 : 0.45}>
          {GROUPS.map(g => { const h = d.row[g.k] / hi * (H - P.t - P.b); y -= h; return h > 0 ? <rect key={g.k} x={x} y={y} width={w} height={Math.max(h - 1.5, 0.5)} rx="3" fill={g.c} /> : null })}
          <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
          <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6a7d73">{MONTHS[+d.m.slice(5) - 1].slice(0, 3)}</text>
        </g>
      })}
    </svg>
    <div className="chart-tip">{sel
      ? <><b>{monthName(sel.m)}: {money(sel.total)}</b><br />{GROUPS.filter(g => sel.row[g.k]).map(g => <span key={g.k} className="mc-key"><i style={{ background: g.c }} />{g.l} {money(sel.row[g.k])}</span>)}</>
      : <>{GROUPS.map(g => <span key={g.k} className="mc-key"><i style={{ background: g.c }} />{g.l}</span>)}<br /><span className="muted">Tap a month for the amounts.</span></>}</div>
  </>
}

export default function MoneyCentre() {
  const { settings, owners, items, t } = useCentre()
  const [tab, setTab] = useState('home')
  const [qm, setQm] = useState(null)
  const [saved, setSaved] = useState(null)
  // Open a payment: job payments open their job, repeat payments the cash flow page, everything else the £ form
  const onOpen = it => {
    if (it.src === 'genpay') return nav('/cashflow')
    if (it.src === 'iou') return alert('This is in Owed between you at the top. Untick it there to stop it counting.')
    if (it.src !== 'money') return it.job ? nav(`/job/${it.job}/money`) : undefined
    if (isLocked(it.date)) return alert(lockMsg(it.date))
    const r = list('money').find(x => x.id === it.id)
    if (!r) return
    // The £ form handles these; anything else on a job (wages, CIS details) opens in the job's own money page
    const fits = r.data.dir === 'in' || ['transfer', 'materials', 'contractor', 'vehicle', 'other'].includes(r.data.cat)
    if (r.job_id && (!fits || num(r.data.cisRate))) return nav(`/job/${r.job_id}/money`)
    setQm({ id: r.id, data: r.data, job_id: r.job_id })
  }
  return (
    <div className="page">
      <TopBar title="Money centre" sub="Both your accounts added together" onBack={() => back('/')} />
      <main className="content">
        <div className="seg mc-tabs">
          {[['home', 'Money'], ['jobs', 'Jobs'], ['tax', 'Tax']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); window.scrollTo(0, 0) }}>{l}</button>)}
        </div>
        {tab === 'home' && <Overview items={items} t={t} owners={owners} settings={settings} setQm={setQm} onOpen={onOpen} />}
        {tab === 'jobs' && <JobsTab items={items} owners={owners} />}
        {tab === 'tax' && <TaxTab items={items} owners={owners} settings={settings} />}
      </main>
      {qm && <QuickMoney key={qm.id || JSON.stringify(qm.data || {})} start={qm} onClose={() => setQm(null)} onSaved={setSaved} />}
      <SavedToast saved={saved} onDone={() => setSaved(null)} />
    </div>
  )
}

