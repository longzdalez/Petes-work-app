import { createRoot } from 'react-dom/client'
import './styles.css'
import { initCloud, cloudEnabled, useStatus, keepStorage } from './store'
import { useRoute } from './router'
import Home from './pages/Home'
import JobInfo from './pages/Job'
import Docs from './pages/Docs'
import Materials, { Folder } from './pages/Materials'
import Money from './pages/Money'
import Schedule from './pages/Schedule'
import Invoices, { InvoiceEdit } from './pages/Invoices'
import Settings, { SignIn } from './pages/Settings'
import Share from './pages/Share'
import VoiceButton from './Voice'

function App() {
  const r = useRoute()
  const st = useStatus()
  if (!st.ready) return null
  if (cloudEnabled && !st.signedIn && r[0] !== 'settings') {
    return (
      <div className="page welcome">
        <div className="welcome-logo">PW</div>
        <h1>Pete Work</h1>
        <p className="muted">Jobs, materials, money and invoices in one place.</p>
        <div className="card"><SignIn /></div>
      </div>
    )
  }
  let page, jobId = null
  if (r[0] === 'job' && r[1]) {
    jobId = r[1]
    const sub = r[2] || ''
    page = sub === 'docs' ? <Docs id={jobId} />
      : sub === 'materials' ? <Materials id={jobId} />
      : sub === 'folder' ? <Folder id={jobId} fid={r[3]} />
      : sub === 'money' ? <Money id={jobId} />
      : sub === 'schedule' ? <Schedule id={jobId} />
      : sub === 'invoices' ? <Invoices id={jobId} />
      : sub === 'invoice' ? <InvoiceEdit id={jobId} iid={r[3]} />
      : <JobInfo id={jobId} />
  } else if (r[0] === 'settings') page = <Settings />
  else if (r[0] === 'share') page = <Share />
  else page = <Home />
  return <>
    {page}
    {r[0] !== 'settings' && r[0] !== 'share' && <VoiceButton jobId={jobId} />}
  </>
}

initCloud()
keepStorage()
createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
