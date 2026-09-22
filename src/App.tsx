import { useEffect, useState } from 'react'
import { AIPanel } from './components/AIPanel'
import { Canvas } from './components/Canvas'
import { Gallery } from './components/Gallery'
import { Bulb, Download, Folder, Gear, Grid, Hand, ImageIcon, Layout, Palette, Redo, Sparkles, Undo } from './components/Icons'
import { Inspector } from './components/Inspector'
import { LayoutsPanel } from './components/LayoutsPanel'
import { PresetsModal, ProjectsModal, SettingsModal } from './components/Modals'
import { SlideStrip } from './components/SlideStrip'
import { TipsPanel } from './components/TipsPanel'
import { exportZip } from './lib/export'
import { allPresets, usePreset, useStore } from './store'

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

export default function App() {
  const s = useStore()
  const preset = usePreset()
  const [rightTab, setRightTab] = useState<'edit' | 'tips'>('edit')
  const [progress, setProgress] = useState<string | null>(null)
  useShortcuts()

  useEffect(() => {
    s.init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const aiMode = s.leftTab === 'ai'

  const doExport = async () => {
    setProgress('Przygotowuję…')
    try {
      await exportZip(s.project.name, s.project.slides, preset, s.imageMap, (d, t) => setProgress(`Renderuję slajd ${Math.min(d + 1, t)} z ${t}…`))
      s.notify(`Pobrano ${s.project.slides.length} PNG (1080×1350) w ZIP`)
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

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <svg className="logo-mark" viewBox="0 0 64 64">
            <rect x="12" y="10" width="30" height="38" rx="6" fill="none" stroke="#e8707a" strokeWidth="4" />
            <rect x="22" y="17" width="30" height="38" rx="6" fill="#e8707a" />
          </svg>
          <span>Post<em>ify</em></span>
        </div>
        <div className="seg">
          <button className={aiMode ? 'on red' : ''} onClick={() => s.set({ leftTab: 'ai' })}>
            <Sparkles size={15} /> Tryb AI
          </button>
          <button className={!aiMode ? 'on red' : ''} onClick={() => s.set({ leftTab: s.leftTab === 'ai' ? 'gallery' : s.leftTab })}>
            <Hand size={15} /> Tryb ręczny
          </button>
        </div>
        <input className="project-name" value={s.project.name} onChange={(e) => s.mutate((p) => (p.name = e.target.value), 'rename')} title="Nazwa projektu" />
        <div className="grow" />
        <select className="select" style={{ width: 190 }} value={preset.id} onChange={(e) => s.mutate((p) => (p.presetId = e.target.value))} title="Preset stylu dla całej karuzeli">
          {allPresets(s.customPresets).map((p) => (
            <option key={p.id} value={p.id}>
              Styl: {p.name}
            </option>
          ))}
        </select>
        <button className="btn ghost icon" title="Cofnij (Ctrl+Z)" disabled={!s.past.length} onClick={s.undo}>
          <Undo />
        </button>
        <button className="btn ghost icon" title="Ponów (Ctrl+Y)" disabled={!s.future.length} onClick={s.redo}>
          <Redo />
        </button>
        <button className="btn ghost" onClick={() => s.set({ modal: 'projects' })}>
          <Folder /> Projekty
        </button>
        <button className="btn ghost" onClick={() => s.set({ modal: 'presets' })}>
          <Palette /> Presety
        </button>
        <button className="btn ghost icon" title="Ustawienia (klucz API)" onClick={() => s.set({ modal: 'settings' })}>
          <Gear />
        </button>
        <button className="btn primary" onClick={doExport} disabled={!!progress}>
          <Download /> Eksport ZIP
        </button>
      </header>

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
              </div>
              <div className="panel-scroll">{s.leftTab === 'layouts' ? <LayoutsPanel /> : <Gallery />}</div>
            </>
          )}
        </aside>

        <main className="center">
          <div className="canvas-toolbar">
            <span className="small muted">
              Slajd <b style={{ color: 'var(--text)' }}>{s.current + 1}</b> / {s.project.slides.length} · 1080 × 1350 (4:5)
            </span>
            <div className="grow" style={{ flex: 1 }} />
            <button className={`btn sm ${s.showTips ? 'active' : ''}`} onClick={() => s.set({ showTips: !s.showTips })} title="Pokaż, gdzie tło jest spokojne, a gdzie ruchliwe">
              <Bulb size={14} /> Strefy tekstu
            </button>
            <button className={`btn sm ${s.showGuides ? 'active' : ''}`} onClick={() => s.set({ showGuides: !s.showGuides })} title="Marginesy bezpieczeństwa i kadr siatki profilu 3:4">
              <Grid size={14} /> Linie pomocnicze
            </button>
          </div>
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

      {s.modal === 'settings' && <SettingsModal />}
      {s.modal === 'projects' && <ProjectsModal />}
      {s.modal === 'presets' && <PresetsModal />}
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
