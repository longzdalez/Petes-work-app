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
  if (/\byesterday\b/.test(s)) return add(-1)
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
  const m2 = s.match(/\s*,?\s*\b(today|tomorrow|yesterday|next week|(?:next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b\s*$/i)
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
    let [r0, urg] = takeUrgency(m[1])
    let [rest, date] = takeDate(r0)
    return { kind: 'todo', text: cap(clean(rest)), date: date || today(), urgency: urg }
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
  let [r0, urg] = takeUrgency(s)
  let [rest, date] = takeDate(r0)
  return { kind: 'todo', text: cap(clean(rest)), date: date || today(), urgency: urg }
}

// ---- Understanding speech based on the page that's open ----
const NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
const lead = (s, words) => s.replace(new RegExp(`^(?:please\\s+|can you\\s+)?(?:${words})\\b[\\s,:]*`, 'i'), '')
const amountIn = s => { const m = s.match(/£\s*([\d,]+(?:\.\d+)?)|\b([\d,]+(?:\.\d+)?)\s*(?:pounds?|quid|k\b)/i); if (!m) return null; let v = parseFloat((m[1] || m[2]).replace(/,/g, '')); if (/k\b/i.test(m[0])) v *= 1000; return { v, m: m[0] } }

export function parseInContext(page, raw) {
  const s = raw.trim().replace(/[.!?]+$/, '')
  switch (page) {
    case 'folder': {
      const [r1, urg] = takeUrgency(lead(s, 'add|need|we need|order|get|put'))
      const [r2, date] = takeDate(r1)
      return { kind: 'material', text: cap(clean(r2)), date: date || '', urgency: urg, folder: '' }
    }
    case 'materials': {
      const c = parseCommand(s)
      if (c.kind === 'material') return c
      const [r1, urg] = takeUrgency(lead(s, 'add|need|we need|order|get'))
      const [r2, date] = takeDate(r1)
      return { kind: 'material', text: cap(clean(r2)), date: date || '', urgency: urg, folder: '' }
    }
    case 'schedule': {
      const [r1, urg] = takeUrgency(lead(s, 'schedule|plan|book in|book|add|put'))
      const [rest, date] = takeDate(r1)
      return { kind: 'task', text: cap(clean(rest)), date: date || today(), urgency: urg || 'green' }
    }
    case 'money': {
      const c = parseCommand(s)
      if (c.kind === 'money') return c
      const a = amountIn(s) || { v: parseFloat((s.match(/\b\d[\d,.]*\b/) || ['0'])[0].replace(/,/g, '')), m: (s.match(/\b\d[\d,.]*\b/) || [''])[0] }
      const dir = /\b(received|deposit|from the client|from client|paid us|payment from|money in|came in)\b/i.test(s) ? 'in' : 'out'
      const desc = cap(clean(s.replace(a.m, ' ').replace(/\b(money (in|out)|received|spent|paid|payment|of|for|on|to|from|the client|client)\b/gi, ' ').replace(/\s+/g, ' ')))
      const low = s.toLowerCase()
      const cat = dir === 'in' ? 'client' : /wage/.test(low) ? 'wages' : /electric|plumb|plaster|roof|contractor|scaffold|sub/.test(low) ? 'contractor' : /timber|wood|brick|cement|sand|material|board|screw|tile|paint|merchant/.test(low) ? 'materials' : 'other'
      return { kind: 'money', dir, amount: a.v || 0, desc, cat }
    }
    case 'extras': {
      const a = amountIn(s)
      let t = lead(s, 'add an extra|add extra|extra|add a change|add')
      if (a) t = t.replace(new RegExp(`\\s*(?:for|at|costing|price)?\\s*${a.m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), ' ')
      return { kind: 'extra', text: cap(clean(t)), price: a ? a.v : 0 }
    }
    case 'snags': {
      let t = lead(s, 'add a snag|add snag|snag|add')
      let location = ''
      const m = t.match(/\s+(?:in|on) the ([a-z]+(?: [a-z]+)?)$/i)
      if (m) { location = cap(m[1]); t = t.slice(0, m.index) }
      return { kind: 'snag', text: cap(clean(t)), location }
    }
    case 'hours': {
      let t = s.toLowerCase().replace(/\s+and a half\b/g, '.5').replace(/\bhalf a day\b/g, '4 hours').replace(/\ba full day\b|\ball day\b/g, '8 hours')
      for (const [w, n] of Object.entries(NUMS)) t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), String(n))
      const [r1, date] = takeDate(t)
      const h = r1.match(/(\d+(?:\.\d+)?)\s*hours?/)
      const hours = h ? parseFloat(h[1]) : 8
      const person = cap(clean(r1.replace(/(\d+(?:\.\d+)?)\s*hours?/, ' ').replace(/\b(log|add|did|worked|work|for|today|hours?)\b/g, ' ').replace(/\s+/g, ' ')))
      return { kind: 'hours', person, hours, date: date || today() }
    }
    case 'home': return parseCommand(s)
    default: {
      // On any other job page, plain sentences become a to-do for that job
      const c = parseCommand(s)
      if (c.kind === 'todo') return { ...c, kind: 'jobtodo' }
      return c
    }
  }
}
