/**
 * Instagram story system — the seven content types of the weekly schedule.
 * Each type knows its cadence, its purpose and the *technique* that makes it work,
 * plus the sequence of frames it produces. Text here is placeholder only.
 */
import type { Fields } from './templates'

export type StoryTypeId = 'value' | 'credibility' | 'qa' | 'day' | 'breakdown' | 'lifestyle' | 'cta'

export interface StoryFrame {
  /** structure id from TEMPLATES */
  structure: string
  fields: Partial<Fields>
  /** what this frame is for — shown in the editor and given to the AI */
  note: string
  images?: 1 | 2
}

export interface StoryType {
  id: StoryTypeId
  name: string
  cadence: string
  /** how often, as a weekly number — used by the planner */
  perWeek: [number, number]
  purpose: string
  technique: string
  /** guidance for the AI when it writes this type */
  ai: string
  frames: StoryFrame[]
}

export const STORY_TYPES: StoryType[] = [
  {
    id: 'value',
    name: 'Wartość',
    cadence: '1–2× w tygodniu',
    perWeek: [1, 2],
    purpose: 'Rozwiązuje realny problem i daje konkretne kroki do wykonania.',
    technique: 'Zrzut ekranu z adnotacjami — strzałki i kolorowe dymki rozkładające jedną konkretną rzecz na części.',
    ai: 'Teach one specific thing the viewer can act on today. Frame 1 = the problem in their words. Frame 2 = the annotated example: 2–4 short callouts, each naming exactly what is happening in the screenshot. Frame 3 = the steps to copy, as bullets.',
    frames: [
      { structure: 'sv-hook', fields: { title: 'Problem, który rozwiązujesz', subtitle: 'jedno zdanie, dla kogo to jest' }, note: 'Hook — nazwij problem odbiorcy' },
      { structure: 'sv-annotated', fields: { callouts: ['co jest tu nie tak', 'co zrobić zamiast tego', 'efekt tej zmiany'] }, note: 'Zrzut ekranu z dymkami — serce tego formatu', images: 2 },
      { structure: 'sv-steps', fields: { title: 'Zrób to u siebie:', bullets: ['pierwszy krok', 'drugi krok', 'trzeci krok'] }, note: 'Konkretne kroki do wykonania' },
    ],
  },
  {
    id: 'credibility',
    name: 'Dowód',
    cadence: '2–3× w tygodniu',
    perWeek: [2, 3],
    purpose: 'Wyniki klientów, wiadomości, transformacje — buduje wiarygodność.',
    technique: 'Surowe zrzuty prawdziwych DM-ów i wyników, bez upiększania. Listy „wins”, wiadomość klienta ogłaszająca wynik.',
    ai: 'Show proof, do not sell. Frame 1 = the raw screenshot with a 3–6 word label. Frame 2 = one sentence of context (what happened, in how long). Frame 3 = a short wins list. Never invent numbers — leave placeholders the user fills in.',
    frames: [
      { structure: 'sv-raw', fields: { caption: 'wiadomość od klienta' }, note: 'Surowy zrzut DM / wyniku — bez ramek i ozdób', images: 2 },
      { structure: 'sv-line', fields: { title: 'Jedno zdanie kontekstu: co się wydarzyło i w ile czasu' }, note: 'Kontekst wyniku' },
      { structure: 'sv-steps', fields: { title: 'Wins z tego tygodnia:', bullets: ['wynik pierwszy', 'wynik drugi', 'wynik trzeci'] }, note: 'Lista wyników' },
    ],
  },
  {
    id: 'qa',
    name: 'Q&A',
    cadence: '1× w tygodniu',
    perWeek: [1, 1],
    purpose: 'Odpowiada na częste pytania i rozbraja obiekcje, zanim padną.',
    technique: 'Naklejka „zadaj pytanie”, pytania pogrupowane tematycznie (np. „Biznes i życie”), odpowiedzi jako tekst na zdjęciu.',
    ai: 'Answer real questions plainly. Frame 1 = the sticker prompt with the topic bucket. Then one frame per question: the question in the sticker, the answer as text over a photo — 2–4 sentences, no hedging, pre-handling the objection behind the question.',
    frames: [
      { structure: 'sv-sticker', fields: { kicker: 'Biznes i życie', question: 'Zadaj mi pytanie' }, note: 'Naklejka z pytaniem — zbiera pytania' },
      { structure: 'sv-answer', fields: { question: 'Pytanie, które dostajesz najczęściej', body: 'Odpowiedź w dwóch, trzech zdaniach. Bez owijania — od razu konkret.' }, note: 'Pytanie + odpowiedź' },
      { structure: 'sv-answer', fields: { question: 'Druga obiekcja, którą słyszysz', body: 'Odpowiedź, która rozbraja ją zanim padnie.' }, note: 'Kolejne pytanie' },
    ],
  },
  {
    id: 'day',
    name: 'Dzień z życia',
    cadence: '1–2× w miesiącu (nie co tydzień)',
    perWeek: [0, 0.5],
    purpose: 'Godzina po godzinie, bez filtra — pokazuje, jak wygląda praca naprawdę.',
    technique: 'Zdjęcia ze znacznikiem godziny (10:00, 14:00, 16:00…), kończy się konkretnym, policzalnym wynikiem — nie podsumowaniem.',
    ai: 'Hour-by-hour, unfiltered, no motivational wrap-up. One frame per hour with a timestamp and one plain line about what is happening. The last frame ends on a concrete, quantified result of that day.',
    frames: [
      { structure: 'sv-time', fields: { timestamp: '08:00', title: 'co robisz o tej godzinie' }, note: 'Początek dnia' },
      { structure: 'sv-time', fields: { timestamp: '11:00', title: 'druga godzina dnia' }, note: 'Środek dnia' },
      { structure: 'sv-time', fields: { timestamp: '16:00', title: 'trzecia godzina dnia' }, note: 'Popołudnie' },
      { structure: 'sv-result', fields: { title: 'Efekt dnia: konkretna liczba', subtitle: 'bez podsumowań i morałów' }, note: 'Policzalny wynik — nie „miłego dnia”' },
    ],
  },
  {
    id: 'breakdown',
    name: 'Rozkład na części',
    cadence: '1× w tygodniu',
    purpose: 'Pokazuje mechanizm, który stoi za wynikami.',
    perWeek: [1, 1],
    technique: 'Zrzuty/nagranie prawdziwego systemu — narzędzia, workflow — z czarnymi dymkami wyjaśniającymi, co się dzieje.',
    ai: 'Break down the mechanism behind a result. Frame 1 = the result, in one line. Frame 2–3 = the actual system on screen with black callouts naming each moving part. Last frame = why it works, one sentence.',
    frames: [
      { structure: 'sv-line', fields: { title: 'Wynik, który rozkładasz na części' }, note: 'Od wyniku, nie od narzędzia' },
      { structure: 'sv-annotated', fields: { callouts: ['co robi ten element', 'co dzieje się tutaj', 'dlaczego to działa'] }, note: 'System na ekranie z czarnymi dymkami', images: 2 },
      { structure: 'sv-steps', fields: { title: 'Mechanizm w trzech krokach:', bullets: ['krok pierwszy', 'krok drugi', 'krok trzeci'] }, note: 'Mechanizm w punktach' },
    ],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    cadence: '1–2× w tygodniu',
    perWeek: [1, 2],
    purpose: 'Zero struktury, zero tekstu — buduje bliskość.',
    technique: 'Sekwencja samych zdjęć: miejsca, aktywności. Bez podpisów.',
    ai: 'No text at all. Only pick photos — places, activities, moments. Return empty fields for every frame.',
    frames: [
      { structure: 'sv-photo', fields: {}, note: 'Samo zdjęcie — bez tekstu' },
      { structure: 'sv-photo', fields: {}, note: 'Samo zdjęcie' },
      { structure: 'sv-photo', fields: {}, note: 'Samo zdjęcie' },
    ],
  },
  {
    id: 'cta',
    name: 'CTA',
    cadence: 'rzadziej niż 1× w miesiącu',
    perWeek: [0, 0.2],
    purpose: 'Zamienia uwagę w klientów i sprawia, że wszystkie wcześniejsze sekwencje się zwracają.',
    technique:
      'Wieloslajdowa narracja: kilka klatek nazywających dokładny ból odbiorcy → klatka przejściowa (osobista refleksja) → bezpośrednia oferta ze słowem-kluczem do odpisania. Mówisz jako Ty, nie jako firma.',
    ai: 'A multi-frame narrative, never a soft ask. 3–4 frames naming the exact pain in the prospect\'s own words (one pain per frame, second person). Then one transition frame: a personal reflection that explains why you are opening this now. Then the offer frame: what you will personally do, how many spots, and a reply keyword in caps. Speak as a person, never as a company.',
    frames: [
      { structure: 'sv-pain', fields: { title: 'content nigdy się nie kończy' }, note: 'Ból 1 — jego słowami' },
      { structure: 'sv-pain', fields: { title: 'pozycjonowanie jest niejasne' }, note: 'Ból 2' },
      { structure: 'sv-pain', fields: { title: 'próbowałeś reklam, zatrudniałeś ludzi — nic nie ruszyło' }, note: 'Ból 3 — to, czego już próbował' },
      { structure: 'sv-line', fields: { title: 'Nigdy nikogo nie brałem, ale w zeszłym tygodniu o tym pomyślałem.' }, note: 'Przejście — osobista refleksja' },
      { structure: 'sv-offer', fields: { title: 'Otwieram 3 miejsca, w których osobiście pomogę ci zbudować markę.', keyword: 'MARKA', caption: 'Odpisz „MARKA”, a odezwę się dziś.' }, note: 'Oferta + słowo-klucz do odpisania' },
    ],
  },
]

export const storyTypeById = (id?: string) => STORY_TYPES.find((t) => t.id === id)
