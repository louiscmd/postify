import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FONTS } from '../fonts'
import { MODELS } from '../lib/ai'
import { auth, syncNow } from '../lib/account'
import { authErrorPl, cloudConfigError, cloudEnabled } from '../lib/cloud'
import { canShareImages, downloadFile, renderSlidePngs, sharePngs, zipFiles } from '../lib/export'
import { cleanApiKey, uid } from '../lib/util'
import { SHADOW_LABELS, STYLE_LABELS } from '../presets'
import { buildSlide, TEMPLATES } from '../presets/templates'
import { allPresets, useStore } from '../store'
import type { Preset, StyleKey, TextStyle } from '../types'
import { Copy, Download, Plus, Trash, X } from './Icons'
import { SlideThumb } from './SlideView'

function Modal({ title, onClose, children, narrow }: { title: string; onClose: () => void; children: ReactNode; narrow?: boolean }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${narrow ? 'narrow' : ''}`}>
        <div className="modal-head">
          {title}
          <button className="btn ghost icon" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

const close = () => useStore.setState({ modal: null })

// ── Settings ─────────────────────────────────────────────────
export function SettingsModal() {
  const settings = useStore((s) => s.settings)
  const [key, setKey] = useState(settings.apiKey)
  const [model, setModel] = useState(settings.model)
  const [err, setErr] = useState('')
  return (
    <Modal title="Ustawienia" onClose={close} narrow>
      <div className="field">
        <span className="label">Klucz API Anthropic</span>
        <input
          className="input"
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setErr('')
          }}
          autoComplete="off"
        />
        {err && <div className="msg err" style={{ marginTop: 8, fontSize: 12.5 }}>{err}</div>}
        <div className="tiny dim" style={{ marginTop: 6 }}>
          {useStore.getState().account ? 'Klucz jest zapisany na Twoim koncie (widoczny tylko dla Ciebie) i wysyłany bezpośrednio do api.anthropic.com.' : 'Klucz jest zapisywany w tej przeglądarce i wysyłany bezpośrednio do api.anthropic.com. Zaloguj się, aby zapisać go na koncie.'} Utwórz go na{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            console.anthropic.com
          </a>
          .
        </div>
      </div>
      <div className="field">
        <span className="label">Model</span>
        <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="tiny dim" style={{ marginTop: 6 }}>
          Generowanie karuzeli z ~10 zdjęciami to zwykle kilka–kilkanaście centów na Opus 5; Sonnet 5 jest ok. 2,5× tańszy.
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {settings.apiKey && (
          <button
            className="btn ghost danger"
            onClick={() => {
              useStore.getState().saveSettings({ apiKey: '' })
              setKey('')
            }}
          >
            Usuń klucz
          </button>
        )}
        <button
          className="btn primary"
          onClick={() => {
            const clean = cleanApiKey(key)
            if (clean && !clean.startsWith('sk-ant-')) {
              setErr('To nie wygląda na klucz Anthropic — powinien zaczynać się od „sk-ant-”. Skopiuj go ponownie z console.anthropic.com.')
              return
            }
            useStore.getState().saveSettings({ apiKey: clean, model })
            useStore.getState().notify(clean !== key.trim() ? 'Zapisano — usunięto z klucza niewidoczne/niedozwolone znaki' : 'Zapisano ustawienia')
            close()
          }}
        >
          Zapisz
        </button>
      </div>
    </Modal>
  )
}

// ── Projects ─────────────────────────────────────────────────
export function ProjectsModal() {
  const projects = useStore((s) => s.projects)
  const current = useStore((s) => s.project.id)
  const st = useStore.getState
  return (
    <Modal title="Projekty" onClose={close}>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="grow small muted">{useStore.getState().account ? `Projekty zapisują się automatycznie na koncie ${useStore.getState().account!.email}.` : 'Projekty zapisują się automatycznie w tej przeglądarce. Zaloguj się, aby mieć je na każdym urządzeniu.'}</span>
        <button className="btn primary" onClick={() => st().newProject()}>
          <Plus size={15} /> Nowy projekt
        </button>
      </div>
      <div className="proj-list">
        {[...projects]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((p) => (
            <div key={p.id} className={`proj ${p.id === current ? 'on' : ''}`} onClick={() => st().openProject(p.id)}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
              <div className="tiny dim">
                {p.slideCount} slajdów · {new Date(p.updatedAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn sm ghost danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Usunąć projekt „${p.name}”?`)) st().deleteProject(p.id)
                  }}
                >
                  <Trash size={13} /> Usuń
                </button>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  )
}

// ── Presets ──────────────────────────────────────────────────
const EDIT_KEYS: StyleKey[] = ['title', 'subtitle', 'kicker', 'number', 'body', 'list', 'caption', 'cta', 'keyword', 'note', 'split', 'chip']

export function PresetsModal() {
  const custom = useStore((s) => s.customPresets)
  const projectPreset = useStore((s) => s.project.presetId)
  const images = useStore((s) => s.imageMap)
  const firstImg = useStore((s) => s.images[0]?.id)
  const list = allPresets(custom)
  const [selId, setSelId] = useState(projectPreset)
  const sel = list.find((p) => p.id === selId) ?? list[0]
  const st = useStore.getState

  const demos = useMemo(
    () =>
      ['cover-title', 'content-number', 'list-bullets', 'cta-keyword']
        .map((id) => TEMPLATES.find((t) => t.id === id)!)
        .map((t) => buildSlide(t, { preset: sel, imageIds: firstImg ? [firstImg] : [], fields: t.demo })),
    [sel, firstImg],
  )

  const duplicate = () => {
    const p: Preset = { ...structuredClone(sel), id: uid(), name: `${sel.name} (kopia)`, builtin: false }
    st().savePreset(p)
    setSelId(p.id)
  }
  const edit = (fn: (p: Preset) => void) => {
    const p = structuredClone(sel)
    fn(p)
    st().savePreset(p)
  }
  const setStyle = <K extends keyof TextStyle>(k: StyleKey, prop: K, v: TextStyle[K]) => edit((p) => (p.styles[k][prop] = v))

  return (
    <Modal title="Presety stylu" onClose={close}>
      <div className="preset-layout">
        <div>
          {list.map((p) => (
            <div key={p.id} className={`preset-item ${p.id === sel.id ? 'on' : ''}`} onClick={() => setSelId(p.id)}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="tiny dim">{p.builtin ? 'z Twoich referencji' : 'własny'}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="row" style={{ marginBottom: 12 }}>
            {sel.builtin ? (
              <h3 style={{ margin: 0, flex: 1 }}>{sel.name}</h3>
            ) : (
              <input className="input grow" value={sel.name} onChange={(e) => edit((p) => (p.name = e.target.value))} />
            )}
            <button className="btn" onClick={duplicate}>
              <Copy size={14} /> Duplikuj i edytuj
            </button>
            {!sel.builtin && (
              <button className="btn danger" onClick={() => confirm('Usunąć preset?') && (st().deletePreset(sel.id), setSelId(list[0].id))}>
                <Trash size={14} />
              </button>
            )}
            <button
              className="btn primary"
              onClick={() => {
                st().mutate((p) => (p.presetId = sel.id))
                close()
              }}
            >
              Użyj w projekcie
            </button>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            {sel.description}
          </p>

          <div className="row" style={{ gap: 8, marginBottom: 16, overflowX: 'auto' }}>
            {demos.map((d) => (
              <div key={d.id} style={{ borderRadius: 6, overflow: 'hidden', flex: 'none' }}>
                <SlideThumb slide={d} preset={sel} images={images} width={132} />
              </div>
            ))}
          </div>
          {!firstImg && <div className="tiny dim" style={{ marginTop: -8, marginBottom: 12 }}>Zaimportuj zdjęcie, żeby zobaczyć podgląd na prawdziwym tle.</div>}

          <div className="label">Analiza stylu</div>
          <ul className="analysis" style={{ paddingLeft: 18, marginTop: 0 }}>
            {sel.analysis.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>

          <div className="label" style={{ marginTop: 16 }}>
            Kolory
          </div>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            {(
              [
                ['accent', 'Akcent (strzałki, podkreślenia)'],
                ['dark', 'Ciemny tekst'],
                ['chipBg', 'Tło chipów'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="row small">
                <input type="color" disabled={sel.builtin} value={sel[k].startsWith('#') ? sel[k].slice(0, 7) : '#ffffff'} onChange={(e) => edit((p) => (p[k] = e.target.value))} />
                {l}
              </label>
            ))}
            <label className="row small">
              <input
                type="color"
                disabled={sel.builtin}
                value={sel.styles.caption.highlightBg.startsWith('#') ? sel.styles.caption.highlightBg.slice(0, 7) : '#4b1a6e'}
                onChange={(e) => edit((p) => EDIT_KEYS.forEach((k) => (p.styles[k].highlightBg = e.target.value)))}
              />
              Wyróżnienie ==tekstu==
            </label>
          </div>

          <div className="label">Style tekstu {sel.builtin && <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>— zduplikuj preset, żeby edytować</span>}</div>
          <div className="style-row tiny dim">
            <span>Element</span>
            <span>Font</span>
            <span>Rozmiar</span>
            <span>Grubość</span>
            <span>Kolor</span>
            <span>Cień</span>
          </div>
          {EDIT_KEYS.map((k) => {
            const s = sel.styles[k]
            const dis = sel.builtin
            return (
              <div key={k} className="style-row">
                <span className="small">{STYLE_LABELS[k]}</span>
                <select className="select" disabled={dis} value={s.font} onChange={(e) => setStyle(k, 'font', e.target.value as TextStyle['font'])}>
                  {FONTS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.key}
                    </option>
                  ))}
                </select>
                <input className="input" type="number" disabled={dis} value={s.size} onChange={(e) => setStyle(k, 'size', Number(e.target.value))} />
                <select className="select" disabled={dis} value={s.weight} onChange={(e) => setStyle(k, 'weight', Number(e.target.value))}>
                  {(FONTS.find((f) => f.key === s.font)?.weights ?? [400]).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <input type="color" disabled={dis} value={s.color.startsWith('#') ? s.color.slice(0, 7) : '#ffffff'} onChange={(e) => setStyle(k, 'color', e.target.value)} />
                <select className="select" disabled={dis} value={s.shadow} onChange={(e) => setStyle(k, 'shadow', e.target.value as TextStyle['shadow'])}>
                  {Object.entries(SHADOW_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ── Account ──────────────────────────────────────────────────
export function AccountModal() {
  const account = useStore((s) => s.account)
  const sync = useStore((s) => s.sync)
  const syncMsg = useStore((s) => s.syncMsg)
  const recovery = useStore((s) => s.recovery)
  const projects = useStore((s) => s.projects)
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setMsg(null)
    try {
      const ok = await fn()
      if (ok) setMsg({ ok: true, text: ok })
    } catch (e) {
      setMsg({ ok: false, text: authErrorPl((e as Error).message) })
    } finally {
      setBusy(false)
    }
  }

  if (!cloudEnabled)
    return (
      <Modal title="Konto" onClose={close} narrow>
        <p className="small muted" style={{ marginTop: 0 }}>
          Konta nie są jeszcze włączone w tej instalacji Postify. Wszystko działa lokalnie — projekty i klucz API zostają w tej przeglądarce.
        </p>
        <p className="small muted">
          {cloudConfigError ? `Konfiguracja Supabase jest nieprawidłowa: ${cloudConfigError} Sprawdź zmienne VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.` : 'Aby włączyć konta, właściciel strony musi podłączyć Supabase (instrukcja w README, sekcja „Konta”).'}
        </p>
      </Modal>
    )

  if (recovery)
    return (
      <Modal title="Ustaw nowe hasło" onClose={() => useStore.setState({ modal: null, recovery: false })} narrow>
        <div className="field">
          <span className="label">Nowe hasło</span>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <div className={`msg ${msg.ok ? 'bot' : 'err'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
        <button
          className="btn primary"
          style={{ width: '100%' }}
          disabled={busy || password.length < 6}
          onClick={() =>
            run(async () => {
              await auth.setNewPassword(password)
              useStore.setState({ recovery: false })
              return 'Hasło zmienione.'
            })
          }
        >
          Zapisz hasło
        </button>
      </Modal>
    )

  if (account)
    return (
      <Modal title="Konto" onClose={close} narrow>
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="mini-label">Zalogowano jako</div>
          <div style={{ fontWeight: 600 }}>{account.email}</div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {sync === 'syncing' ? 'Synchronizuję…' : sync === 'error' ? `Błąd synchronizacji: ${syncMsg}` : `Zsynchronizowano · ${projects.length} projekt(ów)`}
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Projekty, zdjęcia z galerii, własne presety i klucz API są zapisywane na tym koncie — zaloguj się na innym urządzeniu, a wszystko będzie na miejscu.
        </p>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn" disabled={sync === 'syncing'} onClick={() => syncNow()}>
            Synchronizuj teraz
          </button>
          <button className="btn danger" onClick={() => auth.signOut().then(close)}>
            Wyloguj
          </button>
        </div>
      </Modal>
    )

  return (
    <Modal title={mode === 'up' ? 'Załóż konto' : mode === 'reset' ? 'Reset hasła' : 'Zaloguj się'} onClose={close} narrow>
      {mode !== 'reset' && (
        <div className="seg full" style={{ marginBottom: 14 }}>
          <button className={mode === 'in' ? 'on red' : ''} onClick={() => setMode('in')}>
            Logowanie
          </button>
          <button className={mode === 'up' ? 'on red' : ''} onClick={() => setMode('up')}>
            Nowe konto
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (mode === 'in') run(() => auth.signIn(email.trim(), password).then(close))
          else if (mode === 'up')
            run(async () => {
              const r = await auth.signUp(email.trim(), password)
              return r.needsConfirm ? `Wysłaliśmy link potwierdzający na ${email.trim()}. Kliknij go, a potem zaloguj się tutaj.` : undefined
            })
          else
            run(async () => {
              await auth.resetPassword(email.trim())
              return 'Jeśli konto istnieje, wysłaliśmy link do ustawienia nowego hasła.'
            })
        }}
      >
        <div className="field">
          <span className="label">E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== 'reset' && (
          <div className="field">
            <span className="label">Hasło</span>
            <input className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {msg && <div className={`msg ${msg.ok ? 'bot' : 'err'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
        <button className="btn primary" type="submit" style={{ width: '100%' }} disabled={busy}>
          {busy && <span className="spinner" />}
          {mode === 'in' ? 'Zaloguj' : mode === 'up' ? 'Załóż konto' : 'Wyślij link'}
        </button>
      </form>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <button className="btn ghost sm" onClick={() => setMode(mode === 'reset' ? 'in' : 'reset')}>
          {mode === 'reset' ? '← Wróć do logowania' : 'Nie pamiętam hasła'}
        </button>
      </div>
      <p className="tiny dim" style={{ marginBottom: 0 }}>
        Po pierwszym zalogowaniu Postify zaproponuje przeniesienie projektów i zdjęć z tej przeglądarki do konta.
      </p>
    </Modal>
  )
}

// ── Export ───────────────────────────────────────────────────
const plural = (n: number, one: string, few: string, many: string) => {
  const t = n % 10
  const h = n % 100
  if (n === 1) return one
  if (t >= 2 && t <= 4 && (h < 12 || h > 14)) return few
  return many
}

export function ExportModal() {
  const project = useStore((s) => s.project)
  const images = useStore((s) => s.imageMap)
  const custom = useStore((s) => s.customPresets)
  const preset = allPresets(custom).find((p) => p.id === project.presetId) ?? allPresets(custom)[0]
  const story = project.format === 'story'
  const [files, setFiles] = useState<File[] | null>(null)
  const [urls, setUrls] = useState<string[]>([])
  const [progress, setProgress] = useState('Renderuję…')
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    let alive = true
    renderSlidePngs(project.name, project.slides, preset, images, (d, t) => alive && setProgress(`Renderuję ${Math.min(d + 1, t)} z ${t}…`))
      .then((f) => {
        if (!alive) return
        setFiles(f)
        setUrls(f.map((x) => URL.createObjectURL(x)))
      })
      .catch((e) => alive && setErr((e as Error).message))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  const canShare = !!files && canShareImages(files)

  return (
    <Modal title={`Eksport — ${project.slides.length} ${story ? plural(project.slides.length, 'klatka', 'klatki', 'klatek') : plural(project.slides.length, 'slajd', 'slajdy', 'slajdów')} PNG`} onClose={close} narrow>
      {!files && !err && (
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="spinner" /> {progress}
        </div>
      )}
      {err && <div className="msg err" style={{ marginBottom: 14 }}>{err}</div>}

      {files && (
        <>
          <div className="export-grid">
            {urls.map((u, i) => (
              <a key={u} href={u} download={files[i].name} className="export-thumb" title={`Zapisz ${files[i].name}`}>
                <img src={u} alt="" />
                <span>{i + 1}</span>
              </a>
            ))}
          </div>
          <div className="tiny dim" style={{ margin: '10px 0 14px' }}>
            {files[0] && `${story ? '1080 × 1920' : '1080 × 1350'} px · PNG · ${Math.round(files.reduce((n, f) => n + f.size, 0) / 1048576 * 10) / 10} MB`}
            {' · '}Przytrzymaj miniaturę, aby zapisać pojedyncze zdjęcie.
          </div>

          {canShare && (
            <>
              <button
                className="btn primary"
                style={{ width: '100%', marginBottom: 8 }}
                onClick={async () => {
                  setDone('')
                  try {
                    await sharePngs(files, project.name)
                    // the share sheet has closed — nothing useful left to say here
                    useStore.getState().notify('Gotowe')
                    close()
                  } catch (e) {
                    if ((e as Error).name === 'AbortError') return // the user closed the sheet
                    setErr('Nie udało się otworzyć okna zapisu. Zapisz zdjęcia pojedynczo — przytrzymaj miniaturę i wybierz „Zapisz do Zdjęć”.')
                  }
                }}
              >
                <Download size={15} /> Zapisz w galerii telefonu
              </button>
              <div className="tiny dim" style={{ marginBottom: 12 }}>
                Otworzy się okno udostępniania — wybierz <b>Zapisz {files.length} obrazów</b> (iPhone) lub <b>Zapisz w Zdjęciach</b>.
              </div>
            </>
          )}

          {!canShare && (
            <div className="tiny dim" style={{ marginBottom: 10 }}>
              Zapis wprost do galerii działa na telefonie (iPhone / Android). Tutaj pobierz pliki na dysk.
            </div>
          )}
          <div className="row">
            <button className="btn grow" onClick={() => files.forEach(downloadFile)}>
              Pobierz pojedynczo
            </button>
            <button className="btn grow" onClick={() => zipFiles(project.name, files)}>
              Pobierz ZIP
            </button>
          </div>
          {done && <div className="msg bot" style={{ marginTop: 12 }}>{done}</div>}
        </>
      )}
    </Modal>
  )
}
