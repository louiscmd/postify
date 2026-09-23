import { useMemo, useState } from 'react'
import { newSeed } from '../presets/layout'
import { slideAnalyses } from '../lib/reroll'
import { fitSlots } from '../lib/slot'
import { buildSlide, ROLE_GROUPS, templatesFor, type TemplateDef } from '../presets/templates'
import { allPresets, useSlide, usePreset, useStore } from '../store'
import type { Slide } from '../types'
import { SlideThumb } from './SlideView'

export function LayoutsPanel() {
  const preset = usePreset()
  const customPresets = useStore((s) => s.customPresets)
  const slide = useSlide()
  const images = useStore((s) => s.imageMap)
  const current = useStore((s) => s.current)
  const st = useStore.getState
  const [roll, setRoll] = useState(() => newSeed())

  const format = useStore((s) => s.project.format) ?? 'post'
  const frameH = format === 'story' ? 1920 : 1350
  const structures = templatesFor(format)
  const groups = ROLE_GROUPS.map((g) => ({ ...g, items: structures.filter((t) => t.role === g.role) })).filter((g) => g.items.length)
  const slideImgs = slide.slots.map((s) => s.imageId).filter(Boolean) as string[]
  const idsFor = (t: TemplateDef) => (t.images === 2 ? [slideImgs[0], slideImgs[1] ?? slideImgs[0]].filter(Boolean) : slideImgs.slice(0, 1))

  // previews are random arrangements too — the dice re-rolls them
  const previews = useMemo(
    () => Object.fromEntries(structures.map((t, i) => [t.id, buildSlide(t, { preset, imageIds: idsFor(t), fields: t.demo, seed: roll + i * 7919, frameH })])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, slideImgs.join(','), roll, format],
  )

  /** Fresh random arrangement, guided by what's calm in the photo. */
  const make = async (t: TemplateDef): Promise<Slide> => {
    const ids = idsFor(t)
    const draft = buildSlide(t, { preset, imageIds: ids, fields: t.demo, frameH })
    fitSlots(draft.slots, images, draft.layout === 'split' ? frameH / 2 : frameH)
    const analyses = await slideAnalyses(draft, images)
    const out = buildSlide(t, { preset, imageIds: ids, fields: t.demo, analyses, frameH })
    fitSlots(out.slots, images, out.layout === 'split' ? frameH / 2 : frameH)
    return out
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

      <div className="row" style={{ marginBottom: 14, alignItems: 'flex-start' }}>
        <div className="tiny muted grow">
          Układy nie mają stałych pozycji — za każdym razem tekst ląduje w innym, spokojnym miejscu zdjęcia. Kliknij, aby zastosować do bieżącego slajdu.
        </div>
        <button className="btn sm" title="Wylosuj nowe podglądy" onClick={() => setRoll(newSeed())}>
          🎲 Losuj
        </button>
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
              <div key={t.id} className="tpl" role="button" onClick={() => apply(t)} title={`${t.description}\nKliknij: zastosuj do bieżącego slajdu (za każdym razem inny układ)`}>
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
