import { list, put } from './store'
import { parseYmd, today } from './util'

export const JOB_STATUS = {
  quoting: 'Quoting',
  booked: 'Booked in',
  onsite: 'On site',
  finished: 'Finished',
}

// The job's status: set by hand, otherwise worked out from the start date
export function jobStatus(d) {
  if (d.status) return d.status
  return d.start && d.start <= today() ? 'onsite' : 'booked'
}

// How far through the job we are, from the start and finish dates
export function jobProgress(d) {
  if (!d.start) return null
  const t = parseYmd(today()), s = parseYmd(d.start)
  if (!d.finish) return t < s ? { pct: 0, label: `Starts in ${Math.round((s - t) / 864e5)} days` } : null
  const f = parseYmd(d.finish)
  const total = Math.max(1, Math.round((f - s) / 864e5) + 1)
  if (t < s) { const n = Math.round((s - t) / 864e5); return { pct: 0, label: n === 1 ? 'Starts tomorrow' : `Starts in ${n} days` } }
  if (t > f) return { pct: 100, label: jobStatus(d) === 'finished' ? 'Finished' : `Due to finish ${Math.round((t - f) / 864e5)} days ago` }
  const day = Math.round((t - s) / 864e5) + 1
  return { pct: Math.round((day / total) * 100), label: `Day ${day} of ${total}` }
}

// Templates remember a job's folders, materials and schedule so new jobs start pre-filled
export function saveTemplate(jobId, name) {
  const job = list('job', r => r.id === jobId)[0]
  const folders = list('folder', r => r.job_id === jobId).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
  const start = job?.data.start ? parseYmd(job.data.start) : null
  const t = {
    name,
    folders: folders.map(f => ({
      name: f.data.name,
      items: list('material', r => r.data.folder_id === f.id).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
        .map(m => ({ text: m.data.text, qty: m.data.qty || '', supplier: m.data.supplier || '', price: m.data.price || '', urgency: m.data.urgency || '' })).filter(m => m.text),
    })),
    tasks: start ? list('task', r => r.job_id === jobId).map(tk => ({ text: tk.data.text, urgency: tk.data.urgency, day: Math.round((parseYmd(tk.data.date) - start) / 864e5) })) : [],
  }
  return put('template', t)
}

export function applyTemplate(tpl, jobId, startDate) {
  tpl.data.folders.forEach((f, i) => {
    const fr = put('folder', { name: f.name, order: i }, { job_id: jobId })
    f.items.forEach((m, j) => put('material', { folder_id: fr.id, text: m.text, qty: m.qty, supplier: m.supplier, price: m.price, urgency: m.urgency, date: '', done: false, order: j }, { job_id: jobId }))
  })
  if (startDate) {
    const s = parseYmd(startDate)
    tpl.data.tasks.forEach(tk => {
      const d = new Date(s); d.setDate(d.getDate() + tk.day)
      put('task', { text: tk.text, urgency: tk.urgency, date: d.toISOString().slice(0, 10), done: false }, { job_id: jobId })
    })
  }
}

export async function smallImage(file, max = 600) {
  const url = URL.createObjectURL(file)
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg', 0.75)
}
