import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { getFontEmbedCSS, toJpeg, toPng } from 'html-to-image'
import JSZip from 'jszip'
import { SlideView } from '../components/SlideView'
import type { GalleryImage, Preset, Slide } from '../types'
import { H, W } from '../types'

/** Mounts slides off-screen at full 1080×1350, waits for fonts + images, then hands each node to `fn`. */
async function withStage<T>(slides: Slide[], preset: Preset, images: Record<string, GalleryImage>, fn: (nodes: HTMLElement[]) => Promise<T>) {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${W}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  // html-to-image waits on requestAnimationFrame, which never fires in a background tab —
  // use a timer during export so switching tabs doesn't freeze it.
  const raf = window.requestAnimationFrame
  window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 0)
  try {
    flushSync(() =>
      root.render(
        createElement(
          'div',
          null,
          slides.map((s) => createElement('div', { key: s.id, className: 'export-slide', style: { width: W, height: H } }, createElement(SlideView, { slide: s, preset, images }))),
        ),
      ),
    )
    await document.fonts.ready
    // img.decode() never resolves in background tabs, so wait for load events (with a safety timeout)
    await Promise.all(
      Array.from(host.querySelectorAll('img')).map(
        (i) =>
          i.complete ||
          new Promise<void>((res) => {
            i.addEventListener('load', () => res(), { once: true })
            i.addEventListener('error', () => res(), { once: true })
            setTimeout(res, 8000)
          }),
      ),
    )
    const nodes = Array.from(host.querySelectorAll<HTMLElement>('.export-slide > .slide-root'))
    return await fn(nodes)
  } finally {
    window.requestAnimationFrame = raf
    root.unmount()
    host.remove()
  }
}

export async function exportZip(
  name: string,
  slides: Slide[],
  preset: Preset,
  images: Record<string, GalleryImage>,
  onProgress: (done: number, total: number) => void,
) {
  const zip = new JSZip()
  await withStage(slides, preset, images, async (nodes) => {
    const fontEmbedCSS = await getFontEmbedCSS(nodes[0])
    for (let i = 0; i < nodes.length; i++) {
      onProgress(i, nodes.length)
      const url = await toPng(nodes[i], { width: W, height: H, pixelRatio: 1, fontEmbedCSS, cacheBust: false })
      const blob = await (await fetch(url)).blob()
      zip.file(`${String(i + 1).padStart(2, '0')}.png`, blob)
    }
    onProgress(nodes.length, nodes.length)
  })
  const out = await zip.generateAsync({ type: 'blob' })
  const safe = name.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().replace(/\s+/g, '-') || 'karuzela'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(out)
  a.download = `${safe}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** Small JPEG of one slide (base64, no prefix) — used to ask Claude for layout feedback. */
export async function slideJpegBase64(slide: Slide, preset: Preset, images: Record<string, GalleryImage>) {
  return withStage([slide], preset, images, async ([node]) => {
    const url = await toJpeg(node, { width: W, height: H, pixelRatio: 0.6, quality: 0.85 })
    return url.split(',')[1]
  })
}
