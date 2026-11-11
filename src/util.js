export const pad = n => String(n).padStart(2, '0')
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function niceDate(s, opts = {}) {
  if (!s) return ''
  const d = s.length > 10 ? new Date(s) : parseYmd(s)
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: opts.noYear ? undefined : 'numeric', weekday: opts.weekday ? 'short' : undefined })
}
export function shortDate(s) {
  if (!s) return ''
  const d = parseYmd(s)
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

export const money = n => '£' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const num = v => { const n = parseFloat(String(v ?? '').replace(/[£,\s]/g, '')); return isNaN(n) ? 0 : n }

export const URGENCY = {
  green: { label: 'Not urgent', color: '#2fa65a', soft: '#dff3e5' },
  amber: { label: 'Soon', color: '#f0a020', soft: '#fdefd3' },
  red: { label: 'Urgent', color: '#e0453a', soft: '#fbe0de' },
}

// Build the 6x7 grid of dates for a month view (weeks start Monday)
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

export function initials(s) { return (s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() }

export function vibrate(ms = 15) { try { navigator.vibrate && navigator.vibrate(ms) } catch { } }
