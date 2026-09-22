import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlockParam, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { STYLE_LABELS } from '../presets'
import { FIELD_KEYS, TEMPLATES, type Fields } from '../presets/templates'
import type { GalleryImage, Preset, Tone, Zone } from '../types'
import { describe, type Analysis } from './analyze'
import { loadImg } from './util'

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — najlepsza jakość (zalecany)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — szybszy i tańszy' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — najtańszy' },
]

export interface AiSlide {
  template: string
  imageIds: string[]
  zone: Zone
  tone: Tone
  fields: Fields
}
export interface AiCarousel {
  title: string
  slides: AiSlide[]
}

const client = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })

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

const schema = (templateIds: string[]) => ({
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
        required: ['template', 'imageIds', 'zone', 'tone', 'fields'],
        properties: {
          template: { type: 'string', enum: templateIds },
          imageIds: { type: 'array', items: { type: 'string' } },
          zone: { type: 'string', enum: ['top', 'middle', 'bottom'] },
          tone: { type: 'string', enum: ['light', 'dark'] },
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

const systemPrompt = (preset: Preset) => {
  const tpls = TEMPLATES.filter((t) => t.family === preset.family)
  return `You design Instagram carousel posts (4:5, 1080×1350) inside the "Postify" editor.

VISUAL STYLE — preset "${preset.name}": ${preset.description}
Style rules extracted from the creator's reference posts:
${preset.analysis.map((a) => `- ${a}`).join('\n')}

TEMPLATES you can use (id — purpose, fields it reads, allowed zones, photos needed):
${tpls.map((t) => `- ${t.id} — ${t.ai} | fields: ${t.fields.join(', ')} | zones: ${t.zones.join('/')} | photos: ${t.images}`).join('\n')}

TEXT MARKUP inside fields: **bold** for key words, ==highlight== for the one phrase that deserves a colour box, blank line (\\n\\n) between paragraphs, "||" to split one line to left/right edges (st-hook subtitle only). Do not put "- " inside bullets/chips items.

HOW TO BUILD THE CAROUSEL
1. Slide 1 is a scroll-stopping hook (cover template). Middle slides deliver value — one idea per slide, very few words, conversational tone like the references (short, punchy, lowercase is fine). Last slide is a CTA (comment a keyword / save / follow).
2. Write ALL text in the same language as the user's request (Polish request → Polish post). Use proper typography for that language (Polish quotes „ ”).
3. Pick photos by looking at them: match mood/content to each slide, avoid using the same photo twice in a row, prefer photos with calm empty areas (sky, wall, floor) for text-heavy slides. Only use imageIds from the provided list. Give each slide exactly as many imageIds as its template needs.
4. zone = where the text goes. Choose the calm area of the photo that does NOT cover faces or the main subject (use the brightness/busy stats given per photo: lower busy = calmer). Must be one of the template's allowed zones.
5. tone = "dark" only when the text sits on a bright area (brightness > ~0.62, e.g. fog/sky/white wall); otherwise "light" (white text + shadow).
6. Fill unused fields with "" or [].
7. Respect length limits — text must fit on a phone screen. Never invent statistics.`
}

export interface GenerateInput {
  apiKey: string
  model: string
  preset: Preset
  prompt: string
  slideCount: number | 'auto'
  images: { img: GalleryImage; analysis?: Analysis }[]
  history: BetaMessageParam[]
}

export async function generateCarousel(inp: GenerateInput): Promise<{ result: AiCarousel; history: BetaMessageParam[] }> {
  const tplIds = TEMPLATES.filter((t) => t.family === inp.preset.family).map((t) => t.id)
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
  const count = inp.slideCount === 'auto' ? 'Choose the best number of slides (usually 5–8).' : `Make exactly ${inp.slideCount} slides.`
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
    system: systemPrompt(inp.preset),
    messages,
    output_config: { format: { type: 'json_schema', schema: schema(tplIds) } },
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
    .filter((s) => tplIds.includes(s.template))
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
  if (e instanceof Anthropic.AuthenticationError) return 'Nieprawidłowy klucz API. Sprawdź go w Ustawieniach.'
  if (e instanceof Anthropic.RateLimitError) return 'Przekroczono limit zapytań. Odczekaj chwilę i spróbuj ponownie.'
  if (e instanceof Anthropic.BadRequestError) return `Błędne zapytanie: ${e.message}`
  if (e instanceof Anthropic.APIConnectionError) return 'Brak połączenia z API Anthropic.'
  if (e instanceof Anthropic.APIError) return `Błąd API (${e.status ?? '?'}): ${e.message}`
  return e instanceof Error ? e.message : String(e)
}
