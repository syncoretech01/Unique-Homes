/* ============================================================================
   MANIFESTO — behaviour

   Everything list-shaped is rendered from the data layer so the section can
   never drift out of step with it:
     · the marquee band            src/data/site.js       marqueeWords
     · the capabilities table      src/data/content.js    capabilities
     · the stats band              src/data/site.js       stats

   Bespoke choreography (word masks, rule wipes, the revision bar) is written
   by hand; ordinary entrances are left to the declarative reveal engine.
   ========================================================================== */
import './manifesto.css'
import { gsap, ScrollTrigger, EASE } from '../../core/motion.js'
import { qs, qsa, pad } from '../../lib/utils.js'
import { drawingSVG } from '../../lib/drawings.js'
import { manifesto, capabilities } from '../../data/content.js'
import { stats, marqueeWords } from '../../data/site.js'

/* ------------------------------------------------------------------ GLYPHS */

/**
 * A small drawn separator between marquee words — an outlined diamond, or a
 * single stroke every other item. Every fourth one is terracotta.
 * @param {number} i index of the word it follows
 * @returns {string} inline SVG markup
 */
function glyph(i) {
  const cls = 'manifesto__glyph' + (i % 4 === 3 ? ' manifesto__glyph--acc' : '')
  const open = `<svg class="${cls}" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">`
  return i % 2 === 1
    ? `${open}<path d="M3.1 10.7 8.9 1.3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`
    : `${open}<path d="M6 1.1 10.9 6 6 10.9 1.1 6Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>`
}

/* ------------------------------------------------------------------ BUILD  */

/**
 * Replace the static fallback with a real marquee. Appending a fresh
 * `.marquee` node is deliberate: the shared UI kit observes the DOM and picks
 * it up, repeating and twinning the track so the loop is seamless.
 */
function buildBand(band) {
  if (!band || !marqueeWords.length) return
  band.textContent = ''

  const marquee = document.createElement('div')
  marquee.className = 'marquee'
  marquee.dataset.marqueeSpeed = '46'
  marquee.dataset.marqueeReact = '0.55'

  const track = document.createElement('div')
  track.className = 'marquee__track'

  marqueeWords.forEach((word, i) => {
    const item = document.createElement('span')
    item.className = 'marquee__item'
    item.appendChild(document.createTextNode(word))
    item.insertAdjacentHTML('beforeend', glyph(i))
    track.appendChild(item)
  })

  marquee.appendChild(track)
  band.appendChild(marquee)
}

/**
 * Rebuild the headline as one mask per word so each can rise independently.
 * The closing full stop is lifted into its own accent span.
 * @returns {Element[]} the word elements, in reading order
 */
function buildTitle(node, text) {
  if (!node) return []
  const lines = String(text || '').split('\n').filter((l) => l.trim().length)
  if (!lines.length) return []

  node.textContent = ''

  lines.forEach((lineText, li) => {
    const line = document.createElement('span')
    line.className = 'manifesto__t-line'
    const words = lineText.trim().split(/\s+/)

    words.forEach((word, wi) => {
      const mask = document.createElement('span')
      mask.className = 'manifesto__t-mask'
      const inner = document.createElement('span')
      inner.className = 'manifesto__t-word'

      const isLast = li === lines.length - 1 && wi === words.length - 1
      if (isLast && /[.!?]$/.test(word) && word.length > 1) {
        inner.appendChild(document.createTextNode(word.slice(0, -1)))
        const dot = document.createElement('span')
        dot.className = 'manifesto__t-dot'
        dot.textContent = word.slice(-1)
        inner.appendChild(dot)
      } else {
        inner.textContent = word
      }

      mask.appendChild(inner)
      line.appendChild(mask)
      if (wi < words.length - 1) line.appendChild(document.createTextNode(' '))
    })

    node.appendChild(line)
  })

  return qsa('.manifesto__t-word', node)
}

/** Hairline-ruled capability rows, one per record. */
function buildCaps(list) {
  if (!list || !capabilities.length) return
  list.textContent = ''

  capabilities.forEach((cap, i) => {
    const row = document.createElement('li')
    row.className = 'manifesto__cap'

    const rule = document.createElement('i')
    rule.className = 'manifesto__cap-rule'
    rule.setAttribute('aria-hidden', 'true')

    const index = document.createElement('span')
    index.className = 'manifesto__cap-i t-num'
    index.setAttribute('aria-hidden', 'true')
    index.textContent = pad(i + 1)

    const key = document.createElement('span')
    key.className = 'manifesto__cap-k'
    key.textContent = cap.k

    const value = document.createElement('span')
    value.className = 'manifesto__cap-v'
    value.textContent = cap.v

    row.append(rule, index, key, value)
    list.appendChild(row)
  })
}

/** Four figures with the reveal engine's count-up wired through data-counter. */
function buildStats(wrap) {
  if (!wrap || !stats.length) return
  const bandRule = qs('.manifesto__stats-rule', wrap)
  wrap.textContent = ''
  if (bandRule) wrap.appendChild(bandRule)

  stats.forEach((entry) => {
    const cell = document.createElement('div')
    cell.className = 'stat manifesto__stat'

    const vRule = document.createElement('i')
    vRule.className = 'manifesto__stat-rule manifesto__stat-rule--v'
    vRule.setAttribute('aria-hidden', 'true')

    const hRule = document.createElement('i')
    hRule.className = 'manifesto__stat-rule manifesto__stat-rule--h'
    hRule.setAttribute('aria-hidden', 'true')

    const suffix = entry.suffix || ''
    const num = document.createElement('span')
    num.className = 'stat__num manifesto__stat-num'
    num.dataset.counter = String(entry.value)
    if (suffix) num.dataset.suffix = suffix
    num.textContent = `${entry.value}${suffix}`

    const label = document.createElement('span')
    label.className = 'stat__label manifesto__stat-label'
    label.textContent = entry.label

    const note = document.createElement('span')
    note.className = 'manifesto__stat-note'
    note.textContent = entry.note

    cell.append(vRule, hRule, num, label, note)
    wrap.appendChild(cell)
  })
}

/**
 * The margin drawing — a narrow contour survey strip. Built only once the
 * viewport is wide enough to show it, and re-checked if the window grows.
 */
function buildStrip(strip) {
  if (!strip) return
  const media = window.matchMedia('(min-width: 1101px)')
  const cs = getComputedStyle(document.documentElement)
  const ink = cs.getPropertyValue('--c-blueprint').trim() || '#27415A'
  const accent = cs.getPropertyValue('--c-terra').trim() || '#AE4E2A'

  const paint = () => {
    if (!media.matches || strip.firstElementChild) return
    strip.innerHTML = drawingSVG('contour', {
      seed: 27,
      ink,
      accent,
      width: 240,
      height: 1000,
      density: 0.85,
      strokeScale: 0.7,
      showTitleBlock: false,
    })
  }

  paint()
  if (media.addEventListener) media.addEventListener('change', paint)
  else if (media.addListener) media.addListener(paint)
}

/* ------------------------------------------------------------------- INIT  */

export default function initManifesto(ctx = {}) {
  const root = document.querySelector('[data-section="manifesto"]')
  if (!root) return

  const reduced = !!ctx.reduced

  /* ---------------------------------------------------------- content --- */
  const titleEl = qs('[data-manifesto-title]', root)
  buildBand(qs('[data-manifesto-band]', root))
  const words = buildTitle(titleEl, manifesto.title)
  buildCaps(qs('[data-manifesto-caps]', root))
  buildStats(qs('[data-manifesto-stats]', root))
  buildStrip(qs('[data-manifesto-strip]', root))

  /* ------------------------------------------------------------ nodes --- */
  const capList = qs('[data-manifesto-caps]', root)
  const capRules = qsa('.manifesto__cap-rule', root)
  const capCells = qsa('.manifesto__cap-i, .manifesto__cap-k, .manifesto__cap-v', root)

  const statsWrap = qs('[data-manifesto-stats]', root)
  const bandRule = qs('.manifesto__stats-rule', root)
  const vRules = qsa('.manifesto__stat-rule--v', root)
  const hRules = qsa('.manifesto__stat-rule--h', root)
  const statCells = qsa('.manifesto__stat-num, .manifesto__stat-label, .manifesto__stat-note', root)

  const sign = qs('.manifesto__sign', root)
  const signRule = qs('.manifesto__sign-rule', root)
  const signText = qs('.manifesto__sign-text', root)

  const railFill = qs('[data-manifesto-fill]', root)
  const railRead = qs('[data-manifesto-read]', root)

  /* ------------------------------------------------- revision bar (7) --- */
  /* Scroll position, not motion: it stays live under reduced motion, exactly
     like the site-wide scroll rail. */
  if (railFill) {
    gsap.set(railFill, { transformOrigin: 'top center', scaleY: 0 })
    const setFill = gsap.quickSetter(railFill, 'scaleY')
    let shown = -1

    ScrollTrigger.create({
      trigger: root,
      start: 'top 78%',
      end: 'bottom 22%',
      onUpdate(self) {
        setFill(self.progress)
        if (!railRead) return
        const pct = Math.round(self.progress * 100)
        if (pct === shown) return
        shown = pct
        railRead.textContent = pct >= 100 ? '100' : pad(pct)
      },
      onRefresh(self) {
        setFill(self.progress)
      },
    })
  }

  /* --------------------------------------------------- static fallback --- */
  if (reduced) {
    gsap.set([...capRules, bandRule, ...hRules, signRule].filter(Boolean), { scaleX: 1 })
    gsap.set(vRules, { scaleY: 1 })
    return
  }

  /* ---------------------------------------------- statement titling (2) --- */
  if (titleEl && words.length) {
    gsap.from(words, {
      yPercent: 135,
      duration: 1.25,
      ease: EASE.out,
      stagger: 0.085,
      scrollTrigger: { trigger: titleEl, start: 'top 86%', once: true },
    })
  }

  /* ------------------------------------------------ capabilities (4) ---- */
  if (capList && capRules.length) {
    const caps = gsap.timeline({
      scrollTrigger: { trigger: capList, start: 'top 82%', once: true },
    })
    caps
      .fromTo(capRules, { scaleX: 0 }, { scaleX: 1, duration: 1.05, ease: EASE.out, stagger: 0.085 }, 0)
      .fromTo(
        capCells,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, ease: EASE.out, stagger: 0.085 / 3 },
        0.12
      )
  }

  /* ------------------------------------------------------- stats (5) ---- */
  if (statsWrap && statCells.length) {
    const band = gsap.timeline({
      scrollTrigger: { trigger: statsWrap, start: 'top 84%', once: true },
    })
    if (bandRule) band.fromTo(bandRule, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: EASE.out }, 0)
    if (vRules.length) {
      band.fromTo(vRules, { scaleY: 0 }, { scaleY: 1, duration: 0.95, ease: EASE.out, stagger: 0.08 }, 0.18)
    }
    if (hRules.length) {
      band.fromTo(hRules, { scaleX: 0 }, { scaleX: 1, duration: 0.95, ease: EASE.out, stagger: 0.08 }, 0.18)
    }
    band.fromTo(
      statCells,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: EASE.out, stagger: 0.055 },
      0.22
    )
  }

  /* --------------------------------------------------- signature (6) ---- */
  if (sign && signRule) {
    const sig = gsap.timeline({
      scrollTrigger: { trigger: sign, start: 'top 92%', once: true },
    })
    sig.fromTo(signRule, { scaleX: 0 }, { scaleX: 1, duration: 1.35, ease: EASE.out }, 0)
    if (signText) {
      sig.fromTo(signText, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: EASE.out }, 0.3)
    }
  }
}
