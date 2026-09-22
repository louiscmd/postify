export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)

/**
 * API keys go into an HTTP header, which only accepts plain ASCII. Copying from web pages or chat apps
 * often drags in invisible characters (zero-width spaces, non-breaking spaces, curly quotes, "…").
 * Keep only printable ASCII.
 */
export const cleanApiKey = (s: string) => s.replace(/[^\x21-\x7E]/g, '')

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...a: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
}

export const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })

/** Parse any CSS colour into [r,g,b] 0..255 using a canvas. */
export const parseColor = (c: string): [number, number, number] => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillStyle = c
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2]]
}

const lin = (v: number) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
export const relLum = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
export const contrast = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
