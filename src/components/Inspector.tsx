import { useEffect, useRef, type ReactNode } from 'react'
import { FONTS } from '../fonts'
import { useSlideAnalysis } from '../lib/useAnalysis'
import { SHADOW_LABELS, STYLE_LABELS } from '../presets'
import { makeChips, makeDoodle, makeInset, makeSlot, makeStack, makeTextBlock } from '../presets/templates'
import { usePreset, useSlide, useStore } from '../store'
import type { Block, DoodleEl, ImageEl, StackEl, StyleKey, TextStyle, Zone } from '../types'
import { H, W } from '../types'
import { containZoom, MAX_ZOOM, MIN_ZOOM, pixelZoom } from '../lib/slot'
import { IMAGE_MIME } from './Canvas'
import { DOODLES, Doodle } from './Doodle'
import { Copy, Down, ImageIcon, Pill, Plus, Reset, Split, Square, Trash, Up } from './Icons'
import { resolveStyle } from './SlideView'

// ── small controls ───────────────────────────────────────────
const Num = ({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) => (
  <label>
    <span className="mini-label">{label}</span>
    <input className="input" type="number" value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
)

const Slider = ({ label, value, onChange, min, max, step = 1, fmt }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; fmt?: (v: number) => string }) => (
  <label style={{ display: 'block', marginBottom: 8 }}>
    <span className="mini-label row" style={{ justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span>{fmt ? fmt(value) : value}</span>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
)

const Section = ({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) => (
  <div className="section">
    <div className="section-title">
      <span>{title}</span>
      {right}
    </div>
    {children}
  </div>
)

const ALIGN_OPTS: [TextStyle['align'], string][] = [['left', 'Lewo'], ['center', 'Środek'], ['right', 'Prawo'], ['justify', 'Justuj']]
const ADD_GROUPS: { label: string; keys: StyleKey[] }[] = [
  { label: 'Nagłówki', keys: ['title', 'subtitle', 'kicker', 'number', 'keyword'] },
  { label: 'Treść', keys: ['body', 'list', 'note', 'split'] },
  { label: 'Dół slajdu / CTA', keys: ['caption', 'cta'] },
]
const DEMO: Partial<Record<StyleKey, string>> = {
  title: 'Twój tytuł',
  subtitle: 'Podtytuł',
  kicker: 'nadtytuł',
  body: 'Krótki akapit z **pogrubionym** słowem.',
  list: '- pierwszy **punkt**\n- drugi **punkt**\n- trzeci **punkt**',
  number: '01.',
  keyword: '“SŁOWO”',
  caption: 'Podpis z ==wyróżnieniem==',
  cta: 'Wezwanie do działania z **pogrubieniem**',
  note: '(mały dopisek)',
  split: 'jedna linijka na środku',
}

/** Where a new text element should go: calmest zone of the photo. */
const zonePos = (z: Zone): Pick<StackEl, 'y' | 'anchor'> => (z === 'top' ? { y: 140, anchor: 'top' } : z === 'bottom' ? { y: 1220, anchor: 'bottom' } : { y: 675, anchor: 'center' })

// ── block editor ─────────────────────────────────────────────
function BlockEditor({ el, b, index }: { el: StackEl; b: Block; index: number }) {
  const preset = usePreset()
  const selBlock = useStore((s) => s.selBlock)
  const focusTick = useStore((s) => s.focusTick)
  const st = useStore.getState
  const ref = useRef<HTMLTextAreaElement>(null)
  const on = selBlock === b.id
  const style = resolveStyle(preset, b)

  useEffect(() => {
    if (on && focusTick && ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [focusTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (fn: (blk: Block) => void, key?: string) =>
    st().updateEl(el.id, (e) => {
      if (e.type !== 'stack') return
      const blk = e.blocks.find((x) => x.id === b.id)
      if (blk) fn(blk)
    }, key)
  const setStyle = <K extends keyof TextStyle>(k: K, v: TextStyle[K]) => upd((blk) => ((blk.overrides as Partial<TextStyle>)[k] = v), `${b.id}-${k}`)
  const move = (dir: -1 | 1) =>
    st().updateEl(el.id, (e) => {
      if (e.type !== 'stack') return
      const j = index + dir
      if (j < 0 || j >= e.blocks.length) return
      ;[e.blocks[index], e.blocks[j]] = [e.blocks[j], e.blocks[index]]
    })
  const remove = () =>
    st().updateEl(el.id, (e) => {
      if (e.type === 'stack') e.blocks = e.blocks.filter((x) => x.id !== b.id)
    })
  const hasOv = Object.keys(b.overrides).length > 0

  return (
    <div className={`block-card ${on ? 'on' : ''}`} onFocusCapture={() => !on && st().select(el.id, b.id)} onClick={() => !on && st().select(el.id, b.id)}>
      <div className="block-head">
        <select className="select" style={{ flex: 1, padding: '4px 24px 4px 8px' }} value={b.styleKey} onChange={(e) => upd((blk) => (blk.styleKey = e.target.value as StyleKey))}>
          {(Object.keys(STYLE_LABELS) as StyleKey[]).map((k) => (
            <option key={k} value={k}>
              {STYLE_LABELS[k]}
            </option>
          ))}
        </select>
        <button className="btn sm icon ghost" title="W górę" onClick={() => move(-1)}>
          <Up size={14} />
        </button>
        <button className="btn sm icon ghost" title="W dół" onClick={() => move(1)}>
          <Down size={14} />
        </button>
        <button className="btn sm icon ghost danger" title="Usuń blok" onClick={remove}>
          <Trash size={13} />
        </button>
      </div>

      {b.kind === 'text' ? (
        <textarea ref={ref} className="textarea" rows={Math.min(8, Math.max(2, b.text.split('\n').length + 1))} value={b.text} onChange={(e) => upd((blk) => blk.kind === 'text' && (blk.text = e.target.value), `${b.id}-text`)} />
      ) : (
        <>
          <textarea ref={ref} className="textarea" rows={Math.max(3, b.items.length)} value={b.items.join('\n')} onChange={(e) => upd((blk) => blk.kind === 'chips' && (blk.items = e.target.value.split('\n')), `${b.id}-items`)} />
          <div className="tiny dim">Jeden chip w linii</div>
        </>
      )}

      <div className="grid2" style={{ marginTop: 8 }}>
        <Num label="Rozmiar (px)" value={style.size} onChange={(v) => setStyle('size', Math.max(8, v))} />
        <label>
          <span className="mini-label">Kolor</span>
          <div className="row">
            <input type="color" value={style.color.startsWith('#') ? style.color.slice(0, 7) : '#ffffff'} onChange={(e) => setStyle('color', e.target.value)} />
            <button className="btn sm" title="Biały + cień" onClick={() => upd((blk) => Object.assign(blk.overrides, { color: '#ffffff', shadow: preset.styles[blk.styleKey].shadow === 'none' ? 'soft' : preset.styles[blk.styleKey].shadow }))}>
              Jasny
            </button>
            <button className="btn sm" title="Ciemny bez cienia" onClick={() => upd((blk) => Object.assign(blk.overrides, { color: preset.dark, shadow: 'none' }))}>
              Ciemny
            </button>
          </div>
        </label>
      </div>
      <div className="seg full" style={{ marginTop: 8 }}>
        {ALIGN_OPTS.map(([a, l]) => (
          <button key={a} className={style.align === a ? 'on' : ''} onClick={() => setStyle('align', a)}>
            {l}
          </button>
        ))}
      </div>

      <details className="details">
        <summary>Typografia i efekty</summary>
        <div className="field">
          <span className="mini-label">Font</span>
          <select className="select" value={style.font} onChange={(e) => setStyle('font', e.target.value as TextStyle['font'])}>
            {FONTS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid3">
          <label>
            <span className="mini-label">Grubość</span>
            <select className="select" value={style.weight} onChange={(e) => setStyle('weight', Number(e.target.value))}>
              {(FONTS.find((f) => f.key === style.font)?.weights ?? [400]).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <Num label="Interlinia" step={0.02} value={style.lineHeight} onChange={(v) => setStyle('lineHeight', v)} />
          <Num label="Tracking (em)" step={0.005} value={style.letterSpacing} onChange={(v) => setStyle('letterSpacing', v)} />
        </div>
        <div className="grid2" style={{ marginTop: 8 }}>
          <label>
            <span className="mini-label">Cień</span>
            <select className="select" value={style.shadow} onChange={(e) => setStyle('shadow', e.target.value as TextStyle['shadow'])}>
              {Object.entries(SHADOW_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Num label="Odstęp nad (px)" value={b.marginTop} onChange={(v) => upd((blk) => (blk.marginTop = v), `${b.id}-mt`)} />
        </div>
        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 12 }}>
          <label className="row small">
            <input type="checkbox" checked={style.uppercase} onChange={(e) => setStyle('uppercase', e.target.checked)} /> KAPITALIKI
          </label>
          <label className="row small">
            <input type="checkbox" checked={style.italic} onChange={(e) => setStyle('italic', e.target.checked)} /> kursywa
          </label>
          <label className="row small">
            <input type="checkbox" checked={!!style.underline} onChange={(e) => setStyle('underline', e.target.checked ? preset.accent : null)} /> podkreślenie
          </label>
        </div>
        <div className="grid3" style={{ marginTop: 8 }}>
          <label>
            <span className="mini-label">Wyróżn. tło</span>
            <input type="color" value={style.highlightBg.startsWith('#') ? style.highlightBg.slice(0, 7) : '#4b1a6e'} onChange={(e) => setStyle('highlightBg', e.target.value)} />
          </label>
          <label>
            <span className="mini-label">Wyróżn. tekst</span>
            <input type="color" value={style.highlightColor.startsWith('#') ? style.highlightColor.slice(0, 7) : '#ffffff'} onChange={(e) => setStyle('highlightColor', e.target.value)} />
          </label>
          <label>
            <span className="mini-label">Pogrub. kolor</span>
            <input type="color" value={style.boldColor ?? (style.color.startsWith('#') ? style.color.slice(0, 7) : '#ffffff')} onChange={(e) => setStyle('boldColor', e.target.value)} />
          </label>
        </div>
        {style.underline && (
          <label style={{ display: 'block', marginTop: 8 }}>
            <span className="mini-label">Kolor podkreślenia</span>
            <input type="color" value={style.underline} onChange={(e) => setStyle('underline', e.target.value)} />
          </label>
        )}
        <div style={{ marginTop: 8 }}>
          <span className="mini-label">Wyrównanie bloku w stosie</span>
          <div className="seg full">
            {(['stretch', 'start', 'center', 'end'] as const).map((a) => (
              <button key={a} className={b.selfAlign === a ? 'on' : ''} onClick={() => upd((blk) => (blk.selfAlign = a))}>
                {{ stretch: 'Pełny', start: 'Lewo', center: 'Środek', end: 'Prawo' }[a]}
              </button>
            ))}
          </div>
        </div>
        <Slider label="Krycie" min={0.1} max={1} step={0.05} value={style.opacity} onChange={(v) => setStyle('opacity', v)} fmt={(v) => `${Math.round(v * 100)}%`} />
      </details>
      {hasOv && (
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => upd((blk) => (blk.overrides = {}))}>
          <Reset size={13} /> Wróć do stylu presetu
        </button>
      )}
    </div>
  )
}

// ── element inspectors ───────────────────────────────────────
function Transform({ el }: { el: StackEl | ImageEl | DoodleEl }) {
  const st = useStore.getState
  const set = (k: 'x' | 'y' | 'w' | 'h' | 'rotation', v: number) => st().updateEl(el.id, (e) => ((e as unknown as Record<string, number>)[k] = v), `${el.id}-${k}`)
  return (
    <>
      <div className="grid3">
        <Num label="X" value={el.x} onChange={(v) => set('x', v)} />
        <Num label="Y" value={el.y} onChange={(v) => set('y', v)} />
        <Num label="Szerokość" value={el.w} onChange={(v) => set('w', Math.max(20, v))} />
      </div>
      <div className="grid3" style={{ marginTop: 8 }}>
        {el.type !== 'stack' ? <Num label="Wysokość" value={el.h} onChange={(v) => set('h', Math.max(20, v))} /> : <div />}
        <Num label="Obrót (°)" value={el.rotation} onChange={(v) => set('rotation', v)} />
        <label>
          <span className="mini-label">Wyśrodkuj</span>
          <button className="btn sm" style={{ width: '100%' }} onClick={() => set('x', Math.round((W - el.w) / 2))}>
            poziomo
          </button>
        </label>
      </div>
      {el.type === 'stack' && (
        <div style={{ marginTop: 8 }}>
          <span className="mini-label">Punkt zaczepienia Y (tekst rośnie od…)</span>
          <div className="seg full">
            {(['top', 'center', 'bottom'] as const).map((a) => (
              <button
                key={a}
                className={el.anchor === a ? 'on' : ''}
                onClick={() =>
                  st().updateEl(el.id, (e) => {
                    if (e.type !== 'stack') return
                    const node = document.querySelector<HTMLElement>(`.stage [data-el-id="${e.id}"]`)
                    const stage = document.querySelector<HTMLElement>('.stage')
                    if (node && stage) {
                      // keep the block visually in place while switching anchor
                      const s = stage.getBoundingClientRect()
                      const r = node.getBoundingClientRect()
                      const k = W / s.width
                      const top = (r.top - s.top) * k
                      const h = r.height * k
                      e.y = Math.round(a === 'top' ? top : a === 'center' ? top + h / 2 : top + h)
                    }
                    e.anchor = a
                  })
                }
              >
                {{ top: 'Góra', center: 'Środek', bottom: 'Dół' }[a]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function ElementHeader({ el, title }: { el: StackEl | ImageEl | DoodleEl; title: string }) {
  const st = useStore.getState
  return (
    <div className="section-title">
      <span>{title}</span>
      <span className="row" style={{ gap: 2 }}>
        <button className="btn sm icon ghost" title="Na wierzch" onClick={() => st().reorderEl(el.id, 1)}>
          <Up size={14} />
        </button>
        <button className="btn sm icon ghost" title="Pod spód" onClick={() => st().reorderEl(el.id, -1)}>
          <Down size={14} />
        </button>
        <button className="btn sm icon ghost" title="Duplikuj (Ctrl+D)" onClick={() => st().duplicateEl(el.id)}>
          <Copy size={13} />
        </button>
        <button className="btn sm icon ghost danger" title="Usuń (Delete)" onClick={() => st().deleteEl(el.id)}>
          <Trash size={13} />
        </button>
      </span>
    </div>
  )
}

function StackInspector({ el }: { el: StackEl }) {
  const st = useStore.getState
  const addBlock = (b: Block) =>
    st().updateEl(el.id, (e) => {
      if (e.type === 'stack') e.blocks.push(b)
    })
  return (
    <>
      <div className="section">
        <ElementHeader el={el} title="Tekst" />
        {el.blocks.map((b, i) => (
          <BlockEditor key={b.id} el={el} b={b} index={i} />
        ))}
        <div className="row">
          <button className="btn sm" onClick={() => addBlock(makeTextBlock('body', 'Nowa linijka', { marginTop: 16 }))}>
            <Plus size={13} /> Linijka tekstu
          </button>
          <button className="btn sm" onClick={() => addBlock(makeChips(['chip 1', 'chip 2', 'chip 3'], 30))}>
            <Pill size={13} /> Chipy
          </button>
        </div>
        <div className="tiny dim" style={{ marginTop: 10, lineHeight: 1.7 }}>
          <span className="code">**pogrubienie**</span> <span className="code">==wyróżnienie==</span> <span className="code">- punkt listy</span> pusta linia = nowy akapit ·{' '}
          <span className="code">lewo || prawo</span> rozbija linijkę na dwa brzegi (np. wokół głowy)
        </div>
      </div>
      <Section title="Pozycja">
        <Transform el={el} />
      </Section>
    </>
  )
}

function ImageInspector({ el }: { el: ImageEl }) {
  const images = useStore((s) => s.imageMap)
  const st = useStore.getState
  const upd = (fn: (e: ImageEl) => void, key?: string) => st().updateEl(el.id, (e) => e.type === 'image' && fn(e), key)
  const img = el.imageId ? images[el.imageId] : undefined
  return (
    <>
      <div className="section">
        <ElementHeader el={el} title="Wstawione zdjęcie" />
        <div className="slot-card">
          <DropThumb url={img?.url} onDrop={(id) => upd((e) => (e.imageId = id))} />
          <div style={{ flex: 1 }}>
            <Slider label="Zaokrąglenie" min={0} max={200} value={el.radius} onChange={(v) => upd((e) => (e.radius = v), `${el.id}-r`)} />
            <label className="row small">
              <input type="checkbox" checked={el.shadow} onChange={(e) => upd((x) => (x.shadow = e.target.checked))} /> cień pod zdjęciem
            </label>
          </div>
        </div>
        <Slider label="Kadr poziomo" min={0} max={100} value={el.focusX} onChange={(v) => upd((e) => (e.focusX = v), `${el.id}-fx`)} fmt={(v) => `${v}%`} />
        <Slider label="Kadr pionowo" min={0} max={100} value={el.focusY} onChange={(v) => upd((e) => (e.focusY = v), `${el.id}-fy`)} fmt={(v) => `${v}%`} />
      </div>
      <Section title="Pozycja">
        <Transform el={el} />
      </Section>
    </>
  )
}

function DoodleInspector({ el }: { el: DoodleEl }) {
  const st = useStore.getState
  const upd = (fn: (e: DoodleEl) => void, key?: string) => st().updateEl(el.id, (e) => e.type === 'doodle' && fn(e), key)
  return (
    <>
      <div className="section">
        <ElementHeader el={el} title="Strzałka / dekoracja" />
        <div className="doodle-grid">
          {Object.entries(DOODLES).map(([k, d]) => (
            <button key={k} className={`doodle-btn ${el.kind === k ? 'on' : ''}`} title={d.label} onClick={() => upd((e) => (e.kind = k as DoodleEl['kind']))}>
              <Doodle kind={k as DoodleEl['kind']} color="currentColor" stroke={2} />
            </button>
          ))}
        </div>
        <div className="grid3" style={{ marginTop: 10 }}>
          <label>
            <span className="mini-label">Kolor</span>
            <input type="color" value={el.color} onChange={(e) => upd((x) => (x.color = e.target.value), `${el.id}-c`)} />
          </label>
          <Num label="Grubość" value={el.stroke} onChange={(v) => upd((e) => (e.stroke = Math.max(1, v)), `${el.id}-s`)} />
          <div>
            <span className="mini-label">Odbij</span>
            <div className="row" style={{ gap: 4 }}>
              <button className={`btn sm ${el.flipX ? 'active' : ''}`} onClick={() => upd((e) => (e.flipX = !e.flipX))}>
                ↔
              </button>
              <button className={`btn sm ${el.flipY ? 'active' : ''}`} onClick={() => upd((e) => (e.flipY = !e.flipY))}>
                ↕
              </button>
            </div>
          </div>
        </div>
      </div>
      <Section title="Pozycja">
        <Transform el={el} />
      </Section>
    </>
  )
}

function DropThumb({ url, onDrop, label = 'upuść zdjęcie' }: { url?: string; onDrop: (id: string) => void; label?: string }) {
  return (
    <div
      className="slot-thumb"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(IMAGE_MIME)) {
          e.preventDefault()
          e.currentTarget.classList.add('over')
        }
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove('over')}
      onDrop={(e) => {
        e.preventDefault()
        e.currentTarget.classList.remove('over')
        const id = e.dataTransfer.getData(IMAGE_MIME)
        if (id) onDrop(id)
      }}
    >
      {url ? <img src={url} alt="" /> : label}
    </div>
  )
}

// ── slide inspector ──────────────────────────────────────────
function SlideInspector() {
  const slide = useSlide()
  const preset = usePreset()
  const images = useStore((s) => s.imageMap)
  const current = useStore((s) => s.current)
  const analyses = useSlideAnalysis(slide)
  const st = useStore.getState
  const best = analyses[0]

  const addText = (k: StyleKey) => {
    const pos = best ? zonePos(best.best) : { y: 160, anchor: 'top' as const }
    const tone = best && best.zones[best.best].lum > 0.62 ? { color: preset.dark, shadow: 'none' as const } : {}
    st().addEl(makeStack({ x: 80, w: 920, ...pos, blocks: [makeTextBlock(k, DEMO[k] ?? 'Tekst', { overrides: tone })] }))
  }

  const setLayout = (layout: 'single' | 'split') =>
    st().updateSlide((s) => {
      s.layout = layout
      if (layout === 'split' && s.slots.length < 2) s.slots.push(makeSlot(null))
    })

  const slots = slide.layout === 'split' ? slide.slots.slice(0, 2) : slide.slots.slice(0, 1)
  const slotH = slide.layout === 'split' ? H / 2 : H

  return (
    <>
      <Section title="Dodaj do slajdu">
        <span className="mini-label">Tekst w stylu „{preset.name}” — trafi w najspokojniejsze miejsce zdjęcia</span>
        {ADD_GROUPS.map((g) => (
          <div key={g.label} style={{ marginBottom: 8 }}>
            <span className="mini-label" style={{ color: 'var(--muted)' }}>
              {g.label}
            </span>
            <div className="add-grid">
              {g.keys.map((k) => (
                <button key={k} className="btn sm" onClick={() => addText(k)}>
                  <Plus size={13} /> {STYLE_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <span className="mini-label" style={{ color: 'var(--muted)' }}>
          Inne elementy
        </span>
        <div className="add-grid">
          <button className="btn sm" onClick={() => st().addEl(makeStack({ x: 60, w: 960, y: 1150, anchor: 'bottom', blocks: [makeChips(['pierwszy', 'drugi chip', 'trzeci', 'czwarty chip'])] }))}>
            <Pill size={13} /> Chipy
          </button>
          <button className="btn sm" onClick={() => st().addEl(makeInset({}))}>
            <ImageIcon size={13} /> Wstawka zdjęcia
          </button>
        </div>
        <span className="mini-label" style={{ marginTop: 10 }}>
          Strzałki i dekoracje
        </span>
        <div className="doodle-grid">
          {Object.entries(DOODLES).map(([k, d]) => (
            <button
              key={k}
              className="doodle-btn"
              title={d.label}
              onClick={() => st().addEl(makeDoodle({ kind: k as DoodleEl['kind'], x: 760, y: 420, w: 120, h: k === 'underline' ? 40 : 130, color: k === 'loop' || k === 'curve' || k === 'circle' ? preset.accent : '#ffffff', stroke: k === 'loop' ? 5 : 3 }))}
            >
              <Doodle kind={k as DoodleEl['kind']} color="currentColor" stroke={2} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Tło slajdu">
        <div className="seg full" style={{ marginBottom: 12 }}>
          <button className={slide.layout === 'single' ? 'on' : ''} onClick={() => setLayout('single')}>
            <Square size={14} /> Jedno zdjęcie
          </button>
          <button className={slide.layout === 'split' ? 'on' : ''} onClick={() => setLayout('split')}>
            <Split size={14} /> Podział 50/50
          </button>
        </div>
        {slots.map((s, i) => {
          const img = s.imageId ? images[s.imageId] : undefined
          const set = (fn: (x: typeof s) => void, key?: string) => st().updateSlide((sl) => fn(sl.slots[i]), key)
          return (
            <div key={i} className="card" style={{ marginBottom: 10, padding: 10 }}>
              <div className="slot-card">
                <DropThumb url={img?.url} onDrop={(id) => st().setSlotImage(current, i, id)} label={slide.layout === 'split' ? (i === 0 ? 'góra' : 'dół') : 'upuść zdjęcie'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>
                    {slide.layout === 'split' ? (i === 0 ? 'Górna połowa' : 'Dolna połowa') : 'Zdjęcie tła'}
                  </div>
                  <div className="tiny dim" style={{ marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {img ? img.name : 'Przeciągnij z galerii lub kliknij zdjęcie w galerii'}
                  </div>
                  {img && (
                    <button className="btn sm ghost danger" onClick={() => st().setSlotImage(current, i, null)}>
                      Usuń zdjęcie
                    </button>
                  )}
                </div>
              </div>
              {img && (
                <div style={{ marginTop: 10 }}>
                  <Slider
                    label="Powiększenie"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={s.zoom}
                    onChange={(v) => set((x) => (x.zoom = v), `slot${i}-z`)}
                    fmt={(v) => `${Math.round(v * 100)}%`}
                  />
                  <div className="grid2" style={{ marginBottom: 8 }}>
                    <button className="btn sm" title="Zdjęcie wypełnia cały kadr (część zostaje ucięta)" onClick={() => set((x) => Object.assign(x, { zoom: 1, offsetX: 0, offsetY: 0 }))}>
                      Wypełnij kadr
                    </button>
                    <button className="btn sm" title="Całe zdjęcie mieści się w kadrze — brzegi wypełnia rozmycie" onClick={() => set((x) => Object.assign(x, { zoom: Math.round(containZoom(img, W, slotH) * 1000) / 1000, offsetX: 0, offsetY: 0 }))}>
                      Zmieść całość
                    </button>
                    <button className="btn sm" title="Skala 1:1 — piksele zdjęcia = piksele eksportu" onClick={() => set((x) => Object.assign(x, { zoom: Math.round(pixelZoom(img, W, slotH) * 1000) / 1000 }))}>
                      Skala 1:1
                    </button>
                    <button className="btn sm" title="Wyśrodkuj zdjęcie w kadrze" onClick={() => set((x) => Object.assign(x, { offsetX: 0, offsetY: 0 }))}>
                      Wyśrodkuj
                    </button>
                  </div>
                  <label className="row small" style={{ marginBottom: 6 }}>
                    <input type="checkbox" checked={s.blur !== false} onChange={(e) => set((x) => (x.blur = e.target.checked))} /> rozmyte tło przy pomniejszeniu
                  </label>
                  <div className="tiny dim">
                    {img.w}×{img.h} px · przeciągnij zdjęcie na slajdzie, aby je przesunąć; kółko myszy = powiększenie.
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div className="row" style={{ marginTop: 4 }}>
          <span className="small grow">Kolor tła (bez zdjęcia)</span>
          <input type="color" value={slide.bgColor} onChange={(e) => st().updateSlide((s) => (s.bgColor = e.target.value), 'bg')} />
        </div>
      </Section>

      <Section title="Przyciemnienie (czytelność)">
        <Slider label="Gradient od góry" min={0} max={1} step={0.05} value={slide.overlay.top} onChange={(v) => st().updateSlide((s) => (s.overlay.top = v), 'ov-top')} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Gradient od dołu" min={0} max={1} step={0.05} value={slide.overlay.bottom} onChange={(v) => st().updateSlide((s) => (s.overlay.bottom = v), 'ov-bottom')} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Przyciemnij całość" min={0} max={0.8} step={0.05} value={slide.overlay.dim} onChange={(v) => st().updateSlide((s) => (s.overlay.dim = v), 'ov-dim')} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Section>
    </>
  )
}

export function Inspector() {
  const slide = useSlide()
  const selEl = useStore((s) => s.selEl)
  const el = slide.elements.find((e) => e.id === selEl)
  if (!el) return <SlideInspector />
  return (
    <>
      <div className="section" style={{ paddingTop: 10, paddingBottom: 10 }}>
        <button className="btn ghost sm" onClick={() => useStore.getState().select(null)}>
          ← Ustawienia slajdu
        </button>
      </div>
      {el.type === 'stack' && <StackInspector el={el} />}
      {el.type === 'image' && <ImageInspector el={el} />}
      {el.type === 'doodle' && <DoodleInspector el={el} />}
    </>
  )
}

