// Phone notifications for urgent things due within 2 days.
// Shown when the app is opened, and (on Android Chrome, installed app) by a daily background check.
import { list, subscribe } from './store'
import { today, parseYmd, ymd, shortDate } from './util'

const LS_ON = 'pw_notify'
const LS_SENT = 'pw_notified'
export const remindersOn = () => localStorage.getItem(LS_ON) === '1' && 'Notification' in window && Notification.permission === 'granted'
export const canNotify = () => 'Notification' in window && 'serviceWorker' in navigator

export function dueReminders() {
  const t = today()
  const d2 = (() => { const d = parseYmd(t); d.setDate(d.getDate() + 2); return ymd(d) })()
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j]))
  const live = r => !r.job_id || (jobs[r.job_id] && jobs[r.job_id].data.status !== 'finished')
  const soon = r => r.data.urgency === 'red' && !r.data.done && r.data.date && r.data.date <= d2 && live(r)
  const name = r => r.job_id ? jobs[r.job_id]?.data.name + ': ' : ''
  const out = []
  const folders = Object.fromEntries(list('folder').map(f => [f.id, f]))
  list('material', r => soon(r) && folders[r.data.folder_id] && r.data.text).forEach(r => out.push({ id: r.id + r.data.date, title: `Urgent: order ${r.data.text}`, body: `${name(r)}needed ${shortDate(r.data.date)}`, due: r.data.date, url: `#/job/${r.job_id}/folder/${r.data.folder_id}` }))
  list('todo', r => soon(r) && r.data.text).forEach(r => out.push({ id: r.id + r.data.date, title: `Urgent to-do: ${r.data.text}`, body: `${name(r)}${shortDate(r.data.date)}${r.data.time ? ' at ' + r.data.time : ''}`, due: r.data.date, url: r.job_id ? `#/job/${r.job_id}/todos` : '#/' }))
  list('task', r => soon(r) && r.data.text).forEach(r => out.push({ id: r.id + r.data.date, title: `Urgent: ${r.data.text}`, body: `${name(r)}planned for ${shortDate(r.data.date)}`, due: r.data.date, url: `#/job/${r.job_id}/schedule` }))
  return out
}

// Keep a copy where the background check can see it
function saveForBackground(items) {
  try {
    const q = indexedDB.open('pete-reminders', 1)
    q.onupgradeneeded = () => q.result.createObjectStore('kv')
    q.onsuccess = () => { const tx = q.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(items, 'due') }
  } catch { }
}

async function show(items) {
  if (!remindersOn() || !items.length) return
  const sent = JSON.parse(localStorage.getItem(LS_SENT) || '{}')
  const reg = await navigator.serviceWorker?.ready.catch(() => null)
  for (const it of items) {
    if (sent[it.id]) continue
    try {
      if (reg) await reg.showNotification(it.title, { body: it.body, tag: it.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: it.url } })
      else new Notification(it.title, { body: it.body, tag: it.id })
      sent[it.id] = Date.now()
    } catch { }
  }
  localStorage.setItem(LS_SENT, JSON.stringify(sent))
}

export function checkReminders() {
  const items = dueReminders()
  saveForBackground(items)
  show(items)
}

export async function enableReminders() {
  if (!canNotify()) throw new Error("This phone's browser doesn't support reminders")
  const p = await Notification.requestPermission()
  if (p !== 'granted') throw new Error('Notifications were blocked. You can allow them in your phone settings for this app.')
  localStorage.setItem(LS_ON, '1')
  try {
    const reg = await navigator.serviceWorker.ready
    if (reg.periodicSync) await reg.periodicSync.register('reminders', { minInterval: 6 * 3600 * 1000 })
  } catch { }
  checkReminders()
}
export function disableReminders() { localStorage.setItem(LS_ON, '0') }

export function startReminders() {
  let t = null
  subscribe(() => { clearTimeout(t); t = setTimeout(checkReminders, 2000) })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkReminders())
  setTimeout(checkReminders, 1500)
}
