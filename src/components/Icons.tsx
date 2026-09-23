import type { ReactNode } from 'react'

const I = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

type P = { size?: number }
export const Sparkles = (p: P) => <I {...p}><path d="M12 3l1.8 4.9L19 10l-5.2 2.1L12 17l-1.8-4.9L5 10l5.2-2.1z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></I>
export const Hand = (p: P) => <I {...p}><path d="M18 11V6a2 2 0 0 0-4 0v5" /><path d="M14 10V4a2 2 0 0 0-4 0v6" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" /></I>
export const ImageIcon = (p: P) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></I>
export const Layout = (p: P) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></I>
export const Undo = (p: P) => <I {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></I>
export const Redo = (p: P) => <I {...p}><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></I>
export const Download = (p: P) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></I>
export const Folder = (p: P) => <I {...p}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" /></I>
export const Palette = (p: P) => <I {...p}><circle cx="13.5" cy="6.5" r="1" /><circle cx="17.5" cy="10.5" r="1" /><circle cx="8.5" cy="7.5" r="1" /><circle cx="6.5" cy="12.5" r="1" /><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9z" /></I>
export const Gear = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>
export const Plus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>
export const Copy = (p: P) => <I {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></I>
export const Trash = (p: P) => <I {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></I>
export const Up = (p: P) => <I {...p}><path d="M18 15l-6-6-6 6" /></I>
export const Down = (p: P) => <I {...p}><path d="M6 9l6 6 6-6" /></I>
export const Left = (p: P) => <I {...p}><path d="M15 18l-6-6 6-6" /></I>
export const Right = (p: P) => <I {...p}><path d="M9 18l6-6-6-6" /></I>
export const X = (p: P) => <I {...p}><path d="M18 6L6 18M6 6l12 12" /></I>
export const Bulb = (p: P) => <I {...p}><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></I>
export const Grid = (p: P) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></I>
export const Type = (p: P) => <I {...p}><path d="M4 7V4h16v3M9 20h6M12 4v16" /></I>
export const Arrow = (p: P) => <I {...p}><path d="M4 6c6 0 12 3 12 12" /><path d="M11 15l5 4 4-5" /></I>
export const Check = (p: P) => <I {...p}><path d="M20 6L9 17l-5-5" /></I>
export const Upload = (p: P) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></I>
export const Send = (p: P) => <I {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></I>
export const Pill = (p: P) => <I {...p}><rect x="2" y="8" width="9" height="8" rx="4" /><rect x="13" y="8" width="9" height="8" rx="4" /></I>
export const Split = (p: P) => <I {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 12h16" /></I>
export const Square = (p: P) => <I {...p}><rect x="4" y="3" width="16" height="18" rx="2" /></I>
export const Wand = (p: P) => <I {...p}><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4" /><path d="M3 21l9-9" /></I>
export const Reset = (p: P) => <I {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></I>
export const Story = (p: P) => <I {...p}><rect x="7" y="2" width="10" height="20" rx="3" /><path d="M3 8v8M21 8v8" /></I>
