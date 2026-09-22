import { useMemo, useState, type ReactNode } from 'react'
import { FONTS } from '../fonts'
import { MODELS } from '../lib/ai'
import { uid } from '../lib/util'
import { SHADOW_LABELS, STYLE_LABELS } from '../presets'
import { buildSlide, TEMPLATES } from '../presets/templates'
import { allPresets, useStore } from '../store'
import type { Preset, StyleKey, TextStyle } from '../types'
import { Copy, Plus, Trash, X } from './Icons'
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
  return (
    <Modal title="Ustawienia" onClose={close} narrow>
      <div className="field">
        <span className="label">Klucz API Anthropic</span>
        <input className="input" type="password" placeholder="sk-ant-..." value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
        <div className="tiny dim" style={{ marginTop: 6 }}>
          Klucz jest zapisywany tylko w tej przeglądarce (localStorage) i wysyłany bezpośrednio do api.anthropic.com. Utwórz go na{' '}
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
            useStore.getState().saveSettings({ apiKey: key.trim(), model })
            useStore.getState().notify('Zapisano ustawienia')
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
        <span className="grow small muted">Projekty są zapisywane automatycznie w tej przeglądarce.</span>
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
      TEMPLATES.filter((t) => t.family === sel.family)
        .slice(0, 4)
        .map((t) => buildSlide(t, { preset: sel, zone: t.zones[0], tone: 'light', imageIds: firstImg ? [firstImg, firstImg] : [], fields: t.demo })),
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
