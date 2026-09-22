/**
 * Account sync via Supabase. Postify stays local-first (IndexedDB); when you're logged in,
 * every change is also pushed to your account and pulled on other devices.
 * Configure with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (see README); without them the
 * app simply runs in local-only mode.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { GalleryImage, Preset, Project } from '../types'

/** Accepts the full project URL or just the project ref id, with or without https:// and trailing slash. */
export const normalizeUrl = (raw?: string) => {
  const v = (raw ?? '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  if (/^[a-z0-9-]+$/i.test(v)) return `https://${v}.supabase.co` // project ref pasted instead of the URL
  return `https://${v}`
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anon = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '').trim().replace(/^["']|["']$/g, '')

let client: SupabaseClient | null = null
let configError = ''
try {
  if (url && anon) client = createClient(url, anon)
} catch (e) {
  // a bad env value must never blank the whole app — accounts just stay off
  configError = (e as Error).message
  console.error('Supabase config:', configError)
}

export const supabase = client
export const cloudEnabled = !!client
export const cloudConfigError = configError

const sb = () => {
  if (!supabase) throw new Error('Konta nie są skonfigurowane')
  return supabase
}
const check = <T,>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}
const rows = <T,>(r: { data: T[] | null; error: { message: string } | null }): T[] => check(r) ?? []

type ImageMeta = Omit<GalleryImage, 'url'>

export interface RemoteState {
  projects: { id: string; updatedAt: number; data: Project }[]
  images: ImageMeta[]
  presets: Preset[]
  profile: { api_key: string | null; model: string | null } | null
}

export const cloud = {
  async pullAll(): Promise<RemoteState> {
    const c = sb()
    const [projects, images, presets, profile] = await Promise.all([
      c.from('projects').select('id, updated_at, data'),
      c.from('images').select('id, name, w, h, type, created_at'),
      c.from('presets').select('data'),
      c.from('profiles').select('api_key, model').maybeSingle(),
    ])
    return {
      projects: rows(projects).map((p) => ({ id: p.id, updatedAt: new Date(p.updated_at).getTime(), data: p.data as Project })),
      images: rows(images).map((i) => ({ id: i.id, name: i.name, w: i.w, h: i.h, type: i.type, createdAt: new Date(i.created_at).getTime() })),
      presets: rows(presets).map((p) => p.data as Preset),
      profile: check(profile),
    }
  },

  async pushProject(p: Project) {
    check(await sb().from('projects').upsert({ id: p.id, name: p.name, data: p, updated_at: new Date(p.updatedAt).toISOString() }))
  },
  async deleteProject(id: string) {
    check(await sb().from('projects').delete().eq('id', id))
  },

  async pushImage(userId: string, m: ImageMeta, blob: Blob) {
    const c = sb()
    const up = await c.storage.from('images').upload(`${userId}/${m.id}`, blob, { upsert: true, contentType: m.type })
    if (up.error) throw new Error(up.error.message)
    check(await c.from('images').upsert({ id: m.id, name: m.name, w: m.w, h: m.h, type: m.type, created_at: new Date(m.createdAt).toISOString() }))
  },
  async downloadImage(userId: string, id: string): Promise<Blob> {
    const r = await sb().storage.from('images').download(`${userId}/${id}`)
    if (r.error || !r.data) throw new Error(r.error?.message ?? 'download failed')
    return r.data
  },
  async deleteImage(userId: string, id: string) {
    const c = sb()
    await c.storage.from('images').remove([`${userId}/${id}`])
    check(await c.from('images').delete().eq('id', id))
  },

  async pushPresets(list: Preset[]) {
    const c = sb()
    const remote = rows(await c.from('presets').select('id')).map((r) => r.id as string)
    const gone = remote.filter((id) => !list.some((p) => p.id === id))
    if (gone.length) check(await c.from('presets').delete().in('id', gone))
    if (list.length) check(await c.from('presets').upsert(list.map((p) => ({ id: p.id, data: p, updated_at: new Date().toISOString() }))))
  },

  async pushProfile(userId: string, apiKey: string, model: string) {
    check(await sb().from('profiles').upsert({ id: userId, api_key: apiKey || null, model, updated_at: new Date().toISOString() }))
  },
}

/** Polish, human-friendly versions of the common Supabase auth errors. */
export const authErrorPl = (msg: string) => {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Nieprawidłowy e-mail lub hasło.'
  if (m.includes('email not confirmed')) return 'Potwierdź najpierw adres e-mail — link wysłaliśmy w wiadomości.'
  if (m.includes('already registered')) return 'Konto z tym adresem już istnieje — zaloguj się.'
  if (m.includes('password should be')) return 'Hasło jest za krótkie (min. 6 znaków).'
  if (m.includes('rate limit')) return 'Za dużo prób — odczekaj chwilę.'
  return msg
}
