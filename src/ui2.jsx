// Small display pieces added with the new look (Nov 2026)

const GLYPHS = {
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  warn: 'M12 3l9.5 17h-19zM12 10v4M12 17.5v.5',
}
// Extra icons in the same style as Icon in ui.jsx
export function Glyph({ name, size = 22, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  )
}

// Ring showing how much of the quote is still profit (orange when it's getting low)
export function ProfitRing({ pct, size = 64, sub }) {
  const c = 2 * Math.PI * 22
  const low = pct < 25
  const p = Math.max(0, Math.min(100, pct))
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={`${pct}% of the quote left as profit so far`} className="profit-ring">
      <circle cx="28" cy="28" r="22" fill="none" stroke={low ? '#fff0e2' : '#e6f4ec'} strokeWidth="6.5" />
      {p > 0 && <circle cx="28" cy="28" r="22" fill="none" stroke={low ? '#ff8a3d' : '#3b9268'} strokeWidth="6.5" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 28 28)" />}
      <text x="28" y={sub ? 29 : 32.5} textAnchor="middle" fontSize={pct >= 100 ? 11.5 : 13} fontWeight="900" fill={low ? '#8a4512' : '#1f4d3a'}>{pct}%</text>
      {sub && <text x="28" y="37.5" textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#5d7067">{sub}</text>}
    </svg>
  )
}
