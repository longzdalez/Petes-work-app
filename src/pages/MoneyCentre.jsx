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
import QuickMoney, { SavedToast, whatLabel } from '../QuickMoney'

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

// Add money in/out that isn't for one job, or a settle-up payment between you
function AddSheet({ start, onClose, owners }) {
  const payers = usePayers()
  const [d, setD] = useState({ type: 'out', amount: '', date: today(), desc: '', cat: 'materials', payer: '', against: '', person: '', to: '', ...start })
  const set = p => setD(x => ({ ...x, ...p }))
  const save = () => {
    const amount = num(d.amount)
    if (!amount) return alert('Please put in an amount')
    if (isLocked(d.date)) return alert(lockMsg(d.date))
    if (d.type === 'transfer') {
      if (!d.payer || !d.to || d.payer === d.to) return alert('Pick who paid and who got the money')
      put('money', { dir: 'out', cat: 'transfer', person: d.to, payer: d.payer, amount, date: d.date, desc: d.desc || `${d.payer} paid ${d.to}`, status: 'paid' }, { job_id: null })
    } else {
      if (!d.desc.trim()) return alert('Please say what it was for')
      if (!d.payer) return alert(d.type === 'in' ? 'Tap B or P to say whose account it went into' : 'Tap B or P to say who paid')
      const dup = findDuplicate({ amount, desc: d.desc, date: d.date })
      if (dup && !confirm(`This looks like a payment already saved: ${dup.data.desc || 'no description'}, ${money(dup.data.amount)} on ${shortDate(dup.data.date)}. Save it anyway?`)) return
      put('money', { dir: d.type, cat: d.type === 'in' ? 'other' : d.cat, payer: d.payer, ...(d.type === 'in' ? { against: d.against || d.payer, person: d.person.trim() } : {}), amount, date: d.date, desc: d.desc.trim(), status: 'paid' }, { job_id: null })
    }
    onClose()
  }
  const other = n => owners.find(o => o !== n) || ''
  return (
    <Sheet open onClose={onClose} title={{ out: 'Money out', in: 'Money in', transfer: 'Settle up' }[d.type]}>
      <div className="seg small" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[['out', 'Out'], ['in', 'In'], ['transfer', 'Settle up']].map(([k, l]) => <button key={k} className={d.type === k ? 'on' : ''} onClick={() => set({ type: k })}>{l}</button>)}
      </div>
      <div className="two">
        <label className="field"><span>Amount (£)</span><input inputMode="decimal" value={d.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" /></label>
        <label className="field"><span>Date</span><input type="date" value={d.date} onChange={e => set({ date: e.target.value })} /></label>
      </div>
      {(d.type === 'out' || d.type === 'in') && <>
        <label className="field"><span>What was it for?</span><input value={d.desc} onChange={e => set({ desc: e.target.value })} placeholder={d.type === 'in' ? 'e.g. Cash job' : 'e.g. Tools from Screwfix'} /></label>
        {d.type === 'out' && <label className="field"><span>Type</span>
          <div className="chips">{['materials', 'other'].map(k => <button key={k} className={'chip' + (d.cat === k ? ' on' : '')} onClick={() => set({ cat: k })}>{CAT[k]}</button>)}</div></label>}
        {d.type === 'in' && <label className="field"><span>Who paid it?</span><input value={d.person} onChange={e => set({ person: e.target.value })} placeholder="e.g. the client's name" /></label>}
        <label className="field"><span>{d.type === 'in' ? 'Paid into whose account?' : 'Who paid?'}</span><PayerToggle big value={d.payer} onChange={p => set({ payer: p })} /></label>
        {d.type === 'in' && <><label className="field"><span>Set against</span><PayerToggle big value={d.against || d.payer} onChange={p => set({ against: p })} /></label>
          <p className="small muted" style={{ marginTop: -6 }}>Who this money counts for in who owes who. It starts as whoever's account it went into.</p></>}
      </>}
      {d.type === 'transfer' && <>
        <label className="field"><span>Who paid?</span><PayerToggle big value={d.payer} onChange={p => set({ payer: p, to: other(p) })} /></label>
        <label className="field"><span>Who got it?</span><PayerToggle big value={d.to} onChange={p => set({ to: p, payer: other(p) })} /></label>
        <p className="small muted">Use this when one of you pays the other to square up. It doesn't count as money in or out of the business, and it stays out of the accountant's spreadsheet.</p>
      </>}
      <div className="sheet-actions"><button className="btn primary" onClick={save}>Save</button></div>
    </Sheet>
  )
}

function ItemRow({ it, onEdit }) {
  const locked = isLocked(it.date)
  const editable = (it.kind === 'income' || it.kind === 'expense') && it.src !== 'opening'
  const setPayer = p => locked ? alert(lockMsg(it.date)) : update(it.id, { payer: p })
  const sign = it.kind === 'income' ? '+' : it.kind === 'transfer' ? '' : '−'
  const open = () => {
    if (it.src === 'opening') alert('This is part of the starting point. Change it on the Tally tab, under Starting point.')
    else if (it.job) nav(`/job/${it.job}/money`)
    else if (it.src === 'genpay') nav('/cashflow')
    else if (locked) alert(lockMsg(it.date))
    else if (it.src === 'money') onEdit(it.id)
  }
  const chip = it.kind === 'drawing' ? it.to : it.payer
  return (
    <div className={'up-row mc-row' + (locked ? ' locked' : '')}>
      <span className="small muted nowrap">{shortDate(it.date)}</span>
      <span className="text tap" onClick={open}>
        {it.desc || CAT[it.cat] || KIND[it.kind]}
        <br /><span className="small muted">{needsReceipt(it) && <span className="mc-norec">no receipt</span>} {it.kind === 'drawing' ? `Paid to ${it.to}` : it.kind === 'transfer' ? `${it.payer} → ${it.to}` : (CAT[it.cat] || KIND[it.kind])}{it.jobName ? ` · ${it.jobName}` : ''}</span>
      </span>
      {editable
        ? <PayerToggle disabled={locked} value={it.payer === BIZ ? '' : it.payer} onChange={setPayer} />
        : <span className="payer-chip" title={whoLabel(chip) || 'Not marked'}>{(whoLabel(chip) || '?')[0].toUpperCase()}</span>}
      <span className={'nowrap ' + (it.kind === 'income' ? 'pos' : it.kind === 'transfer' ? '' : 'neg')}>{sign}{money(it.amount)}</span>
    </div>
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

function TallyTab({ items, t, owners, settings, setAdd, setFilter, setTab, setQm }) {
  const { lines, pay } = settle(t.people, money)
  const f = forecast(items, owners)
  const owed = list('invoice', r => r.data.type === 'invoice' && r.data.status !== 'paid' && r.data.status !== 'draft').reduce((s, r) => s + invoiceTotals(r.data).total, 0)
  return <>
    <div className="stat-row">
      <div className="stat in"><span>Money in</span><b>{money(t.moneyIn)}</b></div>
      <div className="stat out"><span>Money out</span><b>{money(t.moneyOut)}</b></div>
    </div>
    <div className={'stat profit ' + (t.profit >= 0 ? 'pos' : 'neg')}><span>Profit so far</span><b>{sm(t.profit)}</b></div>

    <section className="card mc-owed">
      <div className="card-head"><h2>Who's owed what</h2></div>
      {lines.map((l, i) => <p key={i} className={i ? 'small' : 'mc-big'}>{l}</p>)}
      {pay && <button className="btn orange wide" onClick={() => setAdd({ type: 'transfer', payer: pay.from, to: pay.to, amount: pay.amount.toFixed(2) })}><Icon name="check" size={18} /> {pay.from} has paid {pay.to}: record it</button>}
      {t.unmarked > 0 && <p className="notice small" style={{ marginTop: 10 }}>{t.unmarked} payment{t.unmarked > 1 ? 's aren\'t' : ' isn\'t'} marked B or P yet, so this isn't final. <button className="link-btn" onClick={() => { setFilter('none'); setTab('pay') }}>Mark {t.unmarked > 1 ? 'them' : 'it'}</button></p>}
    </section>

    <CatchUp owners={owners} setQm={setQm} />

    <div className="mc-people">{t.people.map(p => <PersonCard key={p.name} p={p} rel={(p.balance - (t.people.reduce((s, q) => s + q.balance, 0) - p.balance)) / 2} />)}</div>
    <p className="small muted" style={{ margin: '-4px 4px 14px' }}>Profits are split 50/50. There's no business account: these totals add up what's gone in and out of both your accounts.</p>

    <div className="money-actions" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <button className="btn primary" onClick={() => setQm({})}><Icon name="plus" size={20} /> Add money</button>
      <button className="btn white" onClick={() => setAdd({ type: 'transfer' })}><Icon name="check" size={20} /> Settle up</button>
    </div>

    <LatePayers />

    <section className="card">
      <div className="card-head"><h2>By the end of {MONTHS[+f.end.slice(5, 7) - 1]}</h2></div>
      {f.count === 0 ? <p className="muted small">Nothing else due in or out this month.</p> : <>
        <div className="kv"><span>Still to come in</span><b className="pos">+{money(f.coming)}</b></div>
        <div className="kv"><span>Still to go out</span><b className="neg">−{money(f.going)}</b></div>
        <div className="kv"><span>Profit would be</span><b>{sm(f.t.profit)}</b></div>
        <div className="kv"><span>Then</span><b>{settle(f.t.people, money).lines[0]}</b></div>
        <p className="small muted">If every invoice due this month is paid and every repeat payment and bill goes out. Invoices not paid yet aren't set against either of you.</p>
      </>}
      {owed > 0 && <p className="small muted" style={{ marginBottom: 0 }}>{money(owed)} is owed on sent invoices in total.</p>}
    </section>

    <MonthTools owners={owners} business={settings.business} />
  </>
}

// ---------- Catching up ----------

// Payments from before the app, added one at a time as you find them. Each is an ordinary payment marked catchup,
// dated when it was paid, so it counts towards the 50/50 like everything else and can be changed or deleted.
function CatchUp({ owners, setQm }) {
  const [all, setAll] = useState(false)
  const rows = list('money', r => r.data.catchup && num(r.data.amount) > 0).sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''))
  const total = (n, f) => rows.filter(r => f(r.data) && (r.data.cat === 'transfer' ? r.data.payer === n : (r.data.dir === 'in' ? (r.data.against || r.data.payer) : r.data.payer) === n)).reduce((s, r) => s + num(r.data.amount), 0)
  const shown = all ? rows : rows.slice(0, 8)
  return (
    <section className="card mc-catch">
      <div className="card-head"><h2>Catching up</h2>{rows.length > 0 && <span className="pill">{rows.length}</span>}</div>
      <p className="small muted" style={{ marginTop: 0 }}>Add payments from before the app, one at a time, as you find them: materials, tools, vehicle costs, subcontractors, or client money paid to one of you. Each one counts towards the 50/50 from the date it was paid.</p>
      <div className="mc-catch-btns">
        {owners.map(n => <button key={n} className="btn ghost" onClick={() => setQm({ catchup: true, data: { dir: 'out', payer: n, date: '' } })}><Icon name="plus" size={18} /> {n} paid</button>)}
        {owners.map(n => <button key={'in' + n} className="btn ghost" onClick={() => setQm({ catchup: true, data: { dir: 'in', against: n, date: '' } })}><Icon name="plus" size={18} /> Paid to {n}</button>)}
      </div>
      {rows.length > 0 && <>
        <div className="mc-catch-tot">
          {owners.map(n => <div key={n}><b>{n}</b><span>Paid out {money(total(n, d => d.dir === 'out' && d.cat !== 'transfer'))}</span><span>Paid to them {money(total(n, d => d.dir === 'in'))}</span></div>)}
        </div>
        {shown.map(r => {
          const d = r.data, isIn = d.dir === 'in', isT = d.cat === 'transfer'
          const who = isT ? `${d.payer} → ${d.person}` : isIn ? (d.against || d.payer) : d.payer
          return (
            <button key={r.id} className="mc-catch-row" onClick={() => isT ? (confirmDelete(`this payment between you (${money(num(d.amount))})`) && remove(r.id)) : isLocked(d.date) ? alert(lockMsg(d.date)) : setQm({ id: r.id, data: d, job_id: r.job_id })}>
              <span className="small muted nowrap">{shortDate(d.date)}</span>
              <span className="text"><b>{d.desc || whatLabel(d)}</b><span className="small muted">{isT ? 'Paid between you' : whatLabel(d)}{who ? ` · ${who}` : ''}</span></span>
              <span className={'nowrap ' + (isIn ? 'pos' : isT ? '' : 'neg')}>{isIn ? '+' : isT ? '' : '−'}{money(num(d.amount))}</span>
            </button>
          )
        })}
        {rows.length > 8 && <button className="btn ghost wide" style={{ marginTop: 8 }} onClick={() => setAll(a => !a)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button>}
        <p className="small muted" style={{ marginBottom: 0 }}>Tap one to change or delete it.</p>
      </>}
    </section>
  )
}

// ---------- Money in tab ----------

// One payment in: who paid it, whose account it went into, and who it's set against
function MoneyInRow({ it, owners, onEdit }) {
  const locked = isLocked(it.date)
  const set = patch => locked ? alert(lockMsg(it.date)) : update(it.id, patch)
  const opening = it.src === 'opening'
  const open = () => { if (it.job) nav(`/job/${it.job}/money`); else if (it.src === 'genpay') nav('/cashflow'); else if (locked) alert(lockMsg(it.date)); else if (it.src === 'money') onEdit(it.id) }
  const into = owners.includes(it.payer) ? it.payer : ''
  const against = againstOf(it, owners)
  return (
    <div className={'mc-in-row' + (locked ? ' locked' : '')}>
      <div className="mc-in-top">
        <span className="small muted nowrap">{shortDate(it.date)}</span>
        <span className="text tap" onClick={open}><b>{it.desc || 'Money in'}</b><br />
          <span className="small muted">{it.from ? `From ${it.from}` : it.src === 'genpay' ? 'Repeat payment' : opening ? 'Lump sum from before the app' : 'Who paid it: not filled in'}{it.jobName ? ` · ${it.jobName}` : ''}</span></span>
        <span className="nowrap pos">+{money(it.amount)}</span>
      </div>
      <div className="mc-in-who">
        <span>Into</span><PayerToggle disabled={locked || opening} value={into} onChange={p => set({ payer: p })} />
        <span>Set against</span><PayerToggle disabled={locked || opening} value={against} onChange={p => set({ against: p })} />
      </div>
      {into && against && into !== against && <p className="small mc-in-note">Went into {into}'s account, but counts for {against}.</p>}
    </div>
  )
}

function MoneyInTab({ items, owners, onEdit }) {
  const [filter, setFilter] = useState('all')
  const [shown, setShown] = useState(40)
  const ins = items.filter(it => it.kind === 'income')
  const sum = arr => arr.reduce((s, it) => s + it.amount, 0)
  const unmarked = ins.filter(it => !againstOf(it, owners) || !owners.includes(it.payer))
  const rows = filter === 'all' ? ins : filter === 'none' ? unmarked : ins.filter(it => againstOf(it, owners) === filter)
  return <>
    <section className="card">
      <div className="card-head"><h2>Money in</h2><span className="pill">{money(sum(ins))}</span></div>
      {owners.map(n => <div key={n} className="kv"><span>Set against {n}<br /><span className="small muted">Paid into {n}'s account: {money(sum(ins.filter(it => it.payer === n)))}</span></span><b className="pos">{money(sum(ins.filter(it => againstOf(it, owners) === n)))}</b></div>)}
      <p className="small muted" style={{ marginBottom: 0 }}><b>Into</b> is whose bank account the money went into. <b>Set against</b> is who it counts for in who owes who. It starts as the same person, and you can change it.</p>
    </section>
    <section className="card">
      <div className="card-head"><h2>Every payment in</h2><span className="pill">{rows.length}</span></div>
      <div className="chips mc-filters">{[['all', 'All'], ...owners.map(n => [n, `Set against ${n}`]), ['none', `Not marked${unmarked.length ? ` (${unmarked.length})` : ''}`]].map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => { setFilter(k); setShown(40) }}>{l}</button>)}</div>
      {rows.length === 0 && <p className="muted small">{filter === 'none' ? 'Nothing to mark: every payment in is set.' : 'No money in yet.'}</p>}
      {rows.slice(0, shown).map(it => <MoneyInRow key={it.key} it={it} owners={owners} onEdit={onEdit} />)}
      {rows.length > shown && <button className="btn ghost wide" style={{ marginTop: 10 }} onClick={() => setShown(s => s + 60)}>Show more</button>}
      <p className="small muted" style={{ marginBottom: 0 }}>Tap a payment to change it. Payments on a job open that job.</p>
    </section>
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

function PaymentsTab({ items, filter, setFilter, onEdit }) {
  const payers = usePayers()
  const [shown, setShown] = useState(40)
  const noRec = items.filter(needsReceipt).length
  const filters = [['all', 'All'], ...payers.map(p => [p.name, p.name]), ['none', 'Not marked'], ['norec', `No receipt${noRec ? ` (${noRec})` : ''}`], ['in', 'In'], ['out', 'Out']]
  const rows = items.filter(it => filter === 'all' ? true
    : filter === 'none' ? (it.kind === 'income' || it.kind === 'expense') && (!it.payer || it.payer === BIZ)
    : filter === 'norec' ? needsReceipt(it)
    : filter === 'in' ? it.kind === 'income'
    : filter === 'out' ? it.kind !== 'income'
    : it.payer === filter || it.to === filter)
  return <>
    <section className="card">
      <div className="card-head"><h2>Spending by type</h2></div>
      <SpendChart items={items} />
    </section>
    <section className="card">
      <div className="card-head"><h2>Every payment</h2><span className="pill">{rows.length}</span></div>
      <div className="chips mc-filters">{filters.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => { setFilter(k); setShown(40) }}>{l}</button>)}</div>
      <p className="small muted" style={{ marginTop: 0 }}>{filter === 'norec' ? `Payments over £${RECEIPT_OVER} with no receipt photo. Tap one to open its job and add the photo.` : `Tap ${payers.map(p => p.letter).join(' or ')} to mark who paid, or whose account the money went into. Tap a payment to change it (job payments open their job).`}</p>
      {rows.length === 0 && <p className="muted small">Nothing here{filter === 'none' ? ': everything is marked' : ''}.</p>}
      {rows.slice(0, shown).map(it => <ItemRow key={it.key} it={it} onEdit={onEdit} />)}
      {rows.length > shown && <button className="btn ghost wide" style={{ marginTop: 10 }} onClick={() => setShown(s => s + 60)}>Show more</button>}
    </section>
  </>
}

export default function MoneyCentre() {
  const { settings, owners, items, t } = useCentre()
  const [add, setAdd] = useState(null)
  const [tab, setTab] = useState('tally')
  const [filter, setFilter] = useState('all')
  const [qm, setQm] = useState(null)
  const [saved, setSaved] = useState(null)
  const onEdit = id => {
    const r = list('money').find(x => x.id === id); if (!r) return
    if (r.data.cat === 'transfer') { if (confirmDelete(`this payment between you (${money(num(r.data.amount))})`)) remove(id); return }
    setQm({ id, data: r.data, job_id: r.job_id })
  }
  return (
    <div className="page">
      <TopBar title="Money centre" sub="All jobs, car costs and repeat payments" onBack={() => back('/')} />
      <main className="content">
        <div className="seg mc-tabs">
          {[['tally', 'Tally'], ['in', 'Money in'], ['jobs', 'Jobs'], ['tax', 'Tax'], ['pay', 'Payments']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); window.scrollTo(0, 0) }}>{l}</button>)}
        </div>
        {tab === 'tally' && <TallyTab items={items} t={t} owners={owners} settings={settings} setAdd={setAdd} setFilter={setFilter} setTab={setTab} setQm={setQm} />}
        {tab === 'in' && <MoneyInTab items={items} owners={owners} onEdit={onEdit} />}
        {tab === 'jobs' && <JobsTab items={items} owners={owners} />}
        {tab === 'tax' && <TaxTab items={items} owners={owners} settings={settings} />}
        {tab === 'pay' && <PaymentsTab items={items} filter={filter} setFilter={setFilter} onEdit={onEdit} />}
      </main>
      {add && <AddSheet start={add} owners={owners} onClose={() => setAdd(null)} />}
      {qm && <QuickMoney key={qm.id || 'new'} start={qm} onClose={() => setQm(null)} onSaved={setSaved} />}
      <SavedToast saved={saved} onDone={() => setSaved(null)} />
    </div>
  )
}
