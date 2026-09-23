import { createStore, del, entries, get, set, setMany } from 'idb-keyval'
import type { GalleryImage, Preset, Project, ProjectMeta } from '../types'
import { uid } from './util'

// One local database per account (plus "postify" for guest use), so accounts never mix on a shared browser.
const storeFor = (ns: string) => createStore(ns ? `postify-${ns}` : 'postify', 'kv')
let store = storeFor('')

/** Switch the local database to an account ('' = guest). */
export const useNamespace = (ns: string) => {
  store = storeFor(ns)
}

/** Copy everything saved in guest mode into the current (account) database. */
export async function copyGuestData() {
  const all = await entries(storeFor(''))
  const byId = <T extends { id: string }>(a: T[] = [], b: T[] = []) => [...new Map([...a, ...b].map((x) => [x.id, x])).values()]
  const out: [IDBValidKey, unknown][] = []
  for (const [k, v] of all) {
    if (k === 'lastProject') continue
    // index lists are merged with what the account already has, everything else is copied as-is
    if (k === 'projects' || k === 'images' || k === 'presets') out.push([k, byId((await get(k, store)) as { id: string }[], v as { id: string }[])])
    else out.push([k, v])
  }
  await setMany(out, store)
}

export async function guestSummary() {
  const g = storeFor('')
  const projects = ((await get('projects', g)) as ProjectMeta[] | undefined) ?? []
  const images = ((await get('images', g)) as unknown[] | undefined) ?? []
  return { projects, images: images.length }
}

type ImageMeta = Omit<GalleryImage, 'url'>

export const db = {
  async loadImages(): Promise<GalleryImage[]> {
    const metas = ((await get('images', store)) as ImageMeta[] | undefined) ?? []
    const out: GalleryImage[] = []
    for (const m of metas) {
      const blob = (await get(`img:${m.id}`, store)) as Blob | undefined
      if (blob) out.push({ ...m, url: URL.createObjectURL(blob) })
    }
    return out
  },
  async saveImageIndex(images: GalleryImage[]) {
    await set('images', images.map(({ url: _url, ...m }) => m), store)
  },
  async putImageBlob(id: string, blob: Blob) {
    await set(`img:${id}`, blob, store)
  },
  async deleteImage(id: string) {
    await del(`img:${id}`, store)
  },
  async getImageBlob(id: string) {
    return (await get(`img:${id}`, store)) as Blob | undefined
  },

  async loadProjectIndex(): Promise<ProjectMeta[]> {
    return ((await get('projects', store)) as ProjectMeta[] | undefined) ?? []
  },
  async saveProjectIndex(list: ProjectMeta[]) {
    await set('projects', list, store)
  },
  async loadProject(id: string) {
    return (await get(`project:${id}`, store)) as Project | undefined
  },
  async saveProject(p: Project) {
    await set(`project:${p.id}`, p, store)
  },
  async deleteProject(id: string) {
    await del(`project:${id}`, store)
  },
  async getLastProjectId() {
    return (await get('lastProject', store)) as string | undefined
  },
  async setLastProjectId(id: string) {
    await set('lastProject', id, store)
  },

  async loadCustomPresets(): Promise<Preset[]> {
    return ((await get('presets', store)) as Preset[] | undefined) ?? []
  },
  async saveCustomPresets(p: Preset[]) {
    await set('presets', p, store)
  },
}

const MAX_EDGE = 4096 // ~4× the export width — deep zoom without blur
const MAX_PIXELS = 40e6 // browsers refuse to draw canvases much larger than this

export const IMAGE_EXT = /\.(jpe?g|jpe|jfif|png|webp|avif|gif|bmp|tiff?|heic|heif)$/i

interface Decoded {
  src: CanvasImageSource
  w: number
  h: number
  release: () => void
}

/**
 * What the file actually is, read from its first bytes — file names and MIME types lie
 * (an iPhone HEIC saved as "photo.jpg" is common, and so are TIFFs with a .jpg name).
 */
export async function sniffType(file: Blob): Promise<string> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const at = (i: number, ...bytes: number[]) => bytes.every((v, k) => b[i + k] === v)
  const ascii = (i: number, len: number) => String.fromCharCode(...b.slice(i, i + len))
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (ascii(0, 3) === 'GIF') return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp'
  if (ascii(0, 2) === 'BM') return 'image/bmp'
  if (at(0, 0x49, 0x49, 0x2a, 0x00) || at(0, 0x4d, 0x4d, 0x00, 0x2a)) return 'image/tiff'
  if (ascii(0, 4) === '%PDF') return 'application/pdf'
  if (at(0, 0xff, 0x0a) || at(0, 0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20)) return 'image/jxl'
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4)
    if (brand.startsWith('avi')) return 'image/avif'
    if (/heic|heix|hevc|hevx|mif1|msf1|heis/.test(brand)) return 'image/heic'
  }
  return ''
}

const FORMAT_HELP: Record<string, string> = {
  'image/tiff': 'to plik TIFF — przeglądarki go nie otwierają; zapisz jako JPG lub PNG',
  'image/jxl': 'to plik JPEG XL — zapisz jako JPG lub PNG',
  'application/pdf': 'to plik PDF, nie zdjęcie',
  '': 'nie rozpoznano formatu — plik może być uszkodzony',
}

/**
 * Decode whatever the browser can read. Some JPEGs (CMYK, unusual colour profiles, odd
 * EXIF) are refused by createImageBitmap but load fine as an <img>, so try both.
 */
async function decode(file: File): Promise<Decoded> {
  if (file.size === 0) throw new Error('plik jest pusty (0 bajtów)')
  const real = await sniffType(file)

  // HEIC/HEIF (iPhone) — no browser decodes it, so convert it here; the decoder loads on demand
  if (real === 'image/heic') {
    const { heicTo } = await import('heic-to')
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 }).catch(() => {
      throw new Error('to zdjęcie HEIC (iPhone) i nie udało się go przekonwertować — wyślij je jako JPG')
    })
    const bmp = await createImageBitmap(jpeg as Blob)
    return { src: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() }
  }

  // Re-tag the bytes with the detected type: the <img> fallback trusts the blob's MIME type,
  // and files arrive with a missing or wrong one surprisingly often.
  const blob = real && real !== file.type ? new Blob([file], { type: real }) : file
  for (const src of [blob, file]) {
    for (const opts of [{ imageOrientation: 'from-image' as const }, undefined]) {
      try {
        const bmp = await createImageBitmap(src, opts)
        if (bmp.width && bmp.height) return { src: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() }
        bmp.close()
      } catch {
        /* try the next decoder */
      }
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('0×0')
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    const help =
      FORMAT_HELP[real] ??
      (real === 'image/jpeg'
        ? 'plik JPG wygląda na uszkodzony lub zapisany w nietypowym wariancie — otwórz go w podglądzie i zapisz ponownie'
        : `przeglądarka nie odczytała tego pliku (${real})`)
    throw new Error(`nie udało się odczytać zdjęcia — ${help}`)
  }
}

/**
 * Import a photo of any size or shape. Nothing is rejected for its aspect ratio;
 * oversized photos are scaled down to fit the editor, and the 4:5 frame handles
 * the framing later (fill / fit / free placement).
 */
export async function importFile(file: File): Promise<{ meta: Omit<GalleryImage, 'url'>; blob: Blob }> {
  const img = await decode(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(img.w, img.h), Math.sqrt(MAX_PIXELS / (img.w * img.h)))
    const w = Math.max(1, Math.round(img.w * scale))
    const h = Math.max(1, Math.round(img.h * scale))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const ctx = cv.getContext('2d')
    if (!ctx) throw new Error('przeglądarka nie udostępniła canvasu')
    ctx.drawImage(img.src, 0, 0, w, h)
    const type = file.type === 'image/png' || /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, type, 0.92))
    if (!blob || blob.size === 0) throw new Error('zdjęcie jest za duże dla tej przeglądarki — zmniejsz je i spróbuj ponownie')
    return { blob, meta: { id: uid(), name: file.name.replace(/\.[^.]+$/, '') || 'zdjęcie', w, h, type, createdAt: Date.now() } }
  } finally {
    img.release()
  }
}
