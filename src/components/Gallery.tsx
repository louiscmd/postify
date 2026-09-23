import { useRef, useState } from 'react'
import { makeInset } from '../presets/templates'
import { useSlide, useStore } from '../store'
import { IMAGE_MIME } from './Canvas'
import { Check, ImageIcon, Trash, Upload } from './Icons'

export function Gallery({ selectMode = false }: { selectMode?: boolean }) {
  const images = useStore((s) => s.images)
  const aiSelection = useStore((s) => s.aiSelection)
  const current = useStore((s) => s.current)
  const slide = useSlide()
  const st = useStore.getState
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const setBg = (id: string) => {
    const empty = slide.layout === 'split' ? slide.slots.findIndex((s) => !s.imageId) : -1
    st().setSlotImage(current, empty > 0 ? empty : 0, id)
  }

  return (
    <div>
      <div
        className={`drop ${over ? 'over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          st().addFiles(e.dataTransfer.files)
        }}
      >
        <Upload size={20} />
        <div style={{ fontWeight: 600, marginTop: 6 }}>Importuj zdjęcia</div>
        <div className="tiny">Kliknij lub upuść pliki — JPG, PNG, WEBP, HEIC z iPhone, dowolny rozmiar i kształt</div>
        <input
          ref={input}
          type="file"
          accept="image/*,.jpg,.jpeg,.jfif,.png,.webp,.avif,.gif,.bmp,.tif,.tiff,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) st().addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="row small muted" style={{ marginTop: 12, justifyContent: 'space-between' }}>
          <span>{images.length} w galerii</span>
          {selectMode ? (
            <span>
              {aiSelection.length ? `${aiSelection.length} zaznaczonych` : 'AI użyje wszystkich'}
              {aiSelection.length > 0 && (
                <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => useStore.setState({ aiSelection: [] })}>
                  wyczyść
                </button>
              )}
            </span>
          ) : (
            <span className="tiny dim">przeciągnij na slajd</span>
          )}
        </div>
      )}

      <div className="gallery">
        {images.map((img) => {
          const sel = aiSelection.includes(img.id)
          return (
            <div
              key={img.id}
              className={`gthumb ${selectMode && sel ? 'sel' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(IMAGE_MIME, img.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => (selectMode ? st().toggleAiImage(img.id) : setBg(img.id))}
              title={selectMode ? 'Kliknij, aby zaznaczyć dla AI' : `${img.name} — kliknij: ustaw jako tło, przeciągnij: upuść na slajd / wstawkę`}
            >
              <img src={img.url} alt={img.name} loading="lazy" draggable={false} />
              {selectMode && <span className="check">{sel && <Check size={12} />}</span>}
              <div className="gactions" onClick={(e) => e.stopPropagation()}>
                {!selectMode && (
                  <button title="Dodaj jako wstawione zdjęcie" onClick={() => st().addEl(makeInset({ imageId: img.id, x: 340, y: 420, w: 400, h: 500 }))}>
                    <ImageIcon size={13} />
                  </button>
                )}
                <button title="Usuń z galerii" onClick={() => confirm('Usunąć zdjęcie z galerii?') && st().removeImage(img.id)}>
                  <Trash size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
