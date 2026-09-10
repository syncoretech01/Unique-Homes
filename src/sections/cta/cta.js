/* ============================================================================
   CTA — closing call to action

   Behaviour:
     · headline, lede and contact register are written from src/data/site.js so
       the markup fallback can never drift from the data layer
     · a circular type ring is laid out character-by-character around the
       magnetic action button and rotates continuously
     · hovering the button accelerates the ring and draws its arrow glyph
     · the headline block drifts a few pixels with the pointer on desktop

   Entrances, the background parallax and the contact stagger are declared in
   the markup and handled by src/core/reveal.js.
   ========================================================================== */
import './cta.css'
import { gsap, ScrollTrigger, EASE, mm } from '../../core/motion.js'
import { qs } from '../../lib/utils.js'
import { drawingSVG, grainDataURI } from '../../lib/drawings.js'
import { cta, contact } from '../../data/site.js'

/* The ring reads as a rotating stamp: the offer, then what is in the box. */
const RING_TEXT = 'START A PROJECT · ARCHITECTURE · ENGINEERING · VISUALISATION · '

/* The single word in the headline that carries the italic accent. */
const ACCENT_WORD = 'draw'

const POINTER_QUERY =
  '(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

/* ------------------------------------------------------------------------ */
/*  HELPERS                                                                  */
/* ------------------------------------------------------------------------ */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Wrap the first occurrence of `word` in an <em>, which typography.css
 *  renders as the italic terracotta accent inside display headings. */
function emphasise(line, word) {
  const at = line.toLowerCase().indexOf(word.toLowerCase())
  if (at < 0) return esc(line)
  return (
    esc(line.slice(0, at)) +
    '<em>' + esc(line.slice(at, at + word.length)) + '</em>' +
    esc(line.slice(at + word.length))
  )
}

/** `cta.title` carries a newline — render it as two hard-broken display lines. */
function titleHTML(raw) {
  const lines = String(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return ''
  return lines.map((line, i) => (i === 0 ? emphasise(line, ACCENT_WORD) : esc(line))).join('<br>')
}

/** "Start a project" → "Start" over "a project", so it sits inside the disc. */
function circleLabelHTML(label) {
  const words = String(label).trim().split(/\s+/)
  if (words.length < 2) return esc(label)
  return esc(words[0]) + '<br>' + esc(words.slice(1).join(' '))
}

/* ------------------------------------------------------------------------ */
/*  BACKDROP                                                                 */
/* ------------------------------------------------------------------------ */

function paintBackdrop(root) {
  const art = qs('.cta__bg-art', root)
  if (art && !art.firstElementChild) {
    art.innerHTML = drawingSVG('grid', {
      seed: 24,
      width: 1600,
      height: 1000,
      density: 0.8,
      strokeScale: 1.15,
      showTitleBlock: false,
    })
  }

  const grain = qs('.cta__grain', root)
  if (grain) grain.style.backgroundImage = `url("${grainDataURI(128, 0.3, 11)}")`
}

/* ------------------------------------------------------------------------ */
/*  COPY — written from the data layer                                       */
/* ------------------------------------------------------------------------ */

function writeCopy(root) {
  const eyebrow = qs('.cta__eyebrow', root)
  if (eyebrow) eyebrow.textContent = cta.eyebrow

  const title = qs('.cta__title', root)
  const markup = titleHTML(cta.title)
  if (title && markup) title.innerHTML = markup

  const lede = qs('.cta__lede', root)
  if (lede) lede.textContent = cta.body

  const circle = qs('.cta__circle', root)
  if (circle) {
    circle.setAttribute('href', cta.primary.href)
    const label = qs('.cta__circle-label', circle)
    if (label) label.innerHTML = circleLabelHTML(cta.primary.label)
  }

  const secondary = qs('.cta__secondary', root)
  if (secondary) {
    secondary.setAttribute('href', cta.secondary.href)
    const label = qs('.cta__secondary-label', secondary)
    if (label) label.textContent = cta.secondary.label
  }
}

/* ------------------------------------------------------------------------ */
/*  CONTACT REGISTER                                                         */
/* ------------------------------------------------------------------------ */

const COPY_ICON =
  '<svg class="cta__copy-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<rect x="5.5" y="5.5" width="8" height="8" rx="1.2"></rect>' +
  '<path d="M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8"></path>' +
  '</svg>'

function cellHTML(label, body) {
  return (
    '<div class="cta__cell">' +
    `<span class="cta__cell-label t-mono">${esc(label)}</span>` +
    `<div class="cta__cell-body">${body}</div>` +
    '</div>'
  )
}

function buildContact(root) {
  const host = qs('.cta__contact', root)
  if (!host) return

  const a = contact.address
  const street = [a.line1, a.line2].filter(Boolean).join(', ')
  const locality = `${a.city}, ${a.state} ${a.zip}`

  const emailBody =
    `<a class="cta__value link-u" href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` +
    '<button class="cta__copy" type="button" ' +
    `data-copy="${esc(contact.email)}" data-copy-done="Copied" ` +
    'aria-label="Copy the studio email address to the clipboard">' +
    COPY_ICON +
    '<span class="cta__copy-label" data-copy-label>Copy</span>' +
    '</button>'

  host.innerHTML =
    cellHTML('Email', emailBody) +
    cellHTML(
      'Telephone',
      `<a class="cta__value link-u" href="${esc(contact.phoneHref)}">${esc(contact.phone)}</a>`
    ) +
    cellHTML(
      'Studio',
      `<span class="cta__value">${esc(street)}</span>` +
        `<span class="cta__sub">${esc(locality)}</span>`
    ) +
    cellHTML('Hours', `<span class="cta__value">${esc(contact.hours)}</span>`)
}

/* ------------------------------------------------------------------------ */
/*  ROTATING TYPE RING                                                       */
/* ------------------------------------------------------------------------ */

function buildRing(root) {
  const ring = qs('.cta__ring', root)
  if (!ring || ring.firstElementChild) return

  const chars = Array.from(RING_TEXT)
  const step = 360 / chars.length
  const frag = document.createDocumentFragment()

  chars.forEach((ch, i) => {
    if (ch === ' ') return // the slot still advances; nothing to paint
    const span = document.createElement('span')
    span.className = ch === '·' ? 'cta__ring-char is-dot' : 'cta__ring-char'
    span.textContent = ch
    span.style.setProperty('--rot', `${(i * step).toFixed(3)}deg`)
    frag.appendChild(span)
  })

  ring.appendChild(frag)
}

function spinRing(root, ctx) {
  const ring = qs('.cta__ring', root)
  if (!ring) return

  const spin = gsap.to(ring, {
    rotation: 360,
    duration: 42,
    ease: 'none',
    repeat: -1,
  })

  // Never burn frames on a ring nobody can see.
  const gate = ScrollTrigger.create({
    trigger: root,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? spin.play() : spin.pause()),
  })
  if (!gate.isActive) spin.pause()

  const dial = qs('.cta__dial', root)
  const circle = qs('.cta__circle', root)
  if (!circle || ctx.touch) return

  const rate = (value) =>
    gsap.to(spin, { timeScale: value, duration: 0.75, ease: EASE.out, overwrite: true })

  const engage = () => {
    dial?.classList.add('is-live')
    rate(3.4)
  }
  const release = () => {
    dial?.classList.remove('is-live')
    rate(1)
  }

  circle.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return
    engage()
  })
  circle.addEventListener('pointerleave', release)
  circle.addEventListener('pointercancel', release)
  circle.addEventListener('focus', engage)
  circle.addEventListener('blur', release)
}

/* ------------------------------------------------------------------------ */
/*  POINTER PARALLAX — a few pixels of depth across the headline block       */
/* ------------------------------------------------------------------------ */

function pointerParallax(root, ctx) {
  if (ctx.touch) return

  // Only nodes whose entrance does not itself animate x/y are eligible, so a
  // reveal tween and the pointer tween can never fight over the same channel.
  mm.add(POINTER_QUERY, () => {
    const layers = [
      { node: qs('.cta__head', root), x: 10, y: 7 },
      { node: qs('.cta__note', root), x: -6, y: -3.5 },
      { node: qs('.cta__bg-art', root), x: -15, y: 0 },
    ].filter((layer) => layer.node)

    if (!layers.length) return undefined

    const tracked = layers.map((layer) => ({
      node: layer.node,
      x: layer.x,
      y: layer.y,
      qx: layer.x ? gsap.quickTo(layer.node, 'x', { duration: 0.9, ease: EASE.out }) : null,
      qy: layer.y ? gsap.quickTo(layer.node, 'y', { duration: 0.9, ease: EASE.out }) : null,
    }))

    // Viewport-normalised, so there is not a single layout read per event.
    const move = (e) => {
      if (e.pointerType === 'touch') return
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      for (const layer of tracked) {
        if (layer.qx) layer.qx(nx * layer.x)
        if (layer.qy) layer.qy(ny * layer.y)
      }
    }

    const rest = () => {
      for (const layer of tracked) {
        if (layer.qx) layer.qx(0)
        if (layer.qy) layer.qy(0)
      }
    }

    root.addEventListener('pointermove', move)
    root.addEventListener('pointerleave', rest)

    return () => {
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerleave', rest)
      gsap.set(
        tracked.map((layer) => layer.node),
        { x: 0, y: 0 }
      )
    }
  })
}

/* ------------------------------------------------------------------------ */
/*  INIT                                                                     */
/* ------------------------------------------------------------------------ */

export default function initCta(ctx) {
  const root = document.querySelector('[data-section="cta"]')
  if (!root) return

  paintBackdrop(root)
  writeCopy(root)
  buildContact(root)
  buildRing(root)

  if (ctx.reduced) return

  spinRing(root, ctx)
  pointerParallax(root, ctx)
}
