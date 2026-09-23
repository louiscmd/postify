import { useEffect, useState } from 'react'
import { aiErrorMessage, critiqueSlide } from '../lib/ai'
import { describe, regionStats, ZONE_LABEL, type Analysis } from '../lib/analyze'
import { slideJpegBase64 } from '../lib/export'
import { stripMarkup } from '../lib/markup'
import { useSlideAnalysis } from '../lib/useAnalysis'
import { contrast, parseColor, relLum } from '../lib/util'
import { usePreset, useSlide, useStore } from '../store'
import type { StackEl, Zone } from '../types'
import { slideH, W, H as POST_H } from '../types'
import { Bulb, Sparkles } from './Icons'
import { resolveStyle } from './SlideView'

type Level = 'ok' | 'warn' | 'bad' | 'info'
interface Tip {
  level: Level
  text: string
  fix?: { label: string; run: () => void }
}

const measure = (id: string) => {
  const stage = document.querySelector<HTMLElement>('.stage')
  const node = stage?.querySelector<HTMLElement>(`[data-el-id="${id}"]`)
  if (!stage || !node) return null
  const s = stage.getBoundingClientRect()
  const r = node.getBoundingClientRect()
  const k = W / s.width
  return { x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k }
}

const measureBlock = (id: string) => {
  const stage = document.querySelector<HTMLElement>('.stage')
  const node = stage?.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
  if (!stage || !node) return null
  const s = stage.getBoundingClientRect()
  const r = node.getBoundingClientRect()
  const k = W / s.width
  return { x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k }
}

const zoneY = (z: Zone, h: number): Pick<StackEl, 'y' | 'anchor'> =>
  z === 'top' ? { y: 130, anchor: 'top' } : z === 'bottom' ? { y: h - 125, anchor: 'bottom' } : { y: h / 2, anchor: 'center' }

export function useTips(analyses: (Analysis | null)[]) {
  const slide = useSlide()
  const H = slideH(slide)
  const preset = usePreset()
  const current = useStore((s) => s.current)
  const [tips, setTips] = useState<Tip[]>([])
  const st = useStore.getState

  useEffect(() => {
    const t = setTimeout(() => {
      const out: Tip[] = []
      const slotH = slide.layout === 'split' ? H / 2 : H
      const hasPhoto = slide.slots.some((s) => s.imageId)
      if (!hasPhoto) out.push({ level: 'info', text: 'Dodaj zdjęcie tła — wtedy przeanalizuję, gdzie tekst będzie najczytelniejszy.' })

      let words = 0
      for (const el of slide.elements) {
        if (el.type !== 'stack') continue
        const r = measure(el.id)
        if (!r) continue
        const main = el.blocks.find((b) => b.kind === 'text') ?? el.blocks[0]
        if (!main) continue
        const label = `„${stripMarkup(main.kind === 'text' ? main.text : main.items.join(', ')).slice(0, 28)}…”`
        words += el.blocks.reduce((n, b) => n + stripMarkup(b.kind === 'text' ? b.text : b.items.join(' ')).split(/\s+/).filter(Boolean).length, 0)

        // safe area / Instagram UI
        if (r.x < 40 || r.x + r.w > W - 40 || r.y < 40 || r.y + r.h > H - 40)
          out.push({
            level: 'warn',
            text: `${label} dotyka krawędzi — na telefonie może zostać ucięty lub zasłonięty przez UI Instagrama.`,
            fix: {
              label: 'Wsuń do środka',
              run: () =>
                st().updateEl(el.id, (e) => {
                  if (e.type !== 'stack') return
                  if (r.x < 40) e.x += 60 - r.x
                  if (r.x + r.w > W - 40) e.x -= r.x + r.w - (W - 60)
                  if (r.y < 40) e.y += 60 - r.y
                  if (r.y + r.h > H - 40) e.y -= r.y + r.h - (H - 60)
                }),
            },
          })
        else if (current === 0 && (r.x < 34 || r.x + r.w > W - 34))
          out.push({ level: 'info', text: `${label}: siatka profilu pokazuje kadr 3:4 — boczne 34 px zostaną przycięte na okładce.` })

        // background under each text block (a tall stack can start calm and end on a face)
        const tall = r.h > (slide.layout === 'split' ? H / 2 : H) * 0.42
        for (const blk of el.blocks) {
          const br = measureBlock(blk.id)
          if (!br || br.h < 4) continue
          const style = resolveStyle(preset, blk)
          const blabel = `„${stripMarkup(blk.kind === 'text' ? blk.text : blk.items.join(', ')).replace(/\s+/g, ' ').slice(0, 26)}…”`
          const slotIdx = slide.layout === 'split' && br.y + br.h / 2 > H / 2 ? 1 : 0
          const a = analyses[slotIdx]
          if (!a) continue
          const y0 = br.y - slotIdx * slotH
          const reg = regionStats(a, br.x, Math.max(0, y0), br.w, Math.min(slotH, br.h))
          // overlays darken the photo: approximate their effect on brightness
          const o = slide.overlay
          const cy = (br.y + br.h / 2) / H
          const dark = 1 - Math.min(0.95, o.dim + o.top * Math.max(0, 1 - cy / 0.45) + o.bottom * Math.max(0, 1 - (1 - cy) / 0.45))
          const busy = reg.busy * dark
          if (blk.kind === 'chips') continue // chips carry their own background
          const bgLum = Math.pow(reg.lum * dark, 2.2)
          const txtLum = relLum(parseColor(style.color))
          const ratio = contrast(bgLum, txtLum)
          const shadowed = style.shadow !== 'none'
          const need = shadowed ? 2.2 : 3.2
          const lightText = txtLum > 0.5
          const gradient = { label: 'Dodaj gradient', run: () => st().updateSlide((s) => (cy < 0.5 ? (s.overlay.top = Math.max(s.overlay.top, 0.6)) : (s.overlay.bottom = Math.max(s.overlay.bottom, 0.8)))) }
          if (ratio < need) {
            out.push({
              level: ratio < need * 0.7 ? 'bad' : 'warn',
              text: `${blabel}: słaby kontrast z tłem (${ratio.toFixed(1)}:1). ${lightText ? 'Tło pod tekstem jest jasne.' : 'Tło pod tekstem jest ciemne.'}`,
              fix: lightText
                ? reg.lum > 0.62
                  ? { label: 'Ciemny tekst', run: () => st().updateEl(el.id, (e) => e.type === 'stack' && e.blocks.forEach((b) => Object.assign(b.overrides, { color: preset.dark, shadow: 'none' }))) }
                  : gradient
                : { label: 'Jasny tekst + cień', run: () => st().updateEl(el.id, (e) => e.type === 'stack' && e.blocks.forEach((b) => Object.assign(b.overrides, { color: '#ffffff', shadow: 'soft' }))) },
            })
          } else if (busy > 0.5 && !shadowed) {
            out.push({ level: 'warn', text: `${blabel} leży na ruchliwym fragmencie zdjęcia — dodaj cień, żeby się nie zlewał.`, fix: { label: 'Dodaj cień', run: () => st().updateEl(el.id, (e) => e.type === 'stack' && e.blocks.forEach((b) => (b.overrides.shadow = 'soft'))) } })
          } else if (busy > 0.55 && slide.layout !== 'split' && a.zones[a.best].busy < busy - 0.12) {
            out.push({
              level: 'warn',
              text: tall
                ? `${blabel} wchodzi na szczegółowy fragment (być może twarz lub główny obiekt). Skróć tekst albo przyciemnij tło pod nim.`
                : `${blabel} zasłania szczegółowy fragment (być może twarz lub główny obiekt). Spokojniej jest: ${ZONE_LABEL[a.best]}.`,
              fix: tall ? gradient : { label: `Przenieś: ${ZONE_LABEL[a.best]}`, run: () => st().updateEl(el.id, (e) => e.type === 'stack' && Object.assign(e, zoneY(a.best, H))) },
            })
          } else out.push({ level: 'ok', text: `${blabel}: czytelny (kontrast ${ratio.toFixed(1)}:1${busy > 0.5 ? ', cień pomaga na ruchliwym tle' : ', spokojne tło'}).` })
        }
      }
      if (words > 70) out.push({ level: 'warn', text: `Dużo tekstu (${words} słów). Referencje mają 10–45 słów na slajd — rozbij na dwa slajdy.` })
      if (current === 0 && slide.elements.length && words > 14) out.push({ level: 'info', text: 'Okładka działa najlepiej z hookiem do ~8 słów w dużym kroju.' })
      setTips(out)
    }, 250)
    return () => clearTimeout(t)
  }, [slide, analyses, preset, current]) // eslint-disable-line react-hooks/exhaustive-deps
  return tips
}

export function TipsPanel() {
  const slide = useSlide()
  const preset = usePreset()
  const images = useStore((s) => s.imageMap)
  const settings = useStore((s) => s.settings)
  const showTips = useStore((s) => s.showTips)
  const analyses = useSlideAnalysis(slide)
  const tips = useTips(analyses)
  const [ai, setAi] = useState<{ busy: boolean; text: string; err?: boolean }>({ busy: false, text: '' })

  useEffect(() => {
    setAi({ busy: false, text: '' })
  }, [slide.id])

  const ask = async () => {
    if (!settings.apiKey) return useStore.setState({ modal: 'settings' })
    setAi({ busy: true, text: '' })
    try {
      const jpeg = await slideJpegBase64(slide, preset, images)
      const stats = analyses.map((a, i) => (a ? `slot ${i}: ${describe(a)}` : '')).filter(Boolean).join(' | ') || 'no photo'
      setAi({ busy: false, text: await critiqueSlide({ apiKey: settings.apiKey, model: settings.model, preset, jpegBase64: jpeg, stats }) })
    } catch (e) {
      setAi({ busy: false, text: aiErrorMessage(e), err: true })
    }
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">
          <span className="row">
            <Bulb size={15} /> Analiza tła
          </span>
          <button className={`btn sm ${showTips ? 'active' : ''}`} onClick={() => useStore.setState({ showTips: !showTips })}>
            {showTips ? 'Ukryj strefy' : 'Pokaż strefy'}
          </button>
        </div>
        {analyses.every((a) => !a) && <div className="small muted">Brak zdjęcia tła do analizy.</div>}
        {analyses.map((a, i) =>
          a ? (
            <div key={i} style={{ marginBottom: 10 }}>
              {slide.layout === 'split' && <div className="mini-label">{i === 0 ? 'Górna połowa' : 'Dolna połowa'}</div>}
              {(Object.keys(a.zones) as Zone[]).map((z) => (
                <div key={z} className="zone-row">
                  <span style={{ fontWeight: z === a.best ? 700 : 400, color: z === a.best ? 'var(--ok)' : undefined }}>{ZONE_LABEL[z]}</span>
                  <div className="meter" title="Spokój tła (więcej = lepiej dla tekstu)">
                    <i style={{ width: `${Math.round(a.zones[z].score * 100)}%`, background: a.zones[z].score > 0.6 ? 'var(--ok)' : a.zones[z].score > 0.4 ? 'var(--warn)' : 'var(--bad)' }} />
                  </div>
                  <span className="tiny dim" title="Jasność">
                    {a.zones[z].lum > 0.62 ? 'jasno' : a.zones[z].lum < 0.3 ? 'ciemno' : 'średnio'}
                  </span>
                </div>
              ))}
              <div className="tip info">
                <span className="dot" />
                <span>
                  Tekst najlepiej: <b>{ZONE_LABEL[a.best]}</b>, {a.tone === 'dark' ? <>kolor <b>ciemny</b> bez cienia (jasne tło)</> : <>kolor <b>biały</b> z cieniem</>}.
                </span>
              </div>
            </div>
          ) : null,
        )}
        <div className="tiny dim">Czerwone pola na podglądzie = dużo szczegółów (twarze, przedmioty, tekstury). Zielona ramka = najspokojniejsza strefa.</div>
      </div>

      <div className="section">
        <div className="section-title">Wskazówki do tego slajdu</div>
        {tips.length === 0 && <div className="small muted">Dodaj tekst, żeby zobaczyć wskazówki.</div>}
        {tips.map((t, i) => (
          <div key={i} className={`tip ${t.level}`}>
            <span className="dot" />
            <div style={{ flex: 1 }}>
              {t.text}
              {t.fix && (
                <div style={{ marginTop: 6 }}>
                  <button className="btn sm" onClick={t.fix.run}>
                    {t.fix.label}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title">Opinia AI o układzie</div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Claude obejrzy slajd i doradzi, gdzie przesunąć tekst, czy nie zasłania twarzy i co skrócić.
        </p>
        <button className="btn primary" style={{ width: '100%' }} disabled={ai.busy} onClick={ask}>
          {ai.busy ? <span className="spinner" /> : <Sparkles size={15} />} Zapytaj AI o ten slajd
        </button>
        {ai.text && (
          <div className={`card ai-answer ${ai.err ? 'msg err' : ''}`} style={{ marginTop: 10 }}>
            {ai.text}
          </div>
        )}
      </div>
    </div>
  )
}
