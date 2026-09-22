import type { Session } from '@supabase/supabase-js'
import { getAccountId, loadSettings, setAccountId, useStore } from '../store'
import type { Project, ProjectMeta } from '../types'
import { cloud, cloudEnabled, supabase } from './cloud'
import { copyGuestData, db, guestSummary, useNamespace } from './db'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Two-way merge between this browser's account database and the cloud.
 * Nothing is ever deleted here: items missing on one side are copied over,
 * and for items on both sides the newer one wins.
 */
export async function syncNow() {
  const userId = getAccountId()
  if (!userId || !cloudEnabled) return
  useStore.setState({ sync: 'syncing', syncMsg: '' })
  try {
    await wait(450) // let a pending local save finish first
    const remote = await cloud.pullAll()

    // projects
    const localIndex = await db.loadProjectIndex()
    const index = new Map<string, ProjectMeta>(localIndex.map((m) => [m.id, m]))
    for (const r of remote.projects) {
      const local = await db.loadProject(r.id)
      if (!local || r.updatedAt > local.updatedAt) {
        await db.saveProject(r.data)
        index.set(r.id, { id: r.id, name: r.data.name, updatedAt: r.data.updatedAt, slideCount: r.data.slides.length })
      }
    }
    for (const m of localIndex) {
      const r = remote.projects.find((x) => x.id === m.id)
      if (!r || m.updatedAt > r.updatedAt) {
        const p = (await db.loadProject(m.id)) as Project | undefined
        if (p) await cloud.pushProject(p)
      }
    }
    await db.saveProjectIndex([...index.values()].sort((a, b) => b.updatedAt - a.updatedAt))

    // gallery photos
    const localImgs = ((await db.loadImages()) ?? []).map(({ url, ...m }) => {
      URL.revokeObjectURL(url)
      return m
    })
    const allImgs = [...localImgs]
    for (const r of remote.images)
      if (!localImgs.some((l) => l.id === r.id)) {
        try {
          await db.putImageBlob(r.id, await cloud.downloadImage(userId, r.id))
          allImgs.push(r)
        } catch {
          /* file missing in storage — skip */
        }
      }
    for (const l of localImgs)
      if (!remote.images.some((r) => r.id === l.id)) {
        const blob = await db.getImageBlob(l.id)
        if (blob) await cloud.pushImage(userId, l, blob)
      }
    await db.saveImageIndex(allImgs.sort((a, b) => b.createdAt - a.createdAt).map((m) => ({ ...m, url: '' })))

    // custom presets
    const localPresets = await db.loadCustomPresets()
    const presets = [...new Map([...localPresets, ...remote.presets].map((p) => [p.id, p])).values()]
    await db.saveCustomPresets(presets)
    if (presets.length !== remote.presets.length) await cloud.pushPresets(presets)

    // API key + model: the account copy wins; a key only on this device gets uploaded
    const local = loadSettings()
    if (remote.profile?.api_key) {
      localStorage.setItem(`postify.settings.${userId}`, JSON.stringify({ ...local, apiKey: remote.profile.api_key, model: remote.profile.model || local.model }))
    } else if (local.apiKey) {
      await cloud.pushProfile(userId, local.apiKey, local.model)
    }

    await useStore.getState().init()
    useStore.setState({ sync: 'idle', syncMsg: '' })
  } catch (e) {
    useStore.setState({ sync: 'error', syncMsg: (e as Error).message })
    await useStore.getState().init()
  }
}

/** Switch the app into an account: its own local database, optional import of guest data, then sync. */
let entering: string | null = null

async function enterAccount(session: Session) {
  const user = session.user
  // Supabase fires INITIAL_SESSION and SIGNED_IN close together — only switch once
  if (getAccountId() === user.id || entering === user.id) return
  entering = user.id
  await wait(450)
  setAccountId(user.id)
  useNamespace(user.id)
  useStore.setState({ account: { id: user.id, email: user.email ?? '' }, sync: 'syncing' })

  // once per account and browser: offer to move what was made before logging in
  const flag = `postify.imported.${user.id}`
  if (!localStorage.getItem(flag)) {
    const g = await guestSummary()
    if (g.projects.length || g.images) {
      const names = g.projects.slice(0, 8).map((p) => `• ${p.name}`).join('\n')
      if (confirm(`Przenieść do konta ${user.email} to, co masz w tej przeglądarce?\n\n${g.projects.length} projekt(ów), ${g.images} zdjęć:\n${names}${g.projects.length > 8 ? '\n…' : ''}`)) {
        await copyGuestData()
        const guestSettings = JSON.parse(localStorage.getItem('postify.settings') || '{}')
        const acc = loadSettings()
        if (guestSettings.apiKey && !acc.apiKey) localStorage.setItem(`postify.settings.${user.id}`, JSON.stringify({ ...acc, ...guestSettings }))
      }
    }
    localStorage.setItem(flag, '1')
  }
  await syncNow()
  entering = null
  useStore.getState().notify(`Zalogowano: ${user.email}`)
}

async function leaveAccount() {
  if (!getAccountId()) return
  await wait(450)
  setAccountId('')
  useNamespace('')
  useStore.setState({ account: null, sync: 'off', syncMsg: '' })
  await useStore.getState().init()
}

/** Called once on startup: restores a saved session and follows logins/logouts from any tab. */
export function initAccounts() {
  if (!supabase) return
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') useStore.setState({ modal: 'account', recovery: true })
    if (session?.user) setTimeout(() => enterAccount(session), 0)
    else if (event === 'SIGNED_OUT') setTimeout(() => leaveAccount(), 0)
  })
}

export const auth = {
  async signUp(email: string, password: string) {
    const r = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
    if (r.error) throw r.error
    return { needsConfirm: !r.data.session }
  },
  async signIn(email: string, password: string) {
    const r = await supabase!.auth.signInWithPassword({ email, password })
    if (r.error) throw r.error
  },
  async resetPassword(email: string) {
    const r = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
    if (r.error) throw r.error
  },
  async setNewPassword(password: string) {
    const r = await supabase!.auth.updateUser({ password })
    if (r.error) throw r.error
  },
  async signOut() {
    await supabase!.auth.signOut()
  },
}
