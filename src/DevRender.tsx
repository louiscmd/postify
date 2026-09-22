// Dev-only: /?render=<templateId>&img=<n>&zone=<zone>&tone=<tone> renders one template at 50% for visual QA.
import { useEffect, useState } from 'react'
import { BUILTIN_PRESETS } from './presets'
import { buildSlide, templateById } from './presets/templates'
import { useStore } from './store'
import type { Zone } from './types'
import { SlideThumb } from './components/SlideView'

export default function DevRender() {
  const q = new URLSearchParams(location.search)
  const tpl = templateById(q.get('render')!)!
  const preset = BUILTIN_PRESETS.find((p) => p.family === tpl.family)!
  const [ready, setReady] = useState(false)
  const images = useStore((s) => s.images)
  const map = useStore((s) => s.imageMap)
  useEffect(() => {
    useStore.getState().init().then(() => setReady(true))
  }, [])
  if (!ready) return null
  const n = Number(q.get('img') ?? 0)
  const ids = [images[n]?.id, images[(n + 1) % images.length]?.id].filter(Boolean) as string[]
  const slide = buildSlide(tpl, { preset, zone: (q.get('zone') as Zone) ?? tpl.zones[0], tone: (q.get('tone') as 'light' | 'dark') ?? 'light', imageIds: ids, fields: tpl.demo })
  return <SlideThumb slide={slide} preset={preset} images={map} width={Number(q.get('w') ?? 540)} />
}
