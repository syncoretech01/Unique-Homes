/* ============================================================================
   CUSTOM CURSOR
   A two-layer pointer: a small solid dot that tracks almost 1:1, and an eased
   outline ring that morphs into whatever intent the element under the pointer
   declares through `data-cursor`.

     data-cursor="link"      ring shrinks, dot grows
     data-cursor="view"      ring becomes a filled accent disc labelled 'View'
     data-cursor="drag"      ring expands with left/right arrows + 'Drag'
     data-cursor="explore"   ring expands around a '+' glyph
     data-cursor="text"      ring becomes a thin vertical I-beam
     data-cursor="hide"      both layers fade out

     data-cursor-text="Open project"   overrides the label
     data-cursor-stick[="14"]          magnetic snap: the ring eases to the
                                       element centre and takes its rounded-
                                       rect shape (optional value = padding)

   Rules of the rig:
   · one delegated pointerover listener — sections render markup after boot;
   · every per-frame write is a gsap.quickTo on transform, never gsap.to;
   · state changes tween SVG rect geometry, so the hairline never distorts;
   · colour lives in cursor.css as tokens — nothing is hardcoded here.
   ========================================================================== */
import './cursor.css'
import { gsap, EASE, DUR } from './motion.js'
import { throttle } from '../lib/utils.js'

/* The SVG viewBox is 1:1 with pixels; every shape is drawn centred on C,C. */
const C = 160
const STICK_PAD = 11

/** w/h/rx = ring rect in px · fill/stroke = rect opacities · dot/trail = scale + alpha */
const SHAPES = {
  default: { w: 40, h: 40, rx: 20, fill: 0, stroke: 1, dot: 1, trail: 1 },
  link: { w: 22, h: 22, rx: 11, fill: 0, stroke: 1, dot: 1.95, trail: 0.5 },
  view: { w: 108, h: 108, rx: 54, fill: 1, stroke: 0, dot: 0, trail: 0 },
  drag: { w: 116, h: 116, rx: 58, fill: 0, stroke: 1, dot: 0, trail: 0 },
  explore: { w: 78, h: 78, rx: 39, fill: 0, stroke: 1, dot: 0, trail: 0.3 },
  text: { w: 2, h: 30, rx: 1, fill: 1, stroke: 0, dot: 0, trail: 0 },
  hide: { w: 40, h: 40, rx: 20, fill: 0, stroke: 0, dot: 0, trail: 0 },
}

const LABELS = { view: 'View', drag: 'Drag' }

/* Elements that read as interactive even without an explicit declaration. */
const INTERACTIVE = 'a[href], button, [role="button"], summary, label[for], .btn, .btn-circle'
const EDITABLE =
  'textarea, [contenteditable="true"], input:not([type="button"]):not([type="submit"])' +
  ':not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"])' +
  ':not([type="color"]):not([type="file"])'

const MARKUP = `
<div class="uhd-cursor__trail"></div>
<div class="uhd-cursor__ring">
  <svg class="uhd-cursor__svg" viewBox="0 0 320 320" width="320" height="320" focusable="false">
    <rect class="uhd-cursor__rect" x="140" y="140" width="40" height="40" rx="20" />
  </svg>
  <span class="uhd-cursor__arrow uhd-cursor__arrow--l"><svg viewBox="0 0 24 24"><path d="M15 4.5 7.5 12 15 19.5" /></svg></span>
  <span class="uhd-cursor__arrow uhd-cursor__arrow--r"><svg viewBox="0 0 24 24"><path d="M9 4.5 16.5 12 9 19.5" /></svg></span>
  <span class="uhd-cursor__glyph"><svg viewBox="0 0 24 24"><path d="M12 4.5v15M4.5 12h15" /></svg></span>
  <span class="uhd-cursor__label"></span>
</div>
<div class="uhd-cursor__dot"></div>`

let instance = null

/**
 * Boot the custom cursor. app.js only calls this on fine-pointer,
 * non-reduced-motion devices — we re-check anyway so the module is safe to
 * call from anywhere.
 *
 * @param {object} ctx boot context — { reduced, touch, ... }
 * @returns {{ destroy(): void, setState(state: string, text?: string): void, refresh(): void } | null}
 */
export function initCursor(ctx = {}) {
  if (instance) return instance
  if (typeof window === 'undefined' || !document.body) return null
  if (ctx.reduced || ctx.touch) return null

  const fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (!fineMQ.matches || reducedMQ.matches) return null

  const html = document.documentElement

  /* ------------------------------------------------------------------ DOM */
  const root = document.createElement('div')
  root.className = 'uhd-cursor'
  root.setAttribute('aria-hidden', 'true')
  root.dataset.state = 'default'
  root.innerHTML = MARKUP
  document.body.appendChild(root)

  const trail = root.querySelector('.uhd-cursor__trail')
  const ring = root.querySelector('.uhd-cursor__ring')
  const rect = root.querySelector('.uhd-cursor__rect')
  const label = root.querySelector('.uhd-cursor__label')
  const dot = root.querySelector('.uhd-cursor__dot')

  html.classList.add('has-custom-cursor')

  /* ---------------------------------------------------------------- STATE */
  let alive = true
  let shown = false
  let hasPointer = false
  let inWindow = true
  let locked = html.classList.contains('is-scroll-locked')
  let state = 'default'
  let labelText = ''
  let pressed = false
  let px = -400
  let py = -400

  let stickEl = null
  const stick = { x: 0, y: 0, w: 0, h: 0, rx: 0, pad: STICK_PAD }

  let morphTween = null
  let paintTween = null
  let dotTween = null
  let trailTween = null
  let pressTween = null
  let fadeTween = null

  /* ------------------------------------------------------------- MOVEMENT */
  gsap.set([trail, ring, dot], { x: px, y: py, force3D: true })
  gsap.set(root, { autoAlpha: 0 })

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.085, ease: 'power3' })
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.085, ease: 'power3' })
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3' })
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3' })
  const trailX = gsap.quickTo(trail, 'x', { duration: 0.85, ease: 'power2' })
  const trailY = gsap.quickTo(trail, 'y', { duration: 0.85, ease: 'power2' })

  /* ------------------------------------------------------------ VISIBILITY */
  function syncVisibility() {
    const should = alive && hasPointer && inWindow && !locked && state !== 'hide'
    if (should === shown) return
    shown = should
    fadeTween?.kill()
    fadeTween = gsap.to(root, {
      autoAlpha: should ? 1 : 0,
      duration: should ? 0.4 : 0.24,
      ease: EASE.out,
    })
  }

  /* ----------------------------------------------------------------- SHAPE */
  function morph(w, h, rx, duration = DUR.base) {
    morphTween?.kill()
    morphTween = gsap.to(rect, {
      attr: {
        x: C - w / 2,
        y: C - h / 2,
        width: Math.max(w, 0.01),
        height: Math.max(h, 0.01),
        rx: Math.max(rx, 0),
      },
      duration,
      ease: EASE.out,
    })
    root.style.setProperty('--uhd-arrow-x', `${(w / 2 - 16).toFixed(1)}px`)
  }

  function paint(shape) {
    paintTween?.kill()
    paintTween = gsap.to(rect, {
      fillOpacity: shape.fill,
      strokeOpacity: shape.stroke,
      duration: DUR.fast,
      ease: EASE.soft,
    })

    dotTween?.kill()
    dotTween = gsap.to(dot, {
      scale: shape.dot || 0.001,
      opacity: shape.dot ? 1 : 0,
      duration: DUR.fast,
      ease: EASE.out,
    })

    trailTween?.kill()
    trailTween = gsap.to(trail, {
      opacity: shape.trail * 0.85,
      duration: DUR.base,
      ease: EASE.out,
    })
  }

  /** Ring geometry for the current state, widened to fit a label if needed. */
  function geometry() {
    if (stickEl) {
      return { w: stick.w + stick.pad * 2, h: stick.h + stick.pad * 2, rx: stick.rx }
    }
    const shape = SHAPES[state] || SHAPES.default
    let { w, rx } = shape
    const h = shape.h
    if (labelText) {
      const need = label.offsetWidth + 52
      if (need > w) {
        w = need
        rx = Math.min(rx, h / 2)
      }
    }
    return { w, h, rx }
  }

  function render(duration) {
    const shape = SHAPES[state] || SHAPES.default
    const { w, h, rx } = geometry()
    morph(w, h, rx, duration)
    paint(shape)
  }

  /* ---------------------------------------------------------------- STATES */
  function setState(next, text = '') {
    const key = Object.prototype.hasOwnProperty.call(SHAPES, next) ? next : 'default'
    const wanted = key === 'text' || key === 'hide' ? '' : text || LABELS[key] || ''
    if (key === state && wanted === labelText) return
    state = key
    labelText = wanted
    root.dataset.state = key
    label.textContent = labelText
    root.classList.toggle('has-label', !!labelText)
    render()
    syncVisibility()
  }

  /* --------------------------------------------------------------- MAGNETS */
  function radiusOf(node, w, h) {
    const max = Math.min(w, h) / 2
    let raw = '0'
    try {
      raw = window.getComputedStyle(node).borderTopLeftRadius || '0'
    } catch (err) {
      raw = '0'
    }
    if (raw.indexOf('%') > -1) return max
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) return 0
    return Math.min(n + stick.pad * 0.5, max)
  }

  function measureStick(force) {
    if (!stickEl) return
    const r = stickEl.getBoundingClientRect()
    const resized = Math.abs(r.width - stick.w) > 1 || Math.abs(r.height - stick.h) > 1
    stick.w = r.width
    stick.h = r.height
    stick.x = r.left + r.width / 2
    stick.y = r.top + r.height / 2
    if (resized || force) {
      stick.rx = radiusOf(stickEl, stick.w, stick.h)
      render()
    }
    ringX(stick.x)
    ringY(stick.y)
  }

  /* One rect read per frame, for one element, only while a magnet is held —
     the element travels with the smooth scroll, so it must be re-measured. */
  function stickTick() {
    if (!stickEl) return
    if (!stickEl.isConnected) {
      leaveStick()
      return
    }
    measureStick(false)
  }

  function enterStick(node, pad) {
    if (stickEl === node) return
    if (stickEl) gsap.ticker.remove(stickTick)
    stickEl = node
    stick.pad = Number.isFinite(pad) ? pad : STICK_PAD
    stick.w = 0
    stick.h = 0
    measureStick(true)
    gsap.ticker.add(stickTick)
  }

  function leaveStick() {
    if (!stickEl) return
    gsap.ticker.remove(stickTick)
    stickEl = null
    ringX(px)
    ringY(py)
    render()
  }

  /* ---------------------------------------------------------------- INTENT */
  function resolve(node) {
    const out = { state: 'default', text: '', stick: null, pad: STICK_PAD }
    if (!node || node.nodeType !== 1 || typeof node.closest !== 'function') return out

    const declared = node.closest('[data-cursor]')
    if (declared) {
      out.state = (declared.dataset.cursor || '').trim() || 'default'
    } else if (node.closest(EDITABLE)) {
      out.state = 'text'
    } else if (node.closest(INTERACTIVE)) {
      out.state = 'link'
    }

    const labelled = node.closest('[data-cursor-text]')
    if (labelled) out.text = (labelled.dataset.cursorText || '').trim()

    const magnet = node.closest('[data-cursor-stick]')
    if (magnet && out.state !== 'hide' && out.state !== 'text') {
      out.stick = magnet
      out.pad = parseFloat(magnet.dataset.cursorStick)
    }
    return out
  }

  function applyFrom(node) {
    if (!alive) return
    const ink = !!(node && typeof node.closest === 'function' && node.closest('[data-theme="ink"]'))
    root.classList.toggle('is-ink', ink)
    const intent = resolve(node)
    if (intent.stick) enterStick(intent.stick, intent.pad)
    else leaveStick()
    setState(intent.state, intent.text)
  }

  /* -------------------------------------------------------------- HANDLERS */
  function onMove(e) {
    if (e.pointerType === 'touch') {
      destroy()
      return
    }
    px = e.clientX
    py = e.clientY
    // First sighting: place the rig, then ease from there — never fly in.
    if (!hasPointer) {
      hasPointer = true
      inWindow = true
      gsap.set([trail, ring, dot], { x: px, y: py })
      applyFrom(document.elementFromPoint(px, py) || e.target)
      syncVisibility()
    }
    dotX(px)
    dotY(py)
    trailX(px)
    trailY(py)
    if (!stickEl) {
      ringX(px)
      ringY(py)
    }
  }

  function onOver(e) {
    if (!inWindow) {
      inWindow = true
      syncVisibility()
    }
    applyFrom(e.target)
  }

  function onOut(e) {
    if (e.relatedTarget) return
    inWindow = false
    press(false)
    syncVisibility()
  }

  function press(down) {
    if (pressed === down) return
    pressed = down
    root.classList.toggle('is-press', down)
    pressTween?.kill()
    pressTween = gsap.to(ring, {
      scale: down ? 0.84 : 1,
      duration: down ? 0.24 : 0.46,
      ease: down ? EASE.soft : EASE.back,
    })
  }

  function onDown(e) {
    if (e.pointerType === 'touch') {
      destroy()
      return
    }
    press(true)
  }

  function onUp() {
    press(false)
  }

  function onBlur() {
    inWindow = false
    press(false)
    syncVisibility()
  }

  /* Scrolling moves the page under a still pointer, so re-hit-test the intent
     and the theme on a throttle rather than trusting boundary events alone. */
  const onScroll = throttle(() => {
    if (!alive || !hasPointer || !inWindow || locked) return
    applyFrom(document.elementFromPoint(px, py))
  }, 140)

  const onResize = throttle(() => {
    if (!alive) return
    if (stickEl) measureStick(true)
    else render(DUR.fast)
  }, 200)

  const observer = new MutationObserver(() => {
    const next = html.classList.contains('is-scroll-locked')
    if (next === locked) return
    locked = next
    if (locked) press(false)
    syncVisibility()
  })
  observer.observe(html, { attributes: true, attributeFilter: ['class'] })

  function onEnvChange() {
    if (!fineMQ.matches || reducedMQ.matches) destroy()
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerover', onOver, { passive: true })
  document.addEventListener('pointerout', onOut, { passive: true })
  document.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('pointerup', onUp, { passive: true })
  document.addEventListener('pointercancel', onUp, { passive: true })
  document.addEventListener('dragstart', onBlur, { passive: true })
  window.addEventListener('blur', onBlur)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  fineMQ.addEventListener('change', onEnvChange)
  reducedMQ.addEventListener('change', onEnvChange)

  /* -------------------------------------------------------------- TEARDOWN */
  function destroy() {
    if (!alive) return
    alive = false
    observer.disconnect()
    gsap.ticker.remove(stickTick)
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerover', onOver)
    document.removeEventListener('pointerout', onOut)
    document.removeEventListener('pointerdown', onDown)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onUp)
    document.removeEventListener('dragstart', onBlur)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    fineMQ.removeEventListener('change', onEnvChange)
    reducedMQ.removeEventListener('change', onEnvChange)
    const tweens = [morphTween, paintTween, dotTween, trailTween, pressTween, fadeTween]
    for (const tween of tweens) tween?.kill()
    gsap.killTweensOf([root, ring, dot, trail, rect])
    stickEl = null
    html.classList.remove('has-custom-cursor')
    root.remove()
    instance = null
  }

  render(DUR.fast)

  instance = {
    destroy,
    /** Force a state from outside — menus and overlays use this. */
    setState: (next, text = '') => setState(next, text),
    /** Re-measure after a layout change no listener caught. */
    refresh: () => (stickEl ? measureStick(true) : render(DUR.fast)),
  }
  return instance
}

/** The live cursor controller, or null when the rig is not running. */
export const getCursor = () => instance
