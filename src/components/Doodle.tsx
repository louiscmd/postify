import type { DoodleKind } from '../types'

// Hand-drawn strokes in a 100×100 box. Arrowheads are separate short strokes so they read as "drawn".
export const DOODLES: Record<DoodleKind, { label: string; d: string }> = {
  curl: { label: 'Strzałka w dół (cienka)', d: 'M18 4 C 40 16, 78 30, 80 58 C 82 78, 66 90, 42 90 M42 90 L 56 80 M42 90 L 55 99' },
  loop: { label: 'Pętla (czerwona)', d: 'M40 2 C 52 14, 70 24, 64 40 C 58 54, 36 50, 42 38 C 48 26, 70 36, 62 58 C 56 74, 50 84, 46 96 M46 96 L 36 82 M46 96 L 58 85' },
  swoosh: { label: 'Zawijas w górę', d: 'M4 30 C 14 70, 56 78, 92 30 M92 30 L 76 32 M92 30 L 92 46' },
  curve: { label: 'Łuk w dół', d: 'M8 8 C 56 6, 84 34, 80 88 M80 88 L 68 74 M80 88 L 93 76' },
  straight: { label: 'Prosta strzałka', d: 'M8 50 L 90 50 M90 50 L 76 38 M90 50 L 76 62' },
  underline: { label: 'Podkreślenie', d: 'M3 58 C 28 48, 68 46, 97 54' },
  circle: { label: 'Obwódka', d: 'M52 8 C 20 6, 4 30, 8 54 C 12 82, 50 94, 78 84 C 98 74, 98 36, 76 18 C 62 8, 40 10, 30 16' },
}

export const Doodle = ({ kind, color, stroke }: { kind: DoodleKind; color: string; stroke: number }) => (
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}>
    <path
      d={DOODLES[kind].d}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
)
