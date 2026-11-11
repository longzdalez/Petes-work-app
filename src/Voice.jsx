import { useEffect, useRef, useState } from 'react'
import { Icon, Sheet, UrgencyDot } from './ui'
import { parseCommand } from './voice'
import { put, list } from './store'
import { niceDate, money, URGENCY } from './util'

const SR = window.SpeechRecognition || window.webkitSpeechRecognition

const KINDS = { todo: 'To-do', material: 'Material', task: 'Schedule', money: 'Money' }

export default function VoiceButton({ jobId }) {
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [cmd, setCmd] = useState(null)
  const [job, setJob] = useState(jobId || '')
  const [done, setDone] = useState('')
  const rec = useRef(null)
  const jobs = list('job').sort((a, b) => (b.data.created || '').localeCompare(a.data.created || ''))

  useEffect(() => { setJob(jobId || jobs[0]?.id || '') }, [jobId, open])
  useEffect(() => { setCmd(text.trim() ? parseCommand(text) : null) }, [text])

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

  const save = () => {
    const c = cmd
    if (!c || !c.text && c.kind !== 'money') return
    if (c.kind === 'todo') put('todo', { text: c.text, date: c.date, done: false })
    if (c.kind === 'task') put('task', { text: c.text, date: c.date, urgency: c.urgency, done: false }, { job_id: job })
    if (c.kind === 'money') put('money', { dir: c.dir, amount: c.amount, desc: c.desc, cat: c.cat, date: new Date().toISOString().slice(0, 10), status: 'paid' }, { job_id: job })
    if (c.kind === 'material') {
      const folders = list('folder', r => r.job_id === job)
      let f = folders.find(x => (x.data.name || '').toLowerCase() === c.folder.toLowerCase())
        || folders.find(x => (x.data.name || '').toLowerCase().includes(c.folder.toLowerCase()) || c.folder.toLowerCase().includes((x.data.name || '~').toLowerCase()))
      if (!f) f = put('folder', { name: c.folder, order: folders.length }, { job_id: job })
      const n = list('material', r => r.data.folder_id === f.id).length
      put('material', { folder_id: f.id, text: c.text, date: c.date, urgency: c.urgency, done: false, order: n }, { job_id: job })
    }
    setDone(`Saved: ${KINDS[c.kind]}`)
    setText('')
  }
  const needsJob = cmd && cmd.kind !== 'todo'
  const setKind = kind => setCmd(c => ({ ...c, kind, folder: c.folder || 'General', date: c.date || new Date().toISOString().slice(0, 10), urgency: c.urgency || (kind === 'task' ? 'green' : ''), dir: c.dir || 'out', amount: c.amount || 0, cat: c.cat || 'other', desc: c.desc || c.text }))

  return (
    <>
      <button className="mic-fab" onClick={start} aria-label="Speak"><Icon name="mic" size={26} /></button>
      <Sheet open={open} onClose={close} title="Say it">
        <div className="voice">
          {SR
            ? <button className={'mic-big' + (listening ? ' on' : '')} onClick={listening ? () => rec.current?.stop() : listen}><Icon name="mic" size={34} /></button>
            : <p className="small muted">Tap the box below, then press the <b>microphone on your keyboard</b> and speak.</p>}
          <p className="small muted">{listening ? 'Listening…' : SR ? 'Tap the microphone and speak, or type below.' : ''}</p>
          <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder='e.g. "Add timber to joinery needed 5th January urgent"' />
          {done && !text && <p className="saved"><Icon name="check" size={18} /> {done}. Say another or close.</p>}
          {cmd && (
            <div className="voice-result">
              <div className="chips">
                {Object.entries(KINDS).map(([k, l]) => <button key={k} className={'chip' + (cmd.kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
              </div>
              <div className="voice-summary">
                {cmd.kind === 'todo' && <>To-do: <b>{cmd.text}</b>{cmd.date && <> on {niceDate(cmd.date, { noYear: true })}</>}</>}
                {cmd.kind === 'material' && <><UrgencyDot value={cmd.urgency} size={14} /> <b>{cmd.text}</b> in <b>{cmd.folder}</b>{cmd.date ? <>, needed {niceDate(cmd.date)}</> : ', no date'}{cmd.urgency && <> ({URGENCY[cmd.urgency].label.toLowerCase()})</>}</>}
                {cmd.kind === 'task' && <><UrgencyDot value={cmd.urgency} size={14} /> <b>{cmd.text}</b> on {niceDate(cmd.date, { weekday: true })}</>}
                {cmd.kind === 'money' && <>Money {cmd.dir}: <b>{money(cmd.amount)}</b> {cmd.desc}</>}
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
            <summary>Things you can say</summary>
            <ul>
              <li>"Add timber to joinery needed 5th January urgent"</li>
              <li>"To do ring the skip company"</li>
              <li>"Schedule first fix electrics on Monday"</li>
              <li>"Received £2000 from client deposit"</li>
              <li>"Spent £350 on timber"</li>
            </ul>
          </details>
        </div>
      </Sheet>
    </>
  )
}
