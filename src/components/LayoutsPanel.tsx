import { useMemo } from 'react'
import { analyzeSlot, slotSize } from '../lib/analyze'
import { buildSlide, ROLE_GROUPS, TEMPLATES, type TemplateDef } from '../presets/templates'
import { allPresets, useSlide, usePreset, useStore } from '../store'
import type { Zone } from '../types'
import { SlideThumb } from './SlideView'

export function LayoutsPanel() {
  const preset = usePreset()
  const customPresets = useStore((s) => s.customPresets)
  const slide = useSlide()
  const images = useStore((s) => s.imageMap)
  const current = useStore((s) => s.current)
  const st = useStore.getState

  // only the layouts designed for this style — no cross-style mixing
  const own = TEMPLATES.filter((t) => t.family === preset.family)
  const groups = ROLE_GROUPS.map((g) => ({ ...g, items: own.filter((t) => t.role === g.role) })).filter((g) => g.items.length)
  const slideImgs = slide.slots.map((s) => s.imageId).filter(Boolean) as string[]

  const previews = useMemo(
    () =>
      Object.fromEntries(
        own.map((t) => [t.id, buildSlide(t, { preset, zone: t.zones[0], tone: 'light', imageIds: t.images === 2 ? [slideImgs[0], slideImgs[1] ?? slideImgs[0]].filter(Boolean) : slideImgs.slice(0, 1), fields: t.demo })]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, slideImgs.join(',')],
  )

  /** Builds the template with placeholder text; uses image analysis to pick zone + text tone. */
  const make = async (t: TemplateDef) => {
    const ids = [...slideImgs]
    if (t.images === 2 && ids.length < 2 && ids[0]) ids.push(ids[0])
    let zone: Zone = t.zones[0]
    let tone: 'light' | 'dark' = 'light'
    const first = ids[0] ? images[ids[0]] : undefined
    if (first && t.role !== 'split') {
      const a = await analyzeSlot(first, { imageId: first.id, focusX: 50, focusY: 50, zoom: 1 }, slotSize('single').w, slotSize('single').h)
      zone = [...t.zones].sort((x, y) => a.zones[y].score - a.zones[x].score)[0] ?? zone
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

  return (
    <div>
      <div className="field">
        <span className="label">Styl karuzeli</span>
        <div className="style-pick">
          {allPresets(customPresets).map((p) => (
            <button key={p.id} className={p.id === preset.id ? 'on' : ''} onClick={() => st().mutate((pr) => (pr.presetId = p.id))}>
              <b>{p.name}</b>
              <span>{p.builtin ? p.description : 'własny wariant'}</span>
            </button>
          ))}
        </div>
        <div className="tiny dim" style={{ marginTop: 6 }}>
          Zmiana stylu przestylizuje wszystkie slajdy — pozycje zostają.
        </div>
      </div>

      <div className="tiny muted" style={{ marginBottom: 14 }}>
        Kliknij układ, aby zastosować go do bieżącego slajdu, albo „+ nowy slajd”. Tekst trafia w najspokojniejszą część zdjęcia — potem wpisz własną treść po prawej.
      </div>

      {groups.map((g) => (
        <div key={g.role} style={{ marginBottom: 18 }}>
          <div className="group-head">
            <span className="label" style={{ margin: 0 }}>
              {g.label}
            </span>
            <span className="tiny dim">{g.hint}</span>
          </div>
          <div className="tpl-grid">
            {g.items.map((t) => (
              <div key={t.id} className="tpl" role="button" onClick={() => apply(t)} title={`${t.description}\nKliknij: zastosuj do bieżącego slajdu`}>
                <SlideThumb slide={previews[t.id]} preset={preset} images={images} width={138} />
                <div className="tpl-name">
                  {t.name}
                  {t.images === 2 && <div className="tpl-desc">2 zdjęcia</div>}
                  <button
                    className="btn sm"
                    style={{ marginTop: 6, width: '100%' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      insert(t)
                    }}
                  >
                    + nowy slajd
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
