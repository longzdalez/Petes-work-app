// One sheet for any money in or out: amount first, then tap the job, type and who paid.
// Opens straight from the home page, so there's no "pick a job, then open its Money page" step.
// Smart defaults: the last job used, this phone's owner as payer, today's date.
import { useEffect, useRef, useState } from 'react'
import { put, remove, list, useList } from './store'
import { Icon, Sheet, Suggest } from './ui'
import { money, num, today, ymd, shortDate, vibrate } from './util'
import { storeFile, pickFile } from './files'
import { readReceipt } from './receipt'
import { PayerToggle } from './Vehicle'
import { isLocked, lockMsg, findDuplicate } from './ledger'
import { jobStatus } from './jobs'

const CATS = {
  in: [['client', 'Client payment'], ['other', 'Other']],
  out: [['materials', 'Materials'], ['contractor', 'Subcontractor'], ['wages', 'Wages'], ['other', 'Misc']],
}
const LAST_JOB = 'pw_qm_job'
const NO_JOB = 'none'
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d) }
const lastJob = () => { try { return localStorage.getItem(LAST_JOB) || '' } catch { return '' } }

// Jobs on the go, the ones with the most recent money first
function useLiveJobs() {
  const jobs = useList('job', r => jobStatus(r.data) !== 'finished')
  const lastUse = {}
  list('money').forEach(m => { if (m.job_id && (m.data.created || '') > (lastUse[m.job_id] || '')) lastUse[m.job_id] = m.data.created })
  return jobs.sort((a, b) => (lastUse[b.id] || b.data.created || '').localeCompare(lastUse[a.id] || a.data.created || ''))
}

// The descriptions used most often, so a repeat payment is one tap
function topDescs(dir) {
  const n = {}
  list('money', m => m.data.dir === dir && m.data.desc).forEach(m => { const k = m.data.desc.trim(); n[k] = (n[k] || 0) + 1 })
  return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k)
}

export default function QuickMoney({ start, onClose, onSaved }) {
  const jobs = useLiveJobs()
  const firstJob = () => { const l = lastJob(); return l === NO_JOB || jobs.some(j => j.id === l) ? l : (jobs[0]?.id || NO_JOB) }
  const blank = () => ({ dir: 'out', cat: 'materials', amount: '', desc: '', person: '', payer: '', date: today(), status: 'paid', job: firstJob(), receipt: null, vat: '' })
  const [d, setD] = useState(() => ({ ...blank(), ...(start?.data || {}) }))
  const [busy, setBusy] = useState('')
  const [read, setRead] = useState('')
  const [more, setMore] = useState(false)
  const amountRef = useRef(null)
  const set = p => setD(x => ({ ...x, ...p }))
  const job = jobs.find(j => j.id === d.job)
  const scan = !!start?.file

  // Read a receipt photo: fills in the amount, VAT, shop and date where it can
  const readFile = async f => {
    setBusy('Saving the photo…')
    const st = await storeFile(f, `${d.job && d.job !== NO_JOB ? d.job : 'general'}/receipts`)
    set({ receipt: { path: st.path, thumb: st.thumb }, dir: 'out' })
    try {
      const r = await readReceipt(f, setBusy)
      setD(x => ({ ...x, amount: x.amount || (r.total ? r.total.toFixed(2) : ''), vat: x.vat || (r.vat ? r.vat.toFixed(2) : ''), desc: x.desc || r.shop || '', date: r.date || x.date }))
      setRead(r.total ? `Read ${money(r.total)}${r.vat ? ` (VAT ${money(r.vat)})` : ''} from the receipt. Check it, pick the job and save.` : "Couldn't read the total. Please type it in.")
    } catch { setRead("Couldn't read the receipt. Please type the amount in.") }
    setBusy('')
  }
  useEffect(() => { if (start?.file) readFile(start.file); else setTimeout(() => amountRef.current?.focus(), 350) }, [])

  const save = again => {
    const amount = num(d.amount)
    if (!amount) { amountRef.current?.focus(); return alert('Please put in an amount') }
    if (!d.payer) return alert(d.dir === 'in' ? 'Tap B or P to say whose account it went into' : 'Tap B or P to say who paid')
    if (isLocked(d.date)) return alert(lockMsg(d.date))
    const desc = d.desc.trim() || (d.dir === 'in' ? (d.cat === 'client' ? 'Client payment' : 'Money in') : CATS.out.find(c => c[0] === d.cat)?.[1] || 'Payment')
    const dup = findDuplicate({ amount, desc, date: d.date })
    if (dup && !confirm(`This looks like a payment already saved: ${dup.data.desc || 'no description'}, ${money(dup.data.amount)} on ${shortDate(dup.data.date)}. Save it anyway?`)) return
    const data = { dir: d.dir, cat: d.cat, amount, desc, date: d.date, status: d.status, payer: d.payer }
    if (d.dir === 'in') { data.against = d.payer; data.person = d.person.trim() || job?.data.client || '' }
    if (d.dir === 'out' && d.cat === 'wages') data.person = d.person || d.payer
    if (d.dir === 'out' && d.cat === 'contractor') data.person = d.person.trim()
    if (d.dir === 'out' && d.receipt) data.receipt = d.receipt
    if (d.dir === 'out' && num(d.vat)) data.vat = num(d.vat)
    const rec = put('money', data, { job_id: d.job === NO_JOB ? null : d.job })
    try { localStorage.setItem(LAST_JOB, d.job) } catch { }
    vibrate(20)
    onSaved && onSaved({ id: rec.id, text: `${d.dir === 'in' ? '+' : '−'}${money(amount)} · ${job ? job.data.name : scan ? 'Miscellaneous' : 'No job'}` })
    if (again) { setD(x => ({ ...blank(), dir: x.dir, cat: x.cat, job: x.job, date: x.date })); setRead(''); setTimeout(() => amountRef.current?.focus(), 50) }
    else onClose()
  }

  const descs = topDescs(d.dir)
  const dateChip = d.date === today() ? 'today' : d.date === yesterday() ? 'yesterday' : 'other'
  return (
    <Sheet open onClose={onClose} title={d.dir === 'in' ? 'Money in' : 'Money out'}>
      <div className="seg">
        <button className={d.dir === 'out' ? 'on out' : ''} onClick={() => set({ dir: 'out', cat: 'materials' })}>Money out</button>
        <button className={d.dir === 'in' ? 'on in' : ''} onClick={() => set({ dir: 'in', cat: 'client', receipt: null })}>Money in</button>
      </div>

      <label className={'qm-amount ' + d.dir}>
        <span>£</span>
        <input ref={amountRef} inputMode="decimal" value={d.amount} placeholder="0.00" aria-label="Amount in pounds" style={{ width: `${Math.max(4, d.amount.length) + 0.5}ch` }}
          onChange={e => set({ amount: e.target.value.replace(/[^\d.,]/g, '') })} onKeyDown={e => e.key === 'Enter' && save(false)} />
      </label>

      <span className="qm-label">Job</span>
      <div className="qm-scroll">
        {scan && <button className={'chip' + (d.job === NO_JOB ? ' on' : '')} onClick={() => set({ job: NO_JOB, cat: 'other' })}>Miscellaneous</button>}
        {jobs.map(j => <button key={j.id} className={'chip' + (d.job === j.id ? ' on' : '')} onClick={() => set({ job: j.id })}>{j.data.name || 'Untitled job'}</button>)}
        {!scan && <button className={'chip' + (d.job === NO_JOB ? ' on' : '')} onClick={() => set({ job: NO_JOB })}>No job</button>}
      </div>

      <span className="qm-label">Type</span>
      <div className="qm-scroll">
        {CATS[d.dir].map(([k, l]) => <button key={k} className={'chip' + (d.cat === k ? ' on' : '')} onClick={() => set({ cat: k })}>{l}</button>)}
      </div>

      <div className="qm-row">
        <label className="field"><span>{d.dir === 'in' ? 'What for?' : d.cat === 'contractor' ? 'Who and what for?' : 'What for?'}</span>
          <input value={d.desc} list="qm-desc" onChange={e => set({ desc: e.target.value })} placeholder={d.dir === 'in' ? 'e.g. Stage payment' : 'e.g. Timber from Jewson'} />
        </label>
        <label className="field qm-who"><span>{d.dir === 'in' ? 'Into' : 'Paid by'}</span><PayerToggle big value={d.payer} onChange={p => set({ payer: p })} /></label>
      </div>
      <Suggest id="qm-desc" values={list('money', m => m.data.dir === d.dir).map(m => m.data.desc)} />
      {descs.length > 0 && !d.desc && <div className="qm-scroll" style={{ marginTop: -6 }}>
        {descs.map(t => <button key={t} className="chip" onClick={() => set({ desc: t })}>{t}</button>)}
      </div>}

      <span className="qm-label">When</span>
      <div className="qm-scroll">
        <button className={'chip' + (dateChip === 'today' ? ' on' : '')} onClick={() => set({ date: today() })}>Today</button>
        <button className={'chip' + (dateChip === 'yesterday' ? ' on' : '')} onClick={() => set({ date: yesterday() })}>Yesterday</button>
        <label className={'chip' + (dateChip === 'other' ? ' on' : '')} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
          {dateChip === 'other' ? shortDate(d.date) : 'Pick a date'}
          <input type="date" value={d.date} onChange={e => e.target.value && set({ date: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0 }} aria-label="Pick a date" />
        </label>
        <button className={'chip' + (d.status === 'upcoming' ? ' on' : '')} onClick={() => set({ status: d.status === 'upcoming' ? 'paid' : 'upcoming' })}>{d.dir === 'in' ? 'Not in yet' : 'Not paid yet'}</button>
      </div>

      {d.dir === 'out' && <button className="qm-photo" disabled={!!busy} onClick={async () => { const [f] = await pickFile({ accept: 'image/*,application/pdf' }); if (f) readFile(f) }}>
        {d.receipt ? <img src={d.receipt.thumb} alt="" /> : <span className="q-badge"><Icon name="receipt" size={20} /></span>}
        <span>{busy || (d.receipt ? 'Receipt added. Tap to swap it' : 'Add the receipt and I\'ll read it')}</span>
      </button>}
      {read && <p className="notice small qm-read">{read}</p>}

      <button className="link-btn" onClick={() => setMore(m => !m)}>{more ? 'Fewer details' : 'More details'}</button>
      {more && <div className="qm-more">
        {d.dir === 'in' && <label className="field"><span>Who paid it?</span><input value={d.person} onChange={e => set({ person: e.target.value })} placeholder={job?.data.client || 'e.g. the client'} /></label>}
        {d.dir === 'out' && d.cat === 'contractor' && <label className="field"><span>Subcontractor's name</span><input value={d.person} onChange={e => set({ person: e.target.value })} /></label>}
        {d.dir === 'out' && <div className="qm-row">
          <label className="field"><span>VAT included £</span><input inputMode="decimal" value={d.vat} onChange={e => set({ vat: e.target.value })} placeholder="0.00" /></label>
          <button className="btn ghost" onClick={() => set({ vat: (num(d.amount) / 6).toFixed(2) })}>20% VAT</button>
        </div>}
      </div>}

      <div className="qm-actions">
        <button className="btn ghost" onClick={() => save(true)}>Save + next</button>
        <button className={'btn ' + (d.dir === 'in' ? 'primary' : 'orange')} onClick={() => save(false)}><Icon name="check" size={20} stroke={2.6} /> Save {num(d.amount) ? money(num(d.amount)) : ''}</button>
      </div>
    </Sheet>
  )
}

// "Saved" message with Undo, shown for a few seconds after a quick save
export function SavedToast({ saved, onDone }) {
  useEffect(() => { if (!saved) return; const t = setTimeout(onDone, 4500); return () => clearTimeout(t) }, [saved])
  if (!saved) return null
  return (
    <div className="qm-done" role="status">
      <span className="tick"><Icon name="check" size={16} stroke={3} /></span>
      <span>Saved {saved.text}</span>
      <button onClick={() => { remove(saved.id); onDone() }}>Undo</button>
    </div>
  )
}
