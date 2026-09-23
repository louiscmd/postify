import { create } from 'zustand'
import { cloud, cloudEnabled } from './lib/cloud'
import { db, IMAGE_EXT, importFile } from './lib/db'
import { initialZoom } from './lib/slot'
import { debounce, uid } from './lib/util'
import { BUILTIN_PRESETS } from './presets'
import { buildSlide, templateById } from './presets/templates'
import type { El, GalleryImage, Preset, Project, ProjectMeta, Settings, Slide } from './types'

export type LeftTab = 'ai' | 'gallery' | 'layouts'
export type Modal = null | 'projects' | 'presets' | 'settings' | 'account'

interface State {
  ready: boolean
  images: GalleryImage[]
  imageMap: Record<string, GalleryImage>
  aiSelection: string[]
  customPresets: Preset[]
  projects: ProjectMeta[]
  project: Project
  current: number
  selEl: string | null
  selBlock: string | null
  leftTab: LeftTab
  showTips: boolean
  showGuides: boolean
  modal: Modal
  settings: Settings
  past: Project[]
  future: Project[]
  lastKey: string | null
  focusTick: number
  toast: string | null
  exporting: boolean
  account: { id: string; email: string } | null
  sync: 'off' | 'idle' | 'syncing' | 'error'
  syncMsg: string
  recovery: boolean

  init: () => Promise<void>
  set: (p: Partial<State>) => void
  notify: (msg: string) => void
  mutate: (fn: (p: Project) => void, coalesceKey?: string) => void
  undo: () => void
  redo: () => void

  addFiles: (files: FileList | File[]) => Promise<string[]>
  removeImage: (id: string) => void
  toggleAiImage: (id: string) => void

  newProject: (name?: string, presetId?: string, slides?: Slide[]) => void
  openProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  select: (elId: string | null, blockId?: string | null) => void
  addSlide: (slide: Slide, at?: number) => void
  duplicateSlide: (i: number) => void
  deleteSlide: (i: number) => void
  moveSlide: (from: number, to: number) => void
  updateSlide: (fn: (s: Slide) => void, key?: string) => void
  updateEl: (id: string, fn: (e: El) => void, key?: string) => void
  addEl: (el: El) => void
  deleteEl: (id: string) => void
  duplicateEl: (id: string) => void
  reorderEl: (id: string, dir: 1 | -1) => void
  setSlotImage: (slideIdx: number, slotIdx: number, imageId: string | null) => void

  savePreset: (p: Preset) => void
  deletePreset: (id: string) => void
  saveSettings: (s: Partial<Settings>) => void
}

// Logged-in account id ('' = guest). Settings and the local database are kept per account.
let accountId = ''
export const setAccountId = (id: string) => {
  accountId = id
}
export const getAccountId = () => accountId
const settingsKey = () => (accountId ? `postify.settings.${accountId}` : 'postify.settings')
export const loadSettings = (): Settings => {
  try {
    return { apiKey: '', model: 'claude-opus-5', ...JSON.parse(localStorage.getItem(settingsKey()) || '{}') }
  } catch {
    return { apiKey: '', model: 'claude-opus-5' }
  }
}

const starterProject = (): Project => {
  const preset = BUILTIN_PRESETS[0]
  const tpl = templateById('cover-title')!
  return {
    id: uid(),
    name: 'Mój pierwszy post',
    presetId: preset.id,
    slides: [buildSlide(tpl, { preset, imageIds: [], fields: tpl.demo })],
    updatedAt: Date.now(),
  }
}

const meta = (p: Project): ProjectMeta => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, slideCount: p.slides.length })

const persist = debounce(async (p: Project, list: ProjectMeta[]) => {
  await db.saveProject(p)
  await db.saveProjectIndex(list)
  await db.setLastProjectId(p.id)
  cloudPush(() => cloud.pushProject(p))
}, 400)

/** Mirror a change to the account (no-op in guest mode); failures show in the account badge. */
export const cloudPush = (fn: () => Promise<unknown>) => {
  if (!accountId || !cloudEnabled) return
  useStore.setState({ sync: 'syncing' })
  fn()
    .then(() => useStore.setState({ sync: 'idle', syncMsg: '' }))
    .catch((e: Error) => useStore.setState({ sync: 'error', syncMsg: e.message }))
}

const mapOf = (imgs: GalleryImage[]) => Object.fromEntries(imgs.map((i) => [i.id, i]))

export const useStore = create<State>((set, get) => {
  const commit = (next: Project, prev: Project, key?: string) => {
    const st = get()
    const coalesce = key && key === st.lastKey
    next.updatedAt = Date.now()
    const projects = [meta(next), ...st.projects.filter((m) => m.id !== next.id)]
    set({
      project: next,
      projects,
      past: coalesce ? st.past : [...st.past.slice(-60), prev],
      future: [],
      lastKey: key ?? null,
    })
    persist(next, projects)
  }

  return {
    ready: false,
    images: [],
    imageMap: {},
    aiSelection: [],
    customPresets: [],
    projects: [],
    project: starterProject(),
    current: 0,
    selEl: null,
    selBlock: null,
    leftTab: 'gallery',
    showTips: false,
    showGuides: true,
    modal: null,
    settings: loadSettings(),
    past: [],
    future: [],
    lastKey: null,
    focusTick: 0,
    toast: null,
    exporting: false,
    account: null,
    sync: 'off',
    syncMsg: '',
    recovery: false,

    async init() {
      get().images.forEach((i) => URL.revokeObjectURL(i.url))
      const [images, customPresets, projects, lastId] = await Promise.all([
        db.loadImages(),
        db.loadCustomPresets(),
        db.loadProjectIndex(),
        db.getLastProjectId(),
      ])
      let project: Project | undefined
      if (lastId) project = await db.loadProject(lastId)
      if (!project && projects[0]) project = await db.loadProject(projects[0].id)
      const p = project ?? get().project
      const list = projects.some((m) => m.id === p.id) ? projects : [meta(p), ...projects]
      set({ ready: true, images, imageMap: mapOf(images), customPresets, projects: list, project: p, current: 0, selEl: null, selBlock: null, past: [], future: [], settings: loadSettings() })
      if (!project) persist(p, list)
    },

    set: (p) => set(p),

    notify(msg) {
      set({ toast: msg })
      setTimeout(() => get().toast === msg && set({ toast: null }), 3200)
    },

    mutate(fn, key) {
      const prev = get().project
      const next = structuredClone(prev)
      fn(next)
      commit(next, prev, key)
    },

    undo() {
      const { past, project, future, projects } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastKey: null, current: Math.min(get().current, prev.slides.length - 1) })
      persist(prev, projects)
    },
    redo() {
      const { past, project, future, projects } = get()
      if (!future.length) return
      const next = future[0]
      set({ project: next, future: future.slice(1), past: [...past, project], lastKey: null, current: Math.min(get().current, next.slides.length - 1) })
      persist(next, projects)
    },

    async addFiles(files) {
      // Accept by MIME *or* extension: drops from some apps arrive with an empty or odd type.
      const all = Array.from(files)
      const list = all.filter((f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name))
      const added: GalleryImage[] = []
      const failed: string[] = []
      for (const f of list) {
        try {
          const { meta, blob } = await importFile(f)
          await db.putImageBlob(meta.id, blob)
          added.push({ ...meta, url: URL.createObjectURL(blob) })
        } catch (e) {
          failed.push(`${f.name}: ${(e as Error).message}`)
        }
      }
      for (const f of all) if (!list.includes(f)) failed.push(`${f.name}: to nie jest plik graficzny`)
      if (failed.length) get().notify(failed.length === 1 ? failed[0] : `Nie dodano ${failed.length} plików — ${failed[0]}`)
      const images = [...added, ...get().images]
      set({ images, imageMap: mapOf(images) })
      await db.saveImageIndex(images)
      const uidNow = accountId
      for (const a of added) {
        const { url: _u, ...m } = a
        cloudPush(async () => cloud.pushImage(uidNow, m, (await db.getImageBlob(a.id))!))
      }
      if (added.length) get().notify(`Dodano ${added.length} ${added.length === 1 ? 'zdjęcie' : 'zdjęć'}`)
      return added.map((a) => a.id)
    },

    removeImage(id) {
      const img = get().imageMap[id]
      const images = get().images.filter((i) => i.id !== id)
      set({ images, imageMap: mapOf(images), aiSelection: get().aiSelection.filter((x) => x !== id) })
      db.saveImageIndex(images)
      db.deleteImage(id)
      const uidNow = accountId
      cloudPush(() => cloud.deleteImage(uidNow, id))
      if (img) setTimeout(() => URL.revokeObjectURL(img.url), 1000)
    },

    toggleAiImage(id) {
      const s = get().aiSelection
      set({ aiSelection: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] })
    },

    newProject(name, presetId, slides) {
      const base = starterProject()
      const p: Project = {
        ...base,
        name: name ?? `Karuzela ${new Date().toLocaleDateString('pl-PL')}`,
        presetId: presetId ?? get().project.presetId,
        slides: slides ?? base.slides,
      }
      const projects = [meta(p), ...get().projects]
      set({ project: p, projects, current: 0, selEl: null, selBlock: null, past: [], future: [], lastKey: null, modal: null })
      persist(p, projects)
    },

    async openProject(id) {
      const p = await db.loadProject(id)
      if (!p) return
      set({ project: p, current: 0, selEl: null, selBlock: null, past: [], future: [], lastKey: null, modal: null })
      db.setLastProjectId(id)
    },

    async deleteProject(id) {
      await db.deleteProject(id)
      cloudPush(() => cloud.deleteProject(id))
      const projects = get().projects.filter((m) => m.id !== id)
      set({ projects })
      await db.saveProjectIndex(projects)
      if (get().project.id === id) {
        if (projects[0]) await get().openProject(projects[0].id)
        else get().newProject()
      }
    },

    select(elId, blockId = null) {
      set({ selEl: elId, selBlock: blockId })
    },

    addSlide(slide, at) {
      const i = at ?? get().current + 1
      get().mutate((p) => {
        p.slides.splice(i, 0, slide)
      })
      set({ current: Math.min(i, get().project.slides.length - 1), selEl: null })
    },
    duplicateSlide(i) {
      get().mutate((p) => {
        const c = structuredClone(p.slides[i])
        c.id = uid()
        c.elements.forEach((e) => {
          e.id = uid()
          if (e.type === 'stack') e.blocks.forEach((b) => (b.id = uid()))
        })
        p.slides.splice(i + 1, 0, c)
      })
      set({ current: i + 1 })
    },
    deleteSlide(i) {
      if (get().project.slides.length <= 1) return get().notify('Karuzela musi mieć co najmniej jeden slajd')
      get().mutate((p) => {
        p.slides.splice(i, 1)
      })
      set({ current: Math.max(0, Math.min(get().current, get().project.slides.length - 1)), selEl: null })
    },
    moveSlide(from, to) {
      if (from === to) return
      get().mutate((p) => {
        const [s] = p.slides.splice(from, 1)
        p.slides.splice(to, 0, s)
      })
      set({ current: to })
    },
    updateSlide(fn, key) {
      const i = get().current
      get().mutate((p) => fn(p.slides[i]), key)
    },
    updateEl(id, fn, key) {
      const i = get().current
      get().mutate((p) => {
        const el = p.slides[i].elements.find((e) => e.id === id)
        if (el) fn(el)
      }, key)
    },
    addEl(el) {
      get().updateSlide((s) => {
        s.elements.push(el)
      })
      set({ selEl: el.id, selBlock: el.type === 'stack' ? el.blocks[0]?.id ?? null : null, focusTick: get().focusTick + 1 })
    },
    deleteEl(id) {
      get().updateSlide((s) => {
        s.elements = s.elements.filter((e) => e.id !== id)
      })
      set({ selEl: null, selBlock: null })
    },
    duplicateEl(id) {
      let newId = ''
      get().updateSlide((s) => {
        const e = s.elements.find((x) => x.id === id)
        if (!e) return
        const c = structuredClone(e)
        c.id = newId = uid()
        if (c.type === 'stack') c.blocks.forEach((b) => (b.id = uid()))
        c.x += 30
        c.y += 30
        s.elements.push(c)
      })
      if (newId) set({ selEl: newId })
    },
    reorderEl(id, dir) {
      get().updateSlide((s) => {
        const i = s.elements.findIndex((e) => e.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= s.elements.length) return
        ;[s.elements[i], s.elements[j]] = [s.elements[j], s.elements[i]]
      })
    },
    setSlotImage(slideIdx, slotIdx, imageId) {
      const img = imageId ? get().imageMap[imageId] : undefined
      get().mutate((p) => {
        const s = p.slides[slideIdx]
        const frameH = s.layout === 'split' ? 675 : 1350
        while (s.slots.length <= slotIdx) s.slots.push({ imageId: null, focusX: 50, focusY: 50, zoom: 1, offsetX: 0, offsetY: 0 })
        s.slots[slotIdx] = { imageId, focusX: 50, focusY: 50, zoom: img ? initialZoom(img, 1080, frameH) : 1, offsetX: 0, offsetY: 0, blur: s.slots[slotIdx]?.blur }
      })
    },

    savePreset(p) {
      const list = get().customPresets
      const customPresets = list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]
      set({ customPresets })
      db.saveCustomPresets(customPresets)
      cloudPush(() => cloud.pushPresets(customPresets))
    },
    deletePreset(id) {
      const customPresets = get().customPresets.filter((x) => x.id !== id)
      set({ customPresets })
      db.saveCustomPresets(customPresets)
      cloudPush(() => cloud.pushPresets(customPresets))
      if (get().project.presetId === id) get().mutate((p) => (p.presetId = BUILTIN_PRESETS[0].id))
    },
    saveSettings(s) {
      const settings = { ...get().settings, ...s }
      localStorage.setItem(settingsKey(), JSON.stringify(settings))
      const uidNow = accountId
      if (s.apiKey !== undefined || s.model !== undefined) cloudPush(() => cloud.pushProfile(uidNow, settings.apiKey, settings.model))
      set({ settings })
    },
  }
})

export const allPresets = (custom: Preset[]) => [...BUILTIN_PRESETS, ...custom]

/** Current project's preset, for use outside React components. */
export const getPreset = (): Preset => {
  const { project, customPresets } = useStore.getState()
  return allPresets(customPresets).find((p) => p.id === project.presetId) ?? BUILTIN_PRESETS[0]
}

export const usePreset = (): Preset => {
  const presetId = useStore((s) => s.project.presetId)
  const custom = useStore((s) => s.customPresets)
  return allPresets(custom).find((p) => p.id === presetId) ?? BUILTIN_PRESETS[0]
}

export const useSlide = () => useStore((s) => s.project.slides[s.current] ?? s.project.slides[0])
