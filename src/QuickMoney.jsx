// The £ form: one simple sheet for any money in or out, used from the home page, the Money centre
// and for catching up on payments from before the app.
//   Money in:  Payment to Pete / Payment to Brian (client money into their account, set against them in the 50/50)
//   Money out: Subcontractor / Materials / Vehicle / Miscellaneous, each marked B or P for who paid
//   Between you: Pete paid Brian / Brian paid Pete (doesn't count as money in or out of the business)
// Every entry has a description, a date and (optionally) a job.
import { useEffect, useRef, useState } from 'react'
import { put, remove, removeWithUndo, list, useList } from './store'
import { Icon, Sheet, Suggest } from './ui'
import { money, num, today, ymd, shortDate, vibrate } from './util'
import { storeFile, pickFile } from './files'
import { readReceipt } from './receipt'
import { PayerToggle } from './Vehicle'
import { useSettings } from './pages/Settings'
import { isLocked, lockMsg, findDuplicate } from './ledger'
import { jobStatus } from './jobs'
import './money-form.css'

const OUT_OPTIONS = [
  ['contractor', 'Payment to subcontractor', 'Who paid, and who it went to'],
  ['materials', 'Materials payment', 'Timber, blocks, fixings, tools for the job'],
  ['vehicle', 'Vehicle payment', 'Fuel, ULEZ, congestion, repairs, tickets'],
  ['other', 'Miscellaneous', 'Anything else'],
]
const OLD_CATS = { wages: 'Wages', client: 'Client payment', repeat: 'Repeat payment' }
const NO_JOB = 'none'
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d) }

// The choices under "What for?" for money in or out
export function whatOptions(dir, owners) {
  if (dir === 'in') return owners.map(n => [`to:${n}`, `Payment to ${n}`, 'Client money into their account, set against the 50/50'])
  if (dir === 'between') return owners.flatMap(a => owners.filter(b => b !== a).map(b => [`pay:${a}>${b}`, `${a} paid ${b}`, 'Money sent from one of you to the other']))
  return OUT_OPTIONS.map(o => [...o])
}
// The "What for?" label for a saved payment
export function whatLabel(d) {
  if (d.cat === 'transfer') return `${d.payer} paid ${d.person}`
  if (d.dir === 'in') return d.against || d.payer ? `Payment to ${d.against || d.payer}` : 'Money in'
  return OUT_OPTIONS.find(o => o[0] === d.cat)?.[1] || OLD_CATS[d.cat] || 'Money out'
}

// Jobs on the go, the ones with the most recent money first
function useLiveJobs() {
  const jobs = useList('job', r => jobStatus(r.data) !== 'finished')
  const lastUse = {}
  list('money').forEach(m => { if (m.job_id && (m.data.created || '') > (lastUse[m.job_id] || '')) lastUse[m.job_id] = m.data.created })
  return jobs.sort((a, b) => (lastUse[b.id] || b.data.created || '').localeCompare(lastUse[a.id] || a.data.created || ''))
}

// start: { data } to pre-fill, { id, data, job_id } to change a saved payment, { file } to read a receipt, { catchup: true } for an earlier payment
export default function QuickMoney({ start = {}, onClose, onSaved }) {
  const { owners } = useSettings()
  const jobs = useLiveJobs()
  const editing = !!start.id
  const scan = !!start.file
  const [d, setD] = useState(() => {
    const s = start.data || {}
    const dir = s.cat === 'transfer' || s.dir === 'between' ? 'between' : s.dir || 'out'
    const what = dir === 'between' ? (s.payer && s.person ? `pay:${s.payer}>${s.person}` : '')
      : dir === 'in' ? (s.against || s.payer ? `to:${s.against || s.payer}` : '') : (s.cat || '')
    return {
      dir, what, amount: s.amount ? String(s.amount) : '', desc: s.desc || '', payer: dir === 'out' ? (s.payer || '') : '',
      date: s.date === '' && start.catchup ? '' : (s.date || today()), job: start.job_id || NO_JOB, receipt: s.receipt || null, vat: s.vat ? String(s.vat) : '',
    }
  })
  const [picking, setPicking] = useState(!d.what && !scan)
  const [showJobs, setShowJobs] = useState(scan || d.job !== NO_JOB)
  const [busy, setBusy] = useState('')
  const [read, setRead] = useState('')
  const amountRef = useRef(null)
  const set = p => setD(x => ({ ...x, ...p }))
  const job = jobs.find(j => j.id === d.job) || (d.job !== NO_JOB ? list('job').find(j => j.id === d.job) : null)
  const opts = whatOptions(d.dir, owners)
  const chosen = opts.find(o => o[0] === d.what) || (d.what && OLD_CATS[d.what] ? [d.what, OLD_CATS[d.what], ''] : null)
  const isIn = d.dir === 'in'
  const isBetween = d.dir === 'between'
  const isOut = d.dir === 'out'

  // Read a receipt photo: fills in the amount, VAT, shop and date where it can
  const readFile = async f => {
    setBusy('Saving the photo…')
    const st = await storeFile(f, `${d.job !== NO_JOB ? d.job : 'general'}/receipts`)
    set({ receipt: { path: st.path, thumb: st.thumb }, dir: 'out' })
    try {
      const r = await readReceipt(f, setBusy)
      setD(x => ({ ...x, amount: x.amount || (r.total ? r.total.toFixed(2) : ''), vat: x.vat || (r.vat ? r.vat.toFixed(2) : ''), desc: x.desc || r.shop || '', date: r.date || x.date }))
      setRead(r.total ? `Read ${money(r.total)}${r.vat ? ` (VAT ${money(r.vat)})` : ''} from the receipt. Check it, then pick what it was for.` : "Couldn't read the total. Please type it in.")
    } catch { setRead("Couldn't read the receipt. Please type the amount in.") }
    setBusy('')
    setPicking(true)
  }
  useEffect(() => { if (scan) readFile(start.file); else if (!editing) setTimeout(() => amountRef.current?.focus(), 350) }, [])

  const switchDir = dir => { if (dir !== d.dir) { set({ dir, what: '', payer: '', receipt: dir === 'out' ? d.receipt : null, job: dir === 'between' ? NO_JOB : d.job }); setPicking(true) } }
  const pick = k => { set({ what: k }); setPicking(false) }

  const save = again => {
    const amount = num(d.amount)
    if (!amount) { amountRef.current?.focus(); return alert('Please put in an amount') }
    if (!d.what) { setPicking(true); return alert('Please choose what it was for') }
    if (isOut && !d.payer) return alert('Tap B or P to say who paid')
    if (!d.date) return alert('Please pick the date it was paid')
    if (isLocked(d.date)) return alert(lockMsg(d.date))
    const desc = d.desc.trim() || chosen?.[1] || (isIn ? 'Money in' : 'Money out')
    if (!editing && !isBetween) {
      const dup = findDuplicate({ amount, desc, date: d.date })
      if (dup && !confirm(`This looks like a payment already saved: ${dup.data.desc || 'no description'}, ${money(dup.data.amount)} on ${shortDate(dup.data.date)}. Save it anyway?`)) return
    }
    let data
    if (isBetween) {
      const [from, to] = d.what.slice(4).split('>')
      data = { dir: 'out', cat: 'transfer', amount, desc, date: d.date, status: 'paid', payer: from, person: to }
    } else if (isIn) {
      const who = d.what.slice(3)
      data = { dir: 'in', cat: 'client', amount, desc, date: d.date, status: 'paid', payer: who, against: who, person: '' }
    } else {
      data = { dir: 'out', cat: d.what, amount, desc, date: d.date, status: 'paid', payer: d.payer, person: d.what === 'contractor' ? desc : '' }
      if (d.receipt) data.receipt = d.receipt
      if (num(d.vat)) data.vat = num(d.vat)
    }
    if (start.catchup || start.data?.catchup) data.catchup = true
    const job_id = d.job === NO_JOB || isBetween ? null : d.job
    let id = start.id
    if (editing) put('money', { ...data, receipt: data.receipt || null, vat: data.vat || null }, { id: start.id, job_id })
    else id = put('money', data, { job_id }).id
    vibrate(20)
    onSaved && onSaved({ id, undo: !editing, text: `${isIn ? '+' : isBetween ? '' : '−'}${money(amount)} · ${chosen?.[1] || desc}` })
    if (again) { setD(x => ({ ...x, amount: '', desc: '', payer: '', what: x.what, receipt: null, vat: '' })); setRead(''); setTimeout(() => amountRef.current?.focus(), 50) }
    else onClose()
  }
  const del = () => { removeWithUndo(start.id, d.desc || 'Payment'); onClose() }

  const dateChip = !d.date ? '' : d.date === today() ? 'today' : d.date === yesterday() ? 'yesterday' : 'other'
  const title = editing ? 'Change payment' : start.catchup ? 'Earlier payment' : isBetween ? 'Between you' : isIn ? 'Money in' : 'Money out'
  return (
    <Sheet open onClose={onClose} title={title}>
      {start.catchup && !editing && <p className="small muted" style={{ marginTop: 0 }}>A payment from before you used the app. Put in the date it was paid and it counts towards the 50/50 from then.</p>}
      <div className="seg qm-seg3">
        <button className={isOut ? 'on out' : ''} onClick={() => switchDir('out')}>Out</button>
        <button className={isIn ? 'on in' : ''} onClick={() => switchDir('in')}>In</button>
        <button className={isBetween ? 'on' : ''} onClick={() => switchDir('between')}>Between you</button>
      </div>

      <label className={'qm-amount ' + d.dir}>
        <span>£</span>
        <input ref={amountRef} inputMode="decimal" value={d.amount} placeholder="0.00" aria-label="Amount in pounds" style={{ width: `${Math.max(4, d.amount.length) + 0.5}ch` }}
          onChange={e => set({ amount: e.target.value.replace(/[^\d.,]/g, '') })} />
      </label>

      <span className="qm-label">What for?</span>
      {picking || !chosen ? (
        <div className="qm-what-list" role="listbox" aria-label="What for?">
          {opts.map(([k, l, hint]) => (
            <button key={k} role="option" aria-selected={d.what === k} className={'qm-what' + (d.what === k ? ' on' : '') + (isIn ? ' in' : '')} onClick={() => pick(k)}>
              <b>{l}</b><span>{hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className={'qm-what chosen' + (isIn ? ' in' : '')} onClick={() => setPicking(true)}>
          <b>{chosen[1]}</b><span>{chosen[2] || 'Tap to change'}</span><Icon name="down" size={18} />
        </button>
      )}

      {chosen && !picking && <>
        {isOut && <div className="qm-who-row"><span>Who paid?</span><PayerToggle big value={d.payer} onChange={p => set({ payer: p })} /></div>}

        <label className="field"><span>Description</span>
          <input value={d.desc} list="qm-desc" onChange={e => set({ desc: e.target.value })}
            placeholder={isBetween ? 'e.g. Squaring up for October' : isIn ? 'e.g. Stage 2 payment from Mrs Smith' : d.what === 'contractor' ? 'e.g. Dave the plasterer, 2 days' : d.what === 'vehicle' ? 'e.g. Diesel, van' : d.what === 'materials' ? 'e.g. Timber from Jewson' : 'What it was for'} />
        </label>
        <Suggest id="qm-desc" values={list('money', m => m.data.dir === d.dir && (isIn || m.data.cat === d.what)).map(m => m.data.desc)} />

        <span className="qm-label">Date paid</span>
        <div className="qm-scroll">
          <button className={'chip' + (dateChip === 'today' ? ' on' : '')} onClick={() => set({ date: today() })}>Today</button>
          <button className={'chip' + (dateChip === 'yesterday' ? ' on' : '')} onClick={() => set({ date: yesterday() })}>Yesterday</button>
          <label className={'chip' + (dateChip === 'other' ? ' on' : '')} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
            {dateChip === 'other' ? shortDate(d.date) : 'Pick a date'}
            <input type="date" value={d.date} onChange={e => e.target.value && set({ date: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0 }} aria-label="Pick a date" />
          </label>
        </div>

        {isBetween ? null : showJobs ? <>
          <span className="qm-label">Job (optional)</span>
          <div className="qm-scroll">
            <button className={'chip' + (d.job === NO_JOB ? ' on' : '')} onClick={() => set({ job: NO_JOB })}>{scan ? 'Miscellaneous' : 'No job'}</button>
            {jobs.map(j => <button key={j.id} className={'chip' + (d.job === j.id ? ' on' : '')} onClick={() => set({ job: j.id })}>{j.data.name || 'Untitled job'}</button>)}
            {job && !jobs.some(j => j.id === job.id) && <button className="chip on">{job.data.name || 'Untitled job'}</button>}
          </div>
        </> : <button className="link-btn qm-jobs-link" onClick={() => setShowJobs(true)}>Link it to a job (optional)</button>}

        {isOut && <button className="qm-photo" disabled={!!busy} onClick={async () => { const [f] = await pickFile({ accept: 'image/*,application/pdf' }); if (f) readFile(f) }}>
          {d.receipt ? <img src={d.receipt.thumb} alt="" /> : <span className="q-badge"><Icon name="receipt" size={20} /></span>}
          <span>{busy || (d.receipt ? 'Receipt added. Tap to swap it' : 'Add a receipt photo (optional)')}</span>
        </button>}
      </>}
      {busy && picking && <p className="notice small qm-read">{busy}</p>}
      {read && <p className="notice small qm-read">{read}</p>}

      <div className={'qm-actions' + (editing ? ' edit' : '')}>
        {editing ? <button className="btn danger" onClick={del} aria-label="Delete this payment"><Icon name="trash" size={18} /> Delete</button>
          : <button className="btn ghost" onClick={() => save(true)}>Save + next</button>}
        <button className={'btn ' + (isOut ? 'orange' : 'primary')} onClick={() => save(false)}><Icon name="check" size={20} stroke={2.6} /> Save {num(d.amount) ? money(num(d.amount)) : ''}</button>
      </div>
    </Sheet>
  )
}

// "Saved" message with Undo, shown for a few seconds after a save
export function SavedToast({ saved, onDone }) {
  useEffect(() => { if (!saved) return; const t = setTimeout(onDone, 4500); return () => clearTimeout(t) }, [saved])
  if (!saved) return null
  return (
    <div className="qm-done" role="status">
      <span className="tick"><Icon name="check" size={16} stroke={3} /></span>
      <span>Saved {saved.text}</span>
      {saved.undo !== false && <button onClick={() => { remove(saved.id); onDone() }}>Undo</button>}
    </div>
  )
}
