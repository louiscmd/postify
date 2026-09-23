/**
 * Geometry for a background photo inside the fixed 4:5 frame.
 *
 * The frame is hard (1080×1350 or a 1080×675 half); the photo slides freely behind it.
 * `zoom` is relative to "cover": 1 = fills the frame, < 1 = smaller than the frame
 * (whole photo visible, edges filled with a blurred copy), > 1 = zoomed in.
 * `offsetX/offsetY` move the photo in canvas pixels from the centred position.
 */
import type { BgSlot } from '../types'

export interface ImgSize {
  w: number
  h: number
}

export const coverScale = (img: ImgSize, sw: number, sh: number) => Math.max(sw / img.w, sh / img.h)
/** zoom value at which the whole photo fits inside the frame */
export const containZoom = (img: ImgSize, sw: number, sh: number) => Math.min(sw / img.w, sh / img.h) / coverScale(img, sw, sh)
/** zoom value at which one photo pixel = one canvas pixel */
export const pixelZoom = (img: ImgSize, sw: number, sh: number) => 1 / coverScale(img, sw, sh)

export const MIN_ZOOM = 0.15
export const MAX_ZOOM = 5

export interface SlotRect {
  w: number
  h: number
  left: number
  top: number
  offsetX: number
  offsetY: number
  covers: boolean
}

export function slotRect(s: BgSlot, img: ImgSize, sw: number, sh: number): SlotRect {
  const k = coverScale(img, sw, sh) * (s.zoom || 1)
  const w = img.w * k
  const h = img.h * k
  let { offsetX, offsetY } = s
  if (offsetX === undefined || offsetY === undefined) {
    // projects made before free placement stored object-position percentages
    const ovx = w - sw
    const ovy = h - sh
    offsetX = ovx > 0 ? ovx * (0.5 - (s.focusX ?? 50) / 100) : 0
    offsetY = ovy > 0 ? ovy * (0.5 - (s.focusY ?? 50) / 100) : 0
  }
  return { w, h, left: (sw - w) / 2 + offsetX, top: (sh - h) / 2 + offsetY, offsetX, offsetY, covers: w >= sw - 0.5 && h >= sh - 0.5 }
}

/**
 * Zoom to start a photo at. Normally it fills the frame (like Canva), but a shape far from
 * 4:5 — a panorama, a very tall shot — would lose most of itself to the crop, so those start
 * fitted whole inside the frame, with the blurred fill behind them.
 */
export const initialZoom = (img: ImgSize, sw: number, sh: number) => {
  const fit = containZoom(img, sw, sh)
  // 0.42 ≈ "more than half of the photo would be cropped away": panoramas and very tall shots.
  // Ordinary landscape/portrait photos still fill the frame, as in Canva.
  return fit < 0.42 ? Math.round(fit * 1000) / 1000 : 1
}

/** Give every background slot of a slide a sensible starting zoom for its photo. */
export function fitSlots(slots: BgSlot[], images: Record<string, { w: number; h: number }>, frameH: number, frameW = 1080) {
  for (const s of slots) {
    const img = s.imageId ? images[s.imageId] : undefined
    if (img && (s.zoom === 1 || s.zoom === undefined) && !s.offsetX && !s.offsetY) s.zoom = initialZoom(img, frameW, frameH)
  }
  return slots
}

/**
 * Keep part of the photo inside the frame so it can never be dragged out of sight.
 * At the limit, `keep` pixels of the photo still overlap the frame.
 */
export function clampOffset(offset: number, size: number, frame: number) {
  const keep = Math.min(size, frame, 220) * 0.6
  const bound = (frame + size) / 2 - keep
  return Math.max(-bound, Math.min(bound, offset))
}
