import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from 'react'
import { useSlideAnalysis } from '../lib/useAnalysis'
import { clamp, uid } from '../lib/util'
import { useSlide, usePreset, useStore } from '../store'
import { H, W, type El } from '../types'
import { SlideView } from './SlideView'

export const IMAGE_MIME = 'application/x-postify-image'

type Rect = { x: number; y: number; w: number; h: number }
type Drag =
  | { mode: 'move'; id: string; sx: number; sy: number; ox: number; oy: number; box: Rect; key: string; moved: boolean }
  | { mode: 'resize'; id: string; handle: 'e' | 'w' | 'se'; sx: number; sy: number; o: { x: number; w: number; h: number }; key: string }
  | { mode: 'pan'; slot: number; sx: number; sy: number; fx: number; fy: number; ovx: number; ovy: number; key: string }

const SNAP = 10

export function Canvas() {
  const slide = useSlide()
  const preset = usePreset()
  const images = useStore((s) => s.imageMap)
  const { selEl, showTips, showGuides, current } = useStore()
  const store = useStore.getState
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const [selRect, setSelRect] = useState<Rect | null>(null)
  const [hoverRect, setHoverRect] = useState<Rect | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [dropOver, setDropOver] = useState(false)
  const [tick, setTick] = useState(0)
  const drag = useRef<Drag | null>(null)
  const analyses = useSlideAnalysis(slide, showTips)

  // fit stage into the available area
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setScale(Math.max(0.15, Math.min((r.width - 48) / W, (r.height - 24) / H)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    document.fonts.ready.then(() => setTick((t) => t + 1))
  }, [])

  const rectOf = useCallback(
    (id: string): Rect | null => {
      const stage = stageRef.current
      const node = stage?.querySelector<HTMLElement>(`[data-el-id="${id}"]`)
      if (!stage || !node) return null
      const s = stage.getBoundingClientRect()
      const r = node.getBoundingClientRect()
      return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale }
    },
    [scale],
  )

  useLayoutEffect(() => {
    setSelRect(selEl ? rectOf(selEl) : null)
  }, [selEl, slide, scale, tick, rectOf])

  const toSlide = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault() // no text selection / native image drag while editing
    window.getSelection()?.removeAllRanges()
    ;(document.activeElement as HTMLElement | null)?.blur?.() // so Delete/arrows act on the canvas, not a text field
    const target = e.target as HTMLElement
    const handle = target.dataset.handle as 'e' | 'w' | 'se' | undefined
    const key = uid()
    if (handle && selEl) {
      const el = slide.elements.find((x) => x.id === selEl)
      if (!el) return
      drag.current = { mode: 'resize', id: el.id, handle, sx: e.clientX, sy: e.clientY, o: { x: el.x, w: el.w, h: el.type === 'stack' ? 0 : el.h }, key }
    } else {
      const node = target.closest<HTMLElement>('[data-el-id]')
      if (node) {
        const id = node.dataset.elId!
        const blockId = target.closest<HTMLElement>('[data-block-id]')?.dataset.blockId ?? null
        const el = slide.elements.find((x) => x.id === id)!
        store().select(id, blockId ?? (el.type === 'stack' ? el.blocks[0]?.id ?? null : null))
        drag.current = { mode: 'move', id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, box: rectOf(id) ?? { x: el.x, y: el.y, w: 10, h: 10 }, key, moved: false }
      } else {
        store().select(null)
        const p = toSlide(e)
        const slotIdx = slide.layout === 'split' && p.y > H / 2 ? 1 : 0
        const s = slide.slots[slotIdx]
        const img = s?.imageId ? images[s.imageId] : undefined
        if (img) {
          const sh = slide.layout === 'split' ? H / 2 : H
          const k = Math.max(W / img.w, sh / img.h) * s.zoom
          drag.current = { mode: 'pan', slot: slotIdx, sx: e.clientX, sy: e.clientY, fx: s.focusX, fy: s.focusY, ovx: img.w * k - W, ovy: img.h * k - sh, key }
        }
      }
    }
    if (drag.current) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) {
      const node = (e.target as HTMLElement).closest<HTMLElement>('[data-el-id]')
      const id = node?.dataset.elId
      setHoverRect(id && id !== selEl ? rectOf(id) : null)
      return
    }
    let dx = (e.clientX - d.sx) / scale
    let dy = (e.clientY - d.sy) / scale
    if (d.mode === 'move') {
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return
      d.moved = true
      const v: number[] = []
      const h: number[] = []
      if (!e.altKey) {
        const b = d.box
        const cx = b.x + dx + b.w / 2
        const cy = b.y + dy + b.h / 2
        const xTargets: [number, number][] = [[cx, W / 2], [b.x + dx, 80], [b.x + dx + b.w, W - 80]]
        for (const [cur, t] of xTargets)
          if (Math.abs(cur - t) < SNAP) {
            dx += t - cur
            v.push(t)
            break
          }
        const yCenters = slide.layout === 'split' ? [H / 4, H / 2, (H * 3) / 4] : [H / 2]
        const yTargets: [number, number][] = [...yCenters.map((t) => [cy, t] as [number, number]), [b.y + dy, 80], [b.y + dy + b.h, H - 80]]
        for (const [cur, t] of yTargets)
          if (Math.abs(cur - t) < SNAP) {
            dy += t - cur
            h.push(t)
            break
          }
      }
      setGuides({ v, h })
      setHoverRect(null)
      store().updateEl(d.id, (el) => {
        el.x = Math.round(d.ox + dx)
        el.y = Math.round(d.oy + dy)
      }, d.key)
    } else if (d.mode === 'resize') {
      store().updateEl(d.id, (el: El) => {
        if (d.handle === 'e') el.w = Math.max(60, Math.round(d.o.w + dx))
        if (d.handle === 'w') {
          const w = Math.max(60, Math.round(d.o.w - dx))
          el.x = Math.round(d.o.x + (d.o.w - w))
          el.w = w
        }
        if (d.handle === 'se' && el.type !== 'stack') {
          if (e.shiftKey) {
            const r = d.o.h / d.o.w
            el.w = Math.max(30, Math.round(d.o.w + dx))
            el.h = Math.round(el.w * r)
          } else {
            el.w = Math.max(30, Math.round(d.o.w + dx))
            el.h = Math.max(30, Math.round(d.o.h + dy))
          }
        }
      }, d.key)
    } else if (d.mode === 'pan') {
      store().updateSlide((s) => {
        const sl = s.slots[d.slot]
        if (d.ovx > 1) sl.focusX = Math.round(clamp(d.fx - (dx / d.ovx) * 100, 0, 100))
        if (d.ovy > 1) sl.focusY = Math.round(clamp(d.fy - (dy / d.ovy) * 100, 0, 100))
      }, d.key)
    }
  }

  const onPointerUp = () => {
    drag.current = null
    setGuides({ v: [], h: [] })
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-el-id]')) useStore.setState((s) => ({ focusTick: s.focusTick + 1 }))
  }

  // ── gallery → canvas drops ──
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(IMAGE_MIME) || e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropOver(true)
    }
  }
  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    setDropOver(false)
    let id = e.dataTransfer.getData(IMAGE_MIME)
    if (!id && e.dataTransfer.files.length) id = (await store().addFiles(e.dataTransfer.files))[0]
    if (!id) return
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.elId) as HTMLElement | undefined
    const el = hit && slide.elements.find((x) => x.id === hit.dataset.elId)
    if (el && el.type === 'image') {
      store().updateEl(el.id, (x) => {
        if (x.type === 'image') x.imageId = id
      })
      return
    }
    const p = toSlide(e)
    store().setSlotImage(current, slide.layout === 'split' && p.y > H / 2 ? 1 : 0, id)
  }

  const selected = slide.elements.find((x) => x.id === selEl)
  const sw = W * scale
  const sh = H * scale

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div
        ref={stageRef}
        className={`stage ${dropOver ? 'drop-over' : ''}`}
        style={{ width: sw, height: sh, cursor: drag.current?.mode === 'pan' ? 'grabbing' : 'default', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverRect(null)}
        onDoubleClick={onDoubleClick}
        onDragOver={onDragOver}
        onDragLeave={() => setDropOver(false)}
        onDrop={onDrop}
      >
        <div className="stage-inner" style={{ transform: `scale(${scale})`, width: W, height: H, overflow: 'hidden', borderRadius: 4 / scale }}>
          <SlideView slide={slide} preset={preset} images={images} showHint />
        </div>

        {showTips && <TipsOverlay analyses={analyses} layout={slide.layout} scale={scale} />}

        {showGuides && (
          <>
            <div className="safe" style={{ left: 60 * scale, top: 60 * scale, width: (W - 120) * scale, height: (H - 120) * scale }} title="Bezpieczny margines" />
            <div className="safe" style={{ left: 33.75 * scale, top: 0, width: (W - 67.5) * scale, height: sh, borderColor: 'rgba(95,208,255,0.28)', borderTop: 0, borderBottom: 0 }} title="Kadr siatki profilu 3:4" />
          </>
        )}
        {slide.layout === 'split' && <div className="split-line" style={{ top: sh / 2 }} />}

        {guides.v.map((x) => (
          <div key={'v' + x} className="guide v" style={{ left: x * scale }} />
        ))}
        {guides.h.map((y) => (
          <div key={'h' + y} className="guide h" style={{ top: y * scale }} />
        ))}

        {hoverRect && <div className="hover-box" style={{ left: hoverRect.x * scale, top: hoverRect.y * scale, width: hoverRect.w * scale, height: hoverRect.h * scale }} />}

        {selRect && selected && (
          <div className="sel-box" style={{ left: selRect.x * scale - 3, top: selRect.y * scale - 3, width: selRect.w * scale + 6, height: selRect.h * scale + 6 }}>
            {selected.type === 'stack' ? (
              <>
                <div className="h w" data-handle="w" />
                <div className="h e" data-handle="e" />
              </>
            ) : (
              <div className="h se" data-handle="se" title="Shift = zachowaj proporcje" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TipsOverlay({ analyses, layout, scale }: { analyses: ReturnType<typeof useSlideAnalysis>; layout: 'single' | 'split'; scale: number }) {
  const slotH = layout === 'split' ? H / 2 : H
  const zoneY = { top: [0.03, 0.32], middle: [0.36, 0.64], bottom: [0.68, 0.97] } as const
  return (
    <>
      {analyses.map((a, i) => {
        if (!a) return null
        const top = i * slotH * scale
        const cw = (W / a.cols) * scale
        const ch = (slotH / a.rows) * scale
        const cells = []
        for (let r = 0; r < a.rows; r++)
          for (let c = 0; c < a.cols; c++) {
            const b = a.busy[r * a.cols + c]
            if (b < 0.3) continue
            cells.push(
              <div
                key={r * a.cols + c}
                style={{ position: 'absolute', left: c * cw, top: top + r * ch, width: cw, height: ch, background: `rgba(239,107,107,${Math.min(0.42, (b - 0.3) * 0.7)})` }}
              />,
            )
          }
        const [y0, y1] = zoneY[a.best]
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {cells}
            <div className="zone-box" style={{ left: W * 0.06 * scale, width: W * 0.88 * scale, top: top + slotH * y0 * scale, height: slotH * (y1 - y0) * scale }}>
              <span>Najlepsze miejsce na tekst · {a.tone === 'dark' ? 'ciemny tekst' : 'jasny tekst'}</span>
            </div>
          </div>
        )
      })}
    </>
  )
}
