/* ============================================================================
   FAQ
   Eight questions from src/data/content.js against a sticky editorial column.

   The accordion is the shared .acc component: this module renders the markup
   contract (.acc / .acc__item / .acc__trigger / .acc__q / .acc__icon /
   .acc__panel / .acc__panel-inner), tags the container with data-acc and
   data-acc-single, and hands it to the UI kit — which owns the open/close,
   the height animation, the ARIA wiring and the roving arrow keys. Emitting
   `ui:refresh` runs that pass synchronously, so the first item is open on the
   first paint rather than a frame or two later.

   The only bespoke motion is the entrance: rows lift in on one trigger while
   their hairlines ink up from the left. The counter in the sticky column
   tracks whichever row is open, listening to the kit's `acc:toggle`.
   ========================================================================== */
import './faq.css'
import { gsap, EASE, sceneTimeline } from '../../core/motion.js'
import { qs, qsa, pad } from '../../lib/utils.js'
import { faq } from '../../data/content.js'
import { contact } from '../../data/site.js'

/* --------------------------------------------------------------- HELPERS */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"]/g, (c) => ESCAPES[c])

function itemHTML(entry, i) {
  const open = i === 0
  return (
    `<div class="acc__item faq__item${open ? ' is-open' : ''}" data-faq-item data-faq-index="${i}">` +
      `<button class="acc__trigger faq__trigger" type="button"` +
      ` aria-expanded="${open ? 'true' : 'false'}">` +
        `<span class="faq__q-wrap">` +
          `<span class="faq__idx t-num">${esc(pad(i + 1))}</span>` +
          `<span class="acc__q faq__q">${esc(entry.q)}</span>` +
        `</span>` +
        `<span class="acc__icon faq__icon" aria-hidden="true"></span>` +
      `</button>` +
      `<div class="acc__panel faq__panel">` +
        `<div class="acc__panel-inner faq__panel-inner">` +
          `<p class="faq__a">${esc(entry.a)}</p>` +
        `</div>` +
      `</div>` +
      `<span class="faq__rule" aria-hidden="true"></span>` +
    `</div>`
  )
}

/* ------------------------------------------------------------------ INIT */

export default function initFaq(ctx = {}) {
  const root = document.querySelector('[data-section="faq"]')
  if (!root) return

  const mount = qs('[data-faq-acc]', root)
  if (!mount || !faq.length) return

  /* ---------------------------------------------------------- accordion */

  mount.innerHTML =
    '<span class="faq__rule faq__rule--top" aria-hidden="true"></span>' +
    '<div class="acc faq__acc" data-acc data-acc-single="true">' +
    faq.map(itemHTML).join('') +
    '</div>'

  const acc = qs('.faq__acc', mount)
  if (!acc) return

  // Wire the shared accordion now — its own observer is debounced, and a
  // panel that opens two frames late reads as a glitch.
  ctx.bus?.emit?.('ui:refresh')

  /* --------------------------------------------------------- sticky copy */

  const mail = qs('[data-faq-mail]', root)
  const mailAddr = qs('[data-faq-mail-addr]', root)
  if (mail) mail.setAttribute('href', `mailto:${contact.email}`)
  if (mailAddr) mailAddr.textContent = contact.email

  const countOpen = qs('[data-faq-count-open]', root)
  const countTotal = qs('[data-faq-count-total]', root)
  if (countTotal) countTotal.textContent = pad(faq.length)

  if (countOpen) {
    const readOut = () => {
      const openItem = qs('.acc__item.is-open', acc)
      countOpen.textContent = openItem
        ? pad(Number(openItem.dataset.faqIndex || 0) + 1)
        : '—'
    }
    readOut()
    ctx.bus?.on?.('acc:toggle', (payload) => {
      if (!payload || payload.group !== acc) return
      readOut()
    })
  }

  /* ------------------------------------------------------------ entrance */

  if (ctx.reduced) return

  const items = qsa('.acc__item', acc)
  if (!items.length) return

  const rules = [qs('.faq__rule--top', mount), ...qsa('.faq__item > .faq__rule', acc)].filter(
    Boolean
  )

  const tl = sceneTimeline(acc, { start: 'top 82%' })

  tl.from(items, {
    y: 26,
    opacity: 0,
    duration: 0.85,
    stagger: 0.055,
    ease: EASE.out,
  })

  tl.fromTo(
    rules,
    { scaleX: 0 },
    { scaleX: 1, duration: 0.95, stagger: 0.055, ease: EASE.soft },
    0.04
  )

  /* Hand the rows back to the cascade once they have landed — the panels
     animate their own height from here on and should own no stale inline
     transform. */
  tl.add(() => gsap.set(items, { clearProps: 'transform,opacity' }))
}
