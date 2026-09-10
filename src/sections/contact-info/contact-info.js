/* ============================================================================
   CONTACT INFO

   The studio card, a locality plan drawn from scratch, three questions and
   the closing register. This is the last section on the contact page — there
   is no CTA behind it — so it has to read as an ending.

   The map is the piece of real work here. There is no embedded map service
   anywhere on this site (nothing may hit the network at runtime), so the
   plan is generated as inline SVG: a slightly irregular street grid, an
   interstate, a rail spur, a river with two bridges, blocks and alleys, and
   the studio marked with a pulsing accent ring. It is deterministic — one
   seed, the same drawing every load — and every colour is a class resolved
   from the token layer in contact-info.css.

   The clock is the shared [data-clock-ui] behaviour. If the UI kit has not
   filled it a beat after boot, this module takes over with its own
   Intl.DateTimeFormat on America/Chicago. The open / closed pill is computed
   from the same zone against the studio hours, so it can never contradict
   them.
   ========================================================================== */
import './contact-info.css'
import { gsap, EASE, sceneTimeline } from '../../core/motion.js'
import { qs, qsa, pad, mulberry32 } from '../../lib/utils.js'
import { brand, contact } from '../../data/site.js'
import { faq } from '../../data/content.js'

/* --------------------------------------------------------------- HELPERS */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"]/g, (c) => ENTITIES[c])
const f = (n) => Math.round(Number(n) * 10) / 10

/** House-style street abbreviations, so the map label tracks the address. */
const ABBR = {
  EAST: 'E', WEST: 'W', NORTH: 'N', SOUTH: 'S',
  STREET: 'ST', AVENUE: 'AVE', ROAD: 'RD', BOULEVARD: 'BLVD',
  DRIVE: 'DR', LANE: 'LN', SUITE: 'STE', PLACE: 'PL',
  FIRST: '1ST', SECOND: '2ND', THIRD: '3RD', FOURTH: '4TH', FIFTH: '5TH',
  SIXTH: '6TH', SEVENTH: '7TH', EIGHTH: '8TH', NINTH: '9TH', TENTH: '10TH',
}

function abbreviate(line) {
  return String(line || '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ABBR[word] || word)
    .join(' ')
}

/* ------------------------------------------------------------------------ */
/*  THE MAP                                                                  */
/* ------------------------------------------------------------------------ */

const MAP_W = 900
const MAP_H = 620
/* Irregular on purpose — a perfectly even grid reads as graph paper. */
const MAP_X = [95, 190, 300, 420, 545, 665, 790]
const MAP_Y = [72, 152, 246, 330, 414, 498]
const PIN = { x: 545, y: 330 }
const RIVER = 'M-10 506 C 130 494 246 546 386 552 C 520 558 668 544 910 516'

const M = 'contact-info__m-'

const svgLine = (x1, y1, x2, y2, cls) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="${cls}"/>`

const svgRect = (x, y, w, h, cls) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" class="${cls}"/>`

const svgText = (x, y, value, cls, extra = '') =>
  `<text x="${f(x)}" y="${f(y)}" class="${cls}"${extra ? ' ' + extra : ''}>${esc(value)}</text>`

/**
 * Build the locality plan.
 * @param {string} pinLabel  the studio's street line, already abbreviated
 * @param {string} streetLabel  the street the pin sits on
 * @returns {string} inline `<svg>` markup
 */
function buildMap(pinLabel, streetLabel) {
  const rand = mulberry32(11)
  const out = []

  /* -- blocks + alleys ------------------------------------------------- */
  const bx = [-16, ...MAP_X, 916]
  const by = [-16, ...MAP_Y, 636]
  const blocks = []
  const alleys = []

  for (let i = 0; i < bx.length - 1; i += 1) {
    for (let j = 0; j < by.length - 1; j += 1) {
      const x0 = bx[i] + 5
      const y0 = by[j] + 5
      const w = bx[i + 1] - 5 - x0
      const h = by[j + 1] - 5 - y0
      if (w < 14 || h < 14) continue
      if (y0 > 494) continue // the river owns the bottom of the sheet

      // One green square in the grid — every neighbourhood has one.
      const park = i === 1 && j === 5
      const r = rand()
      if (!park && r < 0.1) continue

      const cls = park
        ? `${M}block ${M}park`
        : r > 0.87
          ? `${M}block ${M}block--strong`
          : `${M}block`
      blocks.push(svgRect(x0, y0, w, h, cls))

      if (!park && rand() > 0.62) {
        if (w > h) alleys.push(svgLine(x0 + w / 2, y0, x0 + w / 2, y0 + h, `${M}street ${M}alley`))
        else alleys.push(svgLine(x0, y0 + h / 2, x0 + w, y0 + h / 2, `${M}street ${M}alley`))
      }
    }
  }
  out.push(`<g data-ci-blocks>${blocks.join('')}</g>`)

  /* -- the grid -------------------------------------------------------- */
  const streets = []
  MAP_X.forEach((x) => {
    if (x === 300) return // the interstate replaces this one
    streets.push(svgLine(x, -10, x, MAP_H + 10, `${M}street`))
  })
  MAP_Y.forEach((y) => {
    if (y === PIN.y) return // drawn heavier below
    streets.push(svgLine(-10, y, MAP_W + 10, y, `${M}street`))
  })
  streets.push(...alleys)
  out.push(streets.join(''))

  /* -- the street the studio is on ------------------------------------- */
  out.push(svgLine(-10, PIN.y, MAP_W + 10, PIN.y, `${M}major`))

  /* -- interstate: twin carriageways with tie bars ---------------------- */
  const hwy = [
    svgLine(292, -10, 292, MAP_H + 10, `${M}hwy`),
    svgLine(308, -10, 308, MAP_H + 10, `${M}hwy`),
  ]
  for (let y = 10; y < MAP_H; y += 46) {
    hwy.push(svgLine(292, y, 308, y + 12, `${M}rail`))
  }
  out.push(hwy.join(''))

  /* -- rail spur across the north-east ---------------------------------- */
  const railA = { x: 556, y: -12 }
  const railB = { x: 912, y: 254 }
  const rail = [svgLine(railA.x, railA.y, railB.x, railB.y, `${M}rail`)]
  const dx = railB.x - railA.x
  const dy = railB.y - railA.y
  const len = Math.hypot(dx, dy)
  const nx = (-dy / len) * 5.5
  const ny = (dx / len) * 5.5
  for (let t = 0.02; t < 1; t += 0.055) {
    const px = railA.x + dx * t
    const py = railA.y + dy * t
    rail.push(svgLine(px - nx, py - ny, px + nx, py + ny, `${M}rail`))
  }
  out.push(rail.join(''))

  /* -- water ------------------------------------------------------------ */
  out.push(
    `<g data-ci-water>` +
      `<path d="${RIVER} L910 636 L-10 636 Z" class="${M}water"/>` +
      `<path d="${RIVER}" class="${M}shore"/>` +
    `</g>`
  )
  out.push(svgLine(300, 496, 300, 600, `${M}bridge`))
  out.push(svgLine(545, 500, 545, 604, `${M}bridge`))

  /* -- labels ----------------------------------------------------------- */
  const labels = [
    svgText(103, 321, streetLabel, `${M}label`),
    svgText(103, 236, 'E 7th St', `${M}label ${M}label--minor`),
    svgText(232, 48, 'I-35', `${M}label`),
    svgText(676, 404, 'Comal St', `${M}label ${M}label--minor`),
    svgText(330, 592, 'Lady Bird Lake', `${M}label ${M}label--water`),
    svgText(536, 240, 'San Marcos St', `${M}label ${M}label--minor`, 'transform="rotate(-90 536 240)"'),
  ]
  out.push(labels.join(''))

  /* -- north arrow ------------------------------------------------------ */
  out.push(
    `<g class="${M}compass">` +
      `<circle cx="62" cy="76" r="20" class="${M}compass-ring"/>` +
      `<path d="M62 60 L68 88 L62 82 L56 88 Z" class="${M}needle"/>` +
      svgText(56, 50, 'N', `${M}label`) +
    `</g>`
  )

  /* -- scale bar -------------------------------------------------------- */
  const scale = [svgRect(696, 448, 158, 34, `${M}plaque`)]
  scale.push(svgLine(706, 472, 826, 472, `${M}scalebar`))
  for (let i = 0; i <= 4; i += 1) {
    const x = 706 + i * 30
    scale.push(svgLine(x, 466, x, 472, `${M}scalebar`))
  }
  scale.push(svgText(706, 462, '0', `${M}label ${M}label--minor`))
  scale.push(svgText(786, 462, '400 ft', `${M}label ${M}label--minor`))
  out.push(scale.join(''))

  /* -- the studio ------------------------------------------------------- */
  const labelW = pinLabel.length * 11 + 18
  out.push(
    `<g data-ci-pin>` +
      `<circle cx="${PIN.x}" cy="${PIN.y}" r="13" class="${M}ring"/>` +
      `<circle cx="${PIN.x}" cy="${PIN.y}" r="13" class="${M}ring ${M}ring--late"/>` +
      `<path d="M${PIN.x} ${PIN.y} L${PIN.x + 62} ${PIN.y - 58} L${PIN.x + 62 + labelW} ${PIN.y - 58}" class="${M}leader"/>` +
      svgText(PIN.x + 66, PIN.y - 66, pinLabel, `${M}pin-label`) +
      `<circle cx="${PIN.x}" cy="${PIN.y}" r="6.5" class="${M}pin-halo" data-pulse="glow" data-pulse-duration="3.2" style="transform-box:fill-box;transform-origin:center"/>` +
      `<circle cx="${PIN.x}" cy="${PIN.y}" r="6.5" class="${M}pin-core"/>` +
      `<circle cx="${PIN.x}" cy="${PIN.y}" r="2.2" class="${M}pin-eye"/>` +
    `</g>`
  )

  return (
    `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid slice"` +
    ` class="contact-info__m" aria-hidden="true" focusable="false" role="presentation">` +
    out.join('') +
    `</svg>`
  )
}

/* ------------------------------------------------------------------------ */
/*  ACCORDION                                                                */
/* ------------------------------------------------------------------------ */

/** The three that a first enquiry actually turns on. */
const FIRST_ENQUIRY = [
  'What do you need from me to start?',
  'How long does a permit set take?',
  'How do you charge?',
]

function pickQuestions() {
  const picked = FIRST_ENQUIRY.map((q) => faq.find((entry) => entry.q === q)).filter(Boolean)
  return picked.length === FIRST_ENQUIRY.length ? picked : faq.slice(0, 3)
}

function questionHTML(entry, i) {
  const open = i === 0
  return (
    `<div class="acc__item contact-info__item${open ? ' is-open' : ''}">` +
      `<button class="acc__trigger contact-info__trigger" type="button" aria-expanded="${open ? 'true' : 'false'}">` +
        `<span class="contact-info__q-wrap">` +
          `<span class="t-num contact-info__q-idx">${esc(pad(i + 1))}</span>` +
          `<span class="acc__q contact-info__q">${esc(entry.q)}</span>` +
        `</span>` +
        `<span class="acc__icon" aria-hidden="true"></span>` +
      `</button>` +
      `<div class="acc__panel">` +
        `<div class="acc__panel-inner">` +
          `<p class="contact-info__a">${esc(entry.a)}</p>` +
        `</div>` +
      `</div>` +
    `</div>`
  )
}

/* ------------------------------------------------------------------------ */
/*  INIT                                                                     */
/* ------------------------------------------------------------------------ */

export default function initContactInfo(ctx = {}) {
  const root = document.querySelector('[data-section="contact-info"]')
  if (!root) return

  const reduced = !!ctx.reduced
  const address = contact.address

  /* ------------------------------------------------------------- card */

  const addressEl = qs('[data-ci-address]', root)
  if (addressEl) {
    addressEl.innerHTML = [
      esc(address.line1) + (address.line2 ? `, ${esc(address.line2)}` : ''),
      `${esc(address.city)}, ${esc(address.state)} ${esc(address.zip)}`,
      esc(address.country),
    ].join('<br>')
  }

  const hoursEl = qs('[data-ci-hours]', root)
  if (hoursEl) hoursEl.textContent = contact.hours

  const phoneEl = qs('[data-ci-phone]', root)
  if (phoneEl) {
    phoneEl.setAttribute('href', contact.phoneHref)
    phoneEl.textContent = contact.phone
  }

  const emailEl = qs('[data-ci-email]', root)
  if (emailEl) {
    emailEl.setAttribute('href', `mailto:${contact.email}`)
    emailEl.textContent = contact.email
  }

  const closeMail = qs('[data-ci-close-mail]', root)
  if (closeMail) {
    closeMail.setAttribute('href', `mailto:${contact.email}`)
    closeMail.textContent = contact.email
  }

  const fullAddress = [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.zip}`,
  ]
    .filter(Boolean)
    .join(', ')

  const directions = qs('[data-ci-directions]', root)
  if (directions) {
    // A user-initiated navigation in a new tab — not a runtime asset request.
    directions.setAttribute('href', `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`)
  }

  const colophonBrand = qs('[data-ci-colophon-brand]', root)
  if (colophonBrand) colophonBrand.textContent = brand.name
  const colophonSince = qs('[data-ci-colophon-since]', root)
  if (colophonSince) colophonSince.textContent = `Est. ${brand.since}`

  /* ------------------------------------------------- clock + open state */

  const clockNode = qs('[data-ci-clock]', root)
  const statusEl = qs('[data-ci-status]', root)
  const statusText = qs('[data-ci-status-text]', root)

  const formatter = (options) => {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: contact.timezone, ...options })
    } catch (err) {
      return null
    }
  }
  const timeFmt = formatter({ hour: '2-digit', minute: '2-digit', hour12: false })
  const partsFmt = formatter({ weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

  function studioNow() {
    const now = new Date()
    if (!partsFmt) {
      return { day: now.toLocaleDateString('en-GB', { weekday: 'short' }), minutes: now.getHours() * 60 + now.getMinutes() }
    }
    const parts = {}
    for (const part of partsFmt.formatToParts(now)) parts[part.type] = part.value
    const hour = Number(parts.hour) % 24
    const minute = Number(parts.minute) || 0
    return { day: parts.weekday || '', minutes: (Number.isFinite(hour) ? hour : 0) * 60 + minute }
  }

  const OPENS = 8 * 60 + 30
  const CLOSES = 18 * 60

  function paintStatus() {
    if (!statusEl || !statusText) return
    const { day, minutes } = studioNow()
    const weekend = day.startsWith('Sat') || day.startsWith('Sun')
    const open = !weekend && minutes >= OPENS && minutes < CLOSES
    statusEl.classList.toggle('is-open', open)

    let label = 'Open now'
    if (weekend) label = 'Closed — back Monday, 8:30'
    else if (minutes < OPENS) label = 'Closed — opens at 8:30'
    else if (minutes >= CLOSES) label = day.startsWith('Fri') ? 'Closed — back Monday, 8:30' : 'Closed — opens at 8:30'
    statusText.textContent = label
  }

  function paintClock() {
    if (!clockNode) return
    const now = new Date()
    const text = timeFmt ? timeFmt.format(now) : now.toTimeString().slice(0, 5)
    clockNode.textContent = `${text} ${contact.tzLabel}`
  }

  paintStatus()
  window.setInterval(paintStatus, 30000)

  // The UI kit drives every [data-clock-ui] once a second. Only take over if
  // it has not — a second writer would fight it.
  window.setTimeout(() => {
    if (!clockNode || clockNode.textContent.trim()) return
    paintClock()
    window.setInterval(paintClock, 30000)
  }, 700)

  /* -------------------------------------------------------------- social */

  const socialMount = qs('[data-ci-social]', root)
  if (socialMount && contact.social.length) {
    socialMount.innerHTML = contact.social
      .map(
        (item) =>
          `<li class="contact-info__social-item">` +
            `<a class="contact-info__social-link" href="${esc(item.href)}" rel="noopener">` +
              `<span class="contact-info__social-name">${esc(item.label)}</span>` +
              `<span class="contact-info__social-handle">${esc(item.handle)}</span>` +
            `</a>` +
          `</li>`
      )
      .join('')
  }

  /* ----------------------------------------------------------- questions */

  const faqMount = qs('[data-ci-faq]', root)
  if (faqMount) {
    faqMount.innerHTML =
      `<div class="acc contact-info__acc" data-acc data-acc-single="true">` +
      pickQuestions().map(questionHTML).join('') +
      `</div>`
  }

  /* ----------------------------------------------------------------- map */

  const mapMount = qs('[data-ci-map]', root)
  if (mapMount) {
    const streetLine = abbreviate(address.line1)
    const streetOnly = streetLine.replace(/^\d+\s+/, '')
    mapMount.innerHTML = buildMap(streetLine, streetOnly)
  }

  // Wire the accordion (and any button inside the rendered markup) now: the
  // kit's own observer is debounced, and a panel that opens two frames late
  // reads as a glitch.
  ctx.bus?.emit?.('ui:refresh')

  /* ------------------------------------------------------------ entrance */

  if (reduced || !mapMount) return

  const svg = qs('svg', mapMount)
  if (!svg) return

  // Alleys carry a CSS dash pattern that DrawSVG would overwrite, so they
  // fade in with the blocks instead of drawing on.
  const blocks = qsa(`.${M}block, .${M}alley`, svg)
  const strokes = qsa(
    `.${M}street:not(.${M}alley), .${M}major, .${M}hwy, .${M}rail, .${M}bridge, .${M}scalebar`,
    svg
  )
  const water = qs('[data-ci-water]', svg)
  const pin = qs('[data-ci-pin]', svg)
  const marks = qsa(`text, .${M}plaque, .${M}compass`, svg)

  const tl = sceneTimeline(mapMount, { start: 'top 82%' })

  if (blocks.length) {
    tl.from(blocks, { opacity: 0, duration: 0.5, stagger: { each: 0.007, from: 'random' } }, 0)
  }
  if (strokes.length) {
    tl.fromTo(
      strokes,
      { drawSVG: '50% 50%' },
      { drawSVG: '0% 100%', duration: 0.9, stagger: 0.02, ease: EASE.soft },
      0.12
    )
  }
  if (water) tl.from(water, { opacity: 0, duration: 0.9, ease: EASE.soft }, 0.35)
  if (marks.length) tl.from(marks, { opacity: 0, duration: 0.5, stagger: 0.04 }, 0.9)
  if (pin) {
    tl.from(pin, { scale: 0, svgOrigin: `${PIN.x} ${PIN.y}`, duration: 0.8, ease: 'back.out(2.1)' }, 1.05)
  }

  // Hand the drawing back to the browser once it has landed, so nothing keeps
  // a stale inline transform or a dash offset.
  tl.add(() => {
    gsap.set([...blocks, ...marks], { clearProps: 'opacity' })
    if (strokes.length) gsap.set(strokes, { clearProps: 'opacity,strokeDasharray,strokeDashoffset' })
    if (water) gsap.set(water, { clearProps: 'opacity' })
    if (pin) gsap.set(pin, { clearProps: 'transform' })
  })
}
