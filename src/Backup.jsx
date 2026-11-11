import { useRef, useState } from 'react'
import { makeBackup, markBackedUp, restoreBackup, lastBackup, hasData, useVersion } from './store'
import { Icon } from './ui'
import { niceDate } from './util'

const DAY = 864e5

function download(file) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file); a.download = file.name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

// Phones only let apps share certain file types, so the shared copy is a .txt file.
async function shareFile(file) {
  const txt = new File([file], file.name.replace(/\.json$/, '.txt'), { type: 'text/plain' })
  if (navigator.canShare && navigator.canShare({ files: [txt] })) {
    await navigator.share({ files: [txt], title: 'Pete Work backup', text: 'Pete Work backup. Keep this file safe.' })
    return true
  }
  return false
}

export function useBackup() {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const run = async how => {
    setBusy(how); setMsg('')
    try {
      const file = await makeBackup()
      if (how === 'send') {
        const shared = await shareFile(file)
        if (!shared) { download(file); setMsg('Your phone saved the backup in Downloads. You can attach it to an email from there.') }
        else setMsg('Backup sent. Keep that message or file safe.')
      } else {
        download(file)
        setMsg('Backup saved in your Downloads folder.')
      }
      markBackedUp()
    } catch (e) {
      if (e.name !== 'AbortError') setMsg("Couldn't make the backup: " + e.message)
    }
    setBusy('')
  }
  return { busy, msg, run, setMsg }
}

export function BackupCard() {
  useVersion()
  const { busy, msg, run, setMsg } = useBackup()
  const input = useRef()
  const last = lastBackup()
  const onRestore = async e => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (!confirm('Load this backup onto this phone? Anything newer already on the phone is kept.')) return
    try {
      const r = await restoreBackup(f)
      setMsg(`Backup from ${niceDate(r.created)} loaded. ${r.added} item${r.added === 1 ? '' : 's'} brought back.`)
    } catch (err) { setMsg("Couldn't load that file: " + err.message) }
  }
  return (
    <section className="card">
      <div className="card-head"><h2>Back up your jobs</h2></div>
      <p className="small muted" style={{ marginTop: 0 }}>
        Everything is saved on this phone. A backup copies all your jobs, materials, money, invoices and documents into one file, so you can get them back if the phone is lost, broken or replaced.
      </p>
      <p className="small"><b>Last backup:</b> {last ? niceDate(last, { weekday: true }) : 'never'}</p>
      <button className="btn primary wide big" disabled={!!busy} onClick={() => run('send')}>
        <Icon name="share" size={18} /> {busy === 'send' ? 'Making backup…' : 'Send backup to myself'}
      </button>
      <p className="small muted" style={{ margin: '-6px 0 12px' }}>Choose email, WhatsApp or Google Drive, so the copy is kept off the phone.</p>
      <button className="btn ghost wide" disabled={!!busy} onClick={() => run('save')}>
        <Icon name="download" size={18} /> {busy === 'save' ? 'Saving…' : 'Save backup to this phone'}
      </button>
      <button className="btn ghost wide" style={{ marginTop: 10 }} onClick={() => input.current.click()}>
        <Icon name="upload" size={18} /> Restore from a backup file
      </button>
      <input ref={input} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={onRestore} />
      {msg && <p className="notice small" style={{ marginTop: 12, marginBottom: 0 }}>{msg}</p>}
    </section>
  )
}

// Gentle nudge on the home page when it's been a week since the last backup
export function BackupReminder() {
  useVersion()
  const { busy, msg, run } = useBackup()
  const last = lastBackup()
  const due = hasData() && (!last || Date.now() - new Date(last) > 7 * DAY)
  if (!due && !msg) return null
  return (
    <section className="card backup-nudge">
      {msg ? <p className="small" style={{ margin: 0 }}><Icon name="check" size={16} /> {msg}</p> : <>
        <div className="nudge-text">
          <b>{last ? "It's been a week since your last backup" : "You haven't backed up yet"}</b>
          <span className="small muted">Send a copy to yourself so nothing is lost if the phone goes.</span>
        </div>
        <button className="btn primary" disabled={!!busy} onClick={() => run('send')}>{busy ? 'Working…' : 'Back up'}</button>
      </>}
    </section>
  )
}
