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
 * Decode whatever the browser can read. Some JPEGs (CMYK, unusual colour profiles, odd
 * EXIF) are refused by createImageBitmap but load fine as an <img>, so try both.
 */
async function decode(file: File): Promise<Decoded> {
  for (const opts of [{ imageOrientation: 'from-image' as const }, undefined]) {
    try {
      const bmp = await createImageBitmap(file, opts)
      if (bmp.width && bmp.height) return { src: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() }
      bmp.close()
    } catch {
      /* try the next decoder */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('0×0')
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    const hint = /hei[cf]/i.test(file.type + file.name)
      ? 'przeglądarki nie czytają HEIC — zapisz jako JPG'
      : file.size === 0
        ? 'plik jest pusty'
        : 'plik może być uszkodzony lub w nietypowym wariancie (np. CMYK)'
    throw new Error(`nie udało się odczytać zdjęcia — ${hint}`)
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
