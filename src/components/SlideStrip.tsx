import { useState } from 'react'
import { blankSlide } from '../presets/templates'
import { usePreset, useStore } from '../store'
import { IMAGE_MIME } from './Canvas'
import { Copy, Left, Plus, Right, Trash } from './Icons'
import { SlideThumb } from './SlideView'

const SLIDE_MIME = 'application/x-postify-slide'

export function SlideStrip() {
  const slides = useStore((s) => s.project.slides)
  const current = useStore((s) => s.current)
  const images = useStore((s) => s.imageMap)
  const preset = usePreset()
  const st = useStore.getState
  const [over, setOver] = useState<number | null>(null)

  return (
    <div className="strip">
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`sthumb ${i === current ? 'on' : ''} ${over === i ? 'dragover' : ''}`}
          onClick={() => useStore.setState({ current: i, selEl: null, selBlock: null })}
          draggable
          onDragStart={(e) => e.dataTransfer.setData(SLIDE_MIME, String(i))}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(SLIDE_MIME) || e.dataTransfer.types.includes(IMAGE_MIME)) {
              e.preventDefault()
              setOver(i)
            }
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(null)
            const img = e.dataTransfer.getData(IMAGE_MIME)
            if (img) return st().setSlotImage(i, 0, img)
            const from = Number(e.dataTransfer.getData(SLIDE_MIME))
            if (!Number.isNaN(from)) st().moveSlide(from, i)
          }}
          title="Przeciągnij, aby zmienić kolejność · upuść zdjęcie, aby ustawić tło"
        >
          <SlideThumb slide={s} preset={preset} images={images} width={86} />
          <span className="num">{i + 1}</span>
          <div className="sactions" onClick={(e) => e.stopPropagation()}>
            <button title="W lewo" onClick={() => i > 0 && st().moveSlide(i, i - 1)}>
              <Left size={13} />
            </button>
            <button title="W prawo" onClick={() => i < slides.length - 1 && st().moveSlide(i, i + 1)}>
              <Right size={13} />
            </button>
            <button title="Duplikuj" onClick={() => st().duplicateSlide(i)}>
              <Copy size={12} />
            </button>
            <button title="Usuń" onClick={() => st().deleteSlide(i)}>
              <Trash size={12} />
            </button>
          </div>
        </div>
      ))}
      <button className="add-slide" title="Dodaj pusty slajd" onClick={() => st().addSlide(blankSlide(), slides.length)}>
        <Plus size={22} />
      </button>
      <div className="tiny dim" style={{ marginLeft: 6, maxWidth: 170, flex: 'none' }}>
        {slides.length} {slides.length === 1 ? 'slajd' : slides.length < 5 ? 'slajdy' : 'slajdów'} · max 20 na Instagramie
      </div>
    </div>
  )
}
