import { useMemo } from 'react'
import { analyzeSlot, slotSize } from '../lib/analyze'
import { buildSlide, TEMPLATES, type TemplateDef } from '../presets/templates'
import { useSlide, usePreset, useStore } from '../store'
import type { Zone } from '../types'
import { SlideThumb } from './SlideView'

export function LayoutsPanel() {
  const preset = usePreset()
  const slide = useSlide()
  const images = useStore((s) => s.imageMap)
  const current = useStore((s) => s.current)
  const st = useStore.getState

  const own = TEMPLATES.filter((t) => t.family === preset.family)
  const other = TEMPLATES.filter((t) => t.family !== preset.family)
  const slideImgs = slide.slots.map((s) => s.imageId).filter(Boolean) as string[]

  const previews = useMemo(
    () =>
      Object.fromEntries(
        TEMPLATES.map((t) => [t.id, buildSlide(t, { preset, zone: t.zones[0], tone: 'light', imageIds: t.images === 2 ? [slideImgs[0], slideImgs[1] ?? slideImgs[0]].filter(Boolean) : slideImgs.slice(0, 1), fields: t.demo })]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, slideImgs.join(',')],
  )

  /** Builds the template with demo text; uses image analysis to pick zone + text tone. */
  const make = async (t: TemplateDef) => {
    const ids = [...slideImgs]
    if (t.images === 2 && ids.length < 2 && ids[0]) ids.push(ids[0])
    let zone: Zone = t.zones[0]
    let tone: 'light' | 'dark' = 'light'
    const first = ids[0] ? images[ids[0]] : undefined
    if (first && t.role !== 'split') {
      const a = await analyzeSlot(first, { imageId: first.id, focusX: 50, focusY: 50, zoom: 1 }, slotSize('single').w, slotSize('single').h)
      const allowed = t.zones.filter((z) => z in a.zones)
      zone = allowed.sort((x, y) => a.zones[y].score - a.zones[x].score)[0] ?? zone
      tone = a.zones[zone].lum > 0.62 ? 'dark' : 'light'
    }
    return buildSlide(t, { preset, zone, tone, imageIds: ids, fields: t.demo })
  }

  const apply = async (t: TemplateDef) => {
    const s = await make(t)
    st().updateSlide((cur) => {
      const keepSlots = cur.slots
      Object.assign(cur, { ...s, id: cur.id })
      // keep the user's framing for photos that stay the same
      cur.slots = s.slots.map((ns, i) => (keepSlots[i] && keepSlots[i].imageId === ns.imageId ? keepSlots[i] : ns))
    })
    useStore.setState({ selEl: null })
  }
  const insert = async (t: TemplateDef) => st().addSlide(await make(t), current + 1)

  const Card = ({ t }: { t: TemplateDef }) => (
    <div className="tpl" role="button" onClick={() => apply(t)} title="Kliknij: zastosuj do bieżącego slajdu">
      <SlideThumb slide={previews[t.id]} preset={preset} images={images} width={138} />
      <div className="tpl-name">
        {t.name}
        <div className="tpl-desc">{t.description}</div>
        <button
          className="btn sm"
          style={{ marginTop: 6, width: '100%' }}
          onClick={(e) => {
            e.stopPropagation()
            insert(t)
          }}
        >
          + jako nowy slajd
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="hint" style={{ marginBottom: 14 }}>
        Kliknij układ, żeby zastosować go do bieżącego slajdu. Tekst trafi w najspokojniejszą część zdjęcia, a jego kolor zostanie dobrany automatycznie. Potem zmień treść w panelu po prawej.
      </div>
      <div className="label">Styl „{preset.name}”</div>
      <div className="tpl-grid">
        {own.map((t) => (
          <Card key={t.id} t={t} />
        ))}
      </div>
      <div className="label" style={{ marginTop: 20 }}>
        Inne układy (w stylu „{preset.name}”)
      </div>
      <div className="tpl-grid">
        {other.map((t) => (
          <Card key={t.id} t={t} />
        ))}
      </div>
    </div>
  )
}
