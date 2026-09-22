// Dev-only visual QA: /?render=<structureId>&preset=<id>&img=<n>&seed=<n>&w=<px>
// renders one structure through the layout engine (same seed = same arrangement).
import { useEffect, useState } from 'react'
import { BUILTIN_PRESETS } from './presets'
import { buildSlide, templateById } from './presets/templates'
import { slideAnalyses } from './lib/reroll'
import { useStore } from './store'
import type { Slide } from './types'
import { SlideThumb } from './components/SlideView'

export default function DevRender() {
  const q = new URLSearchParams(location.search)
  const tpl = templateById(q.get('render')!)!
  const preset = BUILTIN_PRESETS.find((p) => p.id === (q.get('preset') ?? 'editorial')) ?? BUILTIN_PRESETS[0]
  const [slide, setSlide] = useState<Slide | null>(null)
  const map = useStore((s) => s.imageMap)
  useEffect(() => {
    useStore
      .getState()
      .init()
      .then(async () => {
        const { images, imageMap } = useStore.getState()
        const n = Number(q.get('img') ?? 0)
        const ids = [images[n]?.id, images[(n + 1) % images.length]?.id].filter(Boolean).slice(0, tpl.images) as string[]
        const seed = Number(q.get('seed') ?? 1)
        const draft = buildSlide(tpl, { preset, imageIds: ids, fields: tpl.demo, seed })
        setSlide(buildSlide(tpl, { preset, imageIds: ids, fields: tpl.demo, seed, analyses: await slideAnalyses(draft, imageMap) }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!slide) return null
  return <SlideThumb slide={slide} preset={preset} images={map} width={Number(q.get('w') ?? 540)} />
}
