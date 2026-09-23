import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { getFontEmbedCSS, toJpeg, toPng } from 'html-to-image'
import JSZip from 'jszip'
import { SlideView } from '../components/SlideView'
import type { GalleryImage, Preset, Slide } from '../types'
import { slideH, W } from '../types'

const dataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(new Error('read failed'))
    fr.readAsDataURL(blob)
  })

/**
 * Photos live as blob: URLs, which iOS Safari refuses to inline while rasterising the
 * slide — that is why exports came out with the text but no background. Swapping them
 * for data: URLs before rendering means nothing has to be fetched during capture.
 */
async function inlinePhotos(slides: Slide[], images: Record<string, GalleryImage>) {
  const used = new Set<string>()
  for (const s of slides) {
    for (const slot of s.slots) if (slot.imageId) used.add(slot.imageId)
    for (const el of s.elements) if (el.type === 'image' && el.imageId) used.add(el.imageId)
  }
  const out: Record<string, GalleryImage> = { ...images }
  for (const id of used) {
    const img = images[id]
    if (!img || img.url.startsWith('data:')) continue
    try {
      out[id] = { ...img, url: await dataUrl(await (await fetch(img.url)).blob()) }
    } catch {
      /* keep the original url and let the renderer try */
    }
  }
  return out
}

/** Mounts slides off-screen at full size, waits for fonts + photos, then hands each node to `fn`. */
async function withStage<T>(slides: Slide[], preset: Preset, images: Record<string, GalleryImage>, fn: (nodes: HTMLElement[]) => Promise<T>) {
  const inlined = await inlinePhotos(slides, images)
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
          slides.map((s) =>
            createElement('div', { key: s.id, className: 'export-slide', style: { width: W, height: slideH(s) } }, createElement(SlideView, { slide: s, preset, images: inlined })),
          ),
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

export const safeName = (name: string) => name.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().replace(/\s+/g, '-') || 'postify'

/** Renders every slide to a real PNG file at full Instagram resolution. */
export async function renderSlidePngs(
  name: string,
  slides: Slide[],
  preset: Preset,
  images: Record<string, GalleryImage>,
  onProgress: (done: number, total: number) => void,
): Promise<File[]> {
  return withStage(slides, preset, images, async (nodes) => {
    const fontEmbedCSS = await getFontEmbedCSS(nodes[0])
    const files: File[] = []
    for (let i = 0; i < nodes.length; i++) {
      onProgress(i, nodes.length)
      const opts = { width: W, height: slideH(slides[i]), pixelRatio: 1, fontEmbedCSS, cacheBust: false }
      // Safari's first rasterisation of a node can come back without its images; a second pass is reliable
      if (i === 0) await toPng(nodes[i], opts)
      const url = await toPng(nodes[i], opts)
      const blob = await (await fetch(url)).blob()
      files.push(new File([blob], `${safeName(name)}-${String(i + 1).padStart(2, '0')}.png`, { type: 'image/png' }))
    }
    onProgress(nodes.length, nodes.length)
    return files
  })
}

/** True when the browser can hand PNG files to the system share sheet (iOS: "Save N Images"). */
export const canShareImages = (files: File[]) => !!navigator.canShare?.({ files }) && typeof navigator.share === 'function'

/** Opens the system share sheet — on a phone this is how PNGs reach the camera roll. */
export async function sharePngs(files: File[], title: string) {
  await navigator.share({ files, title })
}

/** Saves one PNG through a normal download (desktop, or as a fallback). */
export function downloadFile(file: File) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function zipFiles(name: string, files: File[]) {
  const zip = new JSZip()
  for (const f of files) zip.file(f.name, f)
  const out = await zip.generateAsync({ type: 'blob' })
  downloadFile(new File([out], `${safeName(name)}.zip`, { type: 'application/zip' }))
}

/** Small JPEG of one slide (base64, no prefix) — used to ask Claude for layout feedback. */
export async function slideJpegBase64(slide: Slide, preset: Preset, images: Record<string, GalleryImage>) {
  return withStage([slide], preset, images, async ([node]) => {
    const url = await toJpeg(node, { width: W, height: slideH(slide), pixelRatio: 0.6, quality: 0.85 })
    return url.split(',')[1]
  })
}
