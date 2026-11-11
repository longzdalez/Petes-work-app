import { useRef, useState, useEffect } from 'react'
import { put, update, remove, removeDeep, useRecord, useList, list } from '../store'
import { Icon, Sheet, Field, Empty, useLongPress, MonthCalendar, UrgencyPicker, UrgencyDot, confirmDelete } from '../ui'
import { JobShell } from './Job'
import { nav } from '../router'
import { niceDate, URGENCY, shortDate } from '../util'

const byOrder = (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0) || a.data.created.localeCompare(b.data.created)

export function materialItems(jobId) {
  const folders = Object.fromEntries(list('folder', r => r.job_id === jobId).map(f => [f.id, f.data.name]))
  return list('material', r => r.job_id === jobId && r.data.date && folders[r.data.folder_id] !== undefined).map(m => ({
    id: m.id, date: m.data.date, text: m.data.text || '(item)', done: m.data.done,
    color: URGENCY[m.data.urgency]?.color, folder: folders[m.data.folder_id], urgency: m.data.urgency, folder_id: m.data.folder_id,
  }))
}

function FolderTile({ folder, count, onLong, jobId }) {
  const lp = useLongPress(() => onLong(folder), () => nav(`/job/${jobId}/folder/${folder.id}`))
  return (
    <div className="folder-tile" {...lp} role="button">
      <div className="folder-icon"><Icon name="folder" size={30} /></div>
      <div className="folder-name">{folder.data.name || 'Untitled'}</div>
      <div className="muted small">{count.open} to get{count.urgent ? ` · ${count.urgent} urgent` : ''}</div>
    </div>
  )
}

function DayList({ date, items, onClose, jobId }) {
  return (
    <Sheet open={!!date} onClose={onClose} title={date ? niceDate(date, { weekday: true }) : ''}>
      {items.length === 0 && <p className="muted">Nothing needed on this day.</p>}
      <ul className="day-list">
        {items.map(it => (
          <li key={it.id} className={it.done ? 'done' : ''} onClick={() => nav(`/job/${jobId}/folder/${it.folder_id}`)}>
            <UrgencyDot value={it.done ? '' : it.urgency} />
            <span className="text">{it.text}</span>
            <span className="muted small">{it.folder}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

export default function Materials({ id }) {
  const job = useRecord(id)
  const folders = useList('folder', r => r.job_id === id, byOrder)
  const mats = useList('material', r => r.job_id === id)
  const [sel, setSel] = useState(null)
  const [big, setBig] = useState(false)
  const [day, setDay] = useState(null)
  const [month, setMonth] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth()] })
  const items = materialItems(id)
  const selF = folders.find(f => f.id === sel)
  const newFolder = () => {
    const name = window.prompt('Name the new folder (e.g. Joinery)')
    if (name === null) return
    put('folder', { name: name.trim() || 'New folder', order: folders.length }, { job_id: id })
  }
  const counts = f => {
    const m = mats.filter(x => x.data.folder_id === f.id && !x.data.done && x.data.text)
    return { open: m.length, urgent: m.filter(x => x.data.urgency === 'red').length }
  }
  return (
    <JobShell job={job} tab="materials" title="Materials">
      <div className="section-head">
        <h2>Folders</h2>
        <button className="btn primary" onClick={newFolder}><Icon name="plus" size={18} /> New folder</button>
      </div>
      {folders.length === 0
        ? <Empty icon="folder" title="No folders yet" text="Make a folder for each trade, like Joinery or Electrics." />
        : <div className="folder-grid">{folders.map(f => <FolderTile key={f.id} folder={f} jobId={id} count={counts(f)} onLong={f => setSel(f.id)} />)}</div>}
      <p className="hint">Hold a folder to rename or delete it.</p>

      <section className="card cal-card">
        <div className="card-head">
          <h2>Materials calendar</h2>
          <button className="icon-btn" onClick={() => setBig(true)} aria-label="Full screen"><Icon name="expand" /></button>
        </div>
        <div onClick={() => setBig(true)}>
          <MonthCalendar compact items={items} month={month} setMonth={setMonth} />
        </div>
        <Upcoming items={items} />
      </section>

      <Sheet open={big} onClose={() => setBig(false)} title="Materials calendar" full>
        <MonthCalendar items={items} month={month} setMonth={setMonth} onDay={setDay} />
        <p className="hint">Swipe left or right to change month. Tap a day to see what's needed.</p>
      </Sheet>
      <DayList date={day} jobId={id} items={items.filter(i => i.date === day)} onClose={() => setDay(null)} />

      {selF && (
        <Sheet open onClose={() => setSel(null)} title="Folder">
          <div className="created">Created {niceDate(selF.data.created)}</div>
          <Field label="Folder name" value={selF.data.name} onChange={v => update(selF.id, { name: v })} />
          <div className="sheet-actions">
            <button className="btn danger" onClick={() => { if (confirmDelete('this folder and its list')) { removeDeep(selF.id); setSel(null) } }}><Icon name="trash" size={18} /> Delete</button>
            <button className="btn primary" onClick={() => setSel(null)}>Done</button>
          </div>
        </Sheet>
      )}
    </JobShell>
  )
}

function Upcoming({ items }) {
  const t = new Date().toISOString().slice(0, 10)
  const up = items.filter(i => !i.done).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  if (!up.length) return null
  return (
    <div className="upcoming">
      <h3>Still to get</h3>
      {up.map(i => (
        <div key={i.id} className="up-row">
          <UrgencyDot value={i.urgency} size={14} />
          <span className="text">{i.text}</span>
          <span className={'small ' + (i.date < t ? 'overdue' : 'muted')}>{shortDate(i.date)}</span>
        </div>
      ))}
    </div>
  )
}

function MaterialRow({ m, autoFocus, onEnter }) {
  const [text, setText] = useState(m.data.text || '')
  const [pick, setPick] = useState(false)
  useEffect(() => setText(m.data.text || ''), [m.data.text])
  const u = URGENCY[m.data.urgency]
  return (
    <div className={'mat-row' + (m.data.done ? ' done' : '')}>
      <button className={'tick' + (m.data.done ? ' on' : '')} onClick={() => update(m.id, { done: !m.data.done })} aria-label="Tick off">
        {m.data.done && <Icon name="check" size={16} stroke={3} />}
      </button>
      <input className="mat-item" value={text} autoFocus={autoFocus} placeholder="Item"
        onChange={e => setText(e.target.value)}
        onBlur={() => text !== (m.data.text || '') && update(m.id, { text })}
        onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); onEnter() } }} />
      <input className="mat-date" type="date" value={m.data.date || ''} onChange={e => update(m.id, { date: e.target.value })} />
      <button className="mat-urg" style={{ background: u && !m.data.done ? u.color : '#fff' }} onClick={() => setPick(true)} aria-label="Urgency">
        {!u && <span className="muted small">–</span>}
      </button>
      <UrgencyPicker open={pick} onClose={() => setPick(false)} value={m.data.urgency} onPick={v => update(m.id, { urgency: v })}>
        <button className="btn danger wide" style={{ marginTop: 10 }} onClick={() => { remove(m.id); setPick(false) }}><Icon name="trash" size={18} /> Delete this item</button>
      </UrgencyPicker>
    </div>
  )
}

export function Folder({ id, fid }) {
  const job = useRecord(id)
  const folder = useRecord(fid)
  const rows = useList('material', r => r.data.folder_id === fid, byOrder)
  const [focusId, setFocusId] = useState(null)
  const add = () => {
    const r = put('material', { folder_id: fid, text: '', date: '', urgency: '', done: false, order: rows.length }, { job_id: id })
    setFocusId(r.id)
  }
  const sorted = [...rows.filter(r => !r.data.done), ...rows.filter(r => r.data.done)]
  return (
    <JobShell job={job} tab="materials" title={folder?.data.name || 'Folder'} onBack={() => nav(`/job/${id}/materials`)}>
      <div className="mat-table card">
        <div className="mat-row head">
          <span className="tick-col" />
          <span>Item</span>
          <span>Date needed</span>
          <span className="urg-col">Urgency</span>
        </div>
        {sorted.map(m => <MaterialRow key={m.id} m={m} autoFocus={m.id === focusId} onEnter={add} />)}
        <button className="add-line" onClick={add}><Icon name="plus" size={18} /> Add item</button>
      </div>
      <p className="hint">Tick an item once it's ordered. Tap the colour box to set how urgent it is, or to delete the item.</p>
    </JobShell>
  )
}
