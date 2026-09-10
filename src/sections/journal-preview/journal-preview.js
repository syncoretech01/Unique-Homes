/* ============================================================================
   JOURNAL PREVIEW
   An editorial index of the four most recent notes, ruled with hairlines that
   draw in as the block reveals.

   The signature interaction is a preview card that trails the pointer while a
   row is hovered: x and y ease at different rates so the card lags and swings,
   and the residual pointer velocity feeds a rotation — the flag-in-the-wind
   feel. Row to row, the artwork swaps behind a directional clip wipe rather
   than cutting.

   Coarse pointers and reduced motion get the same index with an inline
   thumbnail and an excerpt on every row, and no cursor work at all.
   ========================================================================== */
import './journal-preview.css'
import { gsap, EASE, sceneTimeline } from '../../core/motion.js'
import { qs, qsa, clamp } from '../../lib/utils.js'
import { plateHTML } from '../../lib/drawings.js'
import { journal } from '../../data/content.js'

/* Each category draws the sheet type that actually belongs to it, so the
   artwork says something about the entry instead of decorating it. */
const KIND_BY_CATEGORY = {
  Documentation: 'detail',
  Civil: 'site',
  Visualisation: 'axon',
  Additions: 'plan',
}
const FALLBACK_KINDS = ['plan', 'section', 'elevation', 'framing']

const ARROW =
  '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">' +
  '<path d="M2 8 8 2M3.4 2H8v4.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/></svg>'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"]/g, (c) => ESCAPES[c])

/* --------------------------------------------------------------- COLOUR */

/** HSL to hex — SVG presentation attributes only take colours every engine
    parses the same way, so the entry's hue is resolved here. */
function hslHex(h, s, l) {
  const sat = clamp(s / 100, 0, 1)
  const lum = clamp(l / 100, 0, 1)
  const a = sat * Math.min(lum, 1 - lum)
  const wrap = (n) => (n + h / 30) % 12
  const channel = (n) => {
    const k = wrap(n)
    const v = lum - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/** Deterministic per-entry seed, so a note draws the same sheet every visit. */
function seedOf(entry, i) {
  const id = String(entry.id || i)
  let s = 7
  for (let n = 0; n < id.length; n += 1) s = (s * 31 + id.charCodeAt(n)) % 9973
  return s + (i + 1) * 13
}

function plateFor(entry, i) {
  const hue = Number.isFinite(entry.hue) ? entry.hue : 24
  return {
    kind: KIND_BY_CATEGORY[entry.category] || FALLBACK_KINDS[i % FALLBACK_KINDS.length],
    a: hslHex(hue, 30, 95),
    b: hslHex(hue, 24, 86),
    ink: hslHex(hue, 46, 24),
    accent: hslHex(hue, 48, 40),
    seed: seedOf(entry, i),
  }
}

/* ----------------------------------------------------------------- ROWS */

function rowHTML(entry, i) {
  return (
    '<li class="journal-preview__item">' +
    `<a class="journal-preview__row" href="/journal/#${esc(entry.id)}" data-jp-row="${i}">` +
    '<span class="journal-preview__rule" aria-hidden="true"></span>' +
    `<span class="journal-preview__idx">${esc(entry.index)}</span>` +
    '<span class="journal-preview__body">' +
    '<span class="journal-preview__thumb" aria-hidden="true"></span>' +
    '<span class="journal-preview__text">' +
    `<span class="journal-preview__entry-title">${esc(entry.title)}</span>` +
    `<span class="journal-preview__excerpt">${esc(entry.excerpt)}</span>` +
    '</span></span>' +
    `<span class="journal-preview__cat">${esc(entry.category)}</span>` +
    '<span class="journal-preview__meta">' +
    `<span>${esc(entry.date)}</span>` +
    '<span class="journal-preview__sep" aria-hidden="true"></span>' +
    `<span>${esc(entry.readTime)}</span>` +
    '</span>' +
    '<span class="journal-preview__read" aria-hidden="true">' +
    `<span class="journal-preview__read-inner">Read${ARROW}</span></span>` +
    '</a></li>'
  )
}

/* ================================================================= INIT  */

export default function initJournalPreview(ctx = {}) {
  const root = document.querySelector('[data-section="journal-preview"]')
  if (!root) return

  const list = qs('[data-journal-list]', root)
  const entries = Array.isArray(journal) ? journal : []
  if (!list || !entries.length) return

  const hoverMode =
    !ctx.touch &&
    !ctx.reduced &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches

  root.classList.add(hoverMode ? 'is-hover' : 'is-static')

  list.innerHTML = entries.map(rowHTML).join('')

  const rows = qsa('.journal-preview__row', list)
  const rules = qsa('.journal-preview__rule', root)

  /* Cached drawing markup — generated once per entry, never mid-interaction. */
  const artCache = new Map()
  const artFor = (entry, i) => {
    if (!artCache.has(entry.id)) {
      artCache.set(
        entry.id,
        plateHTML(plateFor(entry, i), {
          width: 1000,
          height: 800,
          label: entry.category,
          index: entry.index,
          density: 0.85,
          strokeScale: 1.15,
        })
      )
    }
    return artCache.get(entry.id)
  }

  /* ------------------------------------------------- static: thumbnails */
  if (!hoverMode) {
    qsa('.journal-preview__thumb', list).forEach((thumb, i) => {
      const entry = entries[i]
      if (!entry) return
      thumb.innerHTML = plateHTML(plateFor(entry, i), {
        width: 640,
        height: 480,
        showTitleBlock: false,
        density: 0.6,
        strokeScale: 1.9,
      })
    })
  }

  /* ------------------------------------------------------- the entrance */
  if (!ctx.reduced) {
    gsap.set(rules, { scaleX: 0, transformOrigin: 'left center' })
    gsap.set(rows, { y: 26, opacity: 0 })

    sceneTimeline(list, { start: 'top 82%' })
      .to(rules, {
        scaleX: 1,
        duration: 1.05,
        ease: EASE.out,
        stagger: 0.075,
        clearProps: 'transform',
      }, 0)
      .to(rows, {
        y: 0,
        opacity: 1,
        duration: 0.95,
        ease: EASE.out,
        stagger: 0.075,
        clearProps: 'opacity,transform',
      }, 0.08)
  }

  if (!hoverMode) return

  /* ==================================================== THE HOVER REVEAL */

  const card = qs('[data-journal-card]', root)
  const layers = qsa('[data-journal-art]', card || root)
  const catOut = qs('[data-journal-card-cat]', root)
  const timeOut = qs('[data-journal-card-time]', root)
  if (!card || layers.length < 2) return

  gsap.set(card, {
    xPercent: -50,
    yPercent: -50,
    scale: 0.8,
    opacity: 0,
    rotation: 0,
    transformOrigin: '50% 22%',
  })
  gsap.set(layers, { opacity: 0 })

  /* y is the slower of the two, so the card trails and banks through a
     direction change instead of tracking the pointer rigidly. */
  const xTo = gsap.quickTo(card, 'x', { duration: 0.5, ease: 'power3' })
  const yTo = gsap.quickTo(card, 'y', { duration: 0.72, ease: 'power2' })
  const rotTo = gsap.quickTo(card, 'rotation', { duration: 0.68, ease: 'power3' })

  const size = { w: 0, h: 0, vw: 0, vh: 0 }
  const measure = () => {
    const doc = document.documentElement
    size.w = card.offsetWidth
    size.h = card.offsetHeight
    // clientWidth excludes the scrollbar gutter, so the card can never be
    // parked underneath it.
    size.vw = doc.clientWidth || window.innerWidth
    size.vh = doc.clientHeight || window.innerHeight
  }
  measure()

  /** Keep the whole card on screen — it must never invent a scrollbar. */
  function place(x, y, snap) {
    const hw = size.w * 0.5 + 14
    const hh = size.h * 0.5 + 14
    const cx = clamp(x, hw, Math.max(hw, size.vw - hw))
    const cy = clamp(y, hh, Math.max(hh, size.vh - hh))
    if (snap) {
      xTo(cx, cx)
      yTo(cy, cy)
    } else {
      xTo(cx)
      yTo(cy)
    }
  }

  let front = 0
  let open = false
  let activeRow = null
  let activeIndex = -1
  let revealTween = null
  let lastX = 0
  let lastY = 0
  let velX = 0
  let ticking = false

  /* Residual pointer velocity decays every frame, so the card settles level
     the moment the pointer stops rather than hanging at an angle. */
  const tick = () => {
    velX *= 0.86
    rotTo(clamp(velX * 0.9, -15, 15))
  }
  const startTick = () => {
    if (ticking) return
    ticking = true
    gsap.ticker.add(tick)
  }
  const stopTick = () => {
    if (!ticking) return
    ticking = false
    gsap.ticker.remove(tick)
  }

  function paint(layer, entry, i) {
    if (layer.dataset.jpArt === entry.id) return
    layer.dataset.jpArt = entry.id
    layer.innerHTML = artFor(entry, i)
  }

  function openCard(entry, i, x, y) {
    open = true
    measure()
    lastX = x
    lastY = y
    velX = 0
    front = 0
    gsap.killTweensOf(layers)
    paint(layers[0], entry, i)
    gsap.set(layers[0], { opacity: 1, scale: 1, zIndex: 2, clipPath: 'inset(0% 0% 0% 0%)' })
    gsap.set(layers[1], { opacity: 0, zIndex: 1 })
    place(x, y, true)
    rotTo(0, 0)
    startTick()

    if (revealTween) revealTween.kill()
    revealTween = gsap.fromTo(
      card,
      { scale: 0.8, opacity: 0, clipPath: 'inset(100% 0% 0% 0%)' },
      {
        scale: 1,
        opacity: 1,
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.66,
        ease: EASE.out,
      }
    )
  }

  /** Swap the artwork behind a clip wipe that travels the way the pointer is
      moving down the index. Any in-flight swap is dropped first, so a fast
      run through the rows can never leave a layer stranded. */
  function swapArt(entry, i, direction) {
    gsap.killTweensOf(layers)
    const incoming = layers[1 - front]
    const outgoing = layers[front]
    paint(incoming, entry, i)
    front = 1 - front

    gsap.set(incoming, {
      opacity: 1,
      scale: 1,
      zIndex: 2,
      clipPath: direction >= 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)',
    })
    gsap.set(outgoing, { zIndex: 1 })

    gsap.to(incoming, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.42, ease: EASE.swift })
    gsap.to(outgoing, {
      scale: 1.07,
      duration: 0.55,
      ease: EASE.out,
      onComplete: () => gsap.set(outgoing, { opacity: 0, scale: 1 }),
    })
  }

  function closeCard() {
    if (!open) return
    open = false
    stopTick()
    if (revealTween) revealTween.kill()
    revealTween = gsap.to(card, {
      scale: 0.82,
      opacity: 0,
      duration: 0.38,
      ease: EASE.swift,
      onComplete: () => rotTo(0, 0),
    })
  }

  function setActive(rowEl, x, y) {
    const i = Number(rowEl.dataset.jpRow)
    const entry = entries[i]
    if (!entry) return

    const previous = activeIndex
    if (activeRow) activeRow.classList.remove('is-hovered')
    activeRow = rowEl
    activeIndex = i
    rowEl.classList.add('is-hovered')
    list.classList.add('is-active')

    if (catOut) catOut.textContent = entry.category
    if (timeOut) timeOut.textContent = entry.readTime

    if (!open) openCard(entry, i, x, y)
    else swapArt(entry, i, i >= previous ? 1 : -1)
  }

  function release() {
    if (activeRow) activeRow.classList.remove('is-hovered')
    activeRow = null
    activeIndex = -1
    list.classList.remove('is-active')
    closeCard()
  }

  /* --------------------------------------------------------- listeners */

  const rowUnder = (target) =>
    target instanceof Element ? target.closest('.journal-preview__row') : null

  list.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return
    const rowEl = rowUnder(e.target)
    if (!rowEl || rowEl === activeRow) return
    setActive(rowEl, e.clientX, e.clientY)
  })

  list.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return

    // The pointer can already be resting on a row when the list scrolls into
    // place — no pointerover ever fires for that, so pick it up here.
    if (!open) {
      const rowEl = rowUnder(e.target)
      if (rowEl) setActive(rowEl, e.clientX, e.clientY)
      return
    }

    const dx = e.clientX - lastX
    lastX = e.clientX
    lastY = e.clientY
    velX = velX * 0.7 + dx * 0.3
    place(e.clientX, e.clientY, false)
  }, { passive: true })

  list.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return
    release()
  })
  list.addEventListener('pointercancel', release)
  window.addEventListener('blur', release)

  window.addEventListener('resize', () => {
    measure()
    if (open) place(lastX, lastY, true)
  }, { passive: true })

  /* Warm the four drawings once the browser is idle, so the first hover of
     the session is as cheap as every one after it. */
  const warm = () => entries.forEach((entry, i) => artFor(entry, i))
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 2600 })
  } else {
    window.setTimeout(warm, 1200)
  }
}
