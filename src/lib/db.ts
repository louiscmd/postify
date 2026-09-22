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

const MAX_EDGE = 2160 // 2× the export width — room to zoom without blur

/** Downscale on import so the gallery stays light; keep PNG for screenshots/transparency. */
export async function importFile(file: File): Promise<{ meta: Omit<GalleryImage, 'url'>; blob: Blob }> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), type, 0.92))
  return {
    blob,
    meta: { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), w, h, type, createdAt: Date.now() },
  }
}
