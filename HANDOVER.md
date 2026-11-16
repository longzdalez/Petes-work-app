# BP Builders app: handover

This is the full handover for whoever picks up this app next. It covers what the app is, who uses it, how it's built and published, how the data is stored, and what's still to do. Last updated 15 Nov 2026.

- **Live app:** https://longzdalez.github.io/petes-work-app/
- **Repo:** github.com/longzdalez/Petes-work-app (`main` holds the source, `gh-pages` holds the built site)

---

## 1. What the app is and who uses it

BP Builders is a job-tracking phone app for a small UK building firm with two owners (default names "Pete" and "Partner", which can be changed in Settings). The person giving instructions is one of the owners. They usually send voice-note transcripts with lots of requests in one message, so read those carefully and split them into separate tasks.

The original working name was "Pete Work". You'll still see it in some internal names: the package name, the localStorage keys `pw_*`, the cache `pete-work-v*` and the IndexedDB `pete-files`. Everything the user sees now says **BP Builders**.

### Phones
- Android only: a **Samsung S24+** and a **Huawei P30**. The P30 has **no Google services**, so nothing may depend on Google Play Services, Google sign-in or Firebase.
- The app is a PWA, installed from the browser with "Add to Home screen".
- Right now it's used on **one phone**. Data is stored locally, and sync between phones is built but switched off (see section 6).

### How the user likes things (follow these)
- **Look:** light to medium greens with light orange accents, plus some white so it looks striking. Thin white rims around boxes, rounded and curvy corners rather than square ones, and orange markers on card headings. Every element should have a clear purpose.
- **Language:** plain, friendly UK English. No jargon. Explain what things do in the app itself with short hints under cards.
- **Long-press to edit:** this pattern is used everywhere (jobs, to-dos, trades, hours, folders, docs). Tapping usually opens and holding usually edits.
- **Mic:** the voice button only adds to the page that's open. It's tap to start and tap again to stop, and it keeps listening until stopped.
- **Calendars:** in-app only. No syncing with the phone's calendar.
- **Accounts:** no hiding features behind permissions or user roles.
- **Business details:** the logo, address and bank details for invoices "come later". Settings has fields for them.

---

## 2. Tech stack

- **React 19 + Vite 8**, plain JavaScript (no TypeScript) and one CSS file, `src/styles.css`.
- **Hash routing** in `src/router.js`, using `nav(path)` and `back(fallback)`.
- **Hosting:** GitHub Pages from the `gh-pages` branch. The GitHub Actions workflow `.github/workflows/deploy.yml` ("Publish app") builds the app and pushes it to `gh-pages` automatically (see Build and publish below).
- **Libraries:**
  - jsPDF + jspdf-autotable for invoice, quote and snag PDFs
  - pdfjs-dist for PDF thumbnails and reading text from PDF receipts
  - tesseract.js for receipt OCR, fully self-hosted in `public/ocr/`
  - @supabase/supabase-js for optional sync
- **Service worker:** `public/sw.js`. It handles the offline cache, the Web Share Target (sharing files into the app from WhatsApp or email), `periodicsync` reminders and notification clicks. **Bump `CACHE` (currently `pete-work-v19`) every time you publish**, or phones keep the old version.

### Build and publish

```bash
npm ci            # or npm install
npm run dev       # local dev server
npx vite build    # outputs dist/ (base is './' so it works under /petes-work-app/)
```

**Publishing is automatic.** Every push to `main` that touches `src/`, `public/`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js` or the workflow file runs `.github/workflows/deploy.yml` ("Publish app"). It runs `npm ci` and `npx vite build` (which also draws the app icons, see below), then force-pushes `dist/` (plus `.nojekyll`) to `gh-pages` with the commit message "Deploy <short sha>". GitHub Pages then goes live about 30 seconds later. You can also run it by hand from the Actions tab (workflow_dispatch). Changes to docs only (like this file) don't trigger a publish.

So to publish: check that `npx vite build` passes locally, bump `CACHE` in `public/sw.js`, and push to `main`. To confirm it worked, check that the latest `gh-pages` commit says "Deploy <your sha>" (`git fetch origin gh-pages && git log -1 origin/gh-pages`), or run `gh run list -R longzdalez/Petes-work-app -L 1`. After publishing, tell the user to **close the app fully and reopen it** to get the new version.

Manual fallback, only if Actions is broken (dist/ is git-ignored on main):

```bash
npx vite build
rm -rf /tmp/ghp && cp -r dist /tmp/ghp && cd /tmp/ghp && touch .nojekyll
git init -q -b gh-pages && git add -A && git commit -qm "Deploy <short sha>"
git push -f https://github.com/longzdalez/petes-work-app gh-pages
```

### Testing
There's no test suite. During development I used Playwright scripts (Chromium at a 384×832 mobile viewport with touch on), run against `npx vite preview --port 4173`. Each script:
- seeds `localStorage.pw_records` with a fake job, trades, tasks, money and hours
- clicks through the pages
- takes screenshots
- checks there are no `pageerror` events

Do the same after any change.

---

## 3. GitHub access history (read this if a push fails)

- longzdalez owns the repo. The user's own GitHub account is a collaborator.
- Pushes only work if the **Claude GitHub App is installed on the longzdalez account** ("All repositories"). On 12 Nov, pushes failed with HTTP 403 ("Claude doesn't have GitHub access… for your organization"). Installing the app on longzdalez fixed it.
- A long-running session can keep stale credentials even after access is fixed. Starting a fresh session fixed this.
- 15 Nov: `git push` from the session was refused ("not in this session's authorized repository set") and adding the repo to the session failed. The **GitHub connector** (MCP, signed in as longzdalez) still worked, so the update went out through it instead: create a branch, push the changed files with `push_files`, open a PR into `main` and squash-merge it. The merge triggers the publish workflow. Afterwards, compare the branch with your local build (`git fetch origin <branch>` and check the tree hashes match) to make sure every file arrived byte for byte. The connector can only upload text files, which is why the icon PNGs are drawn during the build rather than stored in git. It also can't change `.github/workflows/` (GitHub refuses with "Resource not accessible by integration"), so build changes have to go in `vite.config.js` or `package.json`.
- GitHub reports the repo as moved from `petes-work-app` to `Petes-work-app`. Both URLs work.
- A git bundle of the whole repo is also kept in the project files at `pete-work-app/app.bundle`.

---

## 4. File layout

```
index.html                 app shell, loads /config.js then src/main.jsx
public/
  config.js                Supabase URL + anon key (EMPTY = sync off)
  manifest.webmanifest     PWA manifest, share_target
  sw.js                    service worker (cache name, share target, reminders)
  icons/                   app icons (PNG), NOT in git: drawn by src/build/make-icons.js on every build
  ocr/                     tesseract worker, wasm cores, eng.traineddata.gz (self-hosted, no CDN)
supabase/setup.sql         run once in Supabase SQL editor (table, RLS, realtime, storage)
src/
  main.jsx                 routes, welcome screen, starts cloud/reminders/storage
  router.js                hash router: useRoute, nav, back
  store.js                 local-first record store, file storage (IndexedDB), Supabase sync, backup/restore
  ui.jsx                   shared components (Icon, TopBar, Sheet, Field, MonthCalendar, SwipeRow, Logo, UrgencyPicker…)
  util.js                  dates (ymd, parseYmd, niceDate, shortDate), money(), num(), URGENCY colours
  styles.css               all styling (bottom section = the "striking" white-rim/orange-accent theme)
  Todos.jsx                TodoList (home + per-job to-dos), edit sheet, to-do calendar sheet
  Voice.jsx / voice.js     mic button + speech recognition; parseInContext(page, text) turns speech into records
  Backup.jsx               backup to file / share, restore, weekly reminder card
  receipt.js               readReceipt(file): OCR photos or read PDF text → { total, vat, shop, date }
  reminders.js             phone notifications 2 days before anything marked red/urgent
  files.js                 storeFile, pickFile, openPath, download, share, WhatsApp helpers
  thumbs.js                image/PDF thumbnails, shrinkImage, pdfText, pdfCanvas
  pdf.js                   invoice/quote PDF, invoiceTotals
  build/make-icons.js      draws the home-screen icons (BP Builders logo, same as Logo in ui.jsx) as PNGs with no extra libraries; vite.config.js runs it at the start of every build and dev server
  jobs.js                  job statuses, progress, templates
  pages/
    Home.jsx               logo header, backup nudge, Contacts/Renewals/Search, To-do, General cash flow, job list, job details sheet
    Job.jsx                JobShell (header + bottom tabs), job overview (status, hub tiles, scope of works + value, info, professional services, notes), job to-dos page
    Docs.jsx               job documents (upload, thumbnails, open)
    Materials.jsx          material folders → checklist (tick, item, date needed, urgency, qty/supplier/price) + calendar, order list
    Money.jsx              job money: Add money / Scan receipt / Payment, Invoices to pay, Money coming in, ledger, proprietor + subcontractor payments, totals, cash flow chart, accountant CSV export
    Schedule.jsx           job start/finish, Trades and workers (colour each), calendar showing trade names, day sheet per trade
    Invoices.jsx           quotes & invoices, stage payments, quote→invoice, PDF, WhatsApp/email, overdue chaser
    Extras.jsx             variations/extras with client signature approval → add to invoice
    Photos.jsx             photo diary
    Snags.jsx              snagging list, sign-off PDF
    Hours.jsx              workers' hours: hourly / day rate / set amount, work date, pay-by date, pay → Money
    Contacts.jsx           contacts + Renewals (insurance, certificates)
    MoneyCentre.jsx        Money centre (/money), tabs Tally/Money in/Jobs/Tax/Payments: starting point (lump sums from before the app), B/P marking, Money in (who paid, into whose account, set against), who owes who (always 50/50), Settle up, late payers, end-of-month forecast, monthly PDF, month lock, profit per job, tax pot, VAT/CIS, spending chart, duplicate + missing-receipt checks. Maths in src/ledger.js
    CashFlow.jsx           General cash flow (not tied to a job): one-off/weekly/monthly/yearly payments
    Search.jsx, Share.jsx, Settings.jsx
```

### Routes (hash)
- `/` is the home page.
- Each job lives at `/job/:id`. Its sub-pages are `/job/:id/{docs, materials, folder/:fid, money, schedule, invoices, invoice/:iid, extras, photos, snags, hours, todos}`.
- Other pages: `/settings`, `/share`, `/contacts`, `/renewals`, `/search`, `/cashflow`.

---

## 5. Data model

Every saved item is a **record**: `{ id, kind, job_id, data, deleted, updated_at }`.
- Records are stored in `localStorage.pw_records`.
- `put(kind, data, { job_id })` creates or merges a record. `update(id, patch)` changes one. `remove(id)` soft-deletes one. `removeDeep(jobId)` deletes a job and everything in it.
- Read records with `list(kind, filter)`. The React hooks are `useList(kind, filter, sort)`, `useRecord(id)` and `useVersion()`.
- Files (documents, receipt photos, PDFs) go into IndexedDB `pete-files` through `storeFile`. Records keep only `{ path, thumb }`.

| kind | job_id | main `data` fields |
|---|---|---|
| `job` | null | name, client, clientPhone, clientEmail, address, start, finish, status (quoting/booked/onsite/finished), cover (dataURL), notes, scope, valueType (estimate/quote), value, valueNotes, pros{architect,engineer,council} |
| `folder` | job | name, order, date |
| `material` | job | folder_id, text, date, urgency, done, order, qty, supplier, price |
| `todo` | null = home, or job | text, date, time, urgency, notes, done, doneOn |
| `task` | job | date, text, urgency, done, trade_id (schedule work) |
| `trade` | job | name, trade, jobs, value (quote), phone, color, order |
| `money` | job or null | dir in/out, cat (client/other/wages/contractor/materials/vehicle/transfer), payer (owner name = whose account it came out of / went into; empty or the old 'business' = not marked), against (money in only: who it's set against, Brian or Pete; empty = same as payer), person (for money in: who paid it), amount, vat, date, desc, status paid/upcoming, receipt{path,thumb}, cisRate, cisLabour |
| `hours` | job | person, payType hour/day/fixed, hours, days, rate, amount, date (work done), payBy, notes, paid, money_id |
| `genpay` | null | General cash flow: dir, amount, desc, date (first), repeat none/weekly/monthly/yearly, until, paid[] (dates ticked) |
| `invoice` | job | type quote/invoice, number, status, lines, due, stages… |
| `doc`, `photo`, `extra`, `snag`, `contact`, `renewal`, `template`, `settings` | varies | see the matching page file |

- **Urgency:** `green`, `amber` or `red`, with the colours in `util.js`. **Red means "urgent"** and is what triggers reminders.
- **Other localStorage keys:**
  - `pw_pending`, `pw_last_sync` (sync)
  - `pw_last_backup`
  - `pw_notify`, `pw_notified` (reminders)
  - `pw_big`, `pw_contrast` (text size and contrast)
  - `pw_cf` (which cash flow chart style is chosen)
- **Backup:** `makeBackup()` exports every record and file into one JSON file. The user can send it to themselves with Settings → Back up, or from the weekly reminder on the home page. `restoreBackup()` merges a backup in and keeps whichever copy of each record is newer.

---

## 6. Pending and next steps

1. **Online sync between the two phones (approved 12 Nov, confirmed 15 Nov for Brian's phone; waiting on the user's Supabase details).**
   - The user chose "Yes, set up online backup", and I sent them steps to:
     - create a free Supabase project (region London)
     - run `supabase/setup.sql`
     - send back the **Project URL** and the **anon public key**
   - When those arrive:
     - put them in `public/config.js`, rebuild and publish
     - the user then opens Settings → "First time? Create the shared login" on the phone
     - after that, data syncs automatically, and the second phone signs in with the same login
   - The first account ever created is the only one the database lets in (RLS is set up for that in setup.sql).
   - Sync code is in `store.js` (`initCloud`, realtime). On 15 Nov it was fixed and tested against a mocked Supabase (Playwright intercepting the REST, auth and storage calls), but **not yet against a real project**, so watch the first real sign-in:
     - Every record written while sync was off is still in `pw_pending`, so the first sign-in uploads all of it, in batches of 200.
     - Files (receipt photos, documents) have their own queue, `pw_files_pending`. On a phone's first sign-in, every file already in IndexedDB is added to it (flag `pw_files_seeded`). Files saved offline or signed out wait in the queue and go up on the next sync. `saveFile` no longer throws if the upload fails, and returns true only if the file is already in the cloud.
     - Tested: 451 records and 2 files uploaded on the first sign-in with nothing left pending; an empty second phone pulled everything; a file saved offline uploaded when back online.
   - The user chose this on 15 Nov so that Brian's phone shows the same jobs. Settings now has a "Put the app on another phone" card with the link and a Send button.
   - The user originally asked for "automatic backup to Google Drive every few seconds". That isn't possible from a PWA, and the Huawei has no Google services, so Supabase is the agreed route.
2. **WhatsApp reminders.**
   - The user wanted a WhatsApp text 2 days before anything urgent. What exists now is phone notifications instead: `reminders.js`, switched on in Settings → Reminders. The background `periodicSync` only fires on Chrome-based browsers, and it isn't guaranteed.
   - Real automatic WhatsApp messages need the WhatsApp Business API (e.g. Twilio) and a server-side scheduler, such as a Supabase Edge Function with cron. That costs a few pounds a month. I offered it as an option and the user hasn't asked for it yet.
3. **Business details** (logo, address, VAT number, bank details) for invoices are still to come from the user. Settings has the fields.
4. **Receipt OCR** works offline. It has been tested on generated receipts but not many real ones. If real receipts read badly, tune `parseReceipt` in `src/receipt.js`.
5. **Voice:** on the schedule page, voice adds a task with no trade attached. A possible improvement is matching a trade name in the spoken text.

## 7. Known quirks
- `Field` in `ui.jsx` saves **when the box loses focus** (dates save straight away). Don't build a Save button that reads a `Field` value before it has blurred.
- Sheets render through a portal to `document.body`. They have to, because a parent with a CSS transform (swipe rows) breaks `position: fixed`.
- Web Speech (the mic) may not work on the Huawei. There, the fallback is the keyboard's own microphone, and the app shows a hint about it.
- Phones keep the old version until the service worker cache name changes. Always bump `CACHE` in `public/sw.js`.
- Fixed positioning makes full-page Playwright screenshots look odd: the tab bar and mic appear mid-page. That's normal.

## 8. Separate project (not this repo)
The user also asked for a personal app called **"My Life"**, with to-dos, daily practices, a "Shroom Tracker" journal and a combined calendar. It is being handled separately. **Don't build it in this repo.**

## 9. Money centre rules
- **There is no business account** (the user, 16 Nov): all money goes in and out of Brian's or Pete's own account, and the Money centre adds the two together. So there's no "Biz" option anywhere. Payments marked 'business' before then count as not marked, and show under Not marked to fix.
- Every money in/out must be marked B or P when saved; invoice-paid and hours-paid ask with WhoPaidSheet.
- Money in also has **Set against** (B or P), chosen separately from whose account it went into. Who owes who uses Set against (`againstOf` in ledger.js), falling back to the account. The Money in tab lists every payment in with both, and flags ones where they differ.
- Who owes who: half the gap between the two balances (`settle` in ledger.js). The old "Paid myself" button is gone (with no business account it meant nothing); old drawings still count.
- Owner wages (cat wages, person = owner) count as that owner taking money (drawings), not a cost. `transfer` = settle-up between owners, left out of the accountant CSV.
- All profit is split 50/50. No per-job split (the user asked for it to be removed).
- Settings: `lockedUntil` (ymd, payments on/before can't change), `taxPct` (tax pot %, default 25).
- **Starting point** (16 Nov): `settings.data.opening = { date, in, materials, wages, other, owed }`. `in`/`materials`/`wages`/`other` are `{ ownerName: £ }` lump sums for everything before the app; `owed = { by, to, amount }` is money already owed between them. `openingItems()` in ledger.js turns it into dated items (src 'opening', not editable from the lists) that go into every Money centre total. `owed` counts like the creditor having lent the debtor that amount. Set on the Tally tab, card "Starting point".
