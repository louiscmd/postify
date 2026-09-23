import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlockParam, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { STYLE_LABELS } from '../presets'
import { FIELD_KEYS, templatesFor, type Fields } from '../presets/templates'
import { storyTypeById } from '../presets/stories'
import type { FormatKey, GalleryImage, Preset, Role, Zone } from '../types'
import { describe, type Analysis } from './analyze'
import { cleanApiKey, loadImg } from './util'

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — najlepsza jakość (zalecany)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — szybszy i tańszy' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — najtańszy' },
]

export interface AiSlide {
  purpose: string
  role: Role
  structure?: string
  imageIds: string[]
  zone: Zone | 'auto'
  fields: Fields
}
export interface AiCarousel {
  title: string
  slides: AiSlide[]
}

// cleaned here too, so keys saved before the Settings fix still work
const client = (apiKey: string) => new Anthropic({ apiKey: cleanApiKey(apiKey), dangerouslyAllowBrowser: true, maxRetries: 2 })

/** Opus 5 gets server-side refusal fallbacks; other models run without. */
const fallbackParams = (model: string) =>
  model === 'claude-opus-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}

/** Downscale to keep vision tokens (and cost) small: ~768px long edge JPEG. */
export async function imageToBase64(img: GalleryImage, edge = 768) {
  const el = await loadImg(img.url)
  const s = Math.min(1, edge / Math.max(el.naturalWidth, el.naturalHeight))
  const cv = document.createElement('canvas')
  cv.width = Math.round(el.naturalWidth * s)
  cv.height = Math.round(el.naturalHeight * s)
  cv.getContext('2d')!.drawImage(el, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/jpeg', 0.8).split(',')[1]
}

const ROLES: Role[] = ['cover', 'content', 'list', 'statement', 'split', 'cta']

const schema = (structureIds: string[]) => ({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'slides'],
  properties: {
    title: { type: 'string', description: 'Short project name (3–6 words) in the post language' },
    slides: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['purpose', 'role', 'structure', 'imageIds', 'zone', 'fields'],
        properties: {
          purpose: { type: 'string', description: "Which part of the user's request this slide delivers (one sentence, used to check coverage)" },
          role: { type: 'string', enum: ROLES },
          structure: { type: 'string', enum: structureIds, description: 'Which frame structure to use' },
          imageIds: { type: 'array', items: { type: 'string' } },
          zone: { type: 'string', enum: ['top', 'middle', 'bottom', 'auto'] },
          fields: {
            type: 'object',
            additionalProperties: false,
            required: FIELD_KEYS,
            properties: Object.fromEntries(
              FIELD_KEYS.map((k) => [k, k === 'bullets' || k === 'chips' ? { type: 'array', items: { type: 'string' } } : { type: 'string' }]),
            ),
          },
        },
      },
    },
  },
})

const structureList = (format: FormatKey) =>
  templatesFor(format)
    .map((t) => `- ${t.id} — ${t.name}: ${t.description} (zdjęcia: ${t.images}; pola: ${Object.keys(t.demo).join(', ') || 'brak'})`)
    .join('\n')

/** Story frames follow the seven-type weekly system; posts follow the carousel rules. */
const storyPrompt = (preset: Preset, storyType?: string) => {
  const t = storyTypeById(storyType)
  return `You write Instagram STORY frames (9:16, 1080×1920) inside the "Postify" editor. You write the CONTENT; the layout engine places it and keeps clear of the top 230 px (avatar bar) and bottom 260 px (reply bar).

VISUAL STYLE — "${preset.name}": ${preset.description}

${
  t
    ? `STORY TYPE — ${t.name} (${t.cadence})
Purpose: ${t.purpose}
Technique that makes it work: ${t.technique}
How to write it: ${t.ai}
Frame plan — follow it in this order, one entry per frame:
${t.frames.map((fr, i) => `${i + 1}. ${fr.structure} — ${fr.note}`).join('\n')}`
    : 'Choose the frames that fit the request.'
}

FRAME STRUCTURES (the "structure" field):
${structureList('story')}

STORY FIELDS
- callouts: short black annotation boxes placed around a screenshot — name exactly what is happening, 2–6 words each
- timestamp: an hour label like "10:00" for day-in-the-life frames
- question: the text inside a white sticker (the ask-me prompt, and each question)
- title / subtitle / body / bullets / caption / keyword: as in posts

RULES
1. Follow the frame plan and the user's request exactly — one idea per frame.
2. A story is read in two seconds: short lines, spoken tone, no marketing voice, lowercase is fine.
3. Write in the language of the request. Speak as a person, never as a company.
4. Never invent numbers, results or client quotes — leave an obvious placeholder for the user to replace.
5. imageIds: one per frame; two when the structure shows a screenshot (sv-annotated, sv-raw). Only ids from the list.`
}

const systemPrompt = (preset: Preset, format: FormatKey, storyType?: string) =>
  format === 'story' ? storyPrompt(preset, storyType) : `You write and plan Instagram carousel posts (4:5) inside the "Postify" editor. You decide the CONTENT of each slide; Postify's layout engine then arranges it automatically — positions, sizes and alignment are randomised within the visual style and adapt to however much text you write.

VISUAL STYLE — "${preset.name}": ${preset.description}
Style notes (typography and mood only — ignore any exact positions, the engine handles placement):
${preset.analysis.map((a) => `- ${a}`).join('\n')}

FOLLOW THE USER'S REQUEST FIRST
- If the user describes slides one by one, make exactly those slides, in that order, and put ALL of the content they asked for on each one. Do not merge, skip or reorder their slides.
- Write complete sentences and complete thoughts. Never cut a sentence short or drop an idea to make it "fit" — the layout adapts to the text. Clarity beats brevity.
- Keep the user's tone instructions. Use their facts and wording where given; never invent statistics or results.
- Write in the language of the request, with that language's typography (Polish → „ ” quotes).
- As a guide, 15–60 words per slide reads well on a phone; go longer when the user's content needs it rather than cutting it.

SLIDE ROLES (one per slide)
- cover — the hook: title (+ subtitle or kicker); optional caption = a sentence pinned to the bottom.
- content — one idea explained: title + body paragraphs; optional number ("01."), bullets.
- list — several points: title + bullets, or title + chips (short 1–3 word tags).
- statement — one strong line or word, optional short body; lots of photo visible.
- split — two photos stacked 50/50: top = claim/question, bottom = answer. Needs 2 imageIds.
- cta — the closing call to action: kicker ("skomentuj") + keyword (one word, no quotes) + caption, OR body with short paragraphs.

FIELDS — fill only what the slide needs, "" or [] for the rest:
kicker (small line above the title), pretitle / posttitle (small uppercase lines framing a title), number, title, subtitle, body (paragraphs separated by a blank line), bullets (items without "- "), chips, keyword, note (small aside), caption (sentence pinned to the bottom), top / bottom (split only).
Markup inside text: **bold** for key words, ==highlight== for the one phrase per slide that deserves a colour box.

PHOTOS
- Look at the photos and match each slide's meaning and mood; avoid repeating a photo on consecutive slides when there are enough. Only use the given imageIds.
- 1 imageId per slide (2 for split, or 2 when the second photo should appear as an inset next to the text).
- zone = where the text should sit so it doesn't cover faces or the main subject (use the per-photo brightness/busy stats: lower busy = calmer). Use "auto" if unsure.`

export interface GenerateInput {
  apiKey: string
  model: string
  preset: Preset
  prompt: string
  slideCount: number | 'auto'
  images: { img: GalleryImage; analysis?: Analysis }[]
  history: BetaMessageParam[]
  format?: FormatKey
  storyType?: string
}

export async function generateCarousel(inp: GenerateInput): Promise<{ result: AiCarousel; history: BetaMessageParam[] }> {
  const content: BetaContentBlockParam[] = []

  if (!inp.history.length) {
    if (inp.images.length) {
      content.push({ type: 'text', text: `AVAILABLE PHOTOS (${inp.images.length}). Each photo is preceded by its id and measured stats.` })
      for (const { img, analysis } of inp.images) {
        content.push({ type: 'text', text: `imageId="${img.id}" (file: ${img.name}, ${img.w}×${img.h}${analysis ? `; zones when used full-frame 4:5 — ${describe(analysis)}` : ''})` })
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await imageToBase64(img) } })
      }
    } else {
      content.push({ type: 'text', text: 'No photos are available — return empty imageIds arrays; the user will add photos manually.' })
    }
  }
  const count =
    inp.slideCount === 'auto'
      ? "Use the number of slides the request asks for; if it doesn't say, choose what the story needs (usually 5–8)."
      : `Make exactly ${inp.slideCount} slides.`
  content.push({
    type: 'text',
    text: inp.history.length
      ? `Revise the carousel you produced above according to this request, and return the full updated carousel: ${inp.prompt}\n${inp.slideCount === 'auto' ? '' : count}`
      : `REQUEST: ${inp.prompt}\n\n${count}`,
  })

  const messages: BetaMessageParam[] = [...inp.history, { role: 'user', content }]
  const stream = client(inp.apiKey).beta.messages.stream({
    model: inp.model,
    max_tokens: 32000,
    system: systemPrompt(inp.preset, inp.format ?? 'post', inp.storyType),
    messages,
    output_config: { format: { type: 'json_schema', schema: schema(templatesFor(inp.format ?? 'post').map((t) => t.id)) } },
    ...fallbackParams(inp.model),
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('Model odmówił wygenerowania tej treści. Spróbuj przeformułować prośbę.')
  if (msg.stop_reason === 'max_tokens') throw new Error('Odpowiedź była za długa — spróbuj z mniejszą liczbą slajdów.')
  const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  let result: AiCarousel
  try {
    result = JSON.parse(text)
  } catch {
    throw new Error('Nie udało się odczytać odpowiedzi AI. Spróbuj ponownie.')
  }
  const valid = new Set(inp.images.map((i) => i.img.id))
  result.slides = result.slides
    .filter((s) => ROLES.includes(s.role))
    .map((s) => ({ ...s, imageIds: s.imageIds.filter((id) => valid.has(id)) }))
  return { result, history: [...messages, { role: 'assistant', content: [{ type: 'text', text }] }] }
}

/** Critique of the current slide layout, in Polish. */
export async function critiqueSlide(opts: { apiKey: string; model: string; preset: Preset; jpegBase64: string; stats: string }) {
  const msg = await client(opts.apiKey).beta.messages.create({
    model: opts.model,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    system: `You are an art director reviewing one Instagram carousel slide (4:5) made in the "${opts.preset.name}" style (${opts.preset.description}). Text style keys available: ${Object.values(STYLE_LABELS).join(', ')}. Answer in Polish, max 6 short bullet points, most important first. Be concrete: say where to move text (top/middle/bottom, left/right, approx px on a 1080×1350 canvas), whether to use dark or light text, add/remove shadow or gradient, shorten wording, and whether text covers a face or the main subject. No preamble.`,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: opts.jpegBase64 } },
          { type: 'text', text: `Measured background stats: ${opts.stats}\nHow can I improve the text placement and readability of this slide?` },
        ],
      },
    ],
    ...fallbackParams(opts.model),
  })
  if (msg.stop_reason === 'refusal') throw new Error('Model odmówił odpowiedzi.')
  return msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
}

export const aiErrorMessage = (e: unknown) => {
  if (e instanceof Error && /ISO-8859-1|non ISO|Headers/i.test(e.message))
    return 'Klucz API zawiera niedozwolone znaki (np. niewidoczną spację lub cudzysłów z kopiowania). Wklej go ponownie w Ustawieniach.'
  if (e instanceof Anthropic.AuthenticationError) return 'Nieprawidłowy klucz API. Sprawdź go w Ustawieniach.'
  if (e instanceof Anthropic.RateLimitError) return 'Przekroczono limit zapytań. Odczekaj chwilę i spróbuj ponownie.'
  if (e instanceof Anthropic.BadRequestError) return `Błędne zapytanie: ${e.message}`
  if (e instanceof Anthropic.APIConnectionError) return 'Brak połączenia z API Anthropic.'
  if (e instanceof Anthropic.APIError) return `Błąd API (${e.status ?? '?'}): ${e.message}`
  return e instanceof Error ? e.message : String(e)
}
