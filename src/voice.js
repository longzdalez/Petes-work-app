// Turn a spoken sentence into an action for the app.
import { MONTHS, ymd, today } from './util.js'

const DAYNAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, 'twenty first': 21, 'twenty second': 22, 'twenty third': 23, 'twenty fourth': 24, 'twenty fifth': 25, 'twenty sixth': 26, 'twenty seventh': 27, 'twenty eighth': 28, 'twenty ninth': 29, thirtieth: 30, 'thirty first': 31 }

export function parseDate(s, now = new Date()) {
  if (!s) return null
  s = s.toLowerCase().replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [w, n] of Object.entries(ORD).sort((a, b) => b[0].length - a[0].length)) s = s.replace(new RegExp(`\\b${w}\\b`, 'g'), String(n))
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const add = n => { const d = new Date(base); d.setDate(d.getDate() + n); return ymd(d) }
  if (/\btoday\b/.test(s)) return ymd(base)
  if (/\btomorrow\b/.test(s)) return add(1)
  if (/\bnext week\b/.test(s)) return add(7)
  const dn = DAYNAMES.findIndex(d => new RegExp(`\\b${d}\\b`).test(s))
  if (dn >= 0) { let diff = (dn - base.getDay() + 7) % 7 || 7; if (/\bnext\b/.test(s) && diff < 7) diff += 0; return add(diff) }
  const mi = MONTHS.findIndex(m => new RegExp(`\\b${m.toLowerCase()}\\b|\\b${m.slice(0, 3).toLowerCase()}\\b`).test(s))
  const dayM = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/)
  const yearM = s.match(/\b(20\d\d)\b/)
  if (mi >= 0 && dayM) {
    let y = yearM ? +yearM[1] : base.getFullYear()
    let d = new Date(y, mi, +dayM[1])
    if (!yearM && d < base) d = new Date(y + 1, mi, +dayM[1])
    return ymd(d)
  }
  const slash = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (slash) {
    let y = slash[3] ? (+slash[3] < 100 ? 2000 + +slash[3] : +slash[3]) : base.getFullYear()
    let d = new Date(y, +slash[2] - 1, +slash[1])
    if (!slash[3] && d < base) d = new Date(y + 1, +slash[2] - 1, +slash[1])
    return ymd(d)
  }
  if (dayM && /\bthe\b/.test(s)) {
    let d = new Date(base.getFullYear(), base.getMonth(), +dayM[1])
    if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, +dayM[1])
    return ymd(d)
  }
  return null
}

const URG = [
  [/\b(very urgent|really urgent|urgent|asap|red|high priority|important)\b/, 'red'],
  [/\b(soon|amber|yellow|orange|medium( priority)?)\b/, 'amber'],
  [/\b(not urgent|no rush|green|low( priority)?|whenever)\b/, 'green'],
]
function takeUrgency(s) {
  for (const [re, k] of URG) { if (re.test(s)) return [s.replace(re, ' ').replace(/\s+/g, ' ').trim(), k] }
  return [s, '']
}
// Split off a date phrase like "needed 5th January" / "by Friday" / "on the 12th"
function takeDate(s) {
  const m = s.match(/\s*,?\s*\b(needed|need it|needed by|needed on|for|by|on|due)\b\s+(.+)$/i)
  if (m) { const d = parseDate(m[2]); if (d) return [s.slice(0, m.index).trim(), d] }
  const m2 = s.match(/\s*,?\s*\b(today|tomorrow|next week|(?:next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b\s*$/i)
  if (m2) return [s.slice(0, m2.index).trim(), parseDate(m2[1])]
  return [s, null]
}
const clean = s => s.replace(/^[\s,.]+|[\s,.]+$/g, '').replace(/^(the|a|an|some)\s+/i, '')
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s

export function parseCommand(raw) {
  let s = raw.trim().replace(/[.!?]+$/, '')
  const low = s.toLowerCase()
  let m

  // To-do
  if ((m = s.match(/^(?:add\s+)?(?:a\s+)?(?:to[\s-]?do|reminder|remind me to|remind me)\s*(?:list)?\s*[:,]?\s*(.+)$/i))) {
    let [rest, date] = takeDate(m[1])
    return { kind: 'todo', text: cap(clean(rest)), date: date || today() }
  }
  // Money
  if ((m = low.match(/^(?:money in|received|we received|got paid|payment in|paid in)\s+(?:of\s+)?£?\s*([\d,]+(?:\.\d+)?)\s*(?:pounds?|quid)?\s*(?:from|for)?\s*(.*)$/))) {
    return { kind: 'money', dir: 'in', amount: parseFloat(m[1].replace(/,/g, '')), desc: cap(clean(s.slice(s.length - m[2].length))) || 'Client payment', cat: 'client' }
  }
  if ((m = low.match(/^(?:money out|paid out|spent|we paid|paid|payment out)\s+(?:of\s+)?£?\s*([\d,]+(?:\.\d+)?)\s*(?:pounds?|quid)?\s*(?:to|on|for)?\s*(.*)$/))) {
    const desc = cap(clean(s.slice(s.length - m[2].length)))
    const cat = /wage|wages/.test(m[2]) ? 'wages' : /electric|plumb|plaster|roofer|contractor|scaffold|sub/.test(m[2]) ? 'contractor' : /timber|wood|brick|cement|sand|material|plaster ?board|screws|tiles|paint|merchant|jewson|wickes|travis|screwfix/.test(m[2]) ? 'materials' : 'other'
    return { kind: 'money', dir: 'out', amount: parseFloat(m[1].replace(/,/g, '')), desc: desc || 'Payment', cat }
  }
  // Schedule
  if ((m = s.match(/^(?:schedule|plan|book in|book|programme)\s+(.+)$/i))) {
    let [r1, urg] = takeUrgency(m[1])
    let [rest, date] = takeDate(r1)
    return { kind: 'task', text: cap(clean(rest)), date: date || today(), urgency: urg || 'green' }
  }
  // Material: "add timber to joinery needed 5th January urgent"
  if ((m = s.match(/^(?:add|need|we need|order|get)\s+(.+?)\s+(?:to|in|into|under|on|for)\s+(?:the\s+)?(.+)$/i))) {
    let item = m[1], rest = m[2]
    let [r1, urg] = takeUrgency(rest)
    let [r2, date] = takeDate(r1)
    const folder = clean(r2.replace(/\b(folder|list|materials?)\b/gi, ' ').replace(/\s+/g, ' '))
    if (folder && folder.split(' ').length <= 4) {
      return { kind: 'material', text: cap(clean(item)), folder: cap(folder), date: date || '', urgency: urg }
    }
  }
  // Fall back: to-do
  let [rest, date] = takeDate(s)
  return { kind: 'todo', text: cap(clean(rest)), date: date || today() }
}
