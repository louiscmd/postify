import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { aiErrorMessage, generateCarousel, type AiCarousel } from '../lib/ai'
import { analyzeSlot } from '../lib/analyze'
import { slideAnalyses } from '../lib/reroll'
import { fitSlots } from '../lib/slot'
import { buildSlide, templateById } from '../presets/templates'
import { STORY_TYPES, storyTypeById } from '../presets/stories'
import { allPresets, usePreset, useStore } from '../store'
import type { GalleryImage, Preset, Role, Slide } from '../types'
import { W, H } from '../types'
import { Gallery } from './Gallery'
import { Send, Sparkles } from './Icons'

interface ChatMsg {
  role: 'user' | 'bot' | 'err'
  text: string
}

const useChat = create<{ msgs: ChatMsg[]; history: BetaMessageParam[]; projectId: string | null; busy: boolean; stage: string }>(() => ({
  msgs: [],
  history: [],
  projectId: null,
  busy: false,
  stage: '',
}))

const SUGGESTIONS = [
  'Zrób mi post o porannej rutynie, która daje energię na cały dzień',
  'Karuzela: 5 błędów, które popełnia każdy początkujący fotograf',
  'Post o tym, jak zaplanować tani weekend w nowym mieście',
  'Krótka historia: czego nauczył mnie pierwszy rok prowadzenia firmy',
]

const MAX_IMAGES = 20

/** AI content → slides arranged by the layout engine (random, guided by each photo + the AI's zone hint). */
export async function slidesFromAi(res: AiCarousel, preset: Preset, images: Record<string, GalleryImage>, frameH = 1350): Promise<Slide[]> {
  return Promise.all(
    res.slides.map(async (s) => {
      const tpl = (s.structure && templateById(s.structure)) || s.role
      const opts = { preset, imageIds: s.imageIds, fields: s.fields, frameH }
      const draft = buildSlide(tpl, opts)
      fitSlots(draft.slots, images, draft.layout === 'split' ? frameH / 2 : frameH)
      const analyses = await slideAnalyses(draft, images)
      const out = buildSlide(tpl, { ...opts, analyses, hint: s.zone })
      fitSlots(out.slots, images, out.layout === 'split' ? frameH / 2 : frameH)
      return out
    }),
  )
}

const ROLE_NAMES: Record<Role, string> = { cover: 'Okładka', content: 'Treść', list: 'Lista', statement: 'Akcent', split: 'Podział 50/50', cta: 'CTA' }

export function AIPanel() {
  const { msgs, busy, stage, history, projectId } = useChat()
  const preset = usePreset()
  const customPresets = useStore((s) => s.customPresets)
  const settings = useStore((s) => s.settings)
  const images = useStore((s) => s.images)
  const aiSelection = useStore((s) => s.aiSelection)
  const currentProjectId = useStore((s) => s.project.id)
  const format = useStore((s) => s.project.format) ?? 'post'
  const storyType = useStore((s) => s.project.storyType)
  const isStory = format === 'story'
  const type = storyTypeById(storyType)
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState<'auto' | number>('auto')
  const [showPick, setShowPick] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const st = useStore.getState

  // a revision only makes sense on the project the conversation created
  const revising = history.length > 0 && projectId === currentProjectId

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length, busy])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    if (!settings.apiKey) {
      useChat.setState({ msgs: [...msgs, { role: 'user', text: q }, { role: 'err', text: 'Najpierw dodaj klucz API Anthropic w Ustawieniach (ikona zębatki).' }] })
      useStore.setState({ modal: 'settings' })
      return
    }
    const baseHistory = revising ? history : []
    const pool = (aiSelection.length ? images.filter((i) => aiSelection.includes(i.id)) : images).slice(0, MAX_IMAGES)
    useChat.setState({ msgs: [...(revising ? msgs : []), { role: 'user', text: q }], busy: true, stage: 'Analizuję zdjęcia…' })
    setPrompt('')
    try {
      const withStats = baseHistory.length
        ? []
        : await Promise.all(pool.map(async (img) => ({ img, analysis: await analyzeSlot(img, { imageId: img.id, focusX: 50, focusY: 50, zoom: 1 }, W, H).catch(() => undefined) })))
      useChat.setState({ stage: baseHistory.length ? 'Poprawiam karuzelę…' : `Claude projektuje karuzelę (${pool.length} zdjęć)…` })
      const { result, history: nextHistory } = await generateCarousel({
        apiKey: settings.apiKey,
        model: settings.model,
        preset,
        prompt: q,
        slideCount: isStory ? (type ? type.frames.length : count) : count,
        images: withStats,
        history: baseHistory,
        format,
        storyType,
      })
      useChat.setState({ stage: 'Układam slajdy…' })
      const slides = await slidesFromAi(result, preset, st().imageMap, isStory ? 1920 : 1350)
      if (!slides.length) throw new Error('AI nie zwróciło żadnych slajdów. Spróbuj inaczej sformułować prośbę.')
      let pid = projectId
      if (revising) {
        st().mutate((p) => {
          p.slides = slides
        })
        useStore.setState({ current: 0, selEl: null })
      } else {
        st().newProject(result.title || q.slice(0, 40), preset.id, slides, format, storyType)
        pid = st().project.id
      }
      const lines = result.slides.map((s, i) => `${i + 1}. ${ROLE_NAMES[s.role]} — ${s.purpose}`)
      useChat.setState((c) => ({
        msgs: [...c.msgs, { role: 'bot', text: `${revising ? 'Poprawione' : 'Gotowe'}: „${result.title}” — ${slides.length} slajdów.\n\n${lines.join('\n')}\n\nMożesz wszystko edytować ręcznie albo napisz, co zmienić (np. „krótsze teksty”, „zamień slajd 3 na listę”).` }],
        history: nextHistory,
        projectId: pid,
      }))
    } catch (e) {
      useChat.setState((c) => ({ msgs: [...c.msgs, { role: 'err', text: aiErrorMessage(e) }] }))
    } finally {
      useChat.setState({ busy: false, stage: '' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="panel-scroll">
        <div className="field">
          <span className="label">Styl posta</span>
          <select className="select" value={preset.id} onChange={(e) => st().mutate((p) => (p.presetId = e.target.value))}>
            {allPresets(customPresets).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.builtin ? '' : ' (własny)'}
              </option>
            ))}
          </select>
          <div className="tiny dim" style={{ marginTop: 5 }}>
            {preset.description}
          </div>
        </div>

        {isStory ? (
          <div className="field">
            <span className="label">Typ relacji</span>
            <select className="select" value={storyType ?? ''} onChange={(e) => st().newStory(e.target.value)}>
              {STORY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.cadence}
                </option>
              ))}
            </select>
            {type && (
              <div className="tiny dim" style={{ marginTop: 6 }}>
                <b>Technika:</b> {type.technique}
                <br />
                {type.frames.length} klatek · {type.purpose}
              </div>
            )}
          </div>
        ) : (
          <div className="field">
            <span className="label">Liczba slajdów</span>
            <div className="seg full">
              {(['auto', 3, 5, 7, 10] as const).map((c) => (
                <button key={c} className={count === c ? 'on red' : ''} onClick={() => setCount(c)}>
                  {c === 'auto' ? 'Auto' : c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label" style={{ margin: 0 }}>
              Zdjęcia dla AI
            </span>
            <button className="btn ghost sm" onClick={() => setShowPick((v) => !v)}>
              {showPick ? 'ukryj' : aiSelection.length ? `wybrane: ${aiSelection.length}` : `wszystkie (${Math.min(images.length, MAX_IMAGES)})`}
            </button>
          </div>
          {(showPick || images.length === 0) && (
            <div style={{ marginTop: 8 }}>
              <Gallery selectMode />
            </div>
          )}
          {images.length > MAX_IMAGES && !aiSelection.length && <div className="tiny dim">AI dostanie pierwsze {MAX_IMAGES} zdjęć — zaznacz konkretne, jeśli chcesz inne.</div>}
        </div>

        <div className="chat">
          {msgs.length === 0 && (
            <>
              <div className="msg bot">
                {isStory ? (
                  <>
                    Opisz temat, a napiszę całą sekwencję relacji typu <b>{type?.name ?? 'relacja'}</b> — zgodnie z techniką tego typu i z układem 9:16 omijającym paski Instagrama.
                  </>
                ) : (
                  <>
                    Cześć! Opisz, o czym ma być post, a zaprojektuję całą karuzelę w stylu <b>{preset.name}</b>: dobiorę zdjęcia z galerii, napiszę teksty i ustawię je w najspokojniejszych miejscach kadru.
                  </>
                )}
              </div>
              <div className="chips-suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip-s" onClick={() => setPrompt(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="msg bot row">
              <span className="spinner" /> {stage}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer">
        <textarea
          className="textarea"
          rows={3}
          placeholder={revising ? 'Co zmienić? np. „mocniejszy hook na 1. klatce”' : isStory ? 'O czym ma być ta relacja?' : 'Zrób mi post o…'}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(prompt)
            }
          }}
        />
        <div className="row">
          {revising && (
            <button className="btn ghost sm" onClick={() => useChat.setState({ msgs: [], history: [], projectId: null })}>
              Nowa rozmowa
            </button>
          )}
          <span className="grow tiny dim">{revising ? 'Poprawki nadpiszą slajdy (Ctrl+Z cofa)' : 'Enter — wyślij · Shift+Enter — nowa linia'}</span>
          <button className="btn primary" disabled={busy || !prompt.trim()} onClick={() => send(prompt)}>
            {busy ? <span className="spinner" /> : revising ? <Send size={15} /> : <Sparkles size={15} />}
            {revising ? 'Popraw' : 'Generuj'}
          </button>
        </div>
      </div>
    </div>
  )
}
