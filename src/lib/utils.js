/* ============================================================================
   UTILITIES
   ========================================================================== */

export const qs = (sel, root = document) => root.querySelector(sel)
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))

export const clamp = (v, min = 0, max = 1) => Math.min(Math.max(v, min), max)
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a))
export const mapRange = (v, a1, b1, a2, b2) => lerp(a2, b2, clamp(invLerp(a1, b1, v)))
export const round = (v, p = 3) => Math.round(v * 10 ** p) / 10 ** p
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))

/** Frame-rate independent lerp factor. */
export const smooth = (current, target, ease, dt = 1) =>
  current + (target - current) * (1 - Math.pow(1 - ease, dt * 60))

/** Deterministic PRNG — same visuals on every load. */
export function mulberry32(seed = 1) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const degToRad = (d) => (d * Math.PI) / 180

export function debounce(fn, wait = 160) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export function throttle(fn, wait = 100) {
  let last = 0
  let timer = null
  return (...args) => {
    const now = performance.now()
    const remaining = wait - (now - last)
    if (remaining <= 0) {
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = performance.now()
        timer = null
        fn(...args)
      }, remaining)
    }
  }
}

/* ------------------------------------------------------------ ENVIRONMENT */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const isTouch = () =>
  window.matchMedia('(hover: none), (pointer: coarse)').matches

export const isMobile = () => window.matchMedia('(max-width: 768px)').matches
export const isTablet = () => window.matchMedia('(max-width: 1100px)').matches

/** Coarse device-capability tier used to scale WebGL quality. */
export function deviceTier() {
  const mem = navigator.deviceMemory || 4
  const cores = navigator.hardwareConcurrency || 4
  if (isTouch() && (mem <= 4 || cores <= 4)) return 'low'
  if (mem <= 4 || cores <= 4) return 'mid'
  return 'high'
}

/* ------------------------------------------------------------------- DOM */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'text') node.textContent = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v)
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v === true ? '' : v)
  }
  for (const c of [].concat(children)) {
    if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return node
}

/** Read a numeric data-attribute with a fallback. */
export const dataNum = (node, name, fallback = 0) => {
  const raw = node.dataset[name]
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

/** Pad an index the way architectural sheets number their drawings. */
export const pad = (n, size = 2) => String(n).padStart(size, '0')

/* ---------------------------------------------------------------- STRING */
export const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/* ------------------------------------------------------------------ MISC */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))
export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Split an array into n roughly-equal columns. */
export function chunkColumns(arr, n) {
  const out = Array.from({ length: n }, () => [])
  arr.forEach((item, i) => out[i % n].push(item))
  return out
}
