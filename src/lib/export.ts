import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { getFontEmbedCSS, toJpeg, toPng } from 'html-to-image'
import JSZip from 'jszip'
import { SlideView } from '../components/SlideView'
import type { GalleryImage, Preset, Slide } from '../types'
import { slideH, W } from '../types'
import { slotRect } from './slot'
import { loadImg } from './util'

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
            createElement('div', { key: s.id, className: 'export-slide', style: { width: W, height: slideH(s) } }, createElement(SlideView, { slide: s, preset, images: inlined, textOnly: true })),
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

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rad = Math.min(r, w / 2, h / 2)
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, rad)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/**
 * Paints the photo layer: backgrounds (with their free zoom/offset and blurred fill),
 * the darkening overlays and any inset photos — everything the text sits on.
 *
 * This is done on a canvas on purpose. Rasterising <img> elements through an SVG
 * foreignObject is unreliable in iOS Safari, which is what produced exports with the
 * text but no photos; drawImage always works.
 */
async function paintPhotoLayer(ctx: CanvasRenderingContext2D, slide: Slide, images: Record<string, GalleryImage>) {
  const H = slideH(slide)
  ctx.fillStyle = slide.bgColor
  ctx.fillRect(0, 0, W, H)

  const slots = slide.layout === 'split' ? slide.slots.slice(0, 2) : slide.slots.slice(0, 1)
  const slotH = slide.layout === 'split' ? H / 2 : H
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    const meta = s?.imageId ? images[s.imageId] : undefined
    if (!meta) continue
    const el = await loadImg(meta.url).catch(() => null)
    if (!el) continue
    const top = i * slotH
    const r = slotRect(s, meta, W, slotH)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, top, W, slotH)
    ctx.clip()
    if (!r.covers && s.blur !== false) {
      // same idea as the CSS: a blurred cover copy fills the empty edges
      const bs = Math.max(W / el.naturalWidth, slotH / el.naturalHeight)
      const bw = el.naturalWidth * bs
      const bh = el.naturalHeight * bs
      // older engines ignore ctx.filter; the copy is then simply dimmed rather than blurred
      ctx.filter = 'blur(42px) brightness(0.55) saturate(1.1)'
      ctx.globalAlpha = ctx.filter === 'none' ? 0.45 : 1
      ctx.drawImage(el, (W - bw) / 2, top + (slotH - bh) / 2, bw, bh)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
    }
    ctx.drawImage(el, r.left, top + r.top, r.w, r.h)
    ctx.restore()
  }

  const o = slide.overlay
  if (o.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${o.dim})`
    ctx.fillRect(0, 0, W, H)
  }
  if (o.top > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.48)
    g.addColorStop(0, `rgba(0,0,0,${o.top})`)
    g.addColorStop(0.46, `rgba(0,0,0,${o.top * 0.55})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H * 0.48)
  }
  if (o.bottom > 0) {
    const g = ctx.createLinearGradient(0, H, 0, H * 0.55)
    g.addColorStop(0, `rgba(0,0,0,${o.bottom})`)
    g.addColorStop(0.36, `rgba(0,0,0,${o.bottom * 0.7})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, H * 0.55, W, H * 0.45)
  }

  for (const el of slide.elements) {
    if (el.type !== 'image' || !el.imageId) continue
    const meta = images[el.imageId]
    if (!meta) continue
    const src = await loadImg(meta.url).catch(() => null)
    if (!src) continue
    ctx.save()
    ctx.translate(el.x + el.w / 2, el.y + el.h / 2)
    ctx.rotate((el.rotation * Math.PI) / 180)
    ctx.translate(-el.w / 2, -el.h / 2)
    if (el.shadow) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = 40
      ctx.shadowOffsetY = 12
      ctx.fillStyle = '#000'
      roundRect(ctx, 0, 0, el.w, el.h, el.radius)
      ctx.fill()
      ctx.restore()
    }
    roundRect(ctx, 0, 0, el.w, el.h, el.radius)
    ctx.clip()
    // object-fit: cover with object-position focusX/focusY
    const k = Math.max(el.w / src.naturalWidth, el.h / src.naturalHeight)
    const dw = src.naturalWidth * k
    const dh = src.naturalHeight * k
    ctx.drawImage(src, (el.w - dw) * (el.focusX / 100), (el.h - dh) * (el.focusY / 100), dw, dh)
    ctx.restore()
  }
}

/** Renders every slide to a real PNG file at full Instagram resolution. */
/**
 * Renders every slide to a full-resolution PNG.
 * Photos go on a canvas (reliable everywhere) and the text layer is rasterised on top
 * with a transparent background, so no photo ever passes through the SVG path.
 */
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
      const H = slideH(slides[i])
      const cv = document.createElement('canvas')
      cv.width = W
      cv.height = H
      const ctx = cv.getContext('2d')
      if (!ctx) throw new Error('Przeglądarka nie udostępniła canvasu do eksportu')
      await paintPhotoLayer(ctx, slides[i], images)

      const textUrl = await toPng(nodes[i], { width: W, height: H, pixelRatio: 1, fontEmbedCSS, cacheBust: false, backgroundColor: 'transparent' })
      const textImg = await loadImg(textUrl)
      ctx.drawImage(textImg, 0, 0, W, H)

      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Nie udało się zapisać PNG')
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
