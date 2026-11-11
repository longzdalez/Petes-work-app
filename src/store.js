// Local-first data store. Every piece of data is a "record":
// { id, kind, job_id, data, deleted, updated_at }
// Records live in localStorage and, when Supabase is set up, sync live between phones.
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, useSyncExternalStore } from 'react'

const LS_RECORDS = 'pw_records'
const LS_PENDING = 'pw_pending'
const LS_SYNC = 'pw_last_sync'

const cfg = window.APP_CONFIG || {}
export const cloudEnabled = !!(cfg.supabaseUrl && cfg.supabaseKey)
export const supabase = cloudEnabled ? createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null

let records = load(LS_RECORDS, {})
let pending = load(LS_PENDING, {})
let version = 0
const listeners = new Set()
export const status = { online: navigator.onLine, syncing: false, signedIn: false, error: '' }

function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }
function save() {
  localStorage.setItem(LS_RECORDS, JSON.stringify(records))
  localStorage.setItem(LS_PENDING, JSON.stringify(pending))
}
function emit() { version++; listeners.forEach(l => l()) }
export function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---- reading ----
export function get(id) { const r = records[id]; return r && !r.deleted ? r : null }
export function list(kind, filter) {
  return Object.values(records).filter(r => r.kind === kind && !r.deleted && (!filter || filter(r)))
}

// React hooks: re-render whenever any data changes.
export function useVersion() { return useSyncExternalStore(subscribe, () => version) }
export function useList(kind, filter, sort) {
  useVersion()
  const out = list(kind, filter)
  if (sort) out.sort(sort)
  return out
}
export function useRecord(id) { useVersion(); return id ? get(id) : null }
export function useStatus() { useVersion(); return { ...status } }

// ---- writing ----
export function put(kind, data, opts = {}) {
  const id = opts.id || uid()
  const prev = records[id]
  const rec = {
    id, kind,
    job_id: opts.job_id !== undefined ? opts.job_id : prev?.job_id ?? null,
    data: opts.replace ? data : { ...(prev?.data || {}), ...data },
    deleted: false,
    updated_at: new Date().toISOString(),
  }
  if (!rec.data.created) rec.data.created = prev?.data?.created || new Date().toISOString()
  records[id] = rec
  pending[id] = true
  save(); emit(); schedulePush()
  return rec
}
export function update(id, patch) {
  const r = records[id]; if (!r) return
  return put(r.kind, patch, { id })
}
export function remove(id) {
  const r = records[id]; if (!r) return
  records[id] = { ...r, deleted: true, updated_at: new Date().toISOString() }
  pending[id] = true
  save(); emit(); schedulePush()
}
// Remove a record and everything belonging to it (used for jobs and folders)
export function removeDeep(id) {
  Object.values(records).forEach(r => {
    if (r.deleted) return
    if (r.job_id === id || r.data?.folder_id === id) remove(r.id)
  })
  remove(id)
}

// ---- cloud sync ----
let pushTimer = null
function schedulePush() {
  if (!cloudEnabled) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(push, 400)
}

async function push() {
  if (!status.signedIn || !navigator.onLine) return
  const ids = Object.keys(pending)
  if (!ids.length) return
  const rows = ids.map(id => records[id]).filter(Boolean).map(r => ({
    id: r.id, kind: r.kind, job_id: r.job_id, data: r.data, deleted: r.deleted,
  }))
  const { error } = await supabase.from('records').upsert(rows)
  if (error) { status.error = error.message; emit(); return }
  ids.forEach(id => delete pending[id])
  status.error = ''
  save(); emit()
}

function applyRemote(row) {
  // If we have unsent local changes for this record, keep ours (they'll be pushed next).
  if (pending[row.id]) return
  records[row.id] = { id: row.id, kind: row.kind, job_id: row.job_id, data: row.data || {}, deleted: row.deleted, updated_at: row.updated_at }
}

async function pull() {
  let since = localStorage.getItem(LS_SYNC) || '1970-01-01T00:00:00Z'
  let latest = since
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('records').select('*')
      .gt('updated_at', since).order('updated_at').range(from, from + 999)
    if (error) throw error
    data.forEach(row => { applyRemote(row); if (row.updated_at > latest) latest = row.updated_at })
    if (data.length < 1000) break
  }
  localStorage.setItem(LS_SYNC, latest)
  save(); emit()
}

let channel = null
async function startSync() {
  status.syncing = true; emit()
  try {
    await pull()
    await push()
    if (!channel) {
      channel = supabase.channel('records-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, payload => {
          const row = payload.new
          if (!row || !row.id) return
          applyRemote(row)
          if (row.updated_at > (localStorage.getItem(LS_SYNC) || '')) localStorage.setItem(LS_SYNC, row.updated_at)
          save(); emit()
        })
        .subscribe(st => { if (st === 'SUBSCRIBED') pull().catch(() => {}) })
    }
    status.error = ''
  } catch (e) {
    status.error = e.message || String(e)
  }
  status.syncing = false; emit()
}

export async function initCloud() {
  if (!cloudEnabled) return
  const { data } = await supabase.auth.getSession()
  status.signedIn = !!data.session
  emit()
  supabase.auth.onAuthStateChange((_e, session) => {
    const was = status.signedIn
    status.signedIn = !!session
    emit()
    if (session && !was) startSync()
  })
  if (status.signedIn) startSync()
  window.addEventListener('online', () => { status.online = true; emit(); if (status.signedIn) startSync() })
  window.addEventListener('offline', () => { status.online = false; emit() })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && status.signedIn) startSync() })
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}
export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  // The database confirms the very first account automatically, so sign straight in.
  await signIn(email, password)
}
export async function signOut() { await supabase.auth.signOut() }

// ---- files (job documents) ----
// Cloud: Supabase Storage bucket "docs". Local only: IndexedDB.
function idb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('pete-files', 1)
    q.onupgradeneeded = () => q.result.createObjectStore('files')
    q.onsuccess = () => res(q.result); q.onerror = rej
  })
}
async function idbDo(mode, fn) {
  const db = await idb()
  return new Promise((res, rej) => {
    const tx = db.transaction('files', mode); const st = tx.objectStore('files')
    const r = fn(st); tx.oncomplete = () => res(r?.result); tx.onerror = rej
  })
}

export async function saveFile(path, blob) {
  await idbDo('readwrite', st => st.put(blob, path)) // keep a local copy for offline viewing
  if (cloudEnabled && status.signedIn) {
    const { error } = await supabase.storage.from('docs').upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
    if (error) throw error
  }
}
export async function getFile(path) {
  const local = await idbDo('readonly', st => st.get(path))
  if (local) return local
  if (cloudEnabled) {
    const { data, error } = await supabase.storage.from('docs').download(path)
    if (error) throw error
    idbDo('readwrite', st => st.put(data, path)).catch(() => {})
    return data
  }
  return null
}
export async function deleteFile(path) {
  await idbDo('readwrite', st => st.delete(path)).catch(() => {})
  if (cloudEnabled && status.signedIn) await supabase.storage.from('docs').remove([path])
}

// Files shared into the app from WhatsApp / email via the Android share menu
export async function takeSharedFiles() {
  return new Promise(res => {
    const q = indexedDB.open('pete-shared', 1)
    q.onupgradeneeded = () => q.result.createObjectStore('shared', { autoIncrement: true })
    q.onsuccess = () => {
      const tx = q.result.transaction('shared', 'readwrite'); const st = tx.objectStore('shared')
      const all = st.getAll(); st.clear()
      tx.oncomplete = () => res(all.result || [])
      tx.onerror = () => res([])
    }
    q.onerror = () => res([])
  })
}

export function useOnline() {
  const [o, setO] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => setO(true), b = () => setO(false)
    window.addEventListener('online', a); window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return o
}
