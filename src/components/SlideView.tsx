import type { CSSProperties } from 'react'
import { fontStack, snapWeight } from '../fonts'
import { RichText } from '../lib/markup'
import { SHADOWS } from '../presets'
import type { BgSlot, Block, El, GalleryImage, Preset, Slide, TextStyle } from '../types'
import { slideH, W } from '../types'
import { slotRect } from '../lib/slot'
import { Doodle } from './Doodle'

export const resolveStyle = (preset: Preset, b: Block): TextStyle => ({ ...preset.styles[b.styleKey], ...b.overrides })

const textCss = (st: TextStyle): CSSProperties => ({
  fontFamily: fontStack(st.font),
  fontSize: st.size,
  fontWeight: snapWeight(st.font, st.weight),
  color: st.color,
  lineHeight: st.lineHeight,
  letterSpacing: `${st.letterSpacing}em`,
  textTransform: st.uppercase ? 'uppercase' : 'none',
  fontStyle: st.italic ? 'italic' : 'normal',
  textShadow: SHADOWS[st.shadow] ?? 'none',
  textAlign: st.align,
  opacity: st.opacity,
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
})

const alignSelf = (a: Block['selfAlign']) => (a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : a === 'center' ? 'center' : 'stretch')

const BlockView = ({ b, preset }: { b: Block; preset: Preset }) => {
  const st = resolveStyle(preset, b)
  const common: CSSProperties = { ...textCss(st), alignSelf: alignSelf(b.selfAlign), marginTop: b.marginTop }
  if (st.boxBg) {
    Object.assign(common, {
      background: st.boxBg,
      borderRadius: st.boxRadius ?? 10,
      padding: `${st.boxPadY ?? 14}px ${st.boxPadX ?? 22}px`,
      alignSelf: b.selfAlign === 'stretch' ? 'flex-start' : alignSelf(b.selfAlign),
      textShadow: 'none',
    })
  }
  if (b.kind === 'chips') {
    const justify = st.align === 'left' ? 'flex-start' : st.align === 'right' ? 'flex-end' : 'center'
    return (
      <div data-block-id={b.id} style={{ ...common, display: 'flex', flexWrap: 'wrap', justifyContent: justify, columnGap: b.gapX, rowGap: b.gapY }}>
        {b.items.filter(Boolean).map((it, i) => (
          <span
            key={i}
            style={{
              background: preset.chipBg,
              color: st.color,
              borderRadius: preset.chipRadius,
              padding: '0.08em 0.32em 0.12em',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
            }}
          >
            {it}
          </span>
        ))}
      </div>
    )
  }
  if (!b.text.trim()) return null
  if (st.underline) {
    return (
      <div data-block-id={b.id} style={common}>
        <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <RichText text={b.text} st={st} />
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" style={{ position: 'absolute', left: '2%', width: '96%', bottom: '-0.12em', height: '0.16em', overflow: 'visible' }}>
            <path d="M1 7 C 30 3, 70 3, 99 6" stroke={st.underline} strokeWidth={6} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </span>
      </div>
    )
  }
  return (
    <div data-block-id={b.id} style={common}>
      <RichText text={b.text} st={st} />
    </div>
  )
}

const SlotView = ({ s, img, top, height, showHint }: { s: BgSlot; img?: GalleryImage; top: number; height: number; showHint: boolean }) => {
  const r = img ? slotRect(s, img, W, height) : null
  return (
  <div style={{ position: 'absolute', left: 0, top, width: W, height, overflow: 'hidden' }}>
    {img && r ? (
      <>
        {/* photo smaller than the frame: fill the edges with a blurred copy instead of a flat band */}
        {!r.covers && s.blur !== false && (
          <img
            src={img.url}
            alt=""
            draggable={false}
            aria-hidden
            style={{ position: 'absolute', left: -60, top: -60, width: W + 120, height: height + 120, objectFit: 'cover', filter: 'blur(42px) brightness(0.55) saturate(1.1)' }}
          />
        )}
        <img
          src={img.url}
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: r.left, top: r.top, width: r.w, height: r.h, maxWidth: 'none', display: 'block' }}
        />
      </>
    ) : (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 90% at 30% 20%, #3a2b2d 0%, #221a1b 55%, #161112 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showHint && (
          <div style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'Inter, sans-serif', fontSize: 34, textAlign: 'center', lineHeight: 1.4 }}>
            Przeciągnij tu zdjęcie
            <br />z galerii
          </div>
        )}
      </div>
    )}
  </div>
  )
}

export const ElementView = ({ el, preset, images, hideImage = false }: { el: El; preset: Preset; images: Record<string, GalleryImage>; hideImage?: boolean }) => {
  if (el.type === 'stack') {
    const ty = el.anchor === 'bottom' ? '-100%' : el.anchor === 'center' ? '-50%' : '0'
    return (
      <div
        data-el-id={el.id}
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.w,
          transform: `translateY(${ty}) rotate(${el.rotation}deg)`,
          transformOrigin: 'center',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {el.blocks.map((b) => (
          <BlockView key={b.id} b={b} preset={preset} />
        ))}
      </div>
    )
  }
  if (el.type === 'image') {
    // on the export text layer the inset photo is painted on the canvas underneath
    if (hideImage) return null
    const img = el.imageId ? images[el.imageId] : undefined
    return (
      <div
        data-el-id={el.id}
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.w,
          height: el.h,
          borderRadius: el.radius,
          overflow: 'hidden',
          transform: `rotate(${el.rotation}deg)`,
          boxShadow: el.shadow ? '0 12px 40px rgba(0,0,0,0.45)' : 'none',
          background: img ? '#000' : 'rgba(255,255,255,0.08)',
          outline: img ? 'none' : '3px dashed rgba(255,255,255,0.3)',
          outlineOffset: -3,
        }}
      >
        {img && (
          <img
            src={img.url}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${el.focusX}% ${el.focusY}%`, display: 'block' }}
          />
        )}
      </div>
    )
  }
  return (
    <div
      data-el-id={el.id}
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        transform: `rotate(${el.rotation}deg) scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
      }}
    >
      <Doodle kind={el.kind} color={el.color} stroke={el.stroke} />
    </div>
  )
}

export function SlideView({
  slide,
  preset,
  images,
  showHint = false,
  textOnly = false,
}: {
  slide: Slide
  preset: Preset
  images: Record<string, GalleryImage>
  showHint?: boolean
  /** export path: photos and overlays are painted on a canvas, this layer carries only text */
  textOnly?: boolean
}) {
  const o = slide.overlay
  const split = slide.layout === 'split'
  const H = slideH(slide)
  return (
    <div
      className="slide-root"
      style={{ position: 'relative', width: W, height: H, overflow: 'hidden', background: textOnly ? 'transparent' : slide.bgColor, fontKerning: 'normal' }}
    >
      {!textOnly &&
        (split ? (
          <>
            <SlotView s={slide.slots[0]} img={images[slide.slots[0]?.imageId ?? '']} top={0} height={H / 2} showHint={showHint} />
            <SlotView s={slide.slots[1] ?? slide.slots[0]} img={images[slide.slots[1]?.imageId ?? '']} top={H / 2} height={H / 2} showHint={showHint} />
          </>
        ) : (
          <SlotView s={slide.slots[0]} img={images[slide.slots[0]?.imageId ?? '']} top={0} height={H} showHint={showHint} />
        ))}
      {!textOnly && o.dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${o.dim})` }} />}
      {!textOnly && o.top > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, rgba(0,0,0,${o.top}) 0%, rgba(0,0,0,${o.top * 0.55}) 22%, rgba(0,0,0,0) 48%)`,
          }}
        />
      )}
      {!textOnly && o.bottom > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to top, rgba(0,0,0,${o.bottom}) 0%, rgba(0,0,0,${o.bottom * 0.7}) 16%, rgba(0,0,0,0) 45%)`,
          }}
        />
      )}
      {slide.elements.map((el) => (
        <ElementView key={el.id} el={el} preset={preset} images={textOnly ? {} : images} hideImage={textOnly} />
      ))}
    </div>
  )
}

/** Scaled, non-interactive preview (thumbnails, template cards). */
export function SlideThumb({ slide, preset, images, width }: { slide: Slide; preset: Preset; images: Record<string, GalleryImage>; width: number }) {
  const s = width / W
  return (
    <div style={{ width, height: slideH(slide) * s, overflow: 'hidden', position: 'relative', pointerEvents: 'none' }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
        <SlideView slide={slide} preset={preset} images={images} />
      </div>
    </div>
  )
}
