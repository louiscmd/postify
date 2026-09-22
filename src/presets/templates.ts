import type { Block, BgSlot, DoodleEl, El, ImageEl, Overlay, Preset, Slide, StackEl, StyleKey, TextStyle, Tone, Zone } from '../types'
import { uid } from '../lib/util'

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

export interface BuildCtx {
  fields: Fields
  zone: Zone
  tone: Tone
  imageIds: string[]
  preset: Preset
}

export interface TemplateDef {
  id: string
  family: Preset['family']
  role: 'cover' | 'content' | 'list' | 'cta' | 'statement' | 'split'
  name: string
  description: string
  /** What the AI should use this template for and which fields it reads. */
  ai: string
  fields: FieldKey[]
  images: 1 | 2
  zones: Zone[]
  demo: Partial<Fields>
  build: (ctx: BuildCtx) => Omit<Slide, 'id'>
}

// ── helpers ──────────────────────────────────────────────────
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
  id: uid(), kind: 'chips', styleKey: 'chip', items, overrides: {}, selfAlign: 'stretch', marginTop, gapX: 40, gapY: 44,
})

const stack = (p: Partial<StackEl> & { blocks: Block[] }): StackEl => ({
  id: uid(), type: 'stack', x: 80, y: 120, w: 920, anchor: 'top', rotation: 0, ...p,
})

const doodle = (p: Partial<DoodleEl>): DoodleEl => ({
  id: uid(), type: 'doodle', kind: 'curl', x: 0, y: 0, w: 110, h: 130, color: '#ffffff', stroke: 3, rotation: 0, flipX: false, flipY: false, ...p,
})

const inset = (p: Partial<ImageEl>): ImageEl => ({
  id: uid(), type: 'image', x: 56, y: 72, w: 362, h: 574, imageId: null, radius: 30, shadow: true, focusX: 50, focusY: 50, rotation: 0, ...p,
})

/** Dark text + no shadow when the chosen zone of the photo is bright. */
const toneOv = (ctx: BuildCtx): Partial<TextStyle> => (ctx.tone === 'dark' ? { color: ctx.preset.dark, shadow: 'none' } : {})

/** Place a stack vertically according to zone. */
const place = (zone: Zone, top = 130, bottom = 1235): Pick<StackEl, 'y' | 'anchor'> =>
  zone === 'top' ? { y: top, anchor: 'top' } : zone === 'bottom' ? { y: bottom, anchor: 'bottom' } : { y: 675, anchor: 'center' }

/**
 * Rough fit: shrink a headline so it wraps to at most `maxLines` lines and its longest word fits.
 * charW = average glyph width as a fraction of font size for that face.
 */
export const fit = (text: string, base: number, width: number, charW: number, maxLines = 2, min = 48) => {
  const clean = text.replace(/\*\*|==|\|\|/g, '')
  const lines = clean.split('\n')
  const longestWord = Math.max(1, ...clean.split(/\s+/).map((w) => w.length))
  let size = Math.min(base, width / (longestWord * charW))
  const count = (sz: number) => lines.reduce((n, l) => n + Math.max(1, Math.ceil((l.length * charW * sz) / width)), 0)
  while (size > min && count(size) > maxLines) size -= 2
  return Math.round(Math.max(min, size))
}

const quoteWrap = (k: string) => (/^[„“"«]/.test(k.trim()) ? k.trim() : `“${k.trim()}”`)
const bulletsText = (b: string[]) => b.filter(Boolean).map((x) => `- ${x.replace(/^[-•]\s*/, '')}`).join('\n')

const base = (ctx: BuildCtx, elements: El[], overlay: Partial<Overlay> = {}, layout: Slide['layout'] = 'single'): Omit<Slide, 'id'> => ({
  layout,
  slots: layout === 'split' ? [slot(ctx.imageIds[0] ?? null), slot(ctx.imageIds[1] ?? null)] : [slot(ctx.imageIds[0] ?? null)],
  bgColor: '#1d1718',
  overlay: ov(overlay),
  elements,
})

// ── EDITORIAL ────────────────────────────────────────────────
const edCover: TemplateDef = {
  id: 'ed-cover', family: 'editorial', role: 'cover',
  name: 'Okładka — tytuł + podtytuł',
  description: 'Ogromny szeryf, pod nim kapitaliki, strzałka prowadząca do zdjęcia.',
  ai: 'Cover/hook slide. title = 1–3 punchy words (big serif), subtitle = short uppercase line (2–4 words).',
  fields: ['title', 'subtitle'], images: 1, zones: ['top', 'bottom'],
  demo: { title: 'Uczę Ją', subtitle: 'Budowania marki osobistej' },
  build: (ctx) => {
    const t = toneOv(ctx)
    const els: El[] = [
      stack({
        x: 78, w: 924, ...place(ctx.zone, 140),
        blocks: [
          tb('title', ctx.fields.title, { overrides: { ...t, size: fit(ctx.fields.title, 158, 924, 0.5, 2, 90) } }),
          tb('subtitle', ctx.fields.subtitle, { marginTop: 4, overrides: t }),
        ],
      }),
    ]
    if (ctx.zone === 'top') els.push(doodle({ kind: 'curl', x: 880, y: 300, w: 100, h: 120, color: ctx.tone === 'dark' ? ctx.preset.dark : '#ffffff', stroke: 3 }))
    return base(ctx, els)
  },
}

const edFramed: TemplateDef = {
  id: 'ed-framed', family: 'editorial', role: 'cover',
  name: 'Okładka — nad / tytuł / pod',
  description: 'Nadtytuł do lewej, szeryf, podpis wyrównany do prawej krawędzi.',
  ai: 'Alternative cover. pretitle = short uppercase lead-in ending with "…", title = 2–3 word serif headline, posttitle = uppercase payoff aligned right.',
  fields: ['pretitle', 'title', 'posttitle'], images: 1, zones: ['top', 'bottom'],
  demo: { pretitle: 'Jak zbudować…', title: 'Markę Osobistą', posttitle: 'Która działa w 2026' },
  build: (ctx) => {
    const t = toneOv(ctx)
    return base(ctx, [
      stack({
        x: 100, w: 880, ...place(ctx.zone, 150),
        blocks: [
          tb('kicker', ctx.fields.pretitle, { overrides: { ...t, uppercase: true, size: 44 } }),
          tb('title', ctx.fields.title, { marginTop: 4, overrides: { ...t, size: fit(ctx.fields.title, 132, 880, 0.48, 2, 80), lineHeight: 0.95 } }),
          tb('kicker', ctx.fields.posttitle, { marginTop: 6, selfAlign: 'end', overrides: { ...t, uppercase: true, size: 44, align: 'right' } }),
        ],
      }),
    ])
  },
}

const edStatement: TemplateDef = {
  id: 'ed-statement', family: 'editorial', role: 'statement',
  name: 'Słowo + akapit',
  description: 'Jedno słowo szeryfem, pod nim wyjustowany akapit, czerwona pętla.',
  ai: 'Story beat. title = ONE lowercase word (serif), body = 1–2 sentences (≤ 30 words), mark 1 key word with **bold**.',
  fields: ['title', 'body'], images: 1, zones: ['top', 'middle', 'bottom'],
  demo: { title: 'odsłonięte', body: 'a potem, gdy zrozumiałem ile to jest warte, opublikowałem to na **youtube** całkowicie za darmo' },
  build: (ctx) => {
    const t = toneOv(ctx)
    const pos = place(ctx.zone, 80)
    const els: El[] = [
      stack({
        x: 230, w: 620, ...pos,
        blocks: [
          tb('title', ctx.fields.title, { overrides: { ...t, align: 'center', size: fit(ctx.fields.title, 176, 620, 0.5, 1, 90) } }),
          tb('body', ctx.fields.body, { marginTop: 14, overrides: { ...t, align: 'justify', size: 42, letterSpacing: 0.02 } }),
        ],
      }),
    ]
    if (ctx.zone === 'top') els.push(doodle({ kind: 'loop', x: 850, y: 150, w: 120, h: 320, color: ctx.preset.accent, stroke: 5 }))
    return base(ctx, els)
  },
}

const edNumber: TemplateDef = {
  id: 'ed-number', family: 'editorial', role: 'content',
  name: 'Punkt numerowany',
  description: 'Odręczne „01.”, tytuł sekcji w 2 liniach, treść w wąskiej kolumnie.',
  ai: 'Numbered step. number = "01." style, title = 2–4 words (Title Case), body = 1–2 short paragraphs (≤ 40 words total), separate paragraphs with a blank line.',
  fields: ['number', 'title', 'body'], images: 1, zones: ['top', 'bottom'],
  demo: { number: '01.', title: 'Odkryj Swoją Niszę', body: 'Twoja marka osobista zaczyna się od zrozumienia, co czyni cię innym i niezapomnianym.\n\nZawsze powtarzam klientom: „marka osobista nazywa się osobista nie bez powodu”.' },
  build: (ctx) => {
    const t = toneOv(ctx)
    return base(ctx, [
      stack({
        x: 78, w: 520, ...place(ctx.zone, 88),
        blocks: [
          tb('number', ctx.fields.number, { overrides: t }),
          tb('title', ctx.fields.title, { marginTop: -6, overrides: { ...t, size: fit(ctx.fields.title, 98, 520, 0.48, 2, 64), lineHeight: 0.95 } }),
          tb('body', ctx.fields.body, { marginTop: 42, overrides: t }),
        ],
      }),
    ])
  },
}

const edInset: TemplateDef = {
  id: 'ed-inset', family: 'editorial', role: 'content',
  name: 'Wstawione zdjęcie + tekst',
  description: 'Zaokrąglone zdjęcie po lewej, numer/tytuł/treść w prawej kolumnie. Wymaga 2 zdjęć.',
  ai: 'Numbered step with a second photo inset on the left (needs 2 imageIds: [background, inset]). number, title (2–3 words), body ≤ 35 words.',
  fields: ['number', 'title', 'body'], images: 2, zones: ['top'],
  demo: { number: '02.', title: 'Określ Swoje Wartości', body: 'Bez wartości gonisz trendy i się wypalasz. Z wartościami budujesz spójność i jasność.\n\nZdefiniuj, co znaczy sukces poza pieniędzmi.' },
  build: (ctx) => {
    const t = toneOv(ctx)
    return base(ctx, [
      inset({ imageId: ctx.imageIds[1] ?? null }),
      stack({
        x: 500, w: 530, y: 110, anchor: 'top',
        blocks: [
          tb('number', ctx.fields.number, { overrides: t }),
          tb('title', ctx.fields.title, { marginTop: -6, overrides: { ...t, size: fit(ctx.fields.title, 92, 530, 0.48, 2, 60), lineHeight: 0.95 } }),
          tb('body', ctx.fields.body, { marginTop: 40, overrides: t }),
        ],
      }),
    ])
  },
}

const edList: TemplateDef = {
  id: 'ed-list', family: 'editorial', role: 'list',
  name: 'Lista',
  description: 'Szeryfowy nagłówek przy samej krawędzi i lista z pogrubieniami.',
  ai: 'List/recap. title = short heading ending with ":", bullets = 4–7 items, each ≤ 6 words with ONE **bold** keyword.',
  fields: ['title', 'bullets'], images: 1, zones: ['top', 'bottom'],
  demo: { title: 'Pokazałem jak:', bullets: ['**uporządkować** swoje konto', '**pozycjonować** się na rynku', 'robić **research** właściwie', 'mieć za dużo **pomysłów**', '**planować + pisać** filmy', 'przestać komplikować **publikację**'] },
  build: (ctx) => {
    const t = toneOv(ctx)
    return base(ctx, [
      stack({
        x: 18, w: 1040, ...place(ctx.zone, 58),
        blocks: [
          tb('title', ctx.fields.title, { overrides: { ...t, size: fit(ctx.fields.title, 120, 1040, 0.5, 1, 70), lineHeight: 1 } }),
          tb('list', bulletsText(ctx.fields.bullets), { marginTop: 8, overrides: t }),
        ],
      }),
    ])
  },
}

const edCta: TemplateDef = {
  id: 'ed-cta', family: 'editorial', role: 'cta',
  name: 'CTA — komentarz',
  description: 'Wyśrodkowany stos: „skomentuj” / „SŁOWO” / linijka.',
  ai: 'Final CTA. kicker = "comment"/"skomentuj" etc, keyword = ONE word (no quotes, it gets quoted), caption = reason, ≤ 6 words.',
  fields: ['kicker', 'keyword', 'caption'], images: 1, zones: ['top', 'middle', 'bottom'],
  demo: { kicker: 'skomentuj', keyword: 'ZERO', caption: 'aby dostać pełny film' },
  build: (ctx) => {
    const t = toneOv(ctx)
    const middle = ctx.zone !== 'top'
    return base(ctx, [
      stack({
        x: middle ? 190 : 34, w: middle ? 700 : 450, ...place(ctx.zone, 100, 1200),
        blocks: [
          tb('kicker', ctx.fields.kicker, { overrides: { ...t, align: 'center', size: 36 } }),
          tb('keyword', quoteWrap(ctx.fields.keyword), { marginTop: -2, overrides: { ...t, size: fit(ctx.fields.keyword + '""', 112, middle ? 700 : 450, 0.62, 1, 60) } }),
          tb('kicker', ctx.fields.caption, { marginTop: 4, overrides: { ...t, align: 'center', size: 38 } }),
        ],
      }),
    ])
  },
}

// ── STORY ────────────────────────────────────────────────────
const stHook: TemplateDef = {
  id: 'st-hook', family: 'story', role: 'cover',
  name: 'Hook — hasło + podpis',
  description: 'Mały nadtytuł, HASŁO z podkreśleniem, linijka rozbita wokół głowy, podpis z wyróżnieniem na dole.',
  ai: 'Hook slide. kicker = 1–3 lowercase words, title = 2–4 word CLAIM, subtitle = short line; put "||" in the middle to split it left/right around the subject\'s head. caption = bottom sentence with the payoff wrapped in ==highlight==.',
  fields: ['kicker', 'title', 'subtitle', 'caption'], images: 1, zones: ['top'],
  demo: { kicker: 'większość ludzi', title: 'używa AI do contentu', subtitle: 'jak babcia || pilota od telewizora', caption: 'Klika i liczy, że to ==ten właściwy==' },
  build: (ctx) => {
    const t = toneOv(ctx)
    const els: El[] = [
      stack({
        x: 118, w: 850, y: 150, anchor: 'top',
        blocks: [
          tb('kicker', ctx.fields.kicker, { overrides: t }),
          tb('title', ctx.fields.title, { marginTop: 8, overrides: { ...t, size: fit(ctx.fields.title, 88, 850, 0.66, 1, 64) } }),
          tb('subtitle', ctx.fields.subtitle, { marginTop: 18, overrides: t }),
        ],
      }),
    ]
    if (ctx.fields.caption) els.push(stack({ x: 60, w: 960, y: 1225, anchor: 'bottom', blocks: [tb('caption', ctx.fields.caption)] }))
    return base(ctx, els, { bottom: ctx.fields.caption ? 0.85 : 0 })
  },
}

const stText: TemplateDef = {
  id: 'st-text', family: 'story', role: 'content',
  name: 'Etykieta + lista + akapity',
  description: 'Fioletowa etykieta, punkty z pogrubieniami i krótkie akapity w górnej części.',
  ai: 'Main content slide. title = short label (gets purple highlight), body = 1–3 short paragraphs (blank line between) — may end with ==highlighted phrase==, bullets = 0–4 items with **bold** keywords. Keep total ≤ 60 words.',
  fields: ['title', 'body', 'bullets'], images: 1, zones: ['top', 'bottom'],
  demo: { title: 'Nie ma pojęcia', bullets: ['co zrobiło twoje ostatnie **20 postów**', 'które hooki naprawdę **działały**', 'jak **normalnie mówisz** bez skryptu'], body: 'Więc wypełnia luki średnią z całego internetu.\n\nDlatego twój content brzmi jak ==papka==' },
  build: (ctx) => {
    const t = toneOv(ctx)
    const blocks: Block[] = []
    if (ctx.fields.title) blocks.push(tb('caption', `==${ctx.fields.title.replace(/==/g, '')}==`, { overrides: { align: 'left', size: 36 } }))
    if (ctx.fields.bullets.length) blocks.push(tb('list', bulletsText(ctx.fields.bullets), { marginTop: blocks.length ? 10 : 0, overrides: t }))
    if (ctx.fields.body) blocks.push(tb('body', ctx.fields.body, { marginTop: blocks.length ? 42 : 0, overrides: t }))
    const top = ctx.zone !== 'bottom'
    return base(ctx, [stack({ x: 72, w: 936, ...place(ctx.zone, 86, 1240), blocks })], top ? { top: 0.55 } : { bottom: 0.85 })
  },
}

const stChips: TemplateDef = {
  id: 'st-chips', family: 'story', role: 'list',
  name: 'Chipy (pigułki)',
  description: 'Wyróżniony nagłówek i rzędy jasnych chipów nad ciemnym gradientem.',
  ai: 'Ingredients/inputs slide. title = one sentence ending with ":" (gets highlight), chips = 3–7 items of 1–3 words, caption = optional bottom sentence.',
  fields: ['title', 'chips', 'caption'], images: 1, zones: ['bottom'],
  demo: { title: 'Daliśmy mu wszystko, co już miał:', chips: ['notatka głosowa', 'unikalny mechanizm', 'info o firmie', 'rozmowy sprzedażowe', 'problemy klientów', 'DM-y'] },
  build: (ctx) => {
    const els: El[] = [
      stack({
        x: 60, w: 960, y: ctx.fields.caption ? 1090 : 1215, anchor: 'bottom',
        blocks: [tb('caption', `==${ctx.fields.title.replace(/==/g, '')}==`, { overrides: { weight: 400, size: 36 } }), chips(ctx.fields.chips, 62)],
      }),
    ]
    if (ctx.fields.caption) els.push(stack({ x: 80, w: 920, y: 1245, anchor: 'bottom', blocks: [tb('cta', ctx.fields.caption)] }))
    return base(ctx, els, { bottom: 0.9 })
  },
}

const stStatement: TemplateDef = {
  id: 'st-statement', family: 'story', role: 'cta',
  name: 'Teza + zrzut + CTA',
  description: 'Zdanie na środku z dopiskiem, wstawiony zrzut ekranu, fioletowa strzałka i CTA na dole.',
  ai: 'Closing slide. title = one bold statement sentence, note = small aside in parentheses, caption = CTA sentence (e.g. Comment "WORD" to …). Optional 2nd imageId = screenshot inset.',
  fields: ['title', 'note', 'caption'], images: 2, zones: ['middle'],
  demo: { title: 'Jeśli brzmisz jak AI, problemem nie jest AI', note: '(to skill issue 😭)', caption: 'Skomentuj „ekosystem”, a pokażę ci jak naprawiłem Claude dla klienta' },
  build: (ctx) => {
    const hasInset = !!ctx.imageIds[1]
    const els: El[] = [
      stack({
        x: 70, w: 940, y: hasInset ? 690 : 675, anchor: hasInset ? 'bottom' : 'center',
        blocks: [tb('cta', ctx.fields.title, { overrides: { size: 50 } }), tb('note', ctx.fields.note, { marginTop: 2 })],
      }),
    ]
    if (hasInset) {
      els.push(inset({ imageId: ctx.imageIds[1], x: 334, y: 745, w: 412, h: 262, radius: 4 }))
      els.push(doodle({ kind: 'curve', x: 770, y: 960, w: 100, h: 110, color: ctx.preset.accent, stroke: 4 }))
    }
    if (ctx.fields.caption) els.push(stack({ x: 80, w: 920, y: 1215, anchor: 'bottom', blocks: [tb('cta', ctx.fields.caption)] }))
    return base(ctx, els, { bottom: 0.9 })
  },
}

const stCaption: TemplateDef = {
  id: 'st-caption', family: 'story', role: 'content',
  name: 'Sam podpis na dole',
  description: 'Zdjęcie gra pierwsze skrzypce, jedno zdanie z wyróżnieniem na dole.',
  ai: 'Minimal slide. caption = one sentence with ==highlight== on the payoff. Use for emotional/visual beats.',
  fields: ['caption'], images: 1, zones: ['bottom', 'top'],
  demo: { caption: 'Klika i liczy, że to ==ten właściwy==' },
  build: (ctx) =>
    base(ctx, [stack({ x: 60, w: 960, ...place(ctx.zone, 120, 1225), blocks: [tb('caption', ctx.fields.caption)] })], ctx.zone === 'top' ? { top: 0.6 } : { bottom: 0.85 }),
}

// ── SPLIT ────────────────────────────────────────────────────
const spSplit: TemplateDef = {
  id: 'sp-split', family: 'split', role: 'split',
  name: 'Podział 50/50',
  description: 'Dwa zdjęcia jedno nad drugim, jedna linijka na środku każdej połowy. Wymaga 2 zdjęć.',
  ai: 'Two stacked photos (needs 2 imageIds: [top, bottom]). top = question/claim (≤ 8 words), bottom = answer/punchline (≤ 10 words). Lowercase, may start with "→ ".',
  fields: ['top', 'bottom'], images: 2, zones: ['middle'],
  demo: { top: 'hashtagi? bez znaczenia', bottom: 'godziny publikacji? też bez znaczenia' },
  build: (ctx) =>
    base(
      ctx,
      [
        stack({ x: 80, w: 920, y: 337, anchor: 'center', blocks: [tb('split', ctx.fields.top)] }),
        stack({ x: 80, w: 920, y: 1012, anchor: 'center', blocks: [tb('split', ctx.fields.bottom)] }),
      ],
      {},
      'split',
    ),
}

const spSingle: TemplateDef = {
  id: 'sp-single', family: 'split', role: 'statement',
  name: 'Jedno zdjęcie + linijka',
  description: 'Pełne zdjęcie, jedna wyśrodkowana linijka.',
  ai: 'Single photo with one centered line. title = ≤ 10 words, lowercase.',
  fields: ['title'], images: 1, zones: ['top', 'middle', 'bottom'],
  demo: { title: 'wyświetlenia sprowadzają się do jednego:' },
  build: (ctx) => base(ctx, [stack({ x: 80, w: 920, ...place(ctx.zone, 300, 1100), blocks: [tb('split', ctx.fields.title, { overrides: toneOv(ctx) })] })]),
}

const spCta: TemplateDef = {
  id: 'sp-cta', family: 'split', role: 'cta',
  name: 'CTA — akapity na dole',
  description: 'Krótkie wyśrodkowane akapity z pogrubieniami nad gradientem.',
  ai: 'Final CTA. body = 3–4 very short paragraphs separated by blank lines, first one = comment "**WORD**", key words in **bold**.',
  fields: ['body'], images: 1, zones: ['bottom'],
  demo: { body: 'skomentuj **„ZERO”**\n\njeśli chcesz pominąć **lata** prób i błędów\n\nnauczyłem dziewczynę **marki osobistej** od zera na kamerze\n\nmożesz obejrzeć całość **za darmo**' },
  build: (ctx) => base(ctx, [stack({ x: 90, w: 900, y: 1250, anchor: 'bottom', blocks: [tb('cta', ctx.fields.body)] })], { bottom: 0.75 }),
}

export const TEMPLATES: TemplateDef[] = [
  edCover, edFramed, edStatement, edNumber, edInset, edList, edCta,
  stHook, stText, stChips, stStatement, stCaption,
  spSplit, spSingle, spCta,
]

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id)

export const buildSlide = (tpl: TemplateDef, ctx: Omit<BuildCtx, 'fields'> & { fields: Partial<Fields> }): Slide => {
  const fields = { ...emptyFields(), ...ctx.fields }
  return { id: uid(), template: tpl.id, ...tpl.build({ ...ctx, fields }) }
}

export const blankSlide = (): Slide => ({
  id: uid(),
  layout: 'single',
  slots: [slot()],
  bgColor: '#1d1718',
  overlay: ov(),
  elements: [],
})

export { slot as makeSlot, stack as makeStack, tb as makeTextBlock, chips as makeChips, doodle as makeDoodle, inset as makeInset }
