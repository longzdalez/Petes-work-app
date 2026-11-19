// The on-screen pop-up for a to-do reminder that has come due while the app is open
import { useEffect, useState } from 'react'
import { Icon } from './ui'
import { update } from './store'
import { nav } from './router'
import { onPopups, dismissPopup, snoozePopup } from './reminders'
import './alarm.css'

// A soft two-note chime, bing then bong, played once when a reminder pops up
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const tone = (freq, at, len) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + at + len + 0.05)
    }
    tone(880, 0, 0.5)    // bing
    tone(587.33, 0.35, 0.9) // bong
    setTimeout(() => ctx.close(), 2000)
  } catch { }
}

export default function AlarmPopup() {
  const [queue, setQueue] = useState([])
  useEffect(() => onPopups(setQueue), [])
  const cur = queue[0]
  useEffect(() => { if (cur) chime() }, [cur?.id])
  if (!cur) return null
  const todoId = cur.id.split('@')[0]
  const later = () => snoozePopup(cur.id)
  const done = () => { update(todoId, { done: true }); dismissPopup(cur.id) }
  const open = () => { dismissPopup(cur.id); nav(cur.url.replace(/^#/, '')) }
  return (
    <div className="alarm-scrim" role="alertdialog" aria-modal="true" aria-labelledby="alarm-title">
      <div className="alarm-box">
        <div className="alarm-ic"><Icon name="check" size={28} /></div>
        <h2 id="alarm-title">{cur.title.replace(/^Reminder: /, '')}</h2>
        <p className="alarm-body">{cur.body}</p>
        <div className="alarm-acts">
          <button className="btn ghost" onClick={later}>Later</button>
          <button className="btn ghost" onClick={open}>Open</button>
          <button className="btn primary" onClick={done}>Done</button>
        </div>
        {queue.length > 1 && <p className="small muted" style={{ margin: '10px 0 0', textAlign: 'center' }}>{queue.length - 1} more reminder{queue.length > 2 ? 's' : ''} to come</p>}
      </div>
    </div>
  )
}
