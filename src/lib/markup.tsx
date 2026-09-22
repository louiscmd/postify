import type { CSSProperties, ReactNode } from 'react'
import type { TextStyle } from '../types'

/**
 * Tiny markup used everywhere (editor + AI):
 *   **bold**        → bold weight
 *   ==highlight==   → coloured box behind words
 *   - item / • item → bullet
 *   blank line      → paragraph gap
 *   left || right   → split one line to both edges (text flows around a head)
 */
type Tok = { t: string; b: boolean; h: boolean }

export const tokenize = (line: string): Tok[] => {
  const out: Tok[] = []
  let b = false
  let h = false
  let buf = ''
  const flush = () => {
    if (buf) out.push({ t: buf, b, h })
    buf = ''
  }
  for (let i = 0; i < line.length; i++) {
    const two = line.slice(i, i + 2)
    if (two === '**') {
      flush()
      b = !b
      i++
    } else if (two === '==') {
      flush()
      h = !h
      i++
    } else buf += line[i]
  }
  flush()
  return out
}

const Inline = ({ line, st }: { line: string; st: TextStyle }) => (
  <>
    {tokenize(line).map((tok, i) => {
      const css: CSSProperties = {}
      if (tok.b) {
        css.fontWeight = st.boldWeight
        if (st.boldColor) css.color = st.boldColor
      }
      if (tok.h) {
        css.background = st.highlightBg
        css.color = st.highlightColor
        css.padding = '0.03em 0.2em 0.06em'
        css.borderRadius = '0.18em'
        css.textShadow = 'none'
        css.boxDecorationBreak = 'clone'
        css.WebkitBoxDecorationBreak = 'clone'
      }
      return (
        <span key={i} style={css}>
          {tok.t}
        </span>
      )
    })}
  </>
)

export const RichText = ({ text, st }: { text: string; st: TextStyle }) => {
  const paragraphs = text.replace(/\r/g, '').split(/\n\s*\n/)
  const nodes: ReactNode[] = []
  paragraphs.forEach((p, pi) => {
    const lines = p.split('\n')
    lines.forEach((line, li) => {
      const key = `${pi}-${li}`
      const mt = pi > 0 && li === 0 ? `${st.paragraphGap}em` : undefined
      const bullet = /^\s*[-•]\s+/.test(line)
      const clean = line.replace(/^\s*[-•]\s+/, '')
      if (bullet) {
        nodes.push(
          <div key={key} style={{ position: 'relative', paddingLeft: '1.35em', marginTop: mt, textAlign: st.align === 'justify' ? 'left' : st.align }}>
            <span style={{ position: 'absolute', left: '0.3em', top: 0 }}>•</span>
            <Inline line={clean} st={st} />
          </div>,
        )
      } else if (line.includes('||')) {
        const parts = line.split('||')
        nodes.push(
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1em', marginTop: mt }}>
            {parts.map((part, i) => (
              <span key={i}>
                <Inline line={part.trim()} st={st} />
              </span>
            ))}
          </div>,
        )
      } else {
        nodes.push(
          <div
            key={key}
            style={{
              marginTop: mt,
              textAlignLast: st.align === 'justify' && li === lines.length - 1 ? 'left' : undefined,
              minHeight: line.trim() ? undefined : '1em',
            }}
          >
            <Inline line={line} st={st} />
          </div>,
        )
      }
    })
  })
  return <>{nodes}</>
}

export const stripMarkup = (s: string) => s.replace(/\*\*|==|\|\|/g, '').replace(/^\s*[-•]\s+/gm, '')
