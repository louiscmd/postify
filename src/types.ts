// Canvas coordinates are Instagram pixels. Both formats are 1080 wide; only the height differs.
export const W = 1080
export const H = 1350 // post 4:5 — the default frame

export type FormatKey = 'post' | 'story'

export const FORMATS: Record<FormatKey, { w: number; h: number; label: string; hint: string; safeTop: number; safeBottom: number }> = {
  post: { w: 1080, h: 1350, label: 'Post 4:5', hint: '1080 × 1350 — karuzela', safeTop: 60, safeBottom: 60 },
  // Instagram's own UI covers the top ~220 px (avatar/name) and bottom ~250 px (reply bar)
  story: { w: 1080, h: 1920, label: 'Story 9:16', hint: '1080 × 1920 — relacja', safeTop: 230, safeBottom: 260 },
}

/** Frame height of a slide (falls back to the 4:5 post for projects made before stories). */
export const slideH = (s?: { h?: number }) => s?.h ?? H

export type FontKey =
  | 'DM Serif Display'
  | 'Gloock'
  | 'Playfair Display'
  | 'Abril Fatface'
  | 'Archivo'
  | 'Inter'
  | 'Arimo'
  | 'Montserrat'
  | 'Be Vietnam Pro'
  | 'Sacramento'
  | 'Caveat'

export type Align = 'left' | 'center' | 'right' | 'justify'
export type ShadowKind = 'none' | 'subtle' | 'soft' | 'hard' | 'glow'
export type Zone = 'top' | 'middle' | 'bottom'
export type Tone = 'light' | 'dark'

export interface TextStyle {
  font: FontKey
  size: number
  weight: number
  boldWeight: number
  color: string
  boldColor: string | null
  align: Align
  lineHeight: number
  letterSpacing: number // em
  uppercase: boolean
  italic: boolean
  shadow: ShadowKind
  highlightBg: string
  highlightColor: string
  underline: string | null // brush underline colour under the whole block
  paragraphGap: number // em
  opacity: number
  /** solid box behind the whole block — story callouts, timestamps, question stickers */
  boxBg?: string | null
  boxRadius?: number
  boxPadX?: number
  boxPadY?: number
}

/** Style slots every preset defines — blocks reference them by key, so switching preset restyles everything. */
export type StyleKey =
  | 'title'
  | 'subtitle'
  | 'kicker'
  | 'number'
  | 'body'
  | 'list'
  | 'caption'
  | 'cta'
  | 'keyword'
  | 'note'
  | 'split'
  | 'chip'

export interface TextBlock {
  id: string
  kind: 'text'
  styleKey: StyleKey
  text: string
  overrides: Partial<TextStyle>
  selfAlign: 'stretch' | 'start' | 'center' | 'end'
  marginTop: number
}

export interface ChipsBlock {
  id: string
  kind: 'chips'
  styleKey: StyleKey
  items: string[]
  overrides: Partial<TextStyle>
  selfAlign: 'stretch' | 'start' | 'center' | 'end'
  marginTop: number
  gapX: number
  gapY: number
}

export type Block = TextBlock | ChipsBlock

/** What a slide does in the carousel — drives how the layout engine arranges it. */
export type Role = 'cover' | 'content' | 'list' | 'statement' | 'split' | 'cta'

export interface StackEl {
  id: string
  type: 'stack'
  /** main text group, bottom caption, or one half of a 50/50 split */
  role?: 'main' | 'caption' | 'top' | 'bottom' | 'callout'
  x: number
  y: number
  w: number
  anchor: 'top' | 'center' | 'bottom'
  rotation: number
  blocks: Block[]
}

export interface ImageEl {
  id: string
  type: 'image'
  x: number
  y: number
  w: number
  h: number
  imageId: string | null
  radius: number
  shadow: boolean
  focusX: number
  focusY: number
  rotation: number
}

export type DoodleKind = 'curl' | 'loop' | 'swoosh' | 'curve' | 'underline' | 'circle' | 'straight'

export interface DoodleEl {
  id: string
  type: 'doodle'
  kind: DoodleKind
  x: number
  y: number
  w: number
  h: number
  color: string
  stroke: number
  rotation: number
  flipX: boolean
  flipY: boolean
}

export type El = StackEl | ImageEl | DoodleEl

export interface BgSlot {
  imageId: string | null
  focusX: number // legacy object-position, kept so old projects still open
  focusY: number
  zoom: number // 1 = fills the frame ("cover"), < 1 = whole photo visible, > 1 = zoomed in
  offsetX?: number // free placement, in canvas px from centred
  offsetY?: number
  blur?: boolean // fill the empty edges with a blurred copy (default on)
}

export interface Overlay {
  top: number // 0..1 gradient from top
  bottom: number // 0..1 gradient from bottom
  dim: number // 0..1 flat darken
}

export interface Slide {
  id: string
  layout: 'single' | 'split'
  slots: BgSlot[]
  bgColor: string
  overlay: Overlay
  elements: El[]
  /** frame height in canvas px — 1350 for a post, 1920 for a story */
  h?: number
  template?: string
  role?: Role
  /** seed of the last random arrangement (re-roll = new seed) */
  seed?: number
}

export interface Project {
  id: string
  name: string
  format?: FormatKey
  /** which story type of the schedule this project follows (stories only) */
  storyType?: string
  presetId: string
  slides: Slide[]
  updatedAt: number
}

export interface ProjectMeta {
  id: string
  name: string
  /** absent on projects saved before stories existed — those are all 4:5 posts */
  format?: FormatKey
  updatedAt: number
  slideCount: number
}

export interface GalleryImage {
  id: string
  name: string
  w: number
  h: number
  type: string
  createdAt: number
  url: string // object URL, runtime only
}

export interface Preset {
  id: string
  name: string
  family: 'editorial' | 'story' | 'split'
  builtin: boolean
  description: string
  analysis: string[]
  accent: string
  dark: string
  chipBg: string
  chipColor: string
  chipRadius: number
  styles: Record<StyleKey, TextStyle>
}

export interface Settings {
  apiKey: string
  model: string
}
