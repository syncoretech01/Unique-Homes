/* ============================================================================
   PACKAGES
   Three engagement cards rendered from src/data/services.js.

   The cards are the only bespoke choreography here: they rise, un-rotate and
   settle in a stagger, the hairline inside each one draws left to right, and
   the tick marks against the includes list ink themselves in behind it. The
   price numerals are handed to the reveal engine's count-up (data-counter +
   data-prefix) so they arrive with the card rather than being animated twice.

   Hover work is CSS and the shared UI kit: data-lift for the lift,
   data-tilt for a four-degree parallax tilt on fine pointers only, a keyframed
   redraw on the ticks, and the .btn fill sweeping from the card rather than
   from the pill. Nothing here runs on a coarse pointer or under reduced
   motion — the rest state is the whole section.
   ========================================================================== */
import './packages.css'
import { EASE, DUR, sceneTimeline } from '../../core/motion.js'
import { qs, qsa, pad } from '../../lib/utils.js'
import { packages } from '../../data/services.js'

/* --------------------------------------------------------------- HELPERS */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"]/g, (c) => ESCAPES[c])

/** Length of the tick path, rounded up — the dash figure CSS also uses. */
const TICK_LEN = 17

const TICK =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M2.6 8.4 6.2 12 13.4 3.6" fill="none" stroke="currentColor" ' +
  'stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter"/></svg>'

/**
 * Split a price string such as `from $4,800` into the pieces the card needs:
 * a mono lead-in, a currency symbol, an integer the counter can run up to and
 * any trailing unit. Anything the pattern cannot read falls back to the
 * original string, printed as written.
 *
 * @param {string} value
 * @returns {{lead: string, symbol: string, amount: number|null, suffix: string, display: string}}
 */
function parsePrice(value) {
  const raw = String(value == null ? '' : value).trim()
  const at = raw.search(/\d/)
  if (at < 0) return { lead: '', symbol: '', amount: null, suffix: '', display: raw }

  const head = raw.slice(0, at)
  const body = raw.slice(at)
  const symbolMatch = head.match(/[^A-Za-z\s]/)
  const digits = body.replace(/\D/g, '')
  const amount = digits ? Number(digits) : null

  return {
    lead: head.replace(/[^A-Za-z ]/g, '').trim(),
    symbol: symbolMatch ? symbolMatch[0] : '',
    amount,
    suffix: body.replace(/[\d,.\s]/g, ''),
    display: raw,
  }
}

function priceHTML(pkg) {
  const { lead, symbol, amount, suffix, display } = parsePrice(pkg.price)
  const leadHTML = lead ? `<span class="packages__price-lead">${esc(lead)}</span>` : ''

  if (amount === null) {
    return (
      `<p class="packages__price">${leadHTML}` +
      `<span class="packages__price-num">${esc(display)}</span></p>`
    )
  }

  const printed = symbol + amount.toLocaleString('en-US') + suffix
  return (
    `<p class="packages__price">${leadHTML}` +
    `<span class="packages__price-num" data-counter="${amount}"` +
    ` data-prefix="${esc(symbol)}"${suffix ? ` data-suffix="${esc(suffix)}"` : ''}` +
    ` data-duration="1.6">${esc(printed)}</span></p>`
  )
}

function cardHTML(pkg, i) {
  const accent = !!pkg.accent
  const includes = (pkg.includes || [])
    .map(
      (line, n) =>
        `<li class="packages__inc" style="--pk-i:${n}">` +
        `<span class="packages__tick" aria-hidden="true">${TICK}</span>` +
        `<span>${esc(line)}</span></li>`
    )
    .join('')

  return (
    `<li class="packages__item${accent ? ' packages__item--accent' : ''}">` +
      `<article class="packages__card${accent ? ' packages__card--accent' : ''}"` +
        ` data-packages-card data-lift="10" data-tilt data-tilt-max="4"` +
        ` data-tilt-perspective="1400"` +
        ` aria-labelledby="packages-name-${i}">` +
        `<span class="packages__wash" aria-hidden="true"></span>` +

        `<header class="packages__card-head">` +
          `<span class="packages__idx t-num">${esc(pad(i + 1))}</span>` +
          (accent
            ? '<span class="tag tag--accent packages__tag">Most requested</span>'
            : '') +
        `</header>` +

        `<h3 class="packages__name" id="packages-name-${i}">${esc(pkg.name)}</h3>` +
        priceHTML(pkg) +
        `<p class="packages__for">${esc(pkg.for)}</p>` +

        `<span class="packages__rule" aria-hidden="true">` +
          `<span class="packages__rule-in"></span></span>` +

        `<ul class="packages__includes" role="list">${includes}</ul>` +

        `<div class="packages__action">` +
          `<a class="btn btn--block packages__btn${accent ? ' btn--accent' : ' btn--ghost'}"` +
          ` href="/contact/" data-arrow>Enquire about ${esc(pkg.name)}</a>` +
        `</div>` +
      `</article>` +
    `</li>`
  )
}

/* ------------------------------------------------------------------ INIT */

export default function initPackages(ctx = {}) {
  const root = document.querySelector('[data-section="packages"]')
  if (!root) return

  const grid = qs('[data-packages-grid]', root)
  if (!grid || !packages.length) return

  /* Three columns, the promoted one a shade wider — read from the data so the
     row stays correct if the promoted package ever moves. */
  grid.style.setProperty(
    '--pk-track',
    packages.map((p) => (p.accent ? 'minmax(0, 1.12fr)' : 'minmax(0, 1fr)')).join(' ')
  )
  grid.innerHTML = packages.map(cardHTML).join('')

  // The UI kit enhances .btn / [data-tilt] on this pass; its own observer
  // would get there eventually, but not before the first paint.
  ctx.bus?.emit?.('ui:refresh')

  if (ctx.reduced) return

  const cards = qsa('[data-packages-card]', grid)
  if (!cards.length) return

  const rules = qsa('.packages__rule-in', grid)
  const ticks = qsa('.packages__tick path', grid)

  const tl = sceneTimeline(grid, { start: 'top 80%' })

  tl.from(cards, {
    y: 56,
    rotate: (i) => (i - (cards.length - 1) / 2) * 1.6,
    scale: 0.965,
    opacity: 0,
    transformOrigin: '50% 100%',
    duration: DUR.slow + 0.1,
    stagger: 0.11,
    ease: EASE.out,
    // Hand the cards back to the tilt with a centred origin.
    clearProps: 'transformOrigin',
  })

  tl.fromTo(
    rules,
    { scaleX: 0 },
    { scaleX: 1, duration: 0.9, stagger: 0.11, ease: EASE.soft },
    0.28
  )

  tl.fromTo(
    ticks,
    { strokeDashoffset: TICK_LEN },
    { strokeDashoffset: 0, duration: 0.5, stagger: 0.022, ease: 'power2.out' },
    0.5
  )
}
