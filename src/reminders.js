// Phone notifications: urgent things due within 2 days, and to-do reminders at the time picked (data.remind = 'YYYY-MM-DDTHH:MM').
// Shown when the app is open (to-do reminders right on time), and on Android Chrome (installed app) by a background check
// that runs a few times a day at most. A web app can't wake a phone at an exact time when it's fully closed.
import { list, subscribe } from './store'
import { today, parseYmd, ymd, shortDate } from './util'

const LS_ON = 'pw_notify'
const LS_SENT = 'pw_notified'
export const remindersOn = () => localStorage.getItem(LS_ON) === '1' && 'Notification' in window && Notification.permission === 'granted'
export const canNotify = () => 'Notification' in window && 'serviceWorker' in navigator

// Local date and time as 'YYYY-MM-DDTHH:MM', the same shape as a to-do's reminder
export const nowLocal = () => { const d = new Date(); return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const atMs = s => new Date(s).getTime()
export const niceRemind = s => s ? `${shortDate(s.slice(0, 10))} at ${s.slice(11, 16)}` : ''
const remindTodos = () => list('todo', r => r.data.remind && !r.data.done && r.data.text)
const remindItem = (r, jobs) => ({ id: `${r.id}@${r.data.remind}`, title: `Reminder: ${r.data.text}`, body: `${r.job_id && jobs[r.job_id] ? jobs[r.job_id].data.name + ': ' : ''}${niceRemind(r.data.remind)}`, url: r.job_id ? `#/job/${r.job_id}/todos` : '#/', alarm: true, at: atMs(r.data.remind) })

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
  remindTodos().filter(r => r.data.remind <= nowLocal()).forEach(r => out.push(remindItem(r, jobs)))
  list('task', r => soon(r) && r.data.text).forEach(r => out.push({ id: r.id + r.data.date, title: `Urgent: ${r.data.text}`, body: `${name(r)}planned for ${shortDate(r.data.date)}`, due: r.data.date, url: `#/job/${r.job_id}/schedule` }))
  return out
}

// On-screen pop-ups for to-do reminders that come due while the app is open (a web app can't put a pop-up over a locked phone)
const LS_POP = 'pw_popped'
let popQueue = []
const popListeners = new Set()
const emitPops = () => popListeners.forEach(f => f(popQueue))
export function onPopups(fn) { popListeners.add(fn); fn(popQueue); return () => popListeners.delete(fn) }
export function dismissPopup(id) { popQueue = popQueue.filter(p => p.id !== id); emitPops() }
// Later: show it again in a little while, while the app stays open
export function snoozePopup(id, ms = 10 * 60 * 1000) {
  const popped = JSON.parse(localStorage.getItem(LS_POP) || '{}')
  delete popped[id]
  localStorage.setItem(LS_POP, JSON.stringify(popped))
  dismissPopup(id)
  setTimeout(() => checkReminders(), ms)
}
function popAlarms(items) {
  if (document.visibilityState !== 'visible') return
  const popped = JSON.parse(localStorage.getItem(LS_POP) || '{}')
  const fresh = items.filter(it => it.alarm && !popped[it.id] && !popQueue.some(p => p.id === it.id))
  if (!fresh.length) return
  fresh.forEach(it => { popped[it.id] = Date.now() })
  localStorage.setItem(LS_POP, JSON.stringify(popped))
  popQueue = [...popQueue, ...fresh]
  emitPops()
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
      // To-do reminders give one gentle buzz; the pop-up in the app plays a soft chime
      const alarm = it.alarm ? { vibrate: [120, 80, 120] } : {}
      if (reg) await reg.showNotification(it.title, { body: it.body, tag: it.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: it.url }, ...alarm })
      else new Notification(it.title, { body: it.body, tag: it.id })
      sent[it.id] = Date.now()
    } catch { }
  }
  localStorage.setItem(LS_SENT, JSON.stringify(sent))
}

// While the app is open, wake up exactly when the next to-do reminder is due
let timer = null
function scheduleNext() {
  clearTimeout(timer)
  const now = Date.now()
  const next = remindTodos().map(r => atMs(r.data.remind)).filter(t => t > now).sort((a, b) => a - b)[0]
  if (next) timer = setTimeout(checkReminders, Math.min(next - now + 500, 6 * 3600 * 1000))
}

export function checkReminders() {
  const items = dueReminders()
  // The background check also gets the to-do reminders still to come, and shows each one once its time has passed
  const jobs = Object.fromEntries(list('job').map(j => [j.id, j]))
  const later = remindTodos().filter(r => r.data.remind > nowLocal()).map(r => remindItem(r, jobs))
  saveForBackground([...items, ...later])
  popAlarms(items)
  show(items)
  scheduleNext()
}

export async function enableReminders() {
  if (!canNotify()) throw new Error("This phone's browser doesn't support reminders")
  const p = await Notification.requestPermission()
  if (p !== 'granted') throw new Error('Notifications were blocked. You can allow them in your phone settings for this app.')
  localStorage.setItem(LS_ON, '1')
  checkReminders()
  try {
    const reg = await navigator.serviceWorker.ready
    if (reg.periodicSync) await reg.periodicSync.register('reminders', { minInterval: 6 * 3600 * 1000 })
  } catch { }
}
export function disableReminders() { localStorage.setItem(LS_ON, '0') }

export function startReminders() {
  let t = null
  subscribe(() => { clearTimeout(t); t = setTimeout(checkReminders, 2000) })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkReminders())
  setTimeout(checkReminders, 1500)
}
