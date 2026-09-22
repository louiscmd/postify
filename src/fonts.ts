// Fonts are bundled locally (same-origin) so html-to-image can embed them reliably on PNG export.
// Every file includes latin-ext, so Polish diacritics render correctly.
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/dm-serif-display/400-italic.css'
import '@fontsource/gloock/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/900.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/abril-fatface/400.css'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/archivo/800.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/arimo/400.css'
import '@fontsource/arimo/700.css'
import '@fontsource/arimo/400-italic.css'
import '@fontsource/montserrat/300.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/be-vietnam-pro/300.css'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/sacramento/400.css'
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/700.css'

import type { FontKey } from './types'

export interface FontInfo {
  key: FontKey
  label: string
  kind: 'serif' | 'sans' | 'script'
  weights: number[]
  fallback: string
}

export const FONTS: FontInfo[] = [
  { key: 'DM Serif Display', label: 'DM Serif Display — ciężki szeryf', kind: 'serif', weights: [400], fallback: 'Georgia, serif' },
  { key: 'Gloock', label: 'Gloock — kontrastowy szeryf', kind: 'serif', weights: [400], fallback: 'Georgia, serif' },
  { key: 'Playfair Display', label: 'Playfair Display — elegancki szeryf', kind: 'serif', weights: [700, 900], fallback: 'Georgia, serif' },
  { key: 'Abril Fatface', label: 'Abril Fatface — didone', kind: 'serif', weights: [400], fallback: 'Georgia, serif' },
  { key: 'Archivo', label: 'Archivo — grotesk (Helvetica-like)', kind: 'sans', weights: [400, 600, 700, 800], fallback: 'Arial, sans-serif' },
  { key: 'Arimo', label: 'Arimo — Arial / Helvetica', kind: 'sans', weights: [400, 700], fallback: 'Arial, sans-serif' },
  { key: 'Montserrat', label: 'Montserrat — geometryczny', kind: 'sans', weights: [300, 400, 600, 700, 800], fallback: 'Arial, sans-serif' },
  { key: 'Be Vietnam Pro', label: 'Be Vietnam Pro — miękki sans', kind: 'sans', weights: [300, 400, 500, 700], fallback: 'Arial, sans-serif' },
  { key: 'Inter', label: 'Inter — neutralny sans', kind: 'sans', weights: [400, 500, 600, 700], fallback: 'Arial, sans-serif' },
  { key: 'Sacramento', label: 'Sacramento — pismo odręczne', kind: 'script', weights: [400], fallback: 'cursive' },
  { key: 'Caveat', label: 'Caveat — notatka odręczna', kind: 'script', weights: [400, 700], fallback: 'cursive' },
]

export const fontStack = (key: FontKey) => {
  const f = FONTS.find((x) => x.key === key)
  return `'${key}', ${f?.fallback ?? 'sans-serif'}`
}

/** Snap a requested weight to the closest one actually bundled (prevents faux-bold). */
export const snapWeight = (key: FontKey, weight: number) => {
  const f = FONTS.find((x) => x.key === key)
  if (!f) return weight
  return f.weights.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a))
}
