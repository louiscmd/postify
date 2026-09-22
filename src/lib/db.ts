import { createStore, del, get, set } from 'idb-keyval'
import type { GalleryImage, Preset, Project, ProjectMeta } from '../types'
import { uid } from './util'

const store = createStore('postify', 'kv')

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
