import { useEffect, useRef, useState } from 'react'
import { Icon, Sheet, UrgencyDot } from './ui'
import { parseInContext } from './voice'
import { put, list, get } from './store'
import { niceDate, money, URGENCY, today } from './util'

const SR = window.SpeechRecognition || window.webkitSpeechRecognition

const KINDS = {
  todo: 'To-do', jobtodo: 'Job to-do', material: 'Material', task: 'Schedule', money: 'Money',
  extra: 'Extra', snag: 'Snag', hours: 'Hours',
}

// What the microphone does on each page: the heading, an example, and which kinds of entry make sense there
const PAGES = {
  home: { title: 'Say it', hint: '"Add timber to joinery needed 5th January urgent"', kinds: ['todo', 'material', 'task', 'money', 'jobtodo'] },
  folder: { title: 'Add to this list', hint: '"Timber 4x2 needed Friday urgent"', kinds: ['material'] },
  materials: { title: 'Add a material', hint: '"Skirting boards needed next week"', kinds: ['material'] },
  schedule: { title: 'Add to the schedule', hint: '"First fix electrics on Monday"', kinds: ['task', 'jobtodo'] },
  money: { title: 'Add money in or out', hint: '"Spent £350 on timber" or "£2000 deposit from the client"', kinds: ['money'] },
  extras: { title: 'Add an extra', hint: '"Move radiator to other wall for £180"', kinds: ['extra'] },
  snags: { title: 'Add a snag', hint: '"Touch up paint on the back door"', kinds: ['snag'] },
  hours: { title: 'Log hours', hint: '"Pete 8 hours today"', kinds: ['hours'] },
  job: { title: 'Add a to-do for this job', hint: '"Call the architect tomorrow"', kinds: ['jobtodo', 'material', 'task', 'money', 'extra', 'snag'] },
}

// ctx: { page, jobId, folderId } from the page that's open
export default function VoiceButton({ ctx }) {
  const page = PAGES[ctx.page] ? ctx.page : ctx.jobId ? 'job' : 'home'
  const cfg = PAGES[page]
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [cmd, setCmd] = useState(null)
  const [job, setJob] = useState(ctx.jobId || '')
  const [done, setDone] = useState('')
  const rec = useRef(null)
  const jobs = list('job').sort((a, b) => (b.data.created || '').localeCompare(a.data.created || ''))
  const folder = ctx.folderId ? get(ctx.folderId) : null

  useEffect(() => { setJob(ctx.jobId || jobs[0]?.id || '') }, [ctx.jobId, open])
  useEffect(() => {
    if (!text.trim()) return setCmd(null)
    let c = parseInContext(page, text)
    // Inside a folder, everything goes into that folder
    if (c.kind === 'material' && folder) c = { ...c, folder: folder.data.name, folderId: folder.id }
    setCmd(c)
  }, [text, page, ctx.folderId])

  const listen = () => {
    if (!SR) return
    try {
      const r = new SR()
      r.lang = 'en-GB'; r.interimResults = true; r.continuous = false
      r.onresult = e => setText([...e.results].map(x => x[0].transcript).join(' '))
      r.onend = () => setListening(false)
      r.onerror = () => setListening(false)
      rec.current = r; r.start(); setListening(true)
    } catch { setListening(false) }
  }
  const start = () => { setText(''); setDone(''); setOpen(true); if (SR) setTimeout(listen, 150) }
  const close = () => { rec.current?.abort?.(); setOpen(false); setListening(false) }

  const findFolder = name => {
    const folders = list('folder', r => r.job_id === job).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
    if (!name) return folders[0] || put('folder', { name: 'General', order: 0 }, { job_id: job })
    const n = name.toLowerCase()
    return folders.find(x => (x.data.name || '').toLowerCase() === n)
      || folders.find(x => (x.data.name || '').toLowerCase().includes(n) || n.includes((x.data.name || '~').toLowerCase()))
      || put('folder', { name, order: folders.length }, { job_id: job })
  }

  const save = () => {
    const c = cmd
    if (!c || (!c.text && !['money', 'hours'].includes(c.kind))) return
    const J = { job_id: job }
    if (c.kind === 'todo') put('todo', { text: c.text, date: c.date || today(), done: false }, { job_id: null })
    if (c.kind === 'jobtodo') put('todo', { text: c.text, date: c.date || today(), done: false }, J)
    if (c.kind === 'task') put('task', { text: c.text, date: c.date || today(), urgency: c.urgency || 'green', done: false }, J)
    if (c.kind === 'money') put('money', { dir: c.dir, amount: c.amount, desc: c.desc, cat: c.cat, date: today(), status: 'paid' }, J)
    if (c.kind === 'extra') put('extra', { text: c.text, location: '', materials: '', labour: c.price ? String(c.price) : '', notes: '', status: 'pending' }, J)
    if (c.kind === 'snag') put('snag', { text: c.text, location: c.location || '', done: false }, J)
    if (c.kind === 'hours') {
      const last = list('hours', r => r.data.person === c.person).sort((a, b) => b.data.created.localeCompare(a.data.created))[0]
      put('hours', { person: c.person || 'Unknown', hours: c.hours, rate: last?.data.rate || 0, date: c.date || today(), notes: '' }, J)
    }
    if (c.kind === 'material') {
      const f = c.folderId ? get(c.folderId) : findFolder(c.folder)
      const n = list('material', r => r.data.folder_id === f.id).length
      put('material', { folder_id: f.id, text: c.text, date: c.date || '', urgency: c.urgency || '', done: false, order: n }, J)
    }
    setDone(`Saved: ${KINDS[c.kind]}`)
    setText('')
  }
  const needsJob = cmd && cmd.kind !== 'todo' && !ctx.jobId
  const setKind = kind => setCmd(c => ({
    ...c, kind, text: c.text || c.desc || c.person || '',
    folder: c.folder || (kind === 'material' && folder ? folder.data.name : ''), date: c.date || today(),
    urgency: c.urgency || (kind === 'task' ? 'green' : ''), dir: c.dir || 'out', amount: c.amount || 0, cat: c.cat || 'other',
    desc: c.desc || c.text, hours: c.hours || 8, person: c.person || '', price: c.price || 0,
  }))
  const kinds = cfg.kinds.includes(cmd?.kind) ? cfg.kinds : [...cfg.kinds, cmd?.kind].filter(Boolean)
  const where = cmd?.kind === 'material' ? (cmd.folder || folder?.data.name || 'the first folder') : ''

  return (
    <>
      <button className="mic-fab" onClick={start} aria-label="Speak"><Icon name="mic" size={26} /></button>
      <Sheet open={open} onClose={close} title={cfg.title}>
        <div className="voice">
          {ctx.jobId && <div className="voice-where"><Icon name="info" size={14} /> {get(ctx.jobId)?.data.name}{folder ? ` › ${folder.data.name}` : ''}</div>}
          {SR
            ? <button className={'mic-big' + (listening ? ' on' : '')} onClick={listening ? () => rec.current?.stop() : listen}><Icon name="mic" size={34} /></button>
            : <p className="small muted">Tap the box below, then press the <b>microphone on your keyboard</b> and speak.</p>}
          <p className="small muted">{listening ? 'Listening…' : SR ? 'Tap the microphone and speak, or type below.' : ''}</p>
          <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={'e.g. ' + cfg.hint} />
          {done && !text && <p className="saved"><Icon name="check" size={18} /> {done}. Say another or close.</p>}
          {cmd && (
            <div className="voice-result">
              {kinds.length > 1 && <div className="chips">
                {kinds.map(k => <button key={k} className={'chip' + (cmd.kind === k ? ' on' : '')} onClick={() => setKind(k)}>{KINDS[k]}</button>)}
              </div>}
              <div className="voice-summary">
                {cmd.kind === 'todo' && <>To-do: <b>{cmd.text}</b>{cmd.date && <> on {niceDate(cmd.date, { noYear: true })}</>}</>}
                {cmd.kind === 'jobtodo' && <>Job to-do: <b>{cmd.text}</b>{cmd.date && <> on {niceDate(cmd.date, { noYear: true })}</>}</>}
                {cmd.kind === 'material' && <><UrgencyDot value={cmd.urgency} size={14} /> <b>{cmd.text}</b> in <b>{where}</b>{cmd.date ? <>, needed {niceDate(cmd.date)}</> : ', no date'}{cmd.urgency && <> ({URGENCY[cmd.urgency].label.toLowerCase()})</>}</>}
                {cmd.kind === 'task' && <><UrgencyDot value={cmd.urgency} size={14} /> <b>{cmd.text}</b> on {niceDate(cmd.date, { weekday: true })}</>}
                {cmd.kind === 'money' && <>Money {cmd.dir}: <b>{money(cmd.amount)}</b> {cmd.desc}</>}
                {cmd.kind === 'extra' && <>Extra: <b>{cmd.text}</b>{cmd.price ? <> for <b>{money(cmd.price)}</b></> : ' (no price yet)'}</>}
                {cmd.kind === 'snag' && <>Snag: <b>{cmd.text}</b>{cmd.location && <> in <b>{cmd.location}</b></>}</>}
                {cmd.kind === 'hours' && <><b>{cmd.person || 'Who?'}</b>: {cmd.hours} hours on {niceDate(cmd.date, { weekday: true, noYear: true })}</>}
              </div>
              {needsJob && (
                <label className="field"><span>Job</span>
                  <select value={job} onChange={e => setJob(e.target.value)}>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.data.name}</option>)}
                  </select>
                </label>
              )}
              <button className="btn primary wide" disabled={needsJob && !job} onClick={save}><Icon name="check" size={18} /> Save</button>
            </div>
          )}
          <details className="voice-help small">
            <summary>Things you can say here</summary>
            <ul>
              <li>{cfg.hint}</li>
              {page === 'home' && <>
                <li>"To do ring the skip company"</li>
                <li>"Schedule first fix electrics on Monday"</li>
                <li>"Received £2000 from client deposit"</li>
              </>}
              {page !== 'home' && <li>Open a different page first to add something else, or pick a different type above.</li>}
            </ul>
          </details>
        </div>
      </Sheet>
    </>
  )
}
