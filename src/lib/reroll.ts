import { arrange, newSeed } from '../presets/layout'
import { getPreset, useStore } from '../store'
import type { GalleryImage, Slide } from '../types'
import { analyzeSlot, slotSize, type Analysis } from './analyze'

/** Photo analysis for each background slot of a slide, as currently framed. */
export async function slideAnalyses(slide: Slide, images: Record<string, GalleryImage>): Promise<(Analysis | null)[]> {
  const { w, h } = slotSize(slide.layout)
  const slots = slide.layout === 'split' ? slide.slots.slice(0, 2) : slide.slots.slice(0, 1)
  return Promise.all(slots.map((s) => (s.imageId && images[s.imageId] ? analyzeSlot(images[s.imageId], s, w, h).catch(() => null) : Promise.resolve(null))))
}

/** New random arrangement for the given slides (text and photos stay), as one undo step. */
export async function rerollSlides(indices: number[]) {
  const st = useStore.getState()
  const preset = getPreset()
  const analyses = await Promise.all(indices.map((i) => slideAnalyses(st.project.slides[i], st.imageMap)))
  st.mutate((p) => {
    indices.forEach((i, k) => {
      if (p.slides[i]) arrange(p.slides[i], preset, analyses[k], newSeed())
    })
  })
  useStore.setState({ selEl: null })
}
