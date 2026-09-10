/* ============================================================================
   RECOGNITION — a hairline-ruled list, drawn rather than announced

   Rows come from `recognitions` in src/data/site.js. Each one enters with its
   own rule sweeping in from the left while the year, title and award mask up
   behind it — one ScrollTrigger drives the whole list.

   The hover state (wipe, accent year, laurel) is pure CSS, so it costs
   nothing per pointer event and disappears cleanly on coarse pointers.
   ========================================================================== */
import './recognition.css'
import { gsap, EASE, queueRefresh } from '../../core/motion.js'
import { qs, qsa, pad } from '../../lib/utils.js'
import { recognitions } from '../../data/site.js'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c])

const CLIPPED = 'inset(0% 0% 100% 0%)'
const OPEN = 'inset(0% 0% 0% 0%)'

/** A drawn laurel with a tick inside it — the only ornament in the section. */
const LAUREL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"' +
  ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' +
  ' role="presentation">' +
  '<path d="M9.6 20.4C5.6 18.3 3.6 13.6 4.9 8.6"/>' +
  '<path d="M14.4 20.4C18.4 18.3 20.4 13.6 19.1 8.6"/>' +
  '<path d="M5.7 12.1c-1.4-.5-2-1.7-1.9-3.1 1.4.1 2.3.9 2.6 2.3"/>' +
  '<path d="M6.7 15.8c-1.4-.4-2.2-1.5-2.2-2.9 1.4 0 2.4.7 2.9 2.1"/>' +
  '<path d="M8.5 19c-1.3-.6-1.9-1.8-1.7-3.2 1.4.2 2.3 1 2.5 2.4"/>' +
  '<path d="M18.3 12.1c1.4-.5 2-1.7 1.9-3.1-1.4.1-2.3.9-2.6 2.3"/>' +
  '<path d="M17.3 15.8c1.4-.4 2.2-1.5 2.2-2.9-1.4 0-2.4.7-2.9 2.1"/>' +
  '<path d="M15.5 19c1.3-.6 1.9-1.8 1.7-3.2-1.4.2-2.3 1-2.5 2.4"/>' +
  '<path d="M9.2 12.1l2.2 2.3 4.3-4.7"/>' +
  '</svg>'

function rowHTML(item) {
  return (
    `<li class="recognition__row">` +
      `<span class="recognition__rule" data-rec-rule aria-hidden="true"></span>` +
      `<span class="recognition__wipe" aria-hidden="true"></span>` +
      `<span class="recognition__year t-num" data-rec-line>${esc(item.year)}</span>` +
      `<span class="recognition__name" data-rec-line>${esc(item.title)}</span>` +
      `<span class="recognition__award" data-rec-line>${esc(item.award)}</span>` +
      `<span class="recognition__glyph" aria-hidden="true">${LAUREL}</span>` +
    `</li>`
  )
}

export default function initRecognition(ctx = {}) {
  const root = document.querySelector('[data-section="recognition"]')
  if (!root) return

  const list = qs('[data-rec-list]', root)
  if (!list) return

  const items = Array.isArray(recognitions) ? recognitions.filter(Boolean) : []
  if (!items.length) return

  list.innerHTML = items.map(rowHTML).join('')

  /* Header meta — count, and the span of years the list actually covers. */
  const count = qs('[data-rec-count]', root)
  if (count) count.textContent = pad(items.length)

  const span = qs('[data-rec-span]', root)
  if (span) {
    const years = items
      .map((item) => parseInt(item.year, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    span.textContent = years.length
      ? `entries · ${years[0]}–${years[years.length - 1]}`
      : 'entries'
  }

  queueRefresh()

  if (ctx.reduced) return

  const rows = qsa('.recognition__row', list)
  const endRule = qs('[data-rec-endrule]', root)
  if (!rows.length) return

  const rules = qsa('[data-rec-rule]', list)
  const lines = qsa('[data-rec-line]', list)
  const closing = endRule ? [endRule] : []

  gsap.set([...rules, ...closing], { scaleX: 0 })
  gsap.set(lines, { clipPath: CLIPPED, y: '0.45em' })

  const tl = gsap.timeline({
    scrollTrigger: { trigger: list, start: 'top 80%', once: true },
  })

  rows.forEach((row, i) => {
    const at = i * 0.09
    const rule = qs('[data-rec-rule]', row)
    if (rule) tl.to(rule, { scaleX: 1, duration: 0.95, ease: EASE.soft }, at)
    tl.to(
      qsa('[data-rec-line]', row),
      {
        clipPath: OPEN,
        y: 0,
        duration: 0.95,
        ease: EASE.out,
        stagger: 0.055,
        clearProps: 'clipPath,y',
      },
      at + 0.1
    )
  })

  if (closing.length) {
    tl.to(closing, { scaleX: 1, duration: 0.95, ease: EASE.soft }, rows.length * 0.09)
  }
}
