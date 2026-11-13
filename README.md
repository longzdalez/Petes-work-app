# BP Builders (was "Pete Work")

New to this code? Read [HANDOVER.md](HANDOVER.md) first.

A phone app (installable web app) for running building jobs: job list and to-dos, job details, documents, materials checklists with an urgency calendar, money in/out with a forecast, a build schedule, and invoices/quotes as PDFs. Works on any Android phone, including ones without Google services.

Live app: https://longzdalez.github.io/Petes-work-app/ (capital P: the lower-case address no longer works since the repo was renamed).

## How it works
- React + Vite. GitHub Pages serves the `gh-pages` branch.
- **Publishing is automatic** (since 13 Nov 2026): every push to `main` that touches the app runs `.github/workflows/deploy.yml`, which builds and force-pushes `dist/` to `gh-pages`. It can also be run by hand from the Actions tab. Still bump `CACHE` in `public/sw.js` with each release so phones pick up the new version.
- The new look (Nov 2026) lives in `src/redesign.css` (loaded after `styles.css`), `src/summary.js` (Today list, job money, urgent count) and `src/ui2.jsx` (profit ring, extra icons). Job pages have 4 tabs plus a More sheet (`MORE` in `src/pages/Job.jsx`).
- Data is saved on the phone first, then synced live between phones through Supabase (`public/config.js` holds the project URL and public key).
- Run `supabase/setup.sql` once in the Supabase SQL editor. Both phones sign in with one shared login; only the first account created can see the data.

## Develop
```
npm install
npm run dev
```
