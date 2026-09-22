import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Slide } from '../types'
import { analyzeSlot, slotSize, type Analysis } from './analyze'

/** Analyses for each background slot of a slide (null where there is no photo). */
export function useSlideAnalysis(slide: Slide | undefined, enabled = true) {
  const imageMap = useStore((s) => s.imageMap)
  const [res, setRes] = useState<(Analysis | null)[]>([])
  const key = slide
    ? slide.layout + '|' + slide.slots.map((s) => `${s.imageId}:${s.focusX}:${s.focusY}:${s.zoom}:${s.offsetX}:${s.offsetY}:${s.blur}`).join(',')
    : ''
  useEffect(() => {
    if (!slide || !enabled) return
    let alive = true
    const { w, h } = slotSize(slide.layout)
    const slots = slide.layout === 'split' ? slide.slots.slice(0, 2) : slide.slots.slice(0, 1)
    Promise.all(
      slots.map((s) => {
        const img = s.imageId ? imageMap[s.imageId] : undefined
        return img ? analyzeSlot(img, s, w, h).catch(() => null) : Promise.resolve(null)
      }),
    ).then((r) => alive && setRes(r))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, imageMap])
  return res
}
