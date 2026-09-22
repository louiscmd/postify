/**
 * Slide *structures*: which pieces of content a slide has (title, list, chips…) and
 * what it does in the carousel. They contain NO coordinates — `compose` builds the
 * text blocks in the current style and `arrange` (layout.ts) places them randomly,
 * guided by the photo and the style's rules.
 */
import type { Analysis } from '../lib/analyze'
import { uid } from '../lib/util'
import type { Block, BgSlot, DoodleEl, El, ImageEl, Overlay, Preset, Role, Slide, StackEl, StyleKey, TextStyle, Zone } from '../types'
import { arrange, newSeed, rng, RULES } from './layout'

export interface Fields {
  kicker: string
  title: string
  subtitle: string
  pretitle: string
  posttitle: string
  number: string
  body: string
  bullets: string[]
  chips: string[]
  caption: string
  keyword: string
  note: string
  top: string
  bottom: string
}

export type FieldKey = keyof Fields

export const FIELD_KEYS: FieldKey[] = [
  'kicker', 'title', 'subtitle', 'pretitle', 'posttitle', 'number', 'body', 'bullets', 'chips', 'caption', 'keyword', 'note', 'top', 'bottom',
]

export const emptyFields = (): Fields => ({
  kicker: '', title: '', subtitle: '', pretitle: '', posttitle: '', number: '', body: '',
  bullets: [], chips: [], caption: '', keyword: '', note: '', top: '', bottom: '',
})

export interface TemplateDef {
  id: string
  role: Role
  name: string
  description: string
  images: 1 | 2
  demo: Partial<Fields>
}

// ── element helpers ──────────────────────────────────────────
const slot = (imageId: string | null = null): BgSlot => ({ imageId, focusX: 50, focusY: 50, zoom: 1 })
const ov = (o: Partial<Overlay> = {}): Overlay => ({ top: 0, bottom: 0, dim: 0, ...o })

interface TbOpts {
  overrides?: Partial<TextStyle>
  selfAlign?: Block['selfAlign']
  marginTop?: number
}

const tb = (styleKey: StyleKey, text: string, o: TbOpts = {}): Block => ({
  id: uid(),
  kind: 'text',
  styleKey,
  text,
  overrides: o.overrides ?? {},
  selfAlign: o.selfAlign ?? 'stretch',
  marginTop: o.marginTop ?? 0,
})

const chips = (items: string[], marginTop = 0): Block => ({
  id: uid(), kind: 'chips', styleKey: 'chip', items, overrides: {}, selfAlign: 'stretch', marginTop, gapX: 36, gapY: 36,
})

const stack = (p: Partial<StackEl> & { blocks: Block[] }): StackEl => ({
  id: uid(), type: 'stack', x: 80, y: 120, w: 920, anchor: 'top', rotation: 0, ...p,
})

const doodle = (p: Partial<DoodleEl>): DoodleEl => ({
  id: uid(), type: 'doodle', kind: 'curl', x: 0, y: 0, w: 110, h: 130, color: '#ffffff', stroke: 3, rotation: 0, flipX: false, flipY: false, ...p,
})

const inset = (p: Partial<ImageEl>): ImageEl => ({
  id: uid(), type: 'image', x: 56, y: 72, w: 362, h: 520, imageId: null, radius: 24, shadow: true, focusX: 50, focusY: 50, rotation: 0, ...p,
})

const quoteWrap = (k: string) => (/^[„“"«]/.test(k.trim()) ? k.trim() : `“${k.trim()}”`)
const bulletsText = (b: string[]) => b.filter(Boolean).map((x) => `- ${x.replace(/^[-•]\s*/, '')}`).join('\n')
const hl = (s: string) => (s.includes('==') ? s : `==${s}==`)

// ── compose: content → styled blocks (no positions) ─────────
export function compose(role: Role, f: Fields, imageIds: string[], preset: Preset, seed: number): Omit<Slide, 'id'> {
  const r = rng(seed ^ 0x9e3779b9)
  const R = RULES[preset.family]
  const story = preset.family === 'story'
  const els: El[] = []
  const split = role === 'split' || (!!f.top && !!f.bottom)

  if (split) {
    els.push(stack({ role: 'top', blocks: [tb('split', f.top || f.title)] }))
    els.push(stack({ role: 'bottom', blocks: [tb('split', f.bottom || f.body || f.caption)] }))
    return { layout: 'split', role: 'split', slots: [slot(imageIds[0] ?? null), slot(imageIds[1] ?? imageIds[0] ?? null)], bgColor: '#1d1718', overlay: ov(), elements: els }
  }

  const b: Block[] = []
  const gap = (n: number) => (b.length ? n : 0)
  if (f.pretitle) b.push(tb('kicker', f.pretitle, { overrides: { uppercase: true } }))
  if (f.kicker) b.push(tb('kicker', f.kicker, { marginTop: gap(4) }))
  if (f.number) b.push(tb('number', f.number, { marginTop: gap(8) }))
  if (f.title) {
    // Story Highlight turns content headings into a highlighted label
    if (story && (role === 'content' || role === 'list')) b.push(tb('caption', hl(f.title), { marginTop: gap(10), overrides: { size: 36 } }))
    else {
      const underline = story && role === 'cover' ? (r() < R.underline ? {} : { underline: null }) : {}
      b.push(tb(role === 'cta' && !f.keyword ? 'cta' : 'title', f.title, { marginTop: gap(f.number ? -6 : 6), overrides: underline }))
    }
  }
  if (f.keyword) b.push(tb('keyword', quoteWrap(f.keyword), { marginTop: gap(2) }))
  if (f.subtitle) b.push(tb('subtitle', f.subtitle, { marginTop: gap(role === 'cover' ? 4 : 12) }))
  if (f.posttitle) b.push(tb('kicker', f.posttitle, { marginTop: gap(6), selfAlign: 'end', overrides: { uppercase: true, align: 'right' } }))
  if (f.body) {
    const justify = role === 'statement' && r() < R.justify ? { align: 'justify' as const } : {}
    b.push(tb(role === 'cta' ? 'cta' : 'body', f.body, { marginTop: gap(f.title ? 30 : 14), overrides: justify }))
  }
  if (f.bullets.length) b.push(tb('list', bulletsText(f.bullets), { marginTop: gap(14) }))
  if (f.chips.length) b.push(chips(f.chips, gap(44)))
  if (f.note) b.push(tb('note', f.note, { marginTop: gap(8) }))

  // a "comment KEYWORD" CTA reads as one lockup — keep its last line with it
  if (role === 'cta' && f.keyword && f.caption) b.push(tb('kicker', f.caption, { marginTop: 6 }))
  if (b.length) els.push(stack({ role: 'main', blocks: b }))
  if (f.caption && !(role === 'cta' && f.keyword)) els.push(stack({ role: 'caption', blocks: [tb(role === 'cta' || role === 'statement' ? 'cta' : 'caption', f.caption)] }))
  if (imageIds[1]) els.push(inset({ imageId: imageIds[1] }))

  return { layout: 'single', role, slots: [slot(imageIds[0] ?? null)], bgColor: '#1d1718', overlay: ov(), elements: els }
}

export interface BuildOpts {
  preset: Preset
  imageIds: string[]
  fields: Partial<Fields>
  analyses?: (Analysis | null | undefined)[]
  seed?: number
  hint?: Zone | 'auto'
}

/** Content + style + photo → a positioned slide (random arrangement unless a seed is given). */
export function buildSlide(tpl: TemplateDef | Role, o: BuildOpts): Slide {
  const role = typeof tpl === 'string' ? tpl : tpl.role
  const seed = o.seed ?? newSeed()
  const fields = { ...emptyFields(), ...o.fields }
  const s: Slide = { id: uid(), template: typeof tpl === 'string' ? undefined : tpl.id, ...compose(role, fields, o.imageIds, o.preset, seed) }
  return arrange(s, o.preset, o.analyses ?? [], seed, { hint: o.hint, decorate: true })
}

// ── structures shown in the Layouts panel (placeholder text only) ─────
export const TEMPLATES: TemplateDef[] = [
  { id: 'cover-title', role: 'cover', name: 'Tytuł + podtytuł', description: 'Duży tytuł z krótkim podtytułem.', images: 1, demo: { title: 'Twój Tytuł', subtitle: 'Krótki podtytuł' } },
  { id: 'cover-framed', role: 'cover', name: 'Nadtytuł / tytuł / podpis', description: 'Tytuł w ramce z dwóch małych linijek.', images: 1, demo: { pretitle: 'Mały nadtytuł…', title: 'Główny Tytuł', posttitle: 'Podpis pod spodem' } },
  { id: 'cover-hook', role: 'cover', name: 'Hasło + podpis na dole', description: 'Nadtytuł, hasło i zdanie na dole slajdu.', images: 1, demo: { kicker: 'mały nadtytuł', title: 'Główne hasło', caption: 'Podpis na dole z ==wyróżnieniem==' } },
  { id: 'content-number', role: 'content', name: 'Punkt numerowany', description: 'Numer, tytuł punktu i akapit.', images: 1, demo: { number: '01.', title: 'Tytuł Punktu', body: 'Akapit, który wyjaśnia ten punkt pełnymi zdaniami.\n\nDrugi akapit z jednym **ważnym** słowem.' } },
  { id: 'content-paragraph', role: 'content', name: 'Tytuł + akapit', description: 'Nagłówek i swobodny tekst.', images: 1, demo: { title: 'Nagłówek', body: 'Tutaj mieści się cała myśl — tekst dopasowuje się do slajdu, a nie odwrotnie.\n\nKolejny akapit, jeśli jest potrzebny.' } },
  { id: 'content-label', role: 'content', name: 'Etykieta + lista + akapit', description: 'Krótka etykieta, punkty i zdanie podsumowania.', images: 1, demo: { title: 'Etykieta', bullets: ['pierwszy punkt z **pogrubieniem**', 'drugi punkt z **pogrubieniem**', 'trzeci punkt'], body: 'Zdanie podsumowania z ==wyróżnieniem==' } },
  { id: 'content-inset', role: 'content', name: 'Wstawione zdjęcie + tekst', description: 'Drugie zdjęcie jako wstawka obok tekstu.', images: 2, demo: { number: '02.', title: 'Kolejny Punkt', body: 'Tekst obok wstawionego zdjęcia.\n\nDrugi akapit, jeśli trzeba.' } },
  { id: 'list-bullets', role: 'list', name: 'Nagłówek + lista', description: 'Kilka punktów z pogrubionymi słowami.', images: 1, demo: { title: 'Nagłówek listy:', bullets: ['pierwszy **punkt** listy', 'drugi **punkt** listy', 'trzeci **punkt** listy', 'czwarty **punkt** listy'] } },
  { id: 'list-chips', role: 'list', name: 'Chipy (pigułki)', description: 'Nagłówek i krótkie hasła w pigułkach.', images: 1, demo: { title: 'Nagłówek nad chipami:', chips: ['pierwszy', 'drugi chip', 'trzeci', 'czwarty chip', 'piąty'] } },
  { id: 'statement-word', role: 'statement', name: 'Słowo + akapit', description: 'Jedno mocne słowo i rozwinięcie.', images: 1, demo: { title: 'słowo', body: 'Jedno lub dwa zdania rozwinięcia z **kluczowym** słowem.' } },
  { id: 'statement-line', role: 'statement', name: 'Jedna linijka', description: 'Samo zdanie, dużo zdjęcia.', images: 1, demo: { title: 'jedna linijka na zdjęciu' } },
  { id: 'statement-caption', role: 'statement', name: 'Sam podpis', description: 'Zdjęcie gra, jedno zdanie na dole.', images: 1, demo: { caption: 'Jedno zdanie z ==wyróżnieniem==' } },
  { id: 'split-2', role: 'split', name: 'Podział 50/50', description: 'Dwa zdjęcia, teza i odpowiedź.', images: 2, demo: { top: 'teza albo pytanie?', bottom: '→ odpowiedź albo puenta' } },
  { id: 'cta-keyword', role: 'cta', name: 'Skomentuj „SŁOWO”', description: 'Słowo-klucz do komentarza.', images: 1, demo: { kicker: 'skomentuj', keyword: 'SŁOWO', caption: 'i odbierz materiał' } },
  { id: 'cta-paragraphs', role: 'cta', name: 'Akapity CTA', description: 'Kilka krótkich zdań zachęty.', images: 1, demo: { body: 'skomentuj **„SŁOWO”**\n\npierwszy krótki akapit z **pogrubieniem**\n\nostatnia linijka **zachęty**' } },
  { id: 'cta-inset', role: 'cta', name: 'Teza + wstawka + CTA', description: 'Zdanie, zrzut ekranu i wezwanie na dole.', images: 2, demo: { title: 'Jedno mocne zdanie', note: '(mały dopisek)', caption: 'Wezwanie do działania na dole slajdu' } },
]

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id)

/** Groups used to organise structures in the manual editor, in carousel order. */
export const ROLE_GROUPS: { role: Role; label: string; hint: string }[] = [
  { role: 'cover', label: 'Okładka', hint: 'pierwszy slajd — hook' },
  { role: 'content', label: 'Treść', hint: 'jeden punkt na slajd' },
  { role: 'list', label: 'Lista', hint: 'kilka punktów naraz' },
  { role: 'statement', label: 'Akcent', hint: 'jedna myśl, dużo zdjęcia' },
  { role: 'split', label: 'Podział 50/50', hint: 'dwa zdjęcia, dwie linijki' },
  { role: 'cta', label: 'Zakończenie / CTA', hint: 'ostatni slajd' },
]

export const blankSlide = (): Slide => ({
  id: uid(),
  layout: 'single',
  slots: [slot()],
  bgColor: '#1d1718',
  overlay: ov(),
  elements: [],
})

export { slot as makeSlot, stack as makeStack, tb as makeTextBlock, chips as makeChips, doodle as makeDoodle, inset as makeInset }
