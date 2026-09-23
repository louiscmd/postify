import { useEffect, useState, type ReactNode } from 'react'

/** True on phone-width screens. */
export function useNarrow() {
  const [n, setN] = useState(() => window.matchMedia('(max-width: 860px)').matches)
  useEffect(() => {
    const q = window.matchMedia('(max-width: 860px)')
    const on = () => setN(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return n
}

/**
 * A section that folds away. On a phone everything starts folded except the section
 * marked `openOnMobile`, so a panel is a short list of headings instead of a wall of controls.
 */
export function Fold({
  title,
  children,
  right,
  openOnMobile = false,
  badge,
}: {
  title: ReactNode
  children: ReactNode
  right?: ReactNode
  openOnMobile?: boolean
  badge?: ReactNode
}) {
  const narrow = useNarrow()
  const [open, setOpen] = useState(!narrow || openOnMobile)
  useEffect(() => setOpen(!narrow || openOnMobile), [narrow, openOnMobile])
  return (
    <div className={`fold ${open ? 'open' : ''}`}>
      <button className="fold-head" onClick={() => setOpen((v) => !v)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        <span className="grow">{title}</span>
        {badge}
      </button>
      {open && (
        <div className="fold-body">
          {right && <div style={{ marginBottom: 8 }}>{right}</div>}
          {children}
        </div>
      )}
    </div>
  )
}
