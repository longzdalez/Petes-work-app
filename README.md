# BP Builders (was "Pete Work")

New to this code? Read [HANDOVER.md](HANDOVER.md) first.

A phone app (installable web app) for running building jobs: job list and to-dos, job details, documents, materials checklists with an urgency calendar, money in/out with a forecast, a build schedule, and invoices/quotes as PDFs. Works on any Android phone, including ones without Google services.

## How it works
- React + Vite. GitHub Pages serves the `gh-pages` branch. To publish: `npm run build`, add an empty `dist/.nojekyll`, and push the contents of `dist/` to `gh-pages`.
- Data is saved on the phone first, then synced live between phones through Supabase (`public/config.js` holds the project URL and public key).
- Run `supabase/setup.sql` once in the Supabase SQL editor. Both phones sign in with one shared login; only the first account created can see the data.

## Develop
```
npm install
npm run dev
```
