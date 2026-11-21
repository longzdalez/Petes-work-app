// How to use the app: short, simple steps. Opened from Settings.
import { TopBar, Icon } from '../ui'
import { back } from '../router'

const TOPICS = [
  { t: 'Start a new job', s: ['On the home page, tap New job.', 'Type the job name and client details, then Save.', 'Tap the job to open it. Everything for that job lives inside it.'] },
  { t: 'Inside a job', s: ['Use the buttons along the top: Materials, Money, Schedule, Invoices, Photos, Hours and more.', 'The Overview shows what the job is worth and what has been paid.', 'When the job is done, set it to Finished and it moves to the Finished jobs folder.'] },
  { t: 'Scan a receipt', s: ['On the home page, tap Scan receipt and take a photo (or pick one).', 'The app reads the amount, VAT, shop and date.', 'Pick what it was for, tap B or P for who paid, then Save. Linking it to a job is optional.'] },
  { t: 'Add money in or out', s: ['Tap the £ button on the home page (or Add money in the Money centre).', 'Pick Money out or Money in, then type the amount.', 'Tap What for? and choose: Payment to Pete or Payment to Brian for money in, or Subcontractor, Materials, Vehicle or Miscellaneous for money out.', 'For money out, tap B or P to say who paid. Add a description, and the date if it wasn\'t today.', 'Linking it to a job is optional. Use Save + next to add several in a row, and Undo on the Saved message if you make a mistake.'] },
  { t: 'To-do reminders', s: ['Tap the bell next to a to-do.', 'Pick a quick time, like Tomorrow 8am, or choose a date and time.', 'Tap Save reminder. The first time, allow notifications when your phone asks.', 'Your phone buzzes at that time. If the app was fully closed, the reminder shows as soon as you open it.'] },
  { t: 'Car costs', s: ['Tap the car button on the home page.', 'Fill in ULEZ, congestion, fuel or tickets.', 'Tap B or P for each one, then Save.'] },
  { t: 'Quotes and invoices', s: ['Open the job and tap Invoices & quotes.', 'Tap New invoice or New quote, fill in the lines, then Send or Save PDF.', 'When the client pays, set the status to Paid and pick whose account it went into.'] },
  { t: 'Money centre: who owes who', s: ['Tap the Money centre box on the home page.', 'Tally shows what each of you has put in, taken out, and who owes who.', 'There\'s no business account: the Money centre adds up both your accounts.', 'When one of you pays the other, tap Settle up to record it.'] },
  { t: 'Catching up on earlier payments', s: ['Open the Money centre. On the Tally tab, find Catching up.', 'Tap Pete paid or Brian paid for money one of you spent, or Paid to Pete or Paid to Brian for client money one of you received.', 'Put in the amount, what it was for, a description and the date it was paid.', 'Add them one at a time as you find them. Each counts towards the 50/50 from its date. Tap one in the list to change or delete it.'] },
  { t: 'Money centre: money in', s: ['Open the Money in tab to see every payment in.', 'Each one shows who paid it, whose account it went into (Into), and who it\'s set against.', 'Tap B or P under Set against to change who it counts for. Who owes who changes to match.'] },
  { t: 'Money centre: the other tabs', s: ['Jobs: profit on each job, split 50/50 between you.', 'Tax: how much to keep back for tax, VAT and CIS, and the spreadsheet for the accountant.', 'Payments: every payment. Use Not marked to find ones with no B or P.'] },
  { t: 'End of the month', s: ['In the Money centre, scroll to Monthly summary.', 'Tap Send summary to share the PDF on WhatsApp.', 'Once you\'ve settled up, tap Lock so that month can\'t be changed by accident.'] },
  { t: 'Repeat payments', s: ['Things like van finance or insurance that come out every month.', 'Tap B or P next to each one to say who pays it.', 'Tick it off when it has been paid.'] },
  { t: 'Talk instead of typing', s: ['Tap the orange microphone button.', 'Say what you want to add, like a to-do, a material, hours or some money.', 'Check what it heard, then Save.'] },
  { t: 'Keep it safe', s: ['Settings has Sharing between phones, so you both see the same jobs.', 'In Settings, use Back up your jobs to send a copy to yourself, so nothing is lost if the phone is.'] },
  { t: 'Tick things off from Today', s: ['On the Today card, tap the tick beside a to-do or a material to mark it done without opening it.'] },
]

export default function Help() {
  return (
    <div className="page">
      <TopBar title="How to use the app" sub="Tap a topic to see the steps" onBack={() => back('/settings')} />
      <main className="content">
        {TOPICS.map((x, i) => (
          <details key={i} className="card help-item">
            <summary><span className="help-num">{i + 1}</span>{x.t}<Icon name="down" size={20} /></summary>
            <ol>{x.s.map((s, j) => <li key={j}>{s}</li>)}</ol>
          </details>
        ))}
        <p className="small muted" style={{ textAlign: 'center' }}>Stuck? Ask Claude in the Work App project.</p>
      </main>
    </div>
  )
}
