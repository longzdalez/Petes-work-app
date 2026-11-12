import { useState } from 'react'
import { put, update, remove, useRecord, useList, list } from '../store'
import { Icon, Sheet, Field, Empty, confirmDelete, Suggest } from '../ui'
import { JobShell } from './Job'
import { money, num, today, shortDate, niceDate } from '../util'
import { useSettings } from './Settings'
import { storeFile, pickFile, openPath, shareOrDownload } from '../files'
import { invoiceTotals } from '../pdf'
import { readReceipt } from '../receipt'
import { nav } from '../router'

export const cisDeduction = d => d.cat === 'contractor' && num(d.cisRate) ? Math.round(num(d.cisLabour || d.amount) * num(d.cisRate)) / 100 : 0

// Every payment across all jobs, as a spreadsheet file for the accountant (UK tax year by default)
export function accountantCsv(from, to) {
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j.data.name]))
  const rows = list('money', r => r.data.status !== 'upcoming' && r.data.date >= from && r.data.date <= to).sort((a, b) => a.data.date.localeCompare(b.data.date))
  const esc = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
  const head = ['Date', 'Job', 'In/Out', 'Category', 'Paid to/from', 'Description', 'Amount', 'VAT included', 'CIS rate %', 'CIS deducted', 'Receipt photo']
  const body = rows.map(r => { const d = r.data; return [d.date, jobs[r.job_id] || '', d.dir === 'in' ? 'In' : 'Out', catLabel(d.dir, d.cat), d.person || '', d.desc || '', num(d.amount).toFixed(2), num(d.vat).toFixed(2), d.cat === 'contractor' ? num(d.cisRate) : '', cisDeduction(d).toFixed(2), d.receipt ? 'Yes' : ''] })
  const totIn = rows.filter(r => r.data.dir === 'in').reduce((s, r) => s + num(r.data.amount), 0)
  const totOut = rows.filter(r => r.data.dir === 'out').reduce((s, r) => s + num(r.data.amount), 0)
  body.push([], ['', '', '', '', '', 'Total in', totIn.toFixed(2)], ['', '', '', '', '', 'Total out', totOut.toFixed(2)], ['', '', '', '', '', 'Profit', (totIn - totOut).toFixed(2)])
  const csv = [head, ...body].map(r => r.map(esc).join(',')).join('\r\n')
  return { file: new File([csv], `BP Builders accounts ${from} to ${to}.csv`, { type: 'text/csv' }), count: rows.length }
}

const CATS_IN = [{ k: 'client', l: 'Client payment' }, { k: 'other', l: 'Other' }]
const CATS_OUT = [{ k: 'wages', l: 'Proprietor wages' }, { k: 'contractor', l: 'Subcontractor' }, { k: 'materials', l: 'Materials' }, { k: 'other', l: 'Other' }]
const catLabel = (dir, k) => (dir === 'in' ? CATS_IN : CATS_OUT).find(c => c.k === k)?.l || 'Other'
const byDate = (a, b) => (a.data.date || '').localeCompare(b.data.date || '') || a.data.created.localeCompare(b.data.created)

function EntrySheet({ entry, jobId, onClose, owners }) {
  const isNew = !entry.id
  const [d, setD] = useState({ dir: 'in', cat: 'client', date: today(), status: 'paid', amount: '', desc: '', person: '', ...entry.data })
  const set = p => setD(x => ({ ...x, ...p }))
  const [busy, setBusy] = useState(false)
  const [read, setRead] = useState(entry.read || '')
  const cats = d.dir === 'in' ? CATS_IN : CATS_OUT
  const save = () => {
    if (!num(d.amount)) return alert('Please put in an amount')
    const data = { ...d, amount: num(d.amount) }
    if (isNew) put('money', data, { job_id: jobId }); else update(entry.id, data)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? (entry.title || 'Add money') : 'Edit entry'}>
      <div className="seg">
        <button className={d.dir === 'in' ? 'on in' : ''} onClick={() => set({ dir: 'in', cat: 'client' })}>Money in</button>
        <button className={d.dir === 'out' ? 'on out' : ''} onClick={() => set({ dir: 'out', cat: 'materials' })}>Money out</button>
      </div>
      <div className="seg small">
        <button className={d.status === 'paid' ? 'on' : ''} onClick={() => set({ status: 'paid' })}>Paid</button>
        <button className={d.status === 'upcoming' ? 'on' : ''} onClick={() => set({ status: 'upcoming' })}>Upcoming</button>
      </div>
      <div className="two">
        <label className="field"><span>Amount (£)</span><input inputMode="decimal" value={d.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" autoFocus={isNew} /></label>
        <label className="field"><span>Date</span><input type="date" value={d.date} onChange={e => set({ date: e.target.value })} /></label>
      </div>
      <label className="field"><span>Type</span>
        <div className="chips">{cats.map(c => <button key={c.k} className={'chip' + (d.cat === c.k ? ' on' : '')} onClick={() => set({ cat: c.k })}>{c.l}</button>)}</div>
      </label>
      {d.cat === 'wages' && (
        <label className="field"><span>Paid to</span>
          <div className="chips">{owners.map(o => <button key={o} className={'chip' + (d.person === o ? ' on' : '')} onClick={() => set({ person: o })}>{o}</button>)}</div>
        </label>
      )}
      {d.cat === 'contractor' && <label className="field"><span>Subcontractor</span>
        {entry.trades?.length > 0 && <div className="chips" style={{ marginBottom: 8 }}>{entry.trades.map(t => <button key={t} className={'chip' + (d.person === t ? ' on' : '')} onClick={() => set({ person: t })}>{t}</button>)}</div>}
        <input value={d.person} onChange={e => set({ person: e.target.value })} placeholder="Name" /></label>}
      <label className="field"><span>What was it for?</span><input value={d.desc} list="money-sugg" onChange={e => set({ desc: e.target.value })} placeholder={d.dir === 'in' ? 'e.g. Deposit' : 'e.g. Timber from Jewson'} /></label>
      <Suggest id="money-sugg" values={list('money').map(m => m.data.desc)} />
      {d.dir === 'out' && <>
        <button className="receipt-pick" onClick={async () => {
          if (d.receipt) return openPath(d.receipt.path)
          const [f] = await pickFile({ accept: 'image/*,application/pdf' }); if (!f) return
          setBusy('Saving…'); const st = await storeFile(f, `${jobId}/receipts`); set({ receipt: { path: st.path, thumb: st.thumb } })
          try {
            const r = await readReceipt(f, setBusy)
            setD(x => ({ ...x, amount: x.amount || (r.total ? r.total.toFixed(2) : ''), vat: x.vat || (r.vat ? r.vat.toFixed(2) : ''), desc: x.desc || r.shop, date: r.date || x.date }))
            setRead(r.total ? `Read from the receipt: total ${money(r.total)}${r.vat ? `, VAT ${money(r.vat)}` : ', no VAT found'}. Please check.` : "Couldn't read the total. Please type it in.")
          } catch (e) { setRead("Couldn't read the receipt. Please type the amount in.") }
          setBusy(false)
        }}>
          {d.receipt ? <img src={d.receipt.thumb} alt="" /> : <Icon name="receipt" />}
          <span>{busy || (d.receipt ? 'Receipt saved (tap to view)' : 'Add a receipt (photo, gallery or PDF) and I\'ll read it')}</span>
        </button>
        {read && <p className="notice small" style={{ marginTop: -4 }}>{read}</p>}
        {d.receipt && <button className="btn ghost small" style={{ marginTop: -6, marginBottom: 12 }} onClick={() => set({ receipt: null })}>Remove receipt</button>}
        <div className="two">
          <label className="field"><span>VAT included £</span><input inputMode="decimal" value={d.vat || ''} onChange={e => set({ vat: e.target.value })} placeholder="0.00" /></label>
          <button className="btn ghost" style={{ marginTop: 24 }} onClick={() => set({ vat: (num(d.amount) / 6).toFixed(2) })}>Standard 20% VAT</button>
        </div>
      </>}
      {d.cat === 'contractor' && <div className="cis-box">
        <b>CIS deduction</b> (for subcontractors under the Construction Industry Scheme)
        <div className="chips" style={{ margin: '8px 0' }}>{[0, 20, 30].map(r => <button key={r} className={'chip' + (num(d.cisRate) === r ? ' on' : '')} onClick={() => set({ cisRate: r })}>{r ? r + '%' : 'None'}</button>)}</div>
        {num(d.cisRate) > 0 && <>
          <label className="field" style={{ marginBottom: 6 }}><span>Labour part of the bill £ (CIS isn't taken off materials)</span><input inputMode="decimal" value={d.cisLabour ?? ''} placeholder={String(num(d.amount) || '')} onChange={e => set({ cisLabour: e.target.value })} /></label>
          <div>Deduct <b>{money(cisDeduction({ ...d, amount: num(d.amount) }))}</b> for HMRC, so pay them <b>{money(num(d.amount) - cisDeduction({ ...d, amount: num(d.amount) }))}</b>.</div>
        </>}
      </div>}
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { if (confirmDelete('this entry')) { remove(entry.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        {!isNew && d.status === 'upcoming' && <button className="btn ghost" onClick={() => { update(entry.id, { ...d, amount: num(d.amount), status: 'paid', date: today() }); onClose() }}>Mark paid today</button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const gbp = v => (v < 0 ? '−£' : '£') + Math.abs(Math.round(v)).toLocaleString('en-GB')

// Cash flow: the job's balance over time (paid so far, then what's coming), or money in and out each month
function CashFlow({ paid, upcoming }) {
  const [view, setView] = useState(() => localStorage.getItem('pw_cf') || 'line')
  const [tip, setTip] = useState(null)
  const pick = v => { setView(v); setTip(null); localStorage.setItem('pw_cf', v) }
  if (!paid.length && !upcoming.length) return <p className="muted small">Add some money in or out and the cash flow graph shows here.</p>
  const W = 340, H = 180, P = { l: 50, r: 12, t: 14, b: 28 }
  let chart
  if (view === 'line') {
    const pts = []; let bal = 0
    paid.forEach(e => { bal += e.data.dir === 'in' ? num(e.data.amount) : -num(e.data.amount); pts.push({ date: e.data.date, bal, e, future: false }) })
    const nowBal = bal
    upcoming.forEach(e => { bal += e.data.dir === 'in' ? num(e.data.amount) : -num(e.data.amount); pts.push({ date: e.data.date, bal, e, future: true }) })
    if (!pts.length) return null
    const all = [{ date: pts[0].date, bal: 0 }, ...pts]
    const vals = all.map(p => p.bal)
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1
    const x = i => P.l + (i * (W - P.l - P.r)) / Math.max(1, all.length - 1)
    const y = v => P.t + ((hi - v) * (H - P.t - P.b)) / span
    const split = all.findIndex(p => p.future)
    const path = (a, b) => { let d = `M${x(a)},${y(all[a].bal)}`; for (let i = a + 1; i <= b; i++) d += ` H${x(i)} V${y(all[i].bal)}`; return d }
    const lastPaid = split === -1 ? all.length - 1 : split - 1
    const area = path(0, lastPaid) + ` V${y(0)} H${x(0)} Z`
    chart = <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cash flow">
      <defs><linearGradient id="cfg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b9268" stopOpacity=".28" /><stop offset="1" stopColor="#3b9268" stopOpacity="0" /></linearGradient></defs>
      {[hi, (hi + lo) / 2, lo].map((t, i) => <g key={i}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e3ece6" /><text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6a7d73">{gbp(t)}</text></g>)}
      {lo < 0 && <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="#9fb3a8" strokeDasharray="3 3" />}
      <path d={area} fill="url(#cfg)" />
      <path d={path(0, lastPaid)} fill="none" stroke="#2f7a57" strokeWidth="2.5" />
      {split !== -1 && <path d={path(Math.max(0, split - 1), all.length - 1)} fill="none" stroke="#ff8a3d" strokeWidth="2.5" strokeDasharray="5 4" />}
      {all.map((p, i) => i > 0 && <g key={i}>
        <circle cx={x(i)} cy={y(p.bal)} r={tip === i ? 6 : 3.5} fill={p.future ? '#ff8a3d' : '#2f7a57'} stroke="#fff" strokeWidth="1.5" />
        <rect x={x(i) - 10} y={P.t} width="20" height={H - P.t - P.b} fill="transparent" onClick={() => setTip(tip === i ? null : i)} />
      </g>)}
      <text x={P.l} y={H - 8} fontSize="10" fill="#6a7d73">{shortDate(all[0].date)}</text>
      <text x={W - P.r} y={H - 8} textAnchor="end" fontSize="10" fill="#6a7d73">{shortDate(all[all.length - 1].date)}</text>
    </svg>
    const t = tip != null ? all[tip] : null
    var tipText = t ? <><b>{t.e.data.desc || catLabel(t.e.data.dir, t.e.data.cat)}</b> <span className={t.e.data.dir === 'in' ? 'pos' : 'neg'}>{t.e.data.dir === 'in' ? '+' : '−'}{money(t.e.data.amount)}</span> {t.future ? 'due' : 'on'} {niceDate(t.date, { noYear: true })}, balance <b>{money(t.bal)}</b></>
      : <span className="muted"><span className="key g" /> paid so far ({money(nowBal)}) {upcoming.length > 0 && <><span className="key o" /> what's coming ({money(bal)})</>}. Tap a dot for details.</span>
  } else {
    const m = {}
    const add = (e, future) => { const k = (e.data.date || today()).slice(0, 7); m[k] ||= { in: 0, out: 0, future: true }; m[k][e.data.dir] += num(e.data.amount); if (!future) m[k].future = false }
    paid.forEach(e => add(e, false)); upcoming.forEach(e => add(e, true))
    const keys = Object.keys(m).sort().slice(-8)
    const hi = Math.max(1, ...keys.flatMap(k => [m[k].in, m[k].out]))
    const bw = (W - P.l - P.r) / keys.length
    const y = v => P.t + ((hi - v) * (H - P.t - P.b)) / hi
    chart = <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Money in and out each month">
      {[hi, hi / 2, 0].map((t, i) => <g key={i}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e3ece6" /><text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6a7d73">{gbp(t)}</text></g>)}
      {keys.map((k, i) => { const v = m[k], x0 = P.l + i * bw, w = Math.min(18, bw / 2 - 4); return <g key={k} opacity={v.future ? .5 : 1} onClick={() => setTip(tip === i ? null : i)}>
        <rect x={x0 + bw / 2 - w - 1} y={y(v.in)} width={w} height={H - P.b - y(v.in)} rx="4" fill="#3b9268" />
        <rect x={x0 + bw / 2 + 1} y={y(v.out)} width={w} height={H - P.b - y(v.out)} rx="4" fill="#ff8a3d" />
        <rect x={x0} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
        <text x={x0 + bw / 2} y={H - 9} textAnchor="middle" fontSize="10" fill="#6a7d73">{MONTHS[+k.slice(5) - 1]}</text>
      </g> })}
    </svg>
    const k = tip != null ? keys[tip] : null
    var tipText = k ? <><b>{MONTHS[+k.slice(5) - 1]} {k.slice(0, 4)}</b>: in <span className="pos">{money(m[k].in)}</span>, out <span className="neg">{money(m[k].out)}</span>, so <b>{money(m[k].in - m[k].out)}</b>{m[k].future ? ' (expected)' : ''}</>
      : <span className="muted"><span className="key g" /> money in <span className="key o" /> money out. Faded bars are still to come. Tap a month for details.</span>
  }
  return <>
    <div className="seg small" style={{ marginBottom: 8 }}>
      <button className={view === 'line' ? 'on' : ''} onClick={() => pick('line')}>Balance</button>
      <button className={view === 'bars' ? 'on' : ''} onClick={() => pick('bars')}>In and out</button>
    </div>
    <div className="chart-wrap">{chart}<div className="chart-tip">{tipText}</div></div>
  </>
}

// A box of payments to people (owners or subcontractors), with a total per person and an Add button
function PeoplePayments({ title, hint, rows, onAdd, onOpen, people }) {
  const by = {}
  rows.forEach(e => { const n = e.data.person || 'Not named'; by[n] = (by[n] || 0) + num(e.data.amount) })
  people.forEach(p => { by[p] ??= 0 })
  const total = rows.reduce((s, e) => s + num(e.data.amount), 0)
  return (
    <section className="card">
      <div className="card-head"><h2>{title}</h2><button className="btn primary small" onClick={onAdd}><Icon name="plus" size={16} /> Add</button></div>
      {Object.keys(by).length === 0 && <p className="muted small">{hint}</p>}
      {Object.entries(by).map(([n, v]) => <div key={n} className="kv"><span>{n}</span><b>{money(v)}</b></div>)}
      {rows.length > 0 && <details className="pay-list"><summary className="small">Each payment ({rows.length})</summary>
        {[...rows].reverse().map(e => (
          <div key={e.id} className="up-row tap" onClick={() => onOpen(e)}>
            <span className="small muted nowrap">{shortDate(e.data.date)}</span>
            <span className="text">{e.data.person || 'Not named'}{e.data.desc && <span className="muted small"> · {e.data.desc}</span>}</span>
            <span className="nowrap neg">−{money(e.data.amount)}</span>
          </div>
        ))}
      </details>}
      <div className="kv grand"><span>Total</span><b>{money(total)}</b></div>
    </section>
  )
}

export default function Money({ id }) {
  const job = useRecord(id)
  const settings = useSettings()
  const owners = settings.owners
  const entries = useList('money', r => r.job_id === id, byDate)
  const trades = useList('trade', r => r.job_id === id)
  const [edit, setEdit] = useState(null)
  const [scanAsk, setScanAsk] = useState(false)
  const [scanning, setScanning] = useState('')
  // A receipt from the camera, the gallery or a downloaded PDF: read the total and VAT, then open a filled-in entry to check and save
  const scan = async camera => {
    setScanAsk(false)
    const [f] = await pickFile(camera ? { accept: 'image/*', capture: 'environment' } : { accept: 'image/*,application/pdf' }); if (!f) return
    setScanning('Saving…')
    const st = await storeFile(f, `${id}/receipts`)
    let r = {}
    try { r = await readReceipt(f, setScanning) } catch { }
    setScanning('')
    setEdit({
      title: 'Check the receipt',
      data: { dir: 'out', cat: 'materials', status: 'paid', amount: r.total ? r.total.toFixed(2) : '', vat: r.vat ? r.vat.toFixed(2) : '', desc: r.shop || '', date: r.date || today(), receipt: { path: st.path, thumb: st.thumb } },
      read: r.total ? `Read from the receipt: total ${money(r.total)}${r.vat ? `, VAT ${money(r.vat)}` : ', no VAT found'}. Please check it's right, then Save.` : "Couldn't read the total on this one. Please type it in.",
    })
  }
  const paid = entries.filter(e => e.data.status !== 'upcoming')
  const invs = useList('invoice', r => r.job_id === id && r.data.type === 'invoice' && r.data.status !== 'paid' && r.data.due)
  const upcoming = [...entries.filter(e => e.data.status === 'upcoming'),
    ...invs.map(i => ({ id: i.id, invoice: true, data: { dir: 'in', amount: invoiceTotals(i.data).total, date: i.data.due, desc: `Invoice ${i.data.number}${i.data.status === 'draft' ? ' (not sent yet)' : ''}`, cat: 'client' } }))]
    .filter(e => e.data.amount).sort((a, b) => a.data.date.localeCompare(b.data.date))
  const toPay = upcoming.filter(e => e.data.dir === 'out')
  const comingIn = upcoming.filter(e => e.data.dir === 'in')
  const sum = arr => arr.reduce((s, e) => s + (Number(e.data.amount) || 0), 0)
  const moneyIn = sum(paid.filter(e => e.data.dir === 'in'))
  const outs = paid.filter(e => e.data.dir === 'out')
  const moneyOut = sum(outs)
  const profit = moneyIn - moneyOut
  const wages = outs.filter(e => e.data.cat === 'wages')
  const subs = outs.filter(e => e.data.cat === 'contractor')
  const other = [{ l: 'Materials', v: sum(outs.filter(e => e.data.cat === 'materials')) }, { l: 'Other', v: sum(outs.filter(e => e.data.cat === 'other' || !e.data.cat)) }]
  const markPaid = e => {
    if (!confirm(`Mark "${e.data.desc || 'this invoice'}" (${money(e.data.amount)}) as paid today?`)) return
    update(e.id, { status: 'paid', date: today() })
  }
  let running = 0
  return (
    <JobShell job={job} tab="money" title="Money">
      <div className="stat-row">
        <div className="stat in"><span>Money in</span><b>{money(moneyIn)}</b></div>
        <div className="stat out"><span>Money out</span><b>{money(moneyOut)}</b></div>
      </div>
      <div className={'stat profit ' + (profit >= 0 ? 'pos' : 'neg')}><span>Profit so far</span><b>{money(profit)}</b></div>

      <div className="money-actions">
        <button className="btn primary" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Add money</button>
        <button className="btn orange" disabled={!!scanning} onClick={() => setScanAsk(true)}><Icon name="receipt" size={20} /> {scanning ? 'Reading…' : 'Scan receipt'}</button>
        <button className="btn white" onClick={() => setEdit({ title: 'Add a payment', data: { dir: 'out', cat: 'other', status: 'paid' } })}><Icon name="money" size={20} /> Payment</button>
      </div>
      <p className="small muted" style={{ margin: '-4px 0 12px', textAlign: 'center' }}>Use <b>Payment</b> for money spent when there's no receipt.</p>
      {scanning && <p className="notice small" style={{ marginTop: -4 }}>{scanning} The first scan takes a little longer while the reader loads.</p>}

      <section className="card">
        <div className="card-head"><h2>Invoices to pay</h2></div>
        {toPay.length === 0
          ? <p className="muted small">Bills you still need to pay. Use Add money, choose Money out and Upcoming, and it shows here. Tick it when it's paid.</p>
          : toPay.map(e => (
            <div key={e.id} className="up-row">
              <button className="tick" onClick={() => markPaid(e)} aria-label="Mark paid" />
              <span className="text tap" onClick={() => setEdit(e)}>{e.data.desc || catLabel(e.data.dir, e.data.cat)}<br /><span className={'small ' + (e.data.date < today() ? 'neg' : 'muted')}>Due {shortDate(e.data.date)}</span></span>
              <span className="nowrap neg">{money(e.data.amount)}</span>
            </div>
          ))}
      </section>

      {comingIn.length > 0 && <section className="card">
        <div className="card-head"><h2>Money coming in</h2></div>
        {comingIn.map(e => (
          <div key={e.id} className="up-row tap" onClick={() => e.invoice ? nav(`/job/${id}/invoice/${e.id}`) : setEdit(e)}>
            <span className="small nowrap muted">{shortDate(e.data.date)}</span>
            <span className="text">{e.data.desc || catLabel(e.data.dir, e.data.cat)}</span>
            <span className="nowrap pos">+{money(e.data.amount)}</span>
          </div>
        ))}
      </section>}

      <section className="card">
        <div className="card-head"><h2>Payments</h2></div>
        {paid.length === 0 ? <p className="muted small">No payments yet.</p> : (
          <table className="ledger">
            <thead><tr><th>Date</th><th>Item</th><th className="r">Amount</th><th className="r">Balance</th></tr></thead>
            <tbody>{paid.map(e => {
              running += e.data.dir === 'in' ? e.data.amount : -e.data.amount
              return (
                <tr key={e.id} onClick={() => setEdit(e)}>
                  <td className="nowrap">{shortDate(e.data.date)}</td>
                  <td><div>{e.data.desc || catLabel(e.data.dir, e.data.cat)}{e.data.receipt && <Icon name="receipt" size={13} style={{ marginLeft: 4, color: '#3b9268' }} />}</div><div className="muted small">{catLabel(e.data.dir, e.data.cat)}{e.data.person ? ` · ${e.data.person}` : ''}</div></td>
                  <td className={'r nowrap ' + (e.data.dir === 'in' ? 'pos' : 'neg')}>{e.data.dir === 'in' ? '+' : '−'}{money(e.data.amount)}</td>
                  <td className="r nowrap">{money(running)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </section>

      <PeoplePayments title="Proprietor payments" people={owners} rows={wages} hint="Wages paid to the owners."
        onAdd={() => setEdit({ title: 'Proprietor payment', data: { dir: 'out', cat: 'wages', status: 'paid', person: owners[0] || '' } })} onOpen={setEdit} />
      <PeoplePayments title="Subcontractor payments" people={[]} rows={subs} hint="Tap Add to record a payment to a subcontractor. It goes into the payments list above too."
        onAdd={() => setEdit({ title: 'Subcontractor payment', trades: trades.map(t => t.data.name), data: { dir: 'out', cat: 'contractor', status: 'paid' } })} onOpen={setEdit} />

      <section className="card">
        <div className="card-head"><h2>All money out on this job</h2></div>
        <div className="kv"><span>Proprietors</span><b>{money(sum(wages))}</b></div>
        <div className="kv"><span>Subcontractors</span><b>{money(sum(subs))}</b></div>
        {other.map(b => <div key={b.l} className="kv"><span>{b.l}</span><b>{money(b.v)}</b></div>)}
        <div className="kv grand"><span>Total paid out</span><b>{money(moneyOut)}</b></div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Cash flow</h2></div>
        <CashFlow paid={paid} upcoming={upcoming} />
      </section>

      {scanAsk && <Sheet open onClose={() => setScanAsk(false)} title="Scan a receipt">
        <button className="btn orange wide big" onClick={() => scan(true)}><Icon name="camera" size={20} /> Take a photo</button>
        <button className="btn ghost wide big" style={{ marginTop: 10 }} onClick={() => scan(false)}><Icon name="folder" size={20} /> From gallery or files</button>
        <p className="small muted">Choose a photo you've already taken, or a receipt or invoice you've downloaded (PDF).</p>
      </Sheet>}
      {edit && <EntrySheet entry={edit} jobId={id} owners={owners} onClose={() => setEdit(null)} />}
    </JobShell>
  )
}
