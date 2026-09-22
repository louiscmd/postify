import type { BgSlot, GalleryImage, Tone, Zone } from '../types'
import { W } from '../types'
import { clamp, loadImg } from './util'

export interface ZoneStat {
  lum: number // 0..1 perceived brightness
  busy: number // 0..1 amount of detail/edges
  score: number // 0..1 how good for text (higher = calmer)
}

export interface Analysis {
  cols: number
  rows: number
  slotW: number
  slotH: number
  lum: Float32Array
  busy: Float32Array
  zones: Record<Zone, ZoneStat>
  best: Zone
  tone: Tone
  avgLum: number
}

const cache = new Map<string, Analysis>()

/**
 * Renders the slot exactly like CSS object-fit: cover + object-position + scale(zoom),
 * then measures brightness and edge density on a coarse grid.
 */
export async function analyzeSlot(img: GalleryImage, s: BgSlot, slotW: number, slotH: number): Promise<Analysis> {
  const key = `${img.id}|${s.focusX}|${s.focusY}|${s.zoom}|${slotW}|${slotH}`
  const hit = cache.get(key)
  if (hit) return hit

  const cw = 120
  const ch = Math.round((cw * slotH) / slotW)
  const cv = document.createElement('canvas')
  cv.width = cw
  cv.height = ch
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  const el = await loadImg(img.url)
  const sc = Math.max(cw / el.naturalWidth, ch / el.naturalHeight)
  const dw = el.naturalWidth * sc
  const dh = el.naturalHeight * sc
  const fx = s.focusX / 100
  const fy = s.focusY / 100
  const ox = fx * cw
  const oy = fy * ch
  ctx.translate(ox, oy)
  ctx.scale(s.zoom, s.zoom)
  ctx.translate(-ox, -oy)
  ctx.drawImage(el, (cw - dw) * fx, (ch - dh) * fy, dw, dh)
  const px = ctx.getImageData(0, 0, cw, ch).data

  const L = new Float32Array(cw * ch)
  for (let i = 0; i < cw * ch; i++) L[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255

  const cell = 10
  const cols = Math.floor(cw / cell)
  const rows = Math.max(1, Math.floor(ch / cell))
  const lum = new Float32Array(cols * rows)
  const busy = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let sum = 0
      let sq = 0
      let g = 0
      let n = 0
      for (let y = r * cell; y < Math.min(ch, (r + 1) * cell); y++)
        for (let x = c * cell; x < (c + 1) * cell; x++) {
          const v = L[y * cw + x]
          sum += v
          sq += v * v
          const right = x + 1 < cw ? L[y * cw + x + 1] : v
          const down = y + 1 < ch ? L[(y + 1) * cw + x] : v
          g += Math.abs(right - v) + Math.abs(down - v)
          n++
        }
      const mean = sum / n
      const std = Math.sqrt(Math.max(0, sq / n - mean * mean))
      lum[r * cols + c] = mean
      busy[r * cols + c] = clamp((g / n) / 0.11 * 0.75 + std / 0.22 * 0.25, 0, 1)
    }

  const band = (y0: number, y1: number): ZoneStat => {
    let l = 0
    let b = 0
    let n = 0
    const c0 = Math.floor(cols * 0.06)
    const c1 = Math.ceil(cols * 0.94)
    for (let r = Math.floor(rows * y0); r < Math.max(Math.floor(rows * y0) + 1, Math.ceil(rows * y1)); r++)
      for (let c = c0; c < c1; c++) {
        l += lum[r * cols + c]
        b += busy[r * cols + c]
        n++
      }
    l /= n
    b /= n
    return { lum: l, busy: b, score: clamp(1 - b, 0, 1) }
  }
  const zones: Record<Zone, ZoneStat> = { top: band(0.03, 0.32), middle: band(0.36, 0.64), bottom: band(0.68, 0.97) }
  // Slight bias toward top: hooks read top-down and IG UI covers the bottom edge.
  const ranked = (Object.keys(zones) as Zone[]).sort((a, b) => zones[b].score + (b === 'top' ? 0.04 : 0) - (zones[a].score + (a === 'top' ? 0.04 : 0)))
  const best = ranked[0]
  const avgLum = lum.reduce((a, b) => a + b, 0) / lum.length
  const res: Analysis = { cols, rows, slotW, slotH, lum, busy, zones, best, tone: zones[best].lum > 0.62 ? 'dark' : 'light', avgLum }
  cache.set(key, res)
  return res
}

/** Brightness / busyness under a rectangle given in slot pixel coordinates. */
export function regionStats(a: Analysis, x: number, y: number, w: number, h: number) {
  const c0 = clamp(Math.floor((x / a.slotW) * a.cols), 0, a.cols - 1)
  const c1 = clamp(Math.ceil(((x + w) / a.slotW) * a.cols), c0 + 1, a.cols)
  const r0 = clamp(Math.floor((y / a.slotH) * a.rows), 0, a.rows - 1)
  const r1 = clamp(Math.ceil(((y + h) / a.slotH) * a.rows), r0 + 1, a.rows)
  let l = 0
  let b = 0
  let maxB = 0
  let n = 0
  for (let r = r0; r < r1; r++)
    for (let c = c0; c < c1; c++) {
      l += a.lum[r * a.cols + c]
      b += a.busy[r * a.cols + c]
      maxB = Math.max(maxB, a.busy[r * a.cols + c])
      n++
    }
  return { lum: l / n, busy: b / n, maxBusy: maxB }
}

export const ZONE_LABEL: Record<Zone, string> = { top: 'góra', middle: 'środek', bottom: 'dół' }

/** Compact text summary for the AI prompt. */
export const describe = (a: Analysis) =>
  (Object.keys(a.zones) as Zone[])
    .map((z) => `${z}: brightness ${a.zones[z].lum.toFixed(2)}, busy ${a.zones[z].busy.toFixed(2)}`)
    .join('; ') + `; calmest=${a.best}; suggested tone=${a.tone}`

export const slotSize = (layout: 'single' | 'split') => ({ w: W, h: layout === 'split' ? 675 : 1350 })
