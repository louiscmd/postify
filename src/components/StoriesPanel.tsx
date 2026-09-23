import { STORY_TYPES, storyTypeById } from '../presets/stories'
import { useStore } from '../store'
import { Plus, Sparkles } from './Icons'

/** The weekly story system: seven types, each with its cadence, purpose and technique. */
export function StoriesPanel() {
  const project = useStore((s) => s.project)
  const st = useStore.getState
  const active = project.format === 'story' ? storyTypeById(project.storyType) : undefined

  const perWeek = STORY_TYPES.reduce((n, t) => n + t.perWeek[1], 0)

  return (
    <div>
      <div className="hint" style={{ marginBottom: 14 }}>
        Siedem typów relacji z Twojego systemu. Kliknij typ, a dostaniesz gotową sekwencję klatek 1080 × 1920 z układem pod tę technikę — treść wpiszesz sam albo wygeneruje ją AI.
      </div>

      <div className="card" style={{ marginBottom: 14, padding: 10 }}>
        <div className="mini-label" style={{ marginBottom: 6 }}>
          Tydzień według systemu
        </div>
        <div className="week-grid">
          {STORY_TYPES.filter((t) => t.perWeek[1] >= 1).map((t) => (
            <div key={t.id} className="week-item">
              <b>{t.perWeek[0] === t.perWeek[1] ? t.perWeek[1] : `${t.perWeek[0]}–${t.perWeek[1]}`}×</b>
              <span>{t.name}</span>
            </div>
          ))}
        </div>
        <div className="tiny dim" style={{ marginTop: 8 }}>
          ≈ {perWeek} relacji w tygodniu + Dzień z życia 1–2× w miesiącu i CTA rzadziej niż raz w miesiącu.
        </div>
      </div>

      {STORY_TYPES.map((t) => (
        <div key={t.id} className={`story-type ${active?.id === t.id ? 'on' : ''}`}>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <b className="grow">{t.name}</b>
            <span className="cadence">{t.cadence}</span>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {t.purpose}
          </div>
          <div className="tiny dim" style={{ marginTop: 6 }}>
            <b>Technika:</b> {t.technique}
          </div>
          <div className="tiny dim" style={{ marginTop: 6 }}>
            {t.frames.length} klatek: {t.frames.map((f) => f.note.split('—')[0].trim()).join(' → ')}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm grow" onClick={() => st().newStory(t.id)}>
              <Plus size={13} /> Nowa sekwencja
            </button>
            <button
              className="btn sm primary"
              title="Utwórz sekwencję i napisz treść z AI"
              onClick={() => {
                st().newStory(t.id)
                useStore.setState({ leftTab: 'ai' })
              }}
            >
              <Sparkles size={13} /> z AI
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
