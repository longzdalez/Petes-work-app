import { useRef, useState } from 'react'
import { put, useRecord, useStatus, cloudEnabled, signIn, signUp, signOut } from '../store'
import { Icon, TopBar, Field } from '../ui'
import { nav, back } from '../router'

export function useSettings() {
  const r = useRecord('settings')
  const d = r?.data || {}
  return { ...d, owners: d.owners?.filter(Boolean).length ? d.owners.filter(Boolean) : ['Pete', 'Partner'], business: d.business || {} }
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
            <li>Open Pete Work from the new icon. To add files from WhatsApp or email, press <b>Share</b> on the file and choose <b>Pete Work</b>.</li>
          </ol>
        </section>
        <p className="hint">Pete Work · version 1.0</p>
      </main>
    </div>
  )
}
