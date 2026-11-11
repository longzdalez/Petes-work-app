import { useState } from 'react'
import { put, update, remove, useList } from '../store'
import { Icon, Sheet, Field, Empty, TopBar, confirmDelete } from '../ui'
import { back } from '../router'
import { initials, niceDate, today } from '../util'
import { whatsApp } from '../files'

export const ROLES = { supplier: 'Supplier', trade: 'Trade / sub', client: 'Client', pro: 'Architect / engineer', other: 'Other' }

export function ContactActions({ c }) {
  const d = c.data
  return (
    <div className="contact-actions" onClick={e => e.stopPropagation()}>
      {d.phone && <a className="round-btn" href={`tel:${d.phone}`} aria-label="Call"><Icon name="phone" size={18} /></a>}
      {d.phone && <button className="round-btn wa" onClick={() => whatsApp(d.phone, '')} aria-label="WhatsApp"><Icon name="chat" size={18} /></button>}
      {d.email && <a className="round-btn orange" href={`mailto:${d.email}`} aria-label="Email"><Icon name="mail" size={18} /></a>}
    </div>
  )
}

function ContactSheet({ contact, onClose }) {
  const isNew = !contact.id
  const [d, setD] = useState({ name: '', company: '', role: 'supplier', trade: '', phone: '', email: '', notes: '', ...contact.data })
  const set = p => setD(x => ({ ...x, ...p }))
  const save = () => { if (!d.name.trim() && !d.company.trim()) return alert('Please add a name'); if (isNew) put('contact', d); else update(contact.id, d); onClose() }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'New contact' : d.name || d.company}>
      <div className="chips" style={{ marginBottom: 12 }}>{Object.entries(ROLES).map(([k, l]) => <button key={k} className={'chip' + (d.role === k ? ' on' : '')} onClick={() => set({ role: k })}>{l}</button>)}</div>
      <div className="two">
        <Field label="Name" value={d.name} onChange={v => set({ name: v })} />
        <Field label="Company" value={d.company} onChange={v => set({ company: v })} />
      </div>
      {(d.role === 'trade' || d.role === 'supplier') && <Field label={d.role === 'trade' ? 'Trade (e.g. Electrician)' : 'What they supply'} value={d.trade} onChange={v => set({ trade: v })} />}
      <div className="two">
        <Field label="Phone" type="tel" value={d.phone} onChange={v => set({ phone: v })} />
        <Field label="Email" type="email" value={d.email} onChange={v => set({ email: v })} />
      </div>
      <Field label="Notes (account no, prices, etc.)" value={d.notes} onChange={v => set({ notes: v })} multiline />
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { if (confirmDelete('this contact')) { remove(contact.id); onClose() } }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

export default function Contacts() {
  const contacts = useList('contact', null, (a, b) => (a.data.name || a.data.company).localeCompare(b.data.name || b.data.company))
  const [edit, setEdit] = useState(null)
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const shown = contacts.filter(c => (!role || c.data.role === role) && (!q || JSON.stringify(c.data).toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="page">
      <TopBar title="Contacts" sub="Suppliers, trades and clients" onBack={() => back('/')} />
      <main className="content">
        <button className="btn orange wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Add contact</button>
        <div className="search-box"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search contacts" /></div>
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className={'chip' + (!role ? ' on' : '')} onClick={() => setRole('')}>All</button>
          {Object.entries(ROLES).map(([k, l]) => <button key={k} className={'chip' + (role === k ? ' on' : '')} onClick={() => setRole(k)}>{l}</button>)}
        </div>
        {shown.length === 0 && <Empty icon="users" title={contacts.length ? 'No matches' : 'No contacts yet'} text="Keep your merchants, subbies and clients here, with one-tap call, WhatsApp and email." />}
        {shown.map(c => (
          <div key={c.id} className="list-card" onClick={() => setEdit(c)} role="button">
            <div className="avatar">{initials(c.data.name || c.data.company)}</div>
            <div className="text">
              <b>{c.data.name || c.data.company}</b>
              <span>{[c.data.name && c.data.company, c.data.trade || ROLES[c.data.role]].filter(Boolean).join(' · ')}</span>
            </div>
            <ContactActions c={c} />
          </div>
        ))}
      </main>
      {edit && <ContactSheet contact={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

// ---- Certificates, insurance and renewals ----
function RenewalSheet({ item, onClose }) {
  const isNew = !item.id
  const [d, setD] = useState({ name: '', expiry: '', notes: '', ...item.data })
  const set = p => setD(x => ({ ...x, ...p }))
  const save = () => { if (!d.name.trim() || !d.expiry) return alert('Please add a name and the expiry date'); if (isNew) put('renewal', d); else update(item.id, d); onClose() }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'New renewal' : d.name}>
      <Field label="What is it?" value={d.name} onChange={v => set({ name: v })} placeholder="e.g. Public liability insurance" />
      <Field label="Expires on" type="date" value={d.expiry} onChange={v => set({ expiry: v })} />
      <Field label="Notes (policy number, who to call)" value={d.notes} onChange={v => set({ notes: v })} multiline />
      <div className="sheet-actions">
        {!isNew && <button className="btn danger" onClick={() => { remove(item.id); onClose() }}><Icon name="trash" size={18} /></button>}
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

export function daysUntil(s) { const t = new Date(today()); return Math.round((new Date(s) - t) / 864e5) }

export function Renewals() {
  const items = useList('renewal', null, (a, b) => a.data.expiry.localeCompare(b.data.expiry))
  const [edit, setEdit] = useState(null)
  return (
    <div className="page">
      <TopBar title="Renewals" sub="Insurance, certificates and licences" onBack={() => back('/')} />
      <main className="content">
        <button className="btn orange wide big" onClick={() => setEdit({ data: {} })}><Icon name="plus" size={20} /> Add renewal</button>
        {items.length === 0 && <Empty icon="shield" title="Nothing added yet" text="Add things like insurance, van MOT, CSCS cards, gas or electrical registration. They'll show on the home page a month before they run out." />}
        {items.map(i => {
          const n = daysUntil(i.data.expiry)
          return (
            <button key={i.id} className="list-card" onClick={() => setEdit(i)}>
              <div className="today-ic"><Icon name="shield" size={18} /></div>
              <div className="text"><b>{i.data.name}</b><span>Expires {niceDate(i.data.expiry)}</span></div>
              <span className={'status ' + (n < 0 ? 'overdue' : n <= 30 ? 'sent' : 'paid')}>{n < 0 ? 'Expired' : n === 0 ? 'Today' : `${n} days`}</span>
            </button>
          )
        })}
      </main>
      {edit && <RenewalSheet item={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
