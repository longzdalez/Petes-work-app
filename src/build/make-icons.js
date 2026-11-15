// Draws the home-screen icons (PNG) from the BP Builders logo, with no extra libraries.
// The logo is the same as the Logo in src/ui.jsx: white-to-pale-green tile, green roof, orange chimney, "BP".
// vite.config.js runs this at the start of every build (and `npm run dev`), writing into public/icons/.
// The PNGs aren't kept in git: the GitHub connector can only upload text files, so they're made here instead.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const GREEN = [0x2f, 0x7a, 0x57], ORANGE = [0xff, 0x9f, 0x55], TOP = [255, 255, 255], BOTTOM = [0xe6, 0xf4, 0xec]
// "BP" from Nunito Black, as a shape (logo units: the tile is 48 x 48)
const BP = 'M15.57 38Q14.86 38 14.49 37.63Q14.12 37.27 14.12 36.58V28.85Q14.12 28.16 14.49 27.79Q14.86 27.43 15.57 27.43H19.23Q20.37 27.43 21.17 27.76Q21.97 28.1 22.39 28.71Q22.81 29.33 22.81 30.16Q22.81 31.09 22.28 31.75Q21.75 32.41 20.83 32.65V32.41Q21.91 32.6 22.5 33.28Q23.09 33.95 23.09 35Q23.09 36.4 22.1 37.2Q21.1 38 19.38 38ZM16.77 35.98H19Q19.77 35.98 20.12 35.68Q20.47 35.39 20.47 34.8Q20.47 34.22 20.12 33.94Q19.77 33.65 19 33.65H16.77ZM16.77 31.62H18.73Q19.48 31.62 19.83 31.36Q20.19 31.09 20.19 30.53Q20.19 29.98 19.83 29.71Q19.48 29.45 18.73 29.45H16.77ZM26.54 38.13Q25.88 38.13 25.52 37.77Q25.16 37.4 25.16 36.74V28.82Q25.16 28.14 25.52 27.79Q25.89 27.43 26.55 27.43H30.24Q32.04 27.43 33.02 28.35Q34.01 29.27 34.01 30.89Q34.01 32.51 33.02 33.43Q32.04 34.35 30.24 34.35H27.91V36.74Q27.91 37.4 27.57 37.77Q27.23 38.13 26.54 38.13ZM27.91 32.24H29.76Q30.54 32.24 30.96 31.9Q31.38 31.57 31.38 30.89Q31.38 30.2 30.96 29.87Q30.54 29.54 29.76 29.54H27.91Z'

// Path (absolute M, H, V, Q, Z only) -> list of edges [x0, y0, x1, y1]
function pathEdges(d) {
  const t = d.match(/[MHVQZ]|-?\d*\.?\d+/g), e = []
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = ''
  const n = () => +t[i++], line = (x1, y1) => { e.push([x, y, x1, y1]); x = x1; y = y1 }
  while (i < t.length) {
    if (/[A-Z]/.test(t[i])) cmd = t[i++]
    if (cmd === 'M') { x = sx = n(); y = sy = n() }
    else if (cmd === 'H') line(n(), y)
    else if (cmd === 'V') line(x, n())
    else if (cmd === 'Q') {
      const cx = n(), cy = n(), ex = n(), ey = n(), x0 = x, y0 = y
      for (let k = 1; k <= 8; k++) { const s = k / 8, u = 1 - s; line(u * u * x0 + 2 * u * s * cx + s * s * ex, u * u * y0 + 2 * u * s * cy + s * s * ey) }
    } else if (cmd === 'Z') { line(sx, sy); cmd = '' }
  }
  return e
}
const BP_EDGES = pathEdges(BP)

const inRoundRect = (x, y, rx, ry, w, h, r) => {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false
  const cx = Math.min(Math.max(x, rx + r), rx + w - r), cy = Math.min(Math.max(y, ry + r), ry + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
const segDist2 = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
}
const onRoof = (x, y) => segDist2(x, y, 8, 23, 24, 10) <= 4 || segDist2(x, y, 24, 10, 40, 23) <= 4
// Non-zero winding test against the "BP" outline
function inBP(x, y) {
  if (x < 14 || x > 34.1 || y < 27.4 || y > 38.2) return false
  let w = 0
  for (const [x0, y0, x1, y1] of BP_EDGES) {
    if ((y0 <= y) !== (y1 <= y)) { const xi = x0 + (y - y0) * (x1 - x0) / (y1 - y0); if (xi > x) w += y1 > y0 ? 1 : -1 }
  }
  return w !== 0
}

// view: [left, top, width] of the square of logo units to draw; tile: true = rounded tile with see-through corners
function render(size, [vx, vy, vw], tile) {
  const S = 4, px = new Uint8Array(size * size * 4), k = vw / size
  // background gradient runs corner to corner across the tile (or the whole square)
  const [gx, gy, gw] = tile ? [2, 2, 44] : [vx, vy, vw]
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let bg = 0, ch = 0, rf = 0, tx = 0
    for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
      const x = vx + (i + (a + 0.5) / S) * k, y = vy + (j + (b + 0.5) / S) * k
      if (!tile || inRoundRect(x, y, 2, 2, 44, 44, 14)) bg++
      if (inRoundRect(x, y, 31, 9, 5, 9, 1.5)) ch++
      if (onRoof(x, y)) rf++
      if (inBP(x, y)) tx++
    }
    const cx = vx + (i + 0.5) * k, cy = vy + (j + 0.5) * k
    const g = Math.max(0, Math.min(1, ((cx - gx) + (cy - gy)) / (2 * gw)))
    let col = TOP.map((c, n) => c + (BOTTOM[n] - c) * g), al = bg / (S * S)
    for (const [cov, c] of [[ch, ORANGE], [rf, GREEN], [tx, GREEN]]) {
      const f = cov / (S * S); if (!f) continue
      const na = f + al * (1 - f)
      col = col.map((v, n) => (c[n] * f + v * al * (1 - f)) / na); al = na
    }
    const o = (j * size + i) * 4
    px[o] = Math.round(col[0]); px[o + 1] = Math.round(col[1]); px[o + 2] = Math.round(col[2]); px[o + 3] = Math.round(al * 255)
  }
  return png(size, px)
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, px) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let j = 0; j < size; j++) { raw[j * (size * 4 + 1)] = 0; Buffer.from(px.buffer, j * size * 4, size * 4).copy(raw, j * (size * 4 + 1) + 1) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

export const ICONS = [
  ['icon-512.png', 512, [2, 2, 44], true],              // rounded tile, see-through corners
  ['icon-192.png', 192, [2, 2, 44], true],
  ['favicon-32.png', 32, [2, 2, 44], true],
  ['icon-512-maskable.png', 512, [-6, -6, 60], false], // full square, logo inside the safe zone (phones crop it to a circle or squircle)
  ['apple-touch-icon.png', 180, [0, 0, 48], false],    // full square: iPhones add their own rounded corners
]

export function makeIcons(outDir) {
  mkdirSync(outDir, { recursive: true })
  for (const [name, size, view, tile] of ICONS) writeFileSync(`${outDir}/${name}`, render(size, view, tile))
}
