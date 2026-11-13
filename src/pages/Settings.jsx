import { useRef, useState } from 'react'
import { put, useRecord, useStatus, cloudEnabled, signIn, signUp, signOut } from '../store'
import { Icon, TopBar, Field } from '../ui'
import { nav, back } from '../router'
import { BackupCard } from '../Backup'
import { accountantCsv } from './Money'
import { shareOrDownload } from '../files'
import { canNotify, remindersOn, enableReminders, disableReminders } from '../reminders'

function RemindersCard() {
  const [on, setOn] = useState(remindersOn())
  const [err, setErr] = useState('')
  return (
    <section className="card">
      <div className="card-head"><h2>Reminders</h2></div>
      <div className="toggle-row">
        <span><b>Urgent reminders</b><br /><span className="small muted">A phone notification 2 days before any material, to-do or schedule item marked red (urgent)</span></span>
        <button className={'switch' + (on ? ' on' : '')} aria-pressed={on} disabled={!canNotify()} onClick={async () => {
          setErr('')
          if (on) { disableReminders(); setOn(false); return }
          try { await enableReminders(); setOn(true) } catch (e) { setErr(e.message) }
        }} />
      </div>
      {!canNotify() && <p className="small muted">This phone's browser can't show reminders. Open the app in Chrome to use them.</p>}
      {err && <p className="error">{err}</p>}
      <p className="small muted" style={{ marginBottom: 0 }}>Reminders appear when you open the app, and on most Android phones once or twice a day in the background as well.</p>
    </section>
  )
}

export function applyDisplay() {
  const c = document.documentElement.classList
  c.toggle('big-text', localStorage.getItem('pw_big') === '1')
  c.toggle('contrast', localStorage.getItem('pw_contrast') === '1')
}

function Toggle({ k, label, sub }) {
  const [on, setOn] = useState(localStorage.getItem(k) === '1')
  return (
    <div className="toggle-row">
      <span><b>{label}</b>{sub && <><br /><span className="small muted">{sub}</span></>}</span>
      <button className={'switch' + (on ? ' on' : '')} aria-pressed={on} onClick={() => { localStorage.setItem(k, on ? '0' : '1'); setOn(!on); applyDisplay() }} />
    </div>
  )
}

function taxYears() {
  const d = new Date(), y = d.getMonth() > 3 || (d.getMonth() === 3 && d.getDate() >= 6) ? d.getFullYear() : d.getFullYear() - 1
  return [y, y - 1, y - 2].map(s => ({ label: `${s}/${String(s + 1).slice(2)}`, from: `${s}-04-06`, to: `${s + 1}-04-05` }))
}

function AccountantCard() {
  const years = taxYears()
  const [i, setI] = useState(0)
  const [msg, setMsg] = useState('')
  return (
    <section className="card">
      <div className="card-head"><h2>For your accountant</h2></div>
      <p className="small muted" style={{ marginTop: 0 }}>Makes a spreadsheet of every payment in and out across all jobs for the tax year, with VAT and CIS amounts. It opens in Excel or Google Sheets.</p>
      <div className="chips" style={{ marginBottom: 12 }}>{years.map((y, j) => <button key={y.label} className={'chip' + (i === j ? ' on' : '')} onClick={() => setI(j)}>Tax year {y.label}</button>)}</div>
      <button className="btn primary wide" onClick={async () => {
        const { file, count } = accountantCsv(years[i].from, years[i].to)
        const r = await shareOrDownload(file, 'Accounts')
        setMsg(r === 'cancelled' ? '' : `${count} payments exported.${r === 'downloaded' ? ' Saved in Downloads.' : ''}`)
      }}><Icon name="share" size={18} /> Send spreadsheet</button>
      {msg && <p className="small muted" style={{ marginBottom: 0 }}>{msg}</p>}
    </section>
  )
}

export function useSettings() {
  const r = useRecord('settings')
  const d = r?.data || {}
  return { ...d, owners: d.owners?.filter(Boolean).length ? d.owners.filter(Boolean) : ['Pete', 'Brian'], business: d.business || {} }
}
const setS = patch => put('settings', patch, { id: 'settings' })

export function SignIn() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async fn => {
    setErr(''); setBusy(true)
    try { await fn(email.trim(), pw) } catch (e) {
      setErr(/confirm/i.test(e.message) ? 'Please open the email Supabase sent you and press the confirm link, then try again.' : e.message)
    }
    setBusy(false)
  }
  return (
    <div className="signin">
      <p className="small">Both phones sign in with the <b>same</b> email and password, so you see the same jobs.</p>
      <Field label="Email" type="email" value={email} onChange={setEmail} live />
      <label className="field"><span>Password</span><input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      {err && <p className="error">{err}</p>}
      <button className="btn primary wide" disabled={busy} onClick={() => go(signIn)}>Sign in</button>
      <button className="btn ghost wide" disabled={busy} onClick={() => { if (pw.length < 6) return setErr('Use a password of at least 6 characters'); go(signUp) }}>First time? Create the shared login</button>
    </div>
  )
}

export default function Settings() {
  const s = useSettings()
  const b = s.business
  const st = useStatus()
  const logo = useRef()
  const setB = patch => setS({ business: { ...b, ...patch } })
  const onLogo = e => {
    const f = e.target.files[0]; if (!f) return
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 500 / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = img.width * scale; c.height = img.height * scale
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      setB({ logo: c.toDataURL('image/png') })
    }
    img.src = URL.createObjectURL(f)
  }
  return (
    <div className="page">
      <TopBar title="Settings" onBack={() => back('/')} />
      <main className="content">
        <section className="card">
          <div className="card-head"><h2>Sharing between phones</h2></div>
          {!cloudEnabled && <p className="small muted">Live sharing isn't switched on yet. Everything is saved on this phone for now and will be uploaded once it's set up.</p>}
          {cloudEnabled && (st.signedIn
            ? <>
              <p className="small"><span className={'sync-dot inline ' + (st.error ? 'bad' : 'ok')} /> {st.error ? 'Problem syncing: ' + st.error : st.syncing ? 'Syncing…' : st.online ? 'Connected. Changes appear on both phones straight away.' : "Offline. Changes are saved and will sync when you're back online."}</p>
              <button className="btn ghost" onClick={() => confirm('Sign out on this phone?') && signOut()}>Sign out</button>
            </>
            : <SignIn />)}
        </section>

        <BackupCard />
        <RemindersCard />
        <AccountantCard />

        <section className="card">
          <div className="card-head"><h2>Easier to read</h2></div>
          <Toggle k="pw_big" label="Bigger text" sub="Makes everything a bit larger" />
          <Toggle k="pw_contrast" label="Stronger contrast" sub="Darker text and outlines, easier in sunlight" />
        </section>

        <section className="card">
          <div className="card-head"><h2>The two owners</h2></div>
          <p className="small muted">Used for wages in Money.</p>
          <div className="two">
            <Field label="Owner 1" value={s.owners[0]} onChange={v => setS({ owners: [v, s.owners[1]] })} />
            <Field label="Owner 2" value={s.owners[1]} onChange={v => setS({ owners: [s.owners[0], v] })} />
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Business details for invoices</h2></div>
          <div className="logo-pick" onClick={() => logo.current.click()}>
            {b.logo ? <img src={b.logo} alt="Logo" /> : <span><Icon name="upload" /> Add your logo</span>}
          </div>
          <input ref={logo} type="file" accept="image/*" hidden onChange={onLogo} />
          {b.logo && <button className="btn ghost small" onClick={() => setB({ logo: '' })}>Remove logo</button>}
          <Field label="Business name" value={b.name} onChange={v => setB({ name: v })} />
          <Field label="Address" value={b.address} onChange={v => setB({ address: v })} multiline />
          <div className="two">
            <Field label="Phone" type="tel" value={b.phone} onChange={v => setB({ phone: v })} />
            <Field label="Second phone" type="tel" value={b.phone2} onChange={v => setB({ phone2: v })} />
          </div>
          <Field label="Email" type="email" value={b.email} onChange={v => setB({ email: v })} />
          <Field label="VAT number (if registered)" value={b.vatNo} onChange={v => setB({ vatNo: v })} />
          <h3 className="sub-h">Bank details</h3>
          <Field label="Account name" value={b.bankName} onChange={v => setB({ bankName: v })} />
          <div className="two">
            <Field label="Sort code" value={b.sortCode} onChange={v => setB({ sortCode: v })} inputMode="numeric" />
            <Field label="Account number" value={b.accountNo} onChange={v => setB({ accountNo: v })} inputMode="numeric" />
          </div>
          <Field label="Payment terms / notes on every invoice" value={b.terms} onChange={v => setB({ terms: v })} multiline placeholder="e.g. Payment due within 14 days. Thank you for your business." />
        </section>

        <section className="card">
          <div className="card-head"><h2>Put the app on your home screen</h2></div>
          <ol className="small steps">
            <li>Open this page in <b>Chrome</b> (or the Huawei browser).</li>
            <li>Tap the <b>⋮ menu</b>, then <b>Add to Home screen</b> or <b>Install app</b>.</li>
            <li>Open BP Builders from the new icon. To add files from WhatsApp or email, press <b>Share</b> on the file and choose <b>BP Builders</b>.</li>
          </ol>
        </section>
        <p className="hint">BP Builders · version 1.0</p>
      </main>
    </div>
  )
}
