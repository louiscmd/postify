import { useEffect, useState } from 'react'
import { AIPanel } from './components/AIPanel'
import { Canvas } from './components/Canvas'
import { Gallery } from './components/Gallery'
import { Bulb, Copy, Download, Folder, Gear, Grid, Hand, ImageIcon, Layout, Palette, Redo, Sparkles, Story, Trash, Type, Undo, X } from './components/Icons'
import { Inspector } from './components/Inspector'
import { LayoutsPanel } from './components/LayoutsPanel'
import { StoriesPanel } from './components/StoriesPanel'
import { AccountModal, PresetsModal, ProjectsModal, SettingsModal } from './components/Modals'
import { initAccounts } from './lib/account'
import { SlideStrip } from './components/SlideStrip'
import { TipsPanel } from './components/TipsPanel'
import { exportZip } from './lib/export'
import { rerollSlides } from './lib/reroll'
import { allPresets, usePreset, useStore, type LeftTab } from './store'

const isTyping = () => {
  const a = document.activeElement as HTMLElement | null
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !isTyping()) {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y' && !isTyping()) {
        e.preventDefault()
        st.redo()
        return
      }
      if (isTyping() || !st.selEl) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        st.deleteEl(st.selEl)
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        st.duplicateEl(st.selEl)
      } else if (e.key === 'Escape') st.select(null)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const id = st.selEl
        st.updateEl(id, (el) => {
          if (e.key === 'ArrowLeft') el.x -= d
          if (e.key === 'ArrowRight') el.x += d
          if (e.key === 'ArrowUp') el.y -= d
          if (e.key === 'ArrowDown') el.y += d
        }, `nudge-${id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Phones and narrow windows get the single-column layout with bottom sheets. */
function useIsMobile() {
  const [m, setM] = useState(() => window.matchMedia('(max-width: 860px)').matches)
  useEffect(() => {
    const q = window.matchMedia('(max-width: 860px)')
    const on = () => setM(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return m
}

type Sheet = LeftTab | 'edit' | 'tips' | null

export default function App() {
  const s = useStore()
  const preset = usePreset()
  const mobile = useIsMobile()
  const [rightTab, setRightTab] = useState<'edit' | 'tips'>('edit')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [sheetBig, setSheetBig] = useState(false)
  const [menu, setMenu] = useState(false)
  const [tools, setTools] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  useShortcuts()

  useEffect(() => {
    s.init().then(initAccounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // selecting something on the canvas opens the editor sheet on a phone
  useEffect(() => {
    if (mobile && s.selEl) setSheet('edit')
  }, [s.selEl, mobile])

  const story = s.project.format === 'story'
  const aiMode = s.leftTab === 'ai'

  const doExport = async () => {
    setProgress('Przygotowuję…')
    try {
      await exportZip(s.project.name, s.project.slides, preset, s.imageMap, (d, t) => setProgress(`Renderuję ${story ? 'klatkę' : 'slajd'} ${Math.min(d + 1, t)} z ${t}…`))
      s.notify(`Pobrano ${s.project.slides.length} PNG (${story ? '1080×1920' : '1080×1350'}) w ZIP`)
    } catch (e) {
      console.error(e)
      s.notify('Eksport nie powiódł się — spróbuj ponownie')
    } finally {
      setProgress(null)
    }
  }

  if (!s.ready)
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <span className="spinner" />
      </div>
    )

  const panelFor = (k: Sheet) =>
    k === 'ai' ? <AIPanel /> : k === 'layouts' ? <LayoutsPanel /> : k === 'stories' ? <StoriesPanel /> : k === 'gallery' ? <Gallery /> : k === 'tips' ? <TipsPanel /> : <Inspector />

  const extraTools = (
    <>
      <button className="btn sm" onClick={() => rerollSlides(s.project.slides.map((_, i) => i))} title="Nowy losowy układ wszystkich slajdów">
        🎲 Wszystkie
      </button>
      <button className={`btn sm ${s.showTips ? 'active' : ''}`} onClick={() => s.set({ showTips: !s.showTips })} title="Gdzie tło jest spokojne, a gdzie ruchliwe">
        <Bulb size={14} /> Strefy
      </button>
      <button className={`btn sm ${s.showGuides ? 'active' : ''}`} onClick={() => s.set({ showGuides: !s.showGuides })} title="Marginesy bezpieczne i kadr profilu">
        <Grid size={14} /> Linie
      </button>
      {/* the per-thumbnail buttons are hidden on a phone, so slide actions live here */}
      <button className="btn sm" title="Duplikuj" onClick={() => s.duplicateSlide(s.current)}>
        <Copy size={14} /> Duplikuj
      </button>
      <button className="btn sm danger" title="Usuń" onClick={() => s.deleteSlide(s.current)}>
        <Trash size={14} /> Usuń
      </button>
    </>
  )

  const toolbar = (
    <div className="canvas-toolbar">
      <span className="small muted">
        {story ? 'Klatka' : 'Slajd'} <b style={{ color: 'var(--text)' }}>{s.current + 1}</b>/{s.project.slides.length}
        <span className="hide-sm"> · {story ? '1080 × 1920 (9:16)' : '1080 × 1350 (4:5)'}</span>
      </span>
      <div className="grow" style={{ flex: 1 }} />
      <button className="btn sm" onClick={() => rerollSlides([s.current])} title="Nowy losowy układ tej klatki (Ctrl+Z cofa)">
        🎲 <span className="hide-sm">Losuj układ</span>
      </button>
      {mobile ? (
        <button className={`btn sm ${tools ? 'active' : ''}`} onClick={() => setTools((v) => !v)} title="Więcej narzędzi">
          ⋯
        </button>
      ) : (
        extraTools
      )}
    </div>
  )

  return (
    <div className={`app ${mobile ? 'is-mobile' : ''}`}>
      <header className="header">
        <div className="logo">
          <svg className="logo-mark" viewBox="0 0 64 64">
            <rect x="12" y="10" width="30" height="38" rx="6" fill="none" stroke="#e8707a" strokeWidth="4" />
            <rect x="22" y="17" width="30" height="38" rx="6" fill="#e8707a" />
          </svg>
          <span className="hide-sm">
            Post<em>ify</em>
          </span>
        </div>
        {!mobile && (
          <div className="seg">
            <button className={aiMode ? 'on red' : ''} onClick={() => s.set({ leftTab: 'ai' })}>
              <Sparkles size={15} /> Tryb AI
            </button>
            <button className={!aiMode ? 'on red' : ''} onClick={() => s.set({ leftTab: s.leftTab === 'ai' ? 'gallery' : s.leftTab })}>
              <Hand size={15} /> Tryb ręczny
            </button>
          </div>
        )}
        <input className="project-name" value={s.project.name} onChange={(e) => s.mutate((p) => (p.name = e.target.value), 'rename')} title="Nazwa projektu" />
        {story && <span className="badge-fmt">9:16</span>}
        <div className="grow" />
        {!mobile && (
          <select className="select" style={{ width: 190 }} value={preset.id} onChange={(e) => s.mutate((p) => (p.presetId = e.target.value))} title="Preset stylu">
            {allPresets(s.customPresets).map((p) => (
              <option key={p.id} value={p.id}>
                Styl: {p.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn ghost icon" title="Cofnij (Ctrl+Z)" disabled={!s.past.length} onClick={s.undo}>
          <Undo />
        </button>
        {!mobile && (
          <>
            <button className="btn ghost icon" title="Ponów (Ctrl+Y)" disabled={!s.future.length} onClick={s.redo}>
              <Redo />
            </button>
            <button className="btn ghost" onClick={() => s.set({ modal: 'projects' })}>
              <Folder /> Projekty
            </button>
            <button className="btn ghost" onClick={() => s.set({ modal: 'presets' })}>
              <Palette /> Presety
            </button>
            <button
              className={`btn ghost account-btn ${s.sync}`}
              onClick={() => s.set({ modal: 'account' })}
              title={
                s.account
                  ? `${s.account.email} — ${s.sync === 'error' ? `błąd synchronizacji: ${s.syncMsg}` : s.sync === 'syncing' ? 'synchronizuję…' : 'zsynchronizowano'}`
                  : 'Zaloguj się, aby zapisywać projekty i klucz API na koncie'
              }
            >
              <span className="avatar">{s.account ? s.account.email[0].toUpperCase() : '?'}</span>
              {s.account ? (s.sync === 'syncing' ? 'Sync…' : s.sync === 'error' ? 'Błąd sync' : 'Konto') : 'Zaloguj'}
            </button>
            <button className="btn ghost icon" title="Ustawienia (klucz API)" onClick={() => s.set({ modal: 'settings' })}>
              <Gear />
            </button>
          </>
        )}
        {mobile && (
          <button className={`btn ghost icon account-btn ${s.sync}`} onClick={() => setMenu((v) => !v)} title="Menu">
            ⋯
          </button>
        )}
        <button className="btn primary" onClick={doExport} disabled={!!progress} title="Eksport PNG (ZIP)">
          <Download /> <span className="hide-sm">Eksport ZIP</span>
        </button>
      </header>

      {mobile && menu && (
        <div className="menu-sheet" onClick={() => setMenu(false)}>
          <button className={`btn ghost account-btn ${s.sync}`} onClick={() => s.set({ modal: 'account' })}>
            <span className="avatar">{s.account ? s.account.email[0].toUpperCase() : '?'}</span>
            {s.account ? (s.sync === 'syncing' ? 'Synchronizuję…' : s.sync === 'error' ? 'Błąd synchronizacji' : s.account.email) : 'Zaloguj się'}
          </button>
          <button className="btn ghost" disabled={!s.future.length} onClick={s.redo}>
            <Redo /> Ponów
          </button>
          <button className="btn ghost" onClick={() => s.set({ modal: 'projects' })}>
            <Folder /> Projekty
          </button>
          <button className="btn ghost" onClick={() => s.set({ modal: 'presets' })}>
            <Palette /> Presety
          </button>
          <button className="btn ghost" onClick={() => s.set({ modal: 'settings' })}>
            <Gear /> Ustawienia
          </button>
          <button className="btn ghost" onClick={() => rerollSlides(s.project.slides.map((_, i) => i))}>
            🎲 Losuj wszystkie układy
          </button>
          <select className="select" value={preset.id} onChange={(e) => s.mutate((p) => (p.presetId = e.target.value))}>
            {allPresets(s.customPresets).map((p) => (
              <option key={p.id} value={p.id}>
                Styl: {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {mobile ? (
        <div className="body mobile">
          <main className="center">
            {toolbar}
            {tools && <div className="tool-row">{extraTools}</div>}
            <Canvas />
            <SlideStrip />
          </main>

          {sheet && (
            <div className={`sheet ${sheetBig ? 'big' : ''}`}>
              {/* the grab bar: tap (or drag) to switch between half and full height */}
              <button className="sheet-grab" onClick={() => setSheetBig((v) => !v)} title={sheetBig ? 'Zmniejsz' : 'Powiększ'}>
                <span />
              </button>
              <div className="sheet-head">
                <b>{{ ai: 'AI', gallery: 'Galeria', layouts: 'Układy', stories: 'Relacje', edit: 'Edycja', tips: 'Wskazówki' }[sheet]}</b>
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn ghost sm" onClick={() => setSheetBig((v) => !v)}>
                    {sheetBig ? '▾ Mniej' : '▴ Więcej'}
                  </button>
                  <button className="btn ghost icon" onClick={() => setSheet(null)}>
                    <X />
                  </button>
                </span>
              </div>
              {/* the AI panel scrolls internally and pins its composer, so it gets the full sheet box */}
              <div className={`sheet-body ${sheet === 'ai' ? 'flush' : ''}`}>{panelFor(sheet)}</div>
            </div>
          )}

          <nav className="tabbar">
            {(
              [
                ['ai', 'AI', <Sparkles size={18} key="a" />],
                ['gallery', 'Zdjęcia', <ImageIcon size={18} key="g" />],
                ['layouts', 'Układy', <Layout size={18} key="l" />],
                ['stories', 'Relacje', <Story size={18} key="s" />],
                ['edit', 'Tekst', <Type size={18} key="e" />],
                ['tips', 'Rady', <Bulb size={18} key="t" />],
              ] as [Sheet, string, React.ReactNode][]
            ).map(([k, label, icon]) => (
              <button
                key={k}
                className={sheet === k ? 'on' : ''}
                onClick={() => {
                  setSheet(sheet === k ? null : k)
                  if (k === 'ai' || k === 'gallery' || k === 'layouts' || k === 'stories') s.set({ leftTab: k })
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div className="body">
          <aside className="left">
            {aiMode ? (
              <AIPanel />
            ) : (
              <>
                <div className="tabs">
                  <button className={s.leftTab === 'gallery' ? 'on' : ''} onClick={() => s.set({ leftTab: 'gallery' })}>
                    <ImageIcon size={15} /> Galeria
                  </button>
                  <button className={s.leftTab === 'layouts' ? 'on' : ''} onClick={() => s.set({ leftTab: 'layouts' })}>
                    <Layout size={15} /> Układy
                  </button>
                  <button className={s.leftTab === 'stories' ? 'on' : ''} onClick={() => s.set({ leftTab: 'stories' })}>
                    <Story size={15} /> Relacje
                  </button>
                </div>
                <div className="panel-scroll">{s.leftTab === 'layouts' ? <LayoutsPanel /> : s.leftTab === 'stories' ? <StoriesPanel /> : <Gallery />}</div>
              </>
            )}
          </aside>

          <main className="center">
            {toolbar}
            <Canvas />
            <SlideStrip />
          </main>

          <aside className="right">
            <div className="tabs">
              <button className={rightTab === 'edit' ? 'on' : ''} onClick={() => setRightTab('edit')}>
                Edycja
              </button>
              <button className={rightTab === 'tips' ? 'on' : ''} onClick={() => setRightTab('tips')}>
                <Bulb size={14} /> Wskazówki
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{rightTab === 'edit' ? <Inspector /> : <TipsPanel />}</div>
          </aside>
        </div>
      )}

      {s.modal === 'settings' && <SettingsModal />}
      {s.modal === 'projects' && <ProjectsModal />}
      {s.modal === 'presets' && <PresetsModal />}
      {s.modal === 'account' && <AccountModal />}
      {s.toast && <div className="toast">{s.toast}</div>}
      {progress && (
        <div className="progress">
          <div className="card row" style={{ padding: '16px 22px' }}>
            <span className="spinner" /> {progress}
          </div>
        </div>
      )}
    </div>
  )
}
