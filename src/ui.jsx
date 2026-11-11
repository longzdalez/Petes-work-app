import { useEffect, useRef, useState } from 'react'
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

// Bottom sheet popup
export function Sheet({ open, onClose, title, children, full }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={'sheet' + (full ? ' full' : '')} onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

// A labelled input that saves when you leave it (or as you type when live)
export function Field({ label, value, onChange, type = 'text', placeholder, multiline, inputMode, live = true }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const commit = val => { if ((val ?? '') !== (value ?? '')) onChange(val) }
  const props = {
    value: v, placeholder, inputMode,
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
