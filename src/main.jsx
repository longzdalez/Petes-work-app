import { createRoot } from 'react-dom/client'
import './styles.css'
import { initCloud, cloudEnabled, useStatus, keepStorage } from './store'
import { useRoute } from './router'
import Home from './pages/Home'
import JobInfo, { JobTodos } from './pages/Job'
import Docs from './pages/Docs'
import Materials, { Folder } from './pages/Materials'
import Money from './pages/Money'
import Schedule from './pages/Schedule'
import Invoices, { InvoiceEdit } from './pages/Invoices'
import Settings, { SignIn, applyDisplay } from './pages/Settings'
import Extras from './pages/Extras'
import Photos from './pages/Photos'
import Snags from './pages/Snags'
import Hours from './pages/Hours'
import Contacts, { Renewals } from './pages/Contacts'
import Search from './pages/Search'
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
      : sub === 'extras' ? <Extras id={jobId} />
      : sub === 'todos' ? <JobTodos id={jobId} />
      : sub === 'photos' ? <Photos id={jobId} />
      : sub === 'snags' ? <Snags id={jobId} />
      : sub === 'hours' ? <Hours id={jobId} />
      : <JobInfo id={jobId} />
  } else if (r[0] === 'settings') page = <Settings />
  else if (r[0] === 'share') page = <Share />
  else if (r[0] === 'contacts') page = <Contacts />
  else if (r[0] === 'renewals') page = <Renewals />
  else if (r[0] === 'search') page = <Search />
  else page = <Home />
  return <>
    {page}
    {!['settings', 'share', 'search'].includes(r[0]) && <VoiceButton ctx={{ page: jobId ? (r[2] || 'job') : 'home', jobId, folderId: r[2] === 'folder' ? r[3] : null }} />}
  </>
}

applyDisplay()
initCloud()
keepStorage()
createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
