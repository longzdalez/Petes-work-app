// Money plan: a planning space for money as it comes in. Split each payment into materials, subcontractors and
// builder's profit, see what's left over, and a weekly forecast of what's due out. Nothing here changes the real
// figures or who owes who: real payments are still put in with the £ button.
import { useState } from 'react'
import { put, update, remove, list, useVersion } from './store'
import { Icon, Sheet, confirmDelete } from './ui'
import { money, num, today, shortDate, parseYmd, ymd } from './util'
import { jobStatus } from './jobs'
import './money-plan.css'

const r2 = n => Math.round(n * 100) / 100
let seq = 0
const lineId = () => `pl${Date.now().toString(36)}${seq++}`
const amt = e => e.target.value.replace(/[^\d.,]/g, '')
const POTS = { materials: 'Materials', sub: 'Subcontractors' }

// Monday of the week a date falls in
const weekStart = s => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d) }
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d) }

export function planTotals(d) {
  const lines = d.lines || []
  const mat = r2(lines.filter(l => l.pot === 'materials').reduce((s, l) => s + num(l.amount), 0))
  const sub = r2(lines.filter(l => l.pot === 'sub').reduce((s, l) => s + num(l.amount), 0))
  const profit = r2(num(d.profit))
  const amount = r2(num(d.amount))
  return { amount, mat, sub, profit, left: r2(amount - mat - sub - profit) }
}

// ---------- The pop-up for one plan ----------

function PlanSheet({ start, owners, onClose }) {
  const [a, b] = owners
  const jobs = list('job', j => jobStatus(j.data) !== 'finished' || j.id === start.job_id).sort((x, y) => (x.data.name || '').localeCompare(y.data.name || ''))
  const [job, setJob] = useState(start.job_id || '')
  const [d, setD] = useState(() => {
    const s = start.data || {}
    return { amount: s.amount ?? '', date: s.date || today(), into: s.into || b || a, desc: s.desc || '', profit: s.profit ?? '', profitShared: !!s.profitShared,
      lines: (s.lines || []).map(l => ({ ...l, amount: l.amount === '' ? '' : String(l.amount) })) }
  })
  const [focus, setFocus] = useState(null)
  const set = p => setD(x => ({ ...x, ...p }))
  const setL = (id, p) => setD(x => ({ ...x, lines: x.lines.map(l => l.id === id ? { ...l, ...p } : l) }))
  const add = pot => { const l = { id: lineId(), pot, desc: '', amount: '', due: '', paid: false }; setD(x => ({ ...x, lines: [...x.lines, l] })); setFocus(l.id) }
  const t = planTotals(d)
  const half = r2(t.profit / 2)
  const j = jobs.find(x => x.id === job)

  // Fill from the job: share out this payment in the same proportions as the job's own costs (or its quote)
  const fillFromJob = () => {
    if (!j) return
    const amount = num(d.amount)
    if (!amount) return alert('Put in the amount coming in first')
    const jd = j.data, worth = num(jd.value)
    if (!worth) return alert('This job has no value yet. Put the job value in on the job first.')
    const ratio = Math.min(1, amount / worth)
    const costs = Array.isArray(jd.refCosts) ? jd.refCosts : []
    let lines
    if (costs.length) {
      lines = costs.filter(c => num(c.amount) > 0).map(c => ({ id: lineId(), pot: c.kind === 'labour' ? 'sub' : 'materials', desc: c.desc || (c.kind === 'labour' ? 'Labour' : 'Materials'), amount: String(r2(num(c.amount) * ratio)), due: '', paid: false }))
    } else {
      const m = r2(num(jd.valueMaterials) * ratio)
      lines = m ? [{ id: lineId(), pot: 'materials', desc: 'Materials', amount: String(m), due: '', paid: false }] : []
    }
    if (d.lines.some(l => num(l.amount)) && !confirm('Replace the lines already in this plan?')) return
    const used = lines.reduce((s, l) => s + num(l.amount), 0)
    set({ lines, profit: costs.length ? String(Math.max(0, r2(amount - used))) : d.profit })
  }

  const save = () => {
    if (!num(d.amount)) return alert('Please put in the amount coming in')
    const lines = d.lines.filter(l => l.desc.trim() || num(l.amount)).map(l => ({ id: l.id, pot: l.pot, desc: l.desc.trim(), amount: num(l.amount), due: l.due || '', paid: !!l.paid }))
    put('plan', { ...d, amount: num(d.amount), profit: num(d.profit), desc: d.desc.trim(), lines }, { ...(start.id ? { id: start.id } : {}), job_id: job || null })
    onClose()
  }

  const pot = (pot, hint) => (
    <div className="mp-pot" key={pot}>
      <div className="mp-pot-head"><b>{POTS[pot]}</b><span>{money(pot === 'materials' ? t.mat : t.sub)}</span></div>
      {d.lines.filter(l => l.pot === pot).map(l => (
        <div key={l.id} className="mp-line">
          <div className="mp-line-top">
            <input className="mp-in" value={l.desc} placeholder={hint} autoFocus={focus === l.id} aria-label="What it's for" onChange={e => setL(l.id, { desc: e.target.value })} />
            <label className="ml-amt-in mp-amt"><span>£</span><input inputMode="decimal" value={l.amount} placeholder="0.00" aria-label="Amount in pounds" onChange={e => setL(l.id, { amount: amt(e) })} /></label>
            <button className="icon-btn" aria-label="Remove this line" onClick={() => setD(x => ({ ...x, lines: x.lines.filter(y => y.id !== l.id) }))}><Icon name="close" size={18} /></button>
          </div>
          <label className="mp-due"><span>Due</span><input type="date" value={l.due || ''} onChange={e => setL(l.id, { due: e.target.value })} />
            <button className={'mp-paid' + (l.paid ? ' on' : '')} onClick={() => setL(l.id, { paid: !l.paid })}>{l.paid ? <><Icon name="check" size={14} stroke={3} /> Paid</> : 'Not paid'}</button></label>
        </div>
      ))}
      <button className="add-line" onClick={() => add(pot)}><Icon name="plus" size={18} /> Add {pot === 'materials' ? 'materials' : 'a trade'}</button>
    </div>
  )

  return (
    <Sheet open onClose={onClose} title={start.id ? 'Change plan' : 'Plan a payment'} full>
      <label className="qm-amount"><span>£</span><input inputMode="decimal" value={d.amount} placeholder="0.00" autoFocus={!start.id} aria-label="Amount coming in" style={{ width: `${Math.max(4, String(d.amount).length) + 0.5}ch` }} onChange={e => set({ amount: amt(e) })} /></label>
      <p className="small muted mp-sub">Coming in</p>
      <label className="field"><span>Job (optional)</span>
        <select value={job} onChange={e => setJob(e.target.value)}>
          <option value="">Not for one job</option>
          {jobs.map(x => <option key={x.id} value={x.id}>{x.data.name || 'Job'}</option>)}
        </select>
      </label>
      {j && <button className="link-btn mp-fill" onClick={fillFromJob}><Icon name="copy" size={16} /> Fill in from the job's {Array.isArray(j.data.refCosts) && j.data.refCosts.length ? 'costs' : 'quote'}</button>}
      <div className="two">
        <label className="field"><span>Expected</span><input type="date" value={d.date} onChange={e => e.target.value && set({ date: e.target.value })} /></label>
        <label className="field"><span>Going into</span>
          <div className="seg small" style={{ margin: 0 }}>{owners.map(n => <button key={n} className={d.into === n ? 'on' : ''} onClick={() => set({ into: n })}>{n}</button>)}</div>
        </label>
      </div>
      <label className="field"><span>Note (optional)</span><input value={d.desc} onChange={e => set({ desc: e.target.value })} placeholder="e.g. Second stage payment" /></label>

      {pot('materials', 'e.g. Timber')}
      {pot('sub', 'e.g. Sparky')}

      <div className="mp-pot">
        <div className="mp-pot-head"><b>Builder's profit</b><span>{money(t.profit)}</span></div>
        <div className="mp-line-top">
          <label className="ml-amt-in mp-amt wide"><span>£</span><input inputMode="decimal" value={d.profit} placeholder="0.00" aria-label="Builder's profit in pounds" onChange={e => set({ profit: amt(e) })} /></label>
          {t.left > 0 && <button className="btn ghost small" onClick={() => set({ profit: String(r2(t.profit + t.left)) })}>Add what's left</button>}
        </div>
        {t.profit > 0 && <p className="mp-split">{owners.map(n => `${n} ${money(half)}`).join(' · ')}</p>}
        {t.profit > 0 && <button className={'mp-paid' + (d.profitShared ? ' on' : '')} onClick={() => set({ profitShared: !d.profitShared })}>{d.profitShared ? <><Icon name="check" size={14} stroke={3} /> Profit shared out</> : 'Profit not shared out yet'}</button>}
      </div>

      <div className={'mp-left' + (t.left < -0.004 ? ' over' : '')}><span>{t.left < -0.004 ? 'Over by' : 'Left over'}</span><b>{money(Math.abs(t.left))}</b></div>
      {t.left < -0.004 && <p className="small neg" style={{ marginTop: -6 }}>You've planned more than is coming in.</p>}
      <p className="small muted">Just a plan. It doesn't change the real figures. Put real payments in with the £ button as usual.</p>
      <div className="sheet-actions">
        {start.id && <button className="btn danger" onClick={() => { if (confirmDelete('this plan')) { remove(start.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save plan</button>
      </div>
    </Sheet>
  )
}

// ---------- The card in the Money centre ----------

export function MoneyPlanCard({ owners }) {
  useVersion()
  const [edit, setEdit] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const [a, b] = owners
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j.data.name || 'Job']))
  const plans = list('plan').sort((x, y) => (y.data.date || '').localeCompare(x.data.date || ''))
  const isDone = p => { const t = planTotals(p.data); return (p.data.lines || []).every(l => l.paid) && (!t.profit || p.data.profitShared) }
  const open = plans.filter(p => !isDone(p)), done = plans.filter(isDone)

  // Weekly forecast: everything planned to go out that isn't ticked as paid
  const wk = weekStart(today()), next = addDays(wk, 7), after = addDays(wk, 14)
  const due = []
  plans.forEach(p => (p.data.lines || []).filter(l => !l.paid && num(l.amount) > 0).forEach(l => due.push({ ...l, plan: p, job: jobs[p.job_id] || '', from: p.data.into })))
  const groups = [
    ['This week', due.filter(x => x.due && x.due < next)],
    ['Next week', due.filter(x => x.due >= next && x.due < after)],
    ['Later', due.filter(x => x.due >= after)],
    ['No date yet', due.filter(x => !x.due)],
  ].filter(([, xs]) => xs.length)
  groups.forEach(([, xs]) => xs.sort((p, q) => (p.due || '').localeCompare(q.due || '')))

  // Profit shares one of you is holding for the other
  const holding = {}
  plans.filter(p => !p.data.profitShared && num(p.data.profit) > 0).forEach(p => {
    const other = owners.find(n => n !== p.data.into)
    if (other) { const k = `${p.data.into}>${other}`; holding[k] = (holding[k] || 0) + num(p.data.profit) / 2 }
  })
  const tick = (p, id) => update(p.id, { lines: p.data.lines.map(l => l.id === id ? { ...l, paid: !l.paid } : l) })
  const sumOf = xs => xs.reduce((s, x) => s + num(x.amount), 0)

  const PlanRow = ({ p }) => {
    const t = planTotals(p.data)
    return (
      <button className={'mp-row' + (isDone(p) ? ' done' : '')} onClick={() => setEdit({ id: p.id, data: p.data, job_id: p.job_id })}>
        <span className="ml-date">{shortDate(p.data.date)}</span>
        <span className="ml-text"><b>{jobs[p.job_id] || p.data.desc || 'Payment'}</b>
          <span>{[`Into ${p.data.into}`, t.mat && `Materials ${money(t.mat)}`, t.sub && `Trades ${money(t.sub)}`, t.profit && `Profit ${money(t.profit)}`].filter(Boolean).join(' · ')}</span>
          <span className={t.left < -0.004 ? 'neg' : ''}>{t.left < -0.004 ? `Over by ${money(-t.left)}` : `Left over ${money(t.left)}`}</span></span>
        <span className="ml-amt">{money(t.amount)}</span>
      </button>
    )
  }

  return (
    <section className="card mp-card">
      <div className="card-head"><h2>Money plan</h2><button className="btn primary small" onClick={() => setEdit({})}><Icon name="plus" size={16} /> Plan a payment</button></div>
      <p className="small muted" style={{ marginTop: 0 }}>Split money as it comes in: materials, trades and your profit. Just a plan, it doesn't change the real figures.</p>

      {groups.length > 0 && <div className="mp-weeks">
        {groups.map(([label, xs]) => (
          <div key={label} className="mp-week">
            <div className="mp-week-head"><b>{label}</b><span>{money(sumOf(xs))}</span></div>
            {xs.map(x => (
              <div key={x.id} className="mp-due-row">
                <button className="tick" onClick={() => tick(x.plan, x.id)} aria-label="Tick when paid" />
                <span className="ml-text"><b>{x.desc || POTS[x.pot]}</b><span>{[POTS[x.pot], x.job, x.due && shortDate(x.due), `from ${x.from}`].filter(Boolean).join(' · ')}</span></span>
                <span className="ml-amt">{money(num(x.amount))}</span>
              </div>
            ))}
          </div>
        ))}
      </div>}
      {Object.entries(holding).map(([k, v]) => { const [h, o] = k.split('>'); return <p key={k} className="mp-hold">{h}'s holding {o}'s {money(v)} profit share</p> })}

      {open.map(p => <PlanRow key={p.id} p={p} />)}
      {plans.length === 0 && <p className="small muted" style={{ margin: '4px 0 0' }}>Nothing planned yet. When a payment's coming in, tap Plan a payment to split it up.</p>}
      {done.length > 0 && <button className="link-btn" style={{ marginTop: 8 }} onClick={() => setShowDone(s => !s)}>{showDone ? 'Hide finished plans' : `Show finished plans (${done.length})`}</button>}
      {showDone && done.map(p => <PlanRow key={p.id} p={p} />)}
      {edit && <PlanSheet start={edit} owners={owners.length ? owners : [a, b].filter(Boolean)} onClose={() => setEdit(null)} />}
    </section>
  )
}
