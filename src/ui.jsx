import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DAYS, MONTHS, URGENCY, monthGrid, today, ymd, vibrate } from './util'

const PATHS = {
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  docs: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  materials: 'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4',
  money: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  schedule: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  invoice: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4',
  info: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  check: 'M5 12l5 5L20 7',
  close: 'M18 6L6 18M6 6l12 12',
  share: 'M4 12v8h16v-8M12 3v13M7 8l5-5 5 5',
  download: 'M12 3v13M7 11l5 5 5-5M4 21h16',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
  cloud: 'M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  extra: 'M12 2l3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.5l-5-5 7-1z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z',
  snag: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM8 8h8M8 12h8M8 16h5',
}
export function Icon({ name, size = 22, stroke = 2, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

// Press-and-hold handler. Returns props to spread onto an element.
export function useLongPress(onLong, onTap, ms = 500) {
  const t = useRef(null), fired = useRef(false), start = useRef(null)
  const clear = () => { clearTimeout(t.current); t.current = null }
  return {
    onPointerDown: e => {
      fired.current = false; start.current = [e.clientX, e.clientY]
      t.current = setTimeout(() => { fired.current = true; vibrate(25); onLong && onLong(e) }, ms)
    },
    onPointerMove: e => {
      if (!start.current) return
      if (Math.abs(e.clientX - start.current[0]) > 10 || Math.abs(e.clientY - start.current[1]) > 10) clear()
    },
    onPointerUp: () => { if (t.current) { clear(); if (!fired.current && onTap) onTap() } start.current = null },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: e => e.preventDefault(),
  }
}

export function TopBar({ title, sub, onBack, right }) {
  return (
    <header className="topbar">
      {onBack && <button className="icon-btn" onClick={onBack} aria-label="Back"><Icon name="back" size={26} /></button>}
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  )
}

// Bottom sheet popup (drawn on top of the page; touches inside it don't reach the page behind)
const stop = e => e.stopPropagation()
export function Sheet({ open, onClose, title, children, full }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onClick={e => { e.stopPropagation(); onClose() }}
      onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop} onPointerDown={stop} onPointerUp={stop} onPointerMove={stop}>
      <div className={'sheet' + (full ? ' full' : '')} onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

// A labelled input that saves when you leave it (or as you type when live)
export function Field({ label, value, onChange, type = 'text', placeholder, multiline, inputMode, live = true, list }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const commit = val => { if ((val ?? '') !== (value ?? '')) onChange(val) }
  const props = {
    value: v, placeholder, inputMode, list,
    onChange: e => { setV(e.target.value); if (live && type === 'date') commit(e.target.value) },
    onBlur: e => commit(e.target.value),
  }
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? <textarea rows={3} {...props} /> : <input type={type} {...props} />}
    </label>
  )
}

export function UrgencyDot({ value, size = 18 }) {
  const u = URGENCY[value]
  return <span className="dot" style={{ width: size, height: size, background: u ? u.color : '#fff', borderColor: u ? u.color : '#c9d1dc' }} />
}

export function UrgencyPicker({ open, onClose, value, onPick, children }) {
  return (
    <Sheet open={open} onClose={onClose} title="How urgent?">
      <div className="urgency-row">
        {Object.entries(URGENCY).map(([k, u]) => (
          <button key={k} className={'urgency-btn' + (value === k ? ' on' : '')} style={{ background: u.color }} onClick={() => { onPick(k); onClose() }}>
            {u.label}
          </button>
        ))}
      </div>
      <button className="btn ghost wide" onClick={() => { onPick(''); onClose() }}>Clear colour</button>
      {children}
    </Sheet>
  )
}

export function Empty({ icon, title, text, action }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon"><Icon name={icon} size={34} /></div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Fab({ onClick, label = 'Add', icon = 'plus' }) {
  return <button className="fab" onClick={onClick} aria-label={label}><Icon name={icon} size={26} stroke={2.5} /><span>{label}</span></button>
}

export function confirmDelete(what) { return window.confirm(`Delete ${what}? This can't be undone.`) }

// Month calendar. items: [{date, text, color, done}] ; onDay(dateStr)
export function MonthCalendar({ items = [], onDay, range, compact, month, setMonth }) {
  const [own, setOwn] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth()] })
  const [y, m] = month || own
  const set = setMonth || setOwn
  const go = delta => { const d = new Date(y, m + delta, 1); set([d.getFullYear(), d.getMonth()]) }
  const touch = useRef(null)
  const days = monthGrid(y, m)
  const t = today()
  const byDate = {}
  items.forEach(it => { if (it.date) (byDate[it.date] ||= []).push(it) })
  const maxShow = compact ? 2 : 4
  return (
    <div className={'cal' + (compact ? ' compact' : '')}
      onTouchStart={e => { touch.current = [e.touches[0].clientX, e.touches[0].clientY] }}
      onTouchEnd={e => {
        if (!touch.current) return
        const dx = e.changedTouches[0].clientX - touch.current[0]
        const dy = e.changedTouches[0].clientY - touch.current[1]
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? -1 : 1) // swipe right = previous month
        touch.current = null
      }}>
      <div className="cal-head">
        <button className="icon-btn" onClick={e => { e.stopPropagation(); go(-1) }} aria-label="Previous month"><Icon name="left" /></button>
        <div className="cal-title">{MONTHS[m]} {y}</div>
        <button className="icon-btn" onClick={e => { e.stopPropagation(); go(1) }} aria-label="Next month"><Icon name="right" /></button>
      </div>
      <div className="cal-grid">
        {DAYS.map(d => <div key={d} className="cal-dow">{compact ? d[0] : d}</div>)}
        {days.map(d => {
          const ds = ymd(d)
          const its = byDate[ds] || []
          const inRange = range && range[0] && ds >= range[0] && ds <= (range[1] || range[0])
          const cls = ['cal-day', d.getMonth() !== m && 'other', ds === t && 'today', inRange && 'in-range',
            range && ds === range[0] && 'range-start', range && ds === range[1] && 'range-end'].filter(Boolean).join(' ')
          return (
            <div key={ds} className={cls} onClick={onDay ? e => { e.stopPropagation(); onDay(ds) } : undefined}>
              <div className="cal-num">{d.getDate()}</div>
              <div className="cal-items">
                {its.slice(0, maxShow).map((it, i) => (
                  <div key={i} className={'cal-item' + (it.done ? ' done' : '')}
                    style={it.done ? undefined : { background: it.color || '#e8edf4', color: it.color ? '#fff' : '#33415c' }}>{it.text}</div>
                ))}
                {its.length > maxShow && <div className="cal-more">+{its.length - maxShow}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Ask for a name (replaces the plain browser prompt)
export function PromptSheet({ open, title, label, initial = '', placeholder, onSave, onClose, children, saveLabel = 'Save' }) {
  const [v, setV] = useState(initial)
  useEffect(() => { if (open) setV(initial) }, [open])
  if (!open) return null
  const go = () => { onSave(v.trim()); onClose() }
  return (
    <Sheet open onClose={onClose} title={title}>
      <label className="field"><span>{label}</span>
        <input autoFocus value={v} placeholder={placeholder} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
      </label>
      {children}
      <button className="btn primary wide big" onClick={go}>{saveLabel}</button>
    </Sheet>
  )
}

// Swipe right to tick, swipe left to show delete
export function SwipeRow({ onTick, onDelete, children, className = '' }) {
  const start = useRef(null)
  const [dx, setDx] = useState(0)
  const [open, setOpen] = useState(false)
  const end = () => {
    if (dx > 70 && onTick) { vibrate(); onTick() }
    if (dx < -60 && onDelete) setOpen(true)
    else if (dx > -10) setOpen(false)
    setDx(0); start.current = null
  }
  return (
    <div className={'swipe ' + className}>
      <div className="swipe-bg tick-bg"><Icon name="check" size={20} stroke={3} /></div>
      {onDelete && <button className="swipe-bg del-bg" onClick={() => { setOpen(false); onDelete() }}><Icon name="trash" size={20} /> Delete</button>}
      <div className="swipe-front" style={{ transform: open || dx ? `translateX(${open ? -96 : dx}px)` : undefined, transition: start.current ? 'none' : 'transform .2s' }}
        onTouchStart={e => { start.current = [e.touches[0].clientX, e.touches[0].clientY, false] }}
        onTouchMove={e => {
          if (!start.current) return
          const x = e.touches[0].clientX - start.current[0], y = e.touches[0].clientY - start.current[1]
          if (!start.current[2] && Math.abs(y) > Math.abs(x)) { start.current = null; return }
          if (Math.abs(x) > 8) start.current[2] = true
          if (start.current[2]) setDx(Math.max(onDelete ? -110 : 0, Math.min(onTick ? 110 : 0, x + (open ? -96 : 0))))
        }}
        onTouchEnd={end} onClick={() => open && setOpen(false)}>
        {children}
      </div>
    </div>
  )
}

// Finger signature box. onChange gets a PNG data URL.
export function SignaturePad({ onDone, onCancel, who = 'Client' }) {
  const c = useRef(), drawing = useRef(false), drew = useRef(false)
  const [name, setName] = useState('')
  useEffect(() => {
    const cv = c.current, r = cv.getBoundingClientRect()
    cv.width = r.width * 2; cv.height = r.height * 2
    const ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1d3b2c'
  }, [])
  const pos = e => { const r = c.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  return (
    <div className="sig">
      <label className="field"><span>{who} name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" /></label>
      <span className="field-label">Sign below with a finger</span>
      <canvas ref={c} className="sig-pad"
        onPointerDown={e => { drawing.current = true; const ctx = c.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)); c.current.setPointerCapture(e.pointerId) }}
        onPointerMove={e => { if (!drawing.current) return; const ctx = c.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke(); drew.current = true }}
        onPointerUp={() => { drawing.current = false }} />
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => { const cv = c.current; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); drew.current = false }}>Clear</button>
        {onCancel && <button className="btn ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn primary" onClick={() => {
          if (!drew.current) return alert('Please sign in the box first')
          if (!name.trim()) return alert('Please type the name too')
          onDone({ signature: c.current.toDataURL('image/png'), name: name.trim(), at: new Date().toISOString() })
        }}>Confirm signature</button>
      </div>
    </div>
  )
}

// <datalist> of things typed before, for suggestions as you type
export function Suggest({ id, values }) {
  const uniq = [...new Set(values.filter(Boolean).map(v => String(v).trim()))].slice(0, 200)
  return <datalist id={id}>{uniq.map(v => <option key={v} value={v} />)}</datalist>
}

export function Toast({ text }) { return text ? <div className="toast">{text}</div> : null }

// BP Builders logo: a roof over the letters, in the app's greens with an orange chimney
export function Logo({ big }) {
  return (
    <div className={'logo' + (big ? ' big' : '')}>
      <svg className="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e6f4ec" /></linearGradient></defs>
        <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#lg)" />
        <rect x="31" y="9" width="5" height="9" rx="1.5" fill="#ff9f55" />
        <path d="M8 23 L24 10 L40 23" fill="none" stroke="#2f7a57" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="24" y="38" textAnchor="middle" fontFamily="Nunito, system-ui, sans-serif" fontWeight="900" fontSize="15" fill="#2f7a57" letterSpacing="0.5">BP</text>
      </svg>
      <div className="logo-text">
        <span className="logo-name">BP <b>Builders</b></span>
        {!big && <span className="logo-sub">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
        {big && <span className="logo-sub">Jobs, materials, money and invoices</span>}
      </div>
    </div>
  )
}
