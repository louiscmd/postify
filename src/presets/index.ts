import type { Preset, StyleKey, TextStyle } from '../types'

const base: TextStyle = {
  font: 'Inter',
  size: 40,
  weight: 400,
  boldWeight: 700,
  color: '#ffffff',
  boldColor: null,
  align: 'left',
  lineHeight: 1.25,
  letterSpacing: 0,
  uppercase: false,
  italic: false,
  shadow: 'soft',
  highlightBg: '#4b1a6e',
  highlightColor: '#ffffff',
  underline: null,
  paragraphGap: 1,
  opacity: 1,
}

const s = (p: Partial<TextStyle>): TextStyle => ({ ...base, ...p })

export const STYLE_LABELS: Record<StyleKey, string> = {
  title: 'Tytuł',
  subtitle: 'Podtytuł',
  kicker: 'Nadtytuł / mały napis',
  number: 'Numer',
  body: 'Treść',
  list: 'Lista',
  caption: 'Podpis (dół)',
  cta: 'CTA',
  keyword: 'Słowo-klucz',
  note: 'Dopisek',
  split: 'Tekst podziału',
  chip: 'Chip',
}

// ─────────────────────────────────────────────────────────────
// 1. EDITORIAL SERIF — refs: "Teaching Her", "exposed", "I've shown how to:",
//    "comment WIFEY", "Personal Brand", "01. Discover Your Niche", "02. Define Core Values"
// ─────────────────────────────────────────────────────────────
const editorial: Preset = {
  id: 'editorial',
  name: 'Editorial Serif',
  family: 'editorial',
  builtin: true,
  description: 'Ciężki szeryf + grotesk w kapitalikach, miękki sans w treści, odręczne numery i strzałki.',
  analysis: [
    'Tytuł: ciężki, kontrastowy szeryf (DM Serif Display) — bardzo duży (130–170 px na 1080), ciasny interlinia 0.9 i lekko ujemny tracking. Zajmuje ~85% szerokości slajdu.',
    'Podtytuł: grotesk bold w KAPITALIKACH (Archivo 700, ~44 px), przyklejony tuż pod tytułem (odstęp ≈ 0), wyrównany do lewej krawędzi tytułu — tworzy zwarty „lockup”.',
    'Wariant ramkowy: mały nadtytuł nad tytułem („HOW TO BUILD A…”) do lewej, podpis pod tytułem wyrównany do PRAWEJ krawędzi tytułu.',
    'Treść: miękki geometryczny sans (Be Vietnam Pro 300, ~38 px), duża interlinia 1.5, słowa-klucze pogrubione (700) — bez zmiany koloru.',
    'Numeracja punktów: odręczny skrypt („01.”, Sacramento) nad tytułem sekcji; tytuł sekcji w 2 liniach, treść w wąskiej kolumnie ~50% szerokości po stronie wolnej od postaci.',
    'Cień: miękki, szeroki (blur ~24 px, 45% czerni) — tekst „świeci” na ciemnym zdjęciu bez widocznej obwódki. Na jasnym (mgła, niebo) tekst ciemnozielony #1b2a22 bez cienia.',
    'Pozycja: tekst prawie zawsze w górnej 1/3, marginesy 70–100 px; lista potrafi zaczynać się 15–20 px od krawędzi. Postać w dolnych 2/3 kadru.',
    'Dekoracje: cienka biała odręczna strzałka pod tytułem (prowadzi wzrok do zdjęcia), czerwona pętla-strzałka przy bloku tekstu, wstawione zdjęcie z zaokrągleniem ~30 px.',
    'CTA: wyśrodkowany stos — małe „comment” (grotesk bold), SŁOWO-KLUCZ w szeryfie z cudzysłowami, mała linijka pod spodem.',
  ],
  accent: '#e2463a',
  dark: '#1b2a22',
  chipBg: 'rgba(255,255,255,0.9)',
  chipColor: '#111111',
  chipRadius: 10,
  styles: {
    title: s({ font: 'DM Serif Display', size: 150, weight: 400, lineHeight: 0.92, letterSpacing: -0.015, shadow: 'soft' }),
    subtitle: s({ font: 'Archivo', size: 46, weight: 700, lineHeight: 1.0, letterSpacing: -0.005, uppercase: true, shadow: 'soft' }),
    kicker: s({ font: 'Archivo', size: 38, weight: 700, lineHeight: 1.05, shadow: 'soft' }),
    number: s({ font: 'Sacramento', size: 112, weight: 400, lineHeight: 0.9, shadow: 'subtle' }),
    body: s({ font: 'Be Vietnam Pro', size: 38, weight: 300, boldWeight: 700, lineHeight: 1.5, letterSpacing: 0.01, shadow: 'soft', paragraphGap: 1.1 }),
    list: s({ font: 'Be Vietnam Pro', size: 40, weight: 400, boldWeight: 700, lineHeight: 1.62, shadow: 'soft' }),
    caption: s({ font: 'Archivo', size: 40, weight: 700, align: 'center', lineHeight: 1.2, shadow: 'soft' }),
    cta: s({ font: 'Be Vietnam Pro', size: 38, weight: 300, boldWeight: 700, align: 'center', lineHeight: 1.45, shadow: 'soft' }),
    keyword: s({ font: 'DM Serif Display', size: 112, weight: 400, lineHeight: 0.95, align: 'center', uppercase: true, shadow: 'soft' }),
    note: s({ font: 'Be Vietnam Pro', size: 30, weight: 300, lineHeight: 1.35, shadow: 'soft' }),
    split: s({ font: 'Montserrat', size: 46, weight: 700, align: 'center', lineHeight: 1.18, shadow: 'subtle' }),
    chip: s({ font: 'Be Vietnam Pro', size: 32, weight: 500, color: '#111111', align: 'center', shadow: 'none' }),
  },
}

// ─────────────────────────────────────────────────────────────
// 2. STORY HIGHLIGHT — refs: "most ppl USE AI FOR CONTENT", "It has no idea",
//    "Jovan tried harder…", chips slides, "If ur output sounds like AI…"
// ─────────────────────────────────────────────────────────────
const story: Preset = {
  id: 'story',
  name: 'Story Highlight',
  family: 'story',
  builtin: true,
  description: 'Helvetica/Arial z twardym cieniem, fioletowe wyróżnienia słów, chipy i ciemny gradient u dołu.',
  analysis: [
    'Krój: jeden neutralny grotesk (Arial/Helvetica → Arimo) w dwóch grubościach: 400 i 700. Hierarchię buduje rozmiar i grubość, nie zmiana fontu.',
    'Hook: mały nadtytuł (~48 px) → HASŁO bold w kapitalikach (~88 px, interlinia 1.0) z cienkim fioletowym podkreśleniem pod spodem → mała linijka rozbita na lewo/prawo, żeby ominąć głowę postaci.',
    'Cień: twardy i krótki (offset 2 px, blur ~5 px, 80% czerni) — daje czytelność na jasnych fragmentach zdjęcia.',
    'Wyróżnienia: fioletowy prostokąt (#4b1a6e, zaokr. ~6 px) za kluczową frazą, biały tekst BEZ cienia. Używany jako etykieta nagłówka („It has no idea”) i na końcu zdania.',
    'Treść: 35 px, interlinia 1.32, listy z kropkami, pogrubione słowa-klucze; bloki oddzielone pustą linią. Tekst w górnej części kadru, lewy margines ~75 px.',
    'Chipy: jasnoszare „pigułki” (90% bieli, ciemny tekst, zaokr. ~8 px) ułożone w wyśrodkowanych rzędach z dużymi odstępami (40–50 px).',
    'Dół slajdu: gradient do czerni (≈ dolne 35%) + wyśrodkowany podpis/CTA biały, 36–40 px. Czasem wstawiony zrzut ekranu na środku i fioletowa strzałka.',
  ],
  accent: '#6a2a95',
  dark: '#141414',
  chipBg: 'rgba(236,236,236,0.92)',
  chipColor: '#111111',
  chipRadius: 8,
  styles: {
    title: s({ font: 'Arimo', size: 88, weight: 700, uppercase: true, lineHeight: 1.0, letterSpacing: -0.01, shadow: 'hard', underline: '#6a2a95' }),
    subtitle: s({ font: 'Arimo', size: 36, weight: 400, lineHeight: 1.2, shadow: 'hard' }),
    kicker: s({ font: 'Arimo', size: 48, weight: 400, lineHeight: 1.05, shadow: 'hard' }),
    number: s({ font: 'Arimo', size: 60, weight: 700, lineHeight: 1, shadow: 'hard' }),
    body: s({ font: 'Arimo', size: 35, weight: 400, boldWeight: 700, lineHeight: 1.32, shadow: 'hard', paragraphGap: 1.1 }),
    list: s({ font: 'Arimo', size: 35, weight: 400, boldWeight: 700, lineHeight: 1.32, shadow: 'hard' }),
    caption: s({ font: 'Arimo', size: 38, weight: 700, align: 'center', lineHeight: 1.25, shadow: 'hard' }),
    cta: s({ font: 'Arimo', size: 40, weight: 400, align: 'center', lineHeight: 1.3, shadow: 'hard' }),
    keyword: s({ font: 'Arimo', size: 56, weight: 700, align: 'center', uppercase: true, shadow: 'hard' }),
    note: s({ font: 'Arimo', size: 30, weight: 400, align: 'right', lineHeight: 1.25, shadow: 'hard' }),
    split: s({ font: 'Arimo', size: 46, weight: 700, align: 'center', lineHeight: 1.18, shadow: 'hard' }),
    chip: s({ font: 'Arimo', size: 34, weight: 400, color: '#111111', align: 'center', shadow: 'none' }),
  },
}
for (const k of Object.keys(story.styles) as StyleKey[]) {
  story.styles[k].highlightBg = '#4b1a6e'
  story.styles[k].highlightColor = '#ffffff'
}

// ─────────────────────────────────────────────────────────────
// 3. SPLIT SCREEN — refs: "hashtags? doesn't matter", "views come down to…",
//    "a viewer watches your whole video?", "BUT your explore page…", "comment ZERO"
// ─────────────────────────────────────────────────────────────
const split: Preset = {
  id: 'split',
  name: 'Split Screen',
  family: 'split',
  builtin: true,
  description: 'Dwa zdjęcia 50/50, po jednej linijce Montserrat Bold wyśrodkowanej w każdej połowie.',
  analysis: [
    'Układ: dwa zdjęcia jedno nad drugim, każde 1080×675, bez odstępu i bez ramki — szew dokładnie w połowie.',
    'Tekst: Montserrat 700, ~46 px, małe litery (poza akcentami typu „BUT”, „YOU”), biały, wyśrodkowany, max 2 linie w połowie.',
    'Pozycja: środek optyczny każdej połowy (≈ y 337 i 1012). Górna linia = pytanie/teza, dolna = odpowiedź/puenta — czytane jak dialog.',
    'Strzałka „→” na początku linii jako znak wniosku; znak zapytania kończy tezę.',
    'Cień: ledwo widoczny (1 px / blur 4 px, 35%) — zdjęcia są stonowane, więc czytelność daje kontrast, nie efekt.',
    'CTA: pojedyncze zdjęcie, gradient od dołu, Montserrat 300 z pogrubionymi słowami, krótkie akapity oddzielone pustą linią, wyśrodkowane w dolnej 1/3.',
  ],
  accent: '#ffffff',
  dark: '#161616',
  chipBg: 'rgba(255,255,255,0.92)',
  chipColor: '#111111',
  chipRadius: 10,
  styles: {
    title: s({ font: 'Montserrat', size: 72, weight: 800, align: 'center', lineHeight: 1.05, shadow: 'subtle' }),
    subtitle: s({ font: 'Montserrat', size: 38, weight: 600, align: 'center', lineHeight: 1.2, shadow: 'subtle' }),
    kicker: s({ font: 'Montserrat', size: 34, weight: 400, align: 'center', shadow: 'subtle' }),
    number: s({ font: 'Montserrat', size: 64, weight: 800, align: 'center', shadow: 'subtle' }),
    body: s({ font: 'Montserrat', size: 36, weight: 300, boldWeight: 700, align: 'center', lineHeight: 1.4, shadow: 'subtle', paragraphGap: 1.2 }),
    list: s({ font: 'Montserrat', size: 36, weight: 400, boldWeight: 700, lineHeight: 1.45, shadow: 'subtle' }),
    caption: s({ font: 'Montserrat', size: 42, weight: 700, align: 'center', lineHeight: 1.2, shadow: 'subtle' }),
    cta: s({ font: 'Montserrat', size: 36, weight: 300, boldWeight: 700, align: 'center', lineHeight: 1.4, shadow: 'subtle', paragraphGap: 1.25 }),
    keyword: s({ font: 'Montserrat', size: 60, weight: 800, align: 'center', uppercase: true, shadow: 'subtle' }),
    note: s({ font: 'Montserrat', size: 28, weight: 400, align: 'center', shadow: 'subtle' }),
    split: s({ font: 'Montserrat', size: 46, weight: 700, align: 'center', lineHeight: 1.18, shadow: 'subtle' }),
    chip: s({ font: 'Montserrat', size: 30, weight: 600, color: '#111111', align: 'center', shadow: 'none' }),
  },
}
for (const k of Object.keys(split.styles) as StyleKey[]) {
  split.styles[k].highlightBg = 'rgba(255,255,255,0.92)'
  split.styles[k].highlightColor = '#111111'
}
for (const k of Object.keys(editorial.styles) as StyleKey[]) {
  editorial.styles[k].highlightBg = 'rgba(226,70,58,0.92)'
  editorial.styles[k].highlightColor = '#ffffff'
}

export const BUILTIN_PRESETS: Preset[] = [editorial, story, split]

export const SHADOWS: Record<string, string> = {
  none: 'none',
  subtle: '0 1px 4px rgba(0,0,0,0.38)',
  soft: '0 2px 24px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.25)',
  hard: '0 2px 5px rgba(0,0,0,0.8)',
  glow: '0 0 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)',
}

export const SHADOW_LABELS: Record<string, string> = {
  none: 'Brak',
  subtle: 'Delikatny',
  soft: 'Miękki (szeroki)',
  hard: 'Twardy (krótki)',
  glow: 'Poświata',
}
