/**
 * Layout engine: positions everything on a slide from *style rules* + randomness,
 * never from fixed coordinates. The same content re-rolled with a new seed gives
 * a different — but always readable — arrangement.
 */
import type { Analysis } from '../lib/analyze'
import { uid } from '../lib/util'
import type { Block, DoodleEl, FontKey, ImageEl, Preset, Slide, StackEl, TextStyle, Zone } from '../types'
import { H, W } from '../types'

// ── seeded random ────────────────────────────────────────────
export type Rand = () => number
export const rng = (seed: number): Rand => {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const newSeed = () => Math.floor(Math.random() * 2 ** 31)
const pick = <T,>(r: Rand, a: readonly T[]) => a[Math.floor(r() * a.length)]
const range = (r: Rand, a: number, b: number) => a + r() * (b - a)

// ── per-style rules (the "feel", not positions) ─────────────
interface Rules {
  aligns: TextStyle['align'][]
  width: [number, number] // fraction of canvas for short text
  widthLong: [number, number] // … for long text
  margin: [number, number]
  titleScale: [number, number]
  doodle: number // chance to add a hand-drawn arrow
  doodleKinds: DoodleEl['kind'][]
  underline: number // chance to keep the title underline (story)
  justify: number // chance to justify a statement paragraph
  insetRadius: [number, number]
}

export const RULES: Record<Preset['family'], Rules> = {
  editorial: {
    aligns: ['left', 'left', 'center', 'right'],
    width: [0.54, 0.82],
    widthLong: [0.66, 0.88],
    margin: [60, 112],
    titleScale: [0.88, 1.12],
    doodle: 0.55,
    doodleKinds: ['curl', 'loop', 'swoosh', 'curve'],
    underline: 0,
    justify: 0.5,
    insetRadius: [18, 40],
  },
  story: {
    aligns: ['left', 'left', 'center'],
    width: [0.64, 0.88],
    widthLong: [0.8, 0.9],
    margin: [56, 96],
    titleScale: [0.88, 1.08],
    doodle: 0.25,
    doodleKinds: ['curve', 'swoosh', 'curl'],
    underline: 0.6,
    justify: 0,
    insetRadius: [2, 14],
  },
  split: {
    aligns: ['center', 'center', 'left'],
    width: [0.66, 0.88],
    widthLong: [0.8, 0.9],
    margin: [60, 100],
    titleScale: [0.9, 1.1],
    doodle: 0.1,
    doodleKinds: ['straight', 'swoosh'],
    underline: 0,
    justify: 0,
    insetRadius: [8, 24],
  },
}

// ── text measurement estimates ───────────────────────────────
const CHAR_W: Partial<Record<FontKey, number>> = {
  'DM Serif Display': 0.5,
  Gloock: 0.52,
  'Playfair Display': 0.52,
  'Abril Fatface': 0.5,
  Archivo: 0.56,
  Arimo: 0.53,
  Montserrat: 0.6,
  'Be Vietnam Pro': 0.53,
  Inter: 0.55,
  Sacramento: 0.36,
  Caveat: 0.42,
}
export const charW = (st: TextStyle) => (CHAR_W[st.font] ?? 0.55) * (st.uppercase ? 1.18 : 1) * (1 + st.letterSpacing)
const plain = (s: string) => s.replace(/\*\*|==/g, '')
const styleOf = (preset: Preset, b: Block): TextStyle => ({ ...preset.styles[b.styleKey], ...b.overrides })

export const estBlock = (b: Block, st: TextStyle, width: number) => {
  if (b.kind === 'chips') {
    let rows = 1
    let x = 0
    for (const it of b.items.filter(Boolean)) {
      const w = (it.length * charW(st) + 0.7) * st.size + b.gapX
      if (x + w > width && x > 0) {
        rows++
        x = 0
      }
      x += w
    }
    return rows * st.size * 1.35 + (rows - 1) * b.gapY
  }
  const paras = b.text.split(/\n\s*\n/)
  let lines = 0
  for (const p of paras)
    for (const l of p.split('\n')) {
      const avail = width - (/^\s*[-•]\s+/.test(l) ? st.size * 1.35 : 0)
      const txt = plain(l).replace('||', '    ')
      lines += Math.max(1, Math.ceil((txt.length * charW(st) * st.size) / Math.max(40, avail)))
    }
  return lines * st.size * st.lineHeight + (paras.length - 1) * st.paragraphGap * st.size
}
export const estStack = (el: StackEl, preset: Preset) => el.blocks.reduce((h, b) => h + b.marginTop + estBlock(b, styleOf(preset, b), el.w), 0)

/** Largest size ≤ base at which a headline wraps to ≤ maxLines and its longest word fits. */
const fitHead = (text: string, base: number, width: number, cw: number, maxLines: number, min: number) => {
  const t = plain(text).replace('||', ' ')
  const longest = Math.max(1, ...t.split(/\s+/).map((w) => w.length))
  let size = Math.min(base, width / (longest * cw))
  const lines = (sz: number) => t.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil((l.length * cw * sz) / width)), 0)
  while (size > min && lines(size) > maxLines) size -= 2
  return Math.round(Math.max(min, size))
}

const HEADLINE = new Set(['title', 'keyword'])

/** Sizes headlines to their box, then shrinks everything until the stack fits `maxH`. */
function autosize(el: StackEl, preset: Preset, r: Rand, maxH: number) {
  const R = RULES[preset.family]
  const scale = range(r, ...R.titleScale)
  for (const b of el.blocks) {
    const baseSt = preset.styles[b.styleKey]
    delete b.overrides.size
    if (b.kind === 'text' && HEADLINE.has(b.styleKey)) {
      const words = plain(b.text).split(/\s+/).filter(Boolean).length
      const st = styleOf(preset, b)
      b.overrides.size = fitHead(b.text, baseSt.size * scale, el.w, charW(st), words <= 3 ? 2 : 3, Math.round(baseSt.size * 0.42))
    }
  }
  for (let guard = 0; guard < 40 && estStack(el, preset) > maxH; guard++) {
    for (const b of el.blocks) {
      const cur = styleOf(preset, b).size
      const min = HEADLINE.has(b.styleKey) ? 44 : b.styleKey === 'number' ? 56 : 24
      b.overrides.size = Math.max(min, Math.round(cur * 0.95))
    }
  }
}

function setAlign(el: StackEl, align: TextStyle['align']) {
  for (const b of el.blocks) {
    if (b.selfAlign === 'end') continue // e.g. a post-title pinned to the right edge of the lockup
    if (b.overrides.align === 'justify' && align !== 'right' && b.styleKey === 'body') continue
    // bullets only read well flush-left; the box itself can still sit anywhere
    const bulleted = b.kind === 'text' && /^\s*[-•]\s+/m.test(b.text)
    b.overrides.align = bulleted ? 'left' : align
    b.selfAlign = 'stretch'
  }
}

/** Dark text only on bright AND calm areas; bright-but-busy gets white text + gradient instead. */
const wantsDark = (z: { lum: number; busy: number } | undefined) => !!z && z.lum > 0.62 && z.busy < 0.4

function applyTone(el: StackEl, preset: Preset, lum: number, busy = 0) {
  for (const b of el.blocks) {
    if (b.kind !== 'text') continue
    if (wantsDark({ lum, busy })) Object.assign(b.overrides, { color: preset.dark, shadow: 'none' })
    else if (b.overrides.color === preset.dark) {
      delete b.overrides.color
      delete b.overrides.shadow
    }
  }
}

/** Random zone, weighted toward calm areas of the photo (and the AI's hint, if any). */
function pickZone(r: Rand, a: Analysis | null | undefined, allowed: Zone[], hint?: Zone | 'auto') {
  const weights = allowed.map((z) => {
    let w = a ? Math.pow(a.zones[z].score, 3) + 0.02 : z === 'top' ? 0.5 : z === 'bottom' ? 0.3 : 0.2
    if (hint && hint !== 'auto' && hint === z) w *= 4
    return w
  })
  let t = r() * weights.reduce((s, w) => s + w, 0)
  for (let i = 0; i < allowed.length; i++) if ((t -= weights[i]) <= 0) return allowed[i]
  return allowed[allowed.length - 1]
}

export interface ArrangeOpts {
  hint?: Zone | 'auto'
  decorate?: boolean // allowed to add a new hand-drawn arrow (fresh slides only)
}

/** Positions every element of `slide` in place. */
export function arrange(slide: Slide, preset: Preset, analyses: (Analysis | null | undefined)[], seed: number, opts: ArrangeOpts = {}) {
  const r = rng(seed)
  const R = RULES[preset.family]
  slide.seed = seed
  const stacks = slide.elements.filter((e): e is StackEl => e.type === 'stack')
  const insets = slide.elements.filter((e): e is ImageEl => e.type === 'image')
  const doodles = slide.elements.filter((e): e is DoodleEl => e.type === 'doodle')
  const m = Math.round(range(r, ...R.margin))
  slide.overlay = { top: 0, bottom: 0, dim: 0 }

  // ── 50/50 split: one group per half, shared alignment for rhythm ──
  if (slide.layout === 'split') {
    const halves = [...stacks].sort((a, b) => (a.role === 'top' ? -1 : b.role === 'top' ? 1 : a.y - b.y))
    const align = pick(r, R.aligns)
    const w = Math.min(W - 2 * m, Math.round(W * range(r, 0.7, 0.9)))
    halves.slice(0, 2).forEach((el, i) => {
      const a = analyses[i]
      const z = pickZone(r, a, ['top', 'middle', 'bottom'])
      const rel = { top: 0.3, middle: 0.5, bottom: 0.7 }[z] + range(r, -0.05, 0.05)
      el.anchor = 'center'
      el.w = w
      el.x = align === 'left' ? m : align === 'right' ? W - m - w : Math.round((W - w) / 2)
      el.y = Math.round(i * (H / 2) + rel * (H / 2))
      setAlign(el, align)
      autosize(el, preset, r, (H / 2) * 0.55)
      const zs = a?.zones[z]
      applyTone(el, preset, zs ? zs.lum : 0.2, zs?.busy)
      // busy/bright half with light text: a soft band behind the line keeps it readable
      if (zs && !wantsDark(zs) && (zs.busy > 0.38 || zs.lum > 0.5)) slide.overlay.dim = Math.max(slide.overlay.dim, 0.25)
    })
    halves.slice(2).forEach((el, i) => {
      el.anchor = 'bottom'
      el.y = H - 60 - i * 160
    })
    return slide
  }

  // ── single photo ──
  const main = stacks.find((s) => s.role === 'main') ?? stacks.find((s) => s.role !== 'caption') ?? stacks[0]
  const caption = stacks.find((s) => s !== main && s.role === 'caption')
  const extras = stacks.filter((s) => s !== main && s !== caption)
  const a = analyses[0]
  const role = slide.role ?? 'content'
  const inset = insets[0]
  let allowed: Zone[] = ['top', 'middle', 'bottom']
  if (caption) allowed = ['top', 'middle']
  if (role === 'cover' && !caption) allowed = ['top', 'bottom', 'top', 'middle']
  const zone = pickZone(r, a, allowed, opts.hint)
  let align = pick(r, R.aligns)

  if (main) {
    const words = main.blocks.reduce((n, b) => n + plain(b.kind === 'text' ? b.text : b.items.join(' ')).split(/\s+/).filter(Boolean).length, 0)
    let maxH: number
    if (inset) {
      const side = pick(r, ['left', 'right'] as const)
      inset.w = Math.round(range(r, 290, 400))
      inset.h = Math.round(inset.w * range(r, 1.25, 1.6))
      inset.radius = Math.round(range(r, ...R.insetRadius))
      inset.rotation = r() < 0.25 ? Math.round(range(r, -3, 3)) : 0
      inset.y = zone === 'bottom' ? Math.round(H - inset.h - range(r, 80, 150)) : Math.round(range(r, 56, 150))
      inset.x = side === 'left' ? m : W - m - inset.w
      main.w = W - 2 * m - inset.w - 44
      main.x = side === 'left' ? inset.x + inset.w + 44 : m
      main.anchor = 'top'
      main.y = inset.y + Math.round(range(r, 0, 60))
      if (align === 'center') align = 'left'
      maxH = H - main.y - 100
      insets.slice(1).forEach((x, i) => {
        x.x = W - m - x.w - i * 30
        x.y = H - x.h - 90
      })
    } else {
      const wr = words > 22 ? R.widthLong : R.width
      main.w = Math.min(W - 2 * m, Math.round(W * range(r, ...wr)))
      main.x = align === 'left' ? m : align === 'right' ? W - m - main.w : Math.round((W - main.w) / 2)
      if (zone === 'top') Object.assign(main, { anchor: 'top', y: Math.round(range(r, 64, 170)) })
      else if (zone === 'bottom') Object.assign(main, { anchor: 'bottom', y: Math.round(range(r, 1160, 1265)) })
      else Object.assign(main, { anchor: 'center', y: Math.round(range(r, 560, caption ? 700 : 790)) })
      // long text may take more of the slide before it starts shrinking (readability > photo space)
      maxH = (zone === 'middle' ? H * 0.56 : H * 0.46) * (words > 40 ? 1.35 : 1)
      if (words > 40 && zone !== 'middle') main.y = zone === 'top' ? Math.min(main.y, 110) : Math.max(main.y, 1230)
    }
    main.rotation = 0
    setAlign(main, align)
    autosize(main, preset, r, maxH)

    // readability: gradient behind the text zone when the photo there is bright or busy
    const zs = a?.zones[zone]
    const tonedDark = wantsDark(zs)
    applyTone(main, preset, zs ? zs.lum : 0.2, zs?.busy)
    if (zs && !tonedDark && (zs.busy > 0.38 || zs.lum > 0.42)) {
      // brighter/busier background → stronger gradient
      const k = Math.min(0.85, range(r, 0.4, 0.6) + Math.max(0, zs.lum - 0.5) * 0.6 + Math.max(0, zs.busy - 0.4) * 0.4)
      if (zone === 'top') slide.overlay.top = k
      else if (zone === 'bottom') slide.overlay.bottom = Math.min(0.9, k * 1.2)
      else slide.overlay.dim = Math.round(k * 0.35 * 100) / 100
    }

    // hand-drawn arrows follow the text instead of sitting at fixed spots
    if (opts.decorate && !doodles.length && !inset && r() < R.doodle) {
      const d: DoodleEl = {
        id: uid(), type: 'doodle', kind: pick(r, R.doodleKinds), x: 0, y: 0, w: 110, h: 120,
        color: r() < 0.5 ? preset.accent : tonedDark ? preset.dark : '#ffffff', stroke: 3, rotation: 0, flipX: false, flipY: false,
      }
      d.stroke = d.kind === 'loop' ? 5 : 3
      slide.elements.push(d)
      doodles.push(d)
    }
    const est = estStack(main, preset)
    const top = main.anchor === 'top' ? main.y : main.anchor === 'bottom' ? main.y - est : main.y - est / 2
    const bottom = top + est
    doodles.forEach((d) => {
      const wide = d.kind === 'straight' || d.kind === 'swoosh' || d.kind === 'underline'
      d.w = Math.round(range(r, 90, 135))
      d.h = Math.round(d.w * (wide ? range(r, 0.45, 0.7) : range(r, 1.0, 1.35)))
      const below = H - bottom - 110 > d.h + 20
      d.y = Math.round(below ? bottom + range(r, 0, 30) : top - d.h - range(r, 10, 30))
      d.flipY = !below && !wide
      if (align === 'right') {
        d.x = Math.round(main.x + main.w * range(r, 0.02, 0.3) - d.w * 0.5)
        d.flipX = true
      } else if (align === 'center') {
        d.x = r() < 0.5 ? Math.round(main.x + main.w * 0.8) : Math.round(main.x + main.w * 0.1 - d.w * 0.4)
        d.flipX = d.x < W / 2
      } else {
        d.x = Math.round(main.x + main.w * range(r, 0.55, 0.9))
        d.flipX = false
      }
      d.x = Math.max(24, Math.min(W - d.w - 24, d.x))
      d.y = Math.max(24, Math.min(H - d.h - 90, d.y))
      d.rotation = Math.round(range(r, -12, 12))
    })
  }

  if (caption) {
    caption.w = Math.round(W * range(r, 0.78, 0.9))
    caption.x = Math.round((W - caption.w) / 2)
    caption.anchor = 'bottom'
    caption.y = Math.round(range(r, 1195, 1262))
    caption.rotation = 0
    setAlign(caption, pick(r, ['center', 'center', 'left'] as const))
    autosize(caption, preset, r, 320)
    applyTone(caption, preset, 0)
    slide.overlay.bottom = Math.max(slide.overlay.bottom, range(r, 0.72, 0.9))
  }

  // manually added groups: stack them in whatever zone the main text isn't using
  extras.forEach((el, i) => {
    el.x = Math.max(m, Math.min(el.x, W - m - el.w))
    if (zone === 'bottom') Object.assign(el, { anchor: 'top', y: 90 + i * 170 })
    else Object.assign(el, { anchor: 'bottom', y: (caption ? 1020 : 1240) - i * 170 })
  })
  return slide
}
