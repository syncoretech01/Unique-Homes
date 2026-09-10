/* ============================================================================
   JOURNAL INDEX — the whole of the writing, on one page.

   Three movements:

     1  A featured entry across the full measure. Its drawing drifts inside a
        clipped frame on a scrubbed trigger and the headline releases line by
        line through the shared reveal engine.

     2  A filterable editorial index. Category chips are derived from the data,
        and filtering runs through GSAP Flip: survivors translate to their new
        slots, leavers scale out from an absolute position, entrants scale in.

     3  A list sign-up wired to the UI kit's [data-form] validation, with a
        success state that tells the truth — nothing is sent anywhere.

   Entries have no routes in this build, so a "read" affordance expands the
   entry inline: the card takes the full measure, unrolls a reading panel of
   real body copy and a pull-quote, and everything around it Flips out of the
   way. Escape, a close button and a second click all close it again.

   Only transform, opacity and clip-path are ever animated — including through
   Flip, which is asked to express any dimension change as a scale rather than
   as width and height.
   ========================================================================== */
import './journal-index.css'
import { gsap, Flip, EASE, DUR, queueRefresh } from '../../core/motion.js'
import { scrollTo } from '../../core/scroll.js'
import { qs, qsa, clamp, pad } from '../../lib/utils.js'
import { plateHTML, blueprintBackgroundCSS } from '../../lib/drawings.js'
import { journal } from '../../data/content.js'
import { contact } from '../../data/site.js'


/**
 * Body copy for the inline reading panels. A string is a paragraph; an object
 * with a `quote` key is the pull-quote.
 */
const BODY = {
  'first-submittal': [
    'The forty hours are not spread thinly across the set. They land in three places, and skipping any one of them is what brings the review back.',
    'The first is the code summary. Before a wall is drawn we write the governing constraints onto the cover sheet in the reviewer’s own vocabulary: zoning district, setbacks, height envelope, impervious cover, occupancy and construction type, wind speed and exposure category, and the edition of every code we are working to. A plans examiner who finds those numbers in the first thirty seconds spends the rest of their time reading the drawings instead of hunting for the basics.',
    { quote: 'A plans examiner is not looking for beauty. They are looking for the numbers that let them stop looking.' },
    'The second is a coordination review — half a day with the architectural, structural and civil sheets open side by side and nobody permitted to defend their own work. Beam depths get checked against ceiling heights, finished floor against the grading plan, the header schedule against the window schedule. It is dull, and it catches the things that would otherwise arrive as an RFI in month four.',
    'The third is a read-through by somebody who has not touched the project. They read the set cold, in sheet order, the way an examiner will, and write down every question they cannot answer from the drawings alone. Each question becomes a note, a dimension or a detail before the set is issued. Forty hours in, four hundred out, and a client on site in March rather than July.',
  ],

  'impervious-cover': [
    'Almost every lot we work on in Central Texas reaches its impervious cover limit before the house does anything interesting. The drive, the turnaround, the walks and the terrace routinely take a third of the allowance, and by the time anyone notices, the plan has been loved for six weeks and the only thing left to cut is a room.',
    'So we count cover before we design. The survey arrives, the allowance is worked out from the zoning district and the lot area, and a one-page budget gets written: drive and approach, walks, terrace, pool deck, covered porch, roof. Every line is a number somebody has to defend in front of the others. What is left over is the house footprint, and it is usually smaller and considerably better than the one anybody had in mind.',
    { quote: 'The cheapest square foot in the project is the one you win back from the driveway.' },
    'Then the trade study. We test three drive positions against the same plan — a straight run to a front-loaded garage, a side-loaded court, and a shared approach with a narrowed throat — and price each one in cover rather than in dollars. Moving the garage to the side has bought a study, a mud room, and on one lot south of the river an entire second bathroom.',
    'Permeable paving is worth asking about and never worth assuming. Jurisdictions credit it differently, several only with a maintenance agreement recorded against the title, and a credit you cannot document is a credit you do not have. We ask the reviewer before we draw it and write their answer on the site plan, so the next person to read the sheet does not have to ask again.',
  ],

  'renders-that-lie': [
    'There is a version of this business where the visualisation is made in a separate file, by a separate person, from a set of PDFs. It is faster and it is cheaper, and what it produces is a picture of a building that does not exist — close enough to sell, far enough to hurt.',
    'Ours hurt once. A render showed a run of glazing at a head height the framing could not carry, because the render model had been built from a design-stage plan and the structure moved afterwards. Nobody lied. The two files simply stopped speaking to each other, and the client approved the wrong one.',
    { quote: 'If the render and the permit set disagree, one of them is going to be demolished.' },
    'The fix was not better rendering. It was deleting the second model. Cameras are now saved as views inside the coordinated model, materials come from the same schedule the specification reads from, and the lighting is set to the real orientation through the real glazing. If a beam grows, the render grows with it the next time it is issued.',
    'The discipline cuts both ways, and that is the point of it. You cannot render a soffit you have not detailed or a stone you have not specified, so the visualisation stops being a mood and starts being evidence. The images take longer to make. They are also the only images we are willing to hand to a builder.',
  ],

  'old-houses': [
    'Nine out of ten additions we take on begin with a building nobody has a drawing for. There may be a plat, a 1954 permit card and a listing floor plan drawn by an agent with a tape measure and an optimistic streak. None of that is a base drawing.',
    'So we survey it. A laser scan around the exterior and through the principal rooms, hand dimensions everywhere the scanner cannot reach, and opened-up checks at the points that matter — a floor register, a closet ceiling, the crawlspace, the attic gable. Two people, most of a day, and the whole thing modelled the same week while the building is still fresh in mind.',
    { quote: 'An as-built that hides its tolerances is a guess wearing a stamp.' },
    'Then the honest part. A 1920s bungalow is not square, its floors are not level and its walls are not the thickness anybody says they are. Our as-built sheets carry a tolerance note stating what was measured, what was inferred and where the risk sits — typically “exterior wall thickness verified at three locations; assume ±3/4 inch elsewhere”. That sentence is worth more to a framer than another week of measuring.',
    'The addition is then designed to touch the old house in as few places as possible, and every one of those places is detailed at a scale where the tolerance can be absorbed. Not because old houses are fragile, but because the cheapest way to handle an unknown is to design a joint that does not care what the answer turns out to be.',
  ],

  'reading-a-survey': [
    'A topographic survey arrives as one sheet of very small type, and most people look at the boundary and stop. There is more in it than in any other document you will be handed, and the important parts take about ten minutes to get out.',
    'Start with the contours and ignore their values. What matters is spacing: lines close together are steep, lines far apart are flat, and the place where they crowd is where retaining, stairs or expense will happen. Trace the routes that run downhill and you have the drainage. Water leaves the lot somewhere, and there are usually only one or two somewheres.',
    { quote: 'Find where the water leaves and the lot has already told you where the house wants to sit.' },
    'Then read the boundary and everything hanging off it. Easements are the ones that bite — a ten-foot public utility easement across the rear is ten feet you cannot build in, and a drainage easement is often worse because it governs what you may put on top of it as well. Setbacks, the front-yard average on an established street and any recorded building line belong on the same tracing.',
    'Last, the furniture. The benchmark and its datum, the trees with species and diameter, the sanitary main with its invert, and the finished floors of the houses either side. The invert decides whether the house can drain by gravity. The tree diameters decide whether the driveway is legal. Neither of them is on the pretty part of the drawing.',
  ],

  'cover-sheet': [
    'A cover sheet carrying a rendering and nothing else is a wasted page. Ours are the busiest sheet in the set, because the cover is where a reader decides how much of the rest of it they are going to trust.',
    'It holds the sheet index, the project data block, the applicable code editions, the design criteria, the general notes that actually govern, the deferred submittal list, and a vicinity map with north pointing the way it points on every other sheet. If a question can be answered once for the whole set, it is answered here and nowhere else.',
    { quote: 'Any question a reviewer has to ask twice belongs on the cover sheet.' },
    'Sheet numbering is part of the same argument. G for general, C for civil, A for architectural, S for structural, in that order, numbered so that inserting a sheet in month five does not renumber the set. The index is generated from the model rather than typed, which makes a sheet that exists but is not listed impossible instead of merely unlikely.',
    'None of this is glamorous and all of it gets read. When the revision cloud finally arrives, the change is logged on the cover with a date and a one-line description, and eighteen months later that column is the only reliable account of what happened, when, and at whose request.',
  ],

  'staging-an-addition': [
    'A good number of our clients build in two moves: what they can afford now, and what they will need when the children are older or a parent moves in. The second move is usually a decade out, and almost always cheaper if it is drawn today.',
    'Three things have to be settled in the first phase because they cannot be undone cheaply. The structure — whether the wall that comes out in 2035 is load-bearing, and if it is, what will carry it. The services — where the panel, the water main and the drainage stub out, and whether they have capacity for the second phase. And the roof geometry, because a roof that was never planned to grow always ends up looking interrupted.',
    { quote: 'Phase one pays for the walls. Phase two pays for the decisions you made in phase one.' },
    'Stubbing a drain and a conduit to a future wall costs a few hundred dollars while the trench is still open. Cutting the same slab later costs several thousand and a week of nobody using the kitchen. We mark those stubs on the plan with their inverts and photograph them before the pour, and the photographs go into the closeout set.',
    'The future phase is documented as a dashed overlay on the permit set, clearly labelled as not in this contract. Reviewers are comfortable with it, appraisers understand it, and in ten years the next architect — who may well not be us — opens one file and can see exactly what was left ready and what was not.',
  ],

  'pier-or-slab': [
    'The foundation is the one decision homeowners arrive with an opinion about, usually inherited from a relative who had a bad experience in a different soil. The lot settles it, and in most cases the lot has already been tested.',
    'Read the geotechnical report before anything else. Across much of Central Texas the number that matters is the potential vertical rise — how far the clay can lift when it takes on water. Under about an inch, a properly stiffened and post-tensioned slab is straightforward. Above two or three, either the slab becomes much deeper and much more expensive, or the house goes on piers to a stable stratum and stops arguing with the clay altogether.',
    { quote: 'A foundation chosen by preference is a foundation you will discuss again later, with a crack gauge in your hand.' },
    'Then the site itself. More than about three feet of fall across the building footprint turns a slab into an earthworks project, and pier-and-beam begins to win on cost as well as on sense. A flood elevation can force the finished floor up, which piers do gracefully and a slab does with imported fill nobody wants to pay for. And a crawlspace is a serviceable place to run plumbing, which matters far more in year fifteen than in year one.',
    'Cost is the last question, not the first. On a flat, mild lot a slab is usually cheaper to build and easier to insulate. On a sloping lot with reactive clay it is neither. We price both against the same structural model and put the two numbers, and the page of the soil report that drove them, in front of the client on a single sheet.',
  ],
}

/* ========================================================================== */
/*  DRAWINGS                                                                  */
/* ========================================================================== */

/* Each category draws the sheet type that belongs to it, so the artwork says
   something about the entry rather than decorating it. Matched to the journal
   preview on the home page, so an entry looks the same wherever it appears. */
const KIND_BY_CATEGORY = {
  Documentation: 'detail',
  Civil: 'site',
  Visualisation: 'axon',
  Additions: 'plan',
  Structure: 'framing',
}
const FALLBACK_KINDS = ['plan', 'section', 'elevation', 'framing']

const SHEET_NAME = {
  plan: 'Ground floor plan',
  section: 'Section AA',
  elevation: 'Elevation',
  axon: 'Cutaway axonometric',
  site: 'Site plan',
  framing: 'Framing plan',
  detail: 'Wall section detail',
  contour: 'Contour survey',
  grid: 'Setting-out grid',
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"]/g, (c) => ESCAPES[c])

const ARROW =
  '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">' +
  '<path d="M2 8 8 2M3.4 2H8v4.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="square"/></svg>'

/** HSL to hex — SVG presentation attributes only take colours every engine
    parses identically, so an entry's hue is resolved here. */
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

/** Deterministic per-entry seed, so an entry draws the same sheet every visit. */
function seedOf(entry, i) {
  const id = String(entry.id || i)
  let s = 7
  for (let n = 0; n < id.length; n += 1) s = (s * 31 + id.charCodeAt(n)) % 9973
  return s + (i + 1) * 13
}

function kindOf(entry, i) {
  return KIND_BY_CATEGORY[entry.category] || FALLBACK_KINDS[i % FALLBACK_KINDS.length]
}

function plateFor(entry, i) {
  const hue = Number.isFinite(entry.hue) ? entry.hue : 24
  return {
    kind: kindOf(entry, i),
    a: hslHex(hue, 30, 95),
    b: hslHex(hue, 24, 86),
    ink: hslHex(hue, 46, 24),
    accent: hslHex(hue, 48, 40),
    seed: seedOf(entry, i),
  }
}

/* ========================================================================== */
/*  MARKUP                                                                    */
/* ========================================================================== */

function panelHTML(entry) {
  const blocks = (BODY[entry.id] || [])
    .map((block) =>
      typeof block === 'string'
        ? `<p class="journal-index__p">${esc(block)}</p>`
        : `<blockquote class="journal-index__quote"><p>${esc(block.quote)}</p></blockquote>`
    )
    .join('')

  return (
    '<div class="journal-index__panel-inner">' +
    `<p class="journal-index__panel-lede">${esc(entry.excerpt)}</p>` +
    `<div class="journal-index__panel-body">${blocks}</div>` +
    '<div class="journal-index__panel-foot">' +
    '<button class="btn btn--ghost btn--sm" type="button" data-ji-close>Close entry</button>' +
    '<p class="journal-index__panel-note">' +
    `Filed under ${esc(entry.category)} · ${esc(entry.readTime)} · ${esc(entry.date)} · press <kbd>Esc</kbd> to close` +
    '</p>' +
    '</div>' +
    '</div>'
  )
}

function cardHTML(entry, i, wide) {
  const panelId = `${entry.id}-panel`
  return (
    `<article class="journal-index__card${wide ? ' journal-index__card--wide' : ''}"` +
    ` id="${esc(entry.id)}" data-ji-entry data-ji-card data-ji-id="${esc(entry.id)}"` +
    ` data-ji-cat="${esc(entry.category)}" data-cursor="view" data-cursor-text="Read">` +
    '<div class="journal-index__card-main">' +
    '<div class="frame journal-index__card-frame">' +
    `<div class="journal-index__card-plate" data-ji-plate="${i}"></div>` +
    '</div>' +
    '<div class="journal-index__card-text">' +
    '<p class="journal-index__card-top">' +
    `<span class="journal-index__card-idx t-num">${esc(entry.index)}</span>` +
    `<span class="tag journal-index__card-tag">${esc(entry.category)}</span>` +
    '</p>' +
    '<h3 class="journal-index__card-title">' +
    `<a class="journal-index__card-link" href="#${esc(entry.id)}" data-ji-read` +
    ` aria-expanded="false" aria-controls="${esc(panelId)}">${esc(entry.title)}</a>` +
    '</h3>' +
    `<p class="journal-index__card-excerpt">${esc(entry.excerpt)}</p>` +
    '<p class="journal-index__card-meta">' +
    `<span>${esc(entry.date)}</span>` +
    '<span class="journal-index__dot" aria-hidden="true"></span>' +
    `<span>${esc(entry.readTime)}</span>` +
    '</p>' +
    '<span class="journal-index__read" aria-hidden="true">' +
    `<span class="journal-index__read-in">Read${ARROW}</span></span>` +
    '</div>' +
    '<button class="journal-index__close-x" type="button" data-ji-close aria-label="Close entry"></button>' +
    '</div>' +
    `<div class="journal-index__panel" id="${esc(panelId)}" data-ji-panel hidden>${panelHTML(entry)}</div>` +
    '</article>'
  )
}

function chipHTML(label, value, count, active) {
  return (
    `<button class="chip journal-index__chip" type="button" data-ji-filter="${esc(value)}"` +
    ` aria-pressed="${active ? 'true' : 'false'}">` +
    `<span class="journal-index__chip-label">${esc(label)}</span>` +
    `<span class="journal-index__chip-n t-num">${esc(pad(count))}</span>` +
    '</button>'
  )
}

/* ========================================================================== */
/*  INIT                                                                      */
/* ========================================================================== */

export default function initJournalIndex(ctx = {}) {
  const root = document.querySelector('[data-section="journal-index"]')
  if (!root) return

  const entries = Array.isArray(journal) ? journal : []
  if (!entries.length) return

  const featured = entries[0]
  const rest = entries.slice(1)

  const featuredEl = qs('[data-ji-featured]', root)
  const headEl = qs('[data-ji-head]', root)
  const gridEl = qs('[data-ji-grid]', root)
  const emptyEl = qs('[data-ji-empty]', root)
  const newsEl = qs('.journal-index__news', root)
  if (!featuredEl || !gridEl) return

  const reduced = !!ctx.reduced

  /* ---------------------------------------------------------------- FEATURED */

  featuredEl.id = featured.id
  featuredEl.dataset.jiId = featured.id
  featuredEl.dataset.jiCat = featured.category

  const set = (sel, text) => {
    const node = qs(sel, featuredEl)
    if (node) node.textContent = text
  }
  set('[data-ji-f-cat]', featured.category)
  set('[data-ji-f-date]', featured.date)
  set('[data-ji-f-title]', featured.title)
  set('[data-ji-f-time]', `${featured.readTime} read`)
  set('[data-ji-f-excerpt]', featured.excerpt)
  set('[data-ji-f-cap]', `Fig. ${featured.index} — ${SHEET_NAME[kindOf(featured, 0)] || 'Drawing'}`)

  const featuredCta = qs('[data-ji-read]', featuredEl)
  const featuredPanel = qs('[data-ji-panel]', featuredEl)
  if (featuredPanel) {
    featuredPanel.id = `${featured.id}-panel`
    featuredPanel.innerHTML = panelHTML(featured)
  }
  if (featuredCta) {
    featuredCta.setAttribute('href', `#${featured.id}`)
    featuredCta.setAttribute('aria-controls', `${featured.id}-panel`)
  }

  const featuredPlateHost = qs('[data-ji-f-plate]', featuredEl)
  if (featuredPlateHost) {
    featuredPlateHost.innerHTML = plateHTML(plateFor(featured, 0), {
      width: 1680,
      height: 1000,
      label: featured.category,
      index: featured.index,
      density: 1,
      strokeScale: 0.85,
    })
  }

  /* ------------------------------------------------------------------- INDEX */

  /* Every third card takes the full measure. Starting the run on the first
     card keeps the half-width cards in exact pairs for the seven entries the
     data currently holds, so the grid never leaves an orphan at rest. */
  gridEl.innerHTML = rest.map((entry, n) => cardHTML(entry, n + 1, n % 3 === 0)).join('')

  const cards = qsa('[data-ji-card]', gridEl)

  qsa('[data-ji-plate]', gridEl).forEach((host) => {
    const i = Number(host.dataset.jiPlate)
    const entry = entries[i]
    if (!entry) return
    host.innerHTML = plateHTML(plateFor(entry, i), {
      width: 1000,
      height: 760,
      label: entry.category,
      index: entry.index,
      density: 0.9,
      strokeScale: 1.1,
    })
  })

  /* ------------------------------------------------------------------- CHIPS */

  const chipsHost = qs('[data-ji-chips]', root)
  const countEl = qs('[data-ji-count]', root)
  const totalEl = qs('[data-ji-total]', root)

  const categories = []
  rest.forEach((entry) => {
    if (entry.category && !categories.includes(entry.category)) categories.push(entry.category)
  })
  const countIn = (cat) => rest.filter((entry) => entry.category === cat).length

  if (chipsHost) {
    chipsHost.innerHTML =
      chipHTML('All', 'all', rest.length, true) +
      categories.map((cat) => chipHTML(cat, cat, countIn(cat), false)).join('')
  }
  const chips = qsa('[data-ji-filter]', root)
  chips.forEach((chip) => chip.classList.toggle('is-active', chip.dataset.jiFilter === 'all'))

  if (totalEl) totalEl.textContent = pad(rest.length)
  if (countEl) countEl.textContent = pad(rest.length)

  /* -------------------------------------------------------------- NEWSLETTER */

  const newsGrid = qs('[data-ji-news-grid]', root)
  if (newsGrid) {
    newsGrid.style.backgroundImage = blueprintBackgroundCSS({ size: 26, major: 4, thickness: 1 })
  }
  qsa('[data-form-success-email]', root).forEach((slot) => {
    slot.setAttribute('href', `mailto:${contact.email}`)
    if (!slot.textContent.trim()) slot.textContent = contact.email
  })

  /* ======================================================================== */
  /*  STATE                                                                   */
  /* ======================================================================== */

  const entryEls = [featuredEl].concat(cards)
  const elOf = (id) => entryEls.find((el) => el.dataset.jiId === id) || null
  const isCard = (el) => !!el && el.hasAttribute('data-ji-card')

  let activeFilter = 'all'
  let openId = null

  /** Only ever asked to move elements whose own dimensions do not change. */
  function collectMovers(changing) {
    const movers = []
    if (headEl) movers.push(headEl)
    if (newsEl) movers.push(newsEl)

    const cardChanging = Array.from(changing).some((id) => id && id !== featured.id)
    if (cardChanging) {
      cards.forEach((card) => {
        if (changing.has(card.dataset.jiId)) return
        if (card.classList.contains('is-filtered-out')) return
        movers.push(card)
      })
    } else if (gridEl) {
      movers.push(gridEl)
    }
    return movers
  }

  function paintOpenState(nextId) {
    entryEls.forEach((el) => {
      const on = el.dataset.jiId === nextId
      el.classList.toggle('is-open', on)

      const panel = qs('[data-ji-panel]', el)
      if (panel) {
        panel.hidden = !on
        if (!on) gsap.set(panel, { clearProps: 'opacity,visibility,transform,clipPath' })
        else panel.setAttribute('tabindex', '-1')
      }

      qsa('[data-ji-read]', el).forEach((node) => node.setAttribute('aria-expanded', String(on)))

      /* A reading panel is for reading — hand the pointer back while it is up. */
      if (isCard(el)) {
        if (on) {
          el.removeAttribute('data-cursor')
          el.removeAttribute('data-cursor-text')
        } else {
          el.setAttribute('data-cursor', 'view')
          el.setAttribute('data-cursor-text', 'Read')
        }
      }
    })
  }

  /**
   * Move to a new open entry (or to none). Everything that is merely displaced
   * Flips; the entry that grew unrolls under a clip; the entry that shrank
   * fades back into its tile.
   */
  function applyOpen(nextId, animate) {
    const prevId = openId
    if (prevId === nextId) return
    openId = nextId

    const changing = new Set([prevId, nextId].filter(Boolean))
    const state = animate ? Flip.getState(collectMovers(changing)) : null

    paintOpenState(nextId)

    if (state) {
      Flip.from(state, {
        duration: 0.78,
        ease: EASE.out,
        scale: true,
        onComplete: queueRefresh,
      })
    } else {
      queueRefresh()
    }

    const prevEl = prevId ? elOf(prevId) : null
    const nextEl = nextId ? elOf(nextId) : null

    if (animate && isCard(prevEl)) {
      gsap.fromTo(
        prevEl,
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1, duration: DUR.base, ease: EASE.out, clearProps: 'opacity,transform' }
      )
    }

    if (!nextEl) return

    const panel = qs('[data-ji-panel]', nextEl)

    if (animate) {
      /* A card rebuilds its whole masthead, so the card unrolls; the featured
         entry keeps its masthead, so only the panel does. */
      const grow = isCard(nextEl) ? nextEl : panel
      if (grow) {
        gsap.fromTo(
          grow,
          { clipPath: 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: EASE.inOut, clearProps: 'clipPath' }
        )
      }
      const blocks = panel ? qsa('.journal-index__panel-inner > *', panel) : []
      if (blocks.length) {
        gsap.fromTo(
          blocks,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: DUR.slow,
            stagger: 0.07,
            delay: 0.2,
            ease: EASE.out,
            clearProps: 'opacity,transform',
          }
        )
      }
    }
  }

  /** Close first, so the outgoing panel does not simply blink out. */
  function closeEntry(animate = true) {
    if (!openId) return
    const el = elOf(openId)
    const panel = el ? qs('[data-ji-panel]', el) : null
    const trigger = el ? qs('[data-ji-read]', el) : null

    const finish = () => {
      applyOpen(null, animate && !reduced)
      if (trigger) trigger.focus({ preventScroll: true })
      clearHash()
    }

    if (!animate || reduced || !panel) {
      finish()
      return
    }
    gsap.to(panel, { opacity: 0, duration: 0.24, ease: EASE.inOut, onComplete: finish })
  }

  function openEntry(id, { animate = true, scroll = true } = {}) {
    const el = elOf(id)
    if (!el) return
    if (openId === id) {
      closeEntry(animate)
      return
    }

    const go = () => {
      applyOpen(id, animate && !reduced)
      writeHash(id)
      /* The panel is the new reading context — send the keyboard into it. */
      const panel = qs('[data-ji-panel]', el)
      if (panel) panel.focus({ preventScroll: true })
      if (scroll) {
        gsap.delayedCall(animate && !reduced ? 0.14 : 0, () =>
          scrollTo(el, { offset: -Math.round(window.innerHeight * 0.08) })
        )
      }
    }

    if (openId && animate && !reduced) {
      const prev = qs('[data-ji-panel]', elOf(openId))
      if (prev) {
        gsap.to(prev, { opacity: 0, duration: 0.2, ease: EASE.inOut, onComplete: go })
        return
      }
    }
    go()
  }

  function writeHash(id) {
    if (!window.history?.replaceState) return
    window.history.replaceState(null, '', `#${id}`)
  }
  function clearHash() {
    if (!window.history?.replaceState) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  /* ======================================================================== */
  /*  FILTERING                                                               */
  /* ======================================================================== */

  function applyFilter(next, animate) {
    if (next === activeFilter) return
    activeFilter = next

    /* An open card that the new filter would remove is closed first. */
    if (openId && openId !== featured.id) {
      const el = elOf(openId)
      if (el && next !== 'all' && el.dataset.jiCat !== next) applyOpen(null, false)
    }

    const state = animate ? Flip.getState(cards) : null

    let shown = 0
    cards.forEach((card) => {
      const match = next === 'all' || card.dataset.jiCat === next
      card.classList.toggle('is-filtered-out', !match)
      if (match) shown += 1
    })

    chips.forEach((chip) => {
      const on = chip.dataset.jiFilter === next
      chip.classList.toggle('is-active', on)
      chip.setAttribute('aria-pressed', String(on))
    })

    if (countEl) countEl.textContent = pad(shown)
    if (emptyEl) emptyEl.hidden = shown > 0

    if (state) {
      Flip.from(state, {
        duration: 0.66,
        ease: EASE.out,
        scale: true,
        absoluteOnLeave: true,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { opacity: 0, scale: 0.88 },
            { opacity: 1, scale: 1, duration: 0.55, ease: EASE.out, clearProps: 'transform' }
          ),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.88, duration: 0.4, ease: EASE.inOut }),
        onComplete: queueRefresh,
      })
    } else {
      queueRefresh()
    }
  }

  /* ======================================================================== */
  /*  EVENTS                                                                  */
  /* ======================================================================== */

  root.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const chip = target.closest('[data-ji-filter]')
    if (chip && root.contains(chip)) {
      event.preventDefault()
      applyFilter(chip.dataset.jiFilter || 'all', !reduced)
      return
    }

    const close = target.closest('[data-ji-close]')
    if (close && root.contains(close)) {
      event.preventDefault()
      closeEntry(true)
      return
    }

    const read = target.closest('[data-ji-read]')
    if (read && root.contains(read)) {
      // A modified click still means "open this somewhere else" — let it.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const holder = read.closest('[data-ji-entry]')
      if (!holder) return
      event.preventDefault()
      openEntry(holder.dataset.jiId, { animate: true })
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openId) return
    // The site menu locks scroll while it is up; Escape belongs to it first.
    if (document.documentElement.classList.contains('is-scroll-locked')) return
    closeEntry(true)
  })

  /* ======================================================================== */
  /*  MOTION                                                                  */
  /* ======================================================================== */

  if (!reduced) {
    /* Cards are Flip targets, so their entrance clears its own inline styles
       rather than leaving a transform for Flip to reason about. */
    cards.forEach((card) => {
      gsap.set(card, { y: 32, opacity: 0 })
      gsap.to(card, {
        y: 0,
        opacity: 1,
        duration: DUR.slow,
        ease: EASE.out,
        clearProps: 'opacity,transform',
        scrollTrigger: { trigger: card, start: 'top 88%', once: true },
      })
    })

    /* The featured drawing drifts inside its frame — symmetric, so the
       oversized plate never shows an edge at either end of the range. */
    const frame = qs('.journal-index__f-frame', featuredEl)
    if (featuredPlateHost && frame) {
      gsap.fromTo(
        featuredPlateHost,
        { yPercent: -8 },
        {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: frame,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        }
      )
    }
  }

  /* ------------------------------------------------------------- DEEP LINKS */

  let wanted = ''
  try {
    wanted = decodeURIComponent((window.location.hash || '').slice(1))
  } catch (err) {
    wanted = ''
  }
  if (wanted && elOf(wanted)) {
    applyOpen(wanted, false)
    const land = () =>
      scrollTo(elOf(wanted), { offset: -Math.round(window.innerHeight * 0.08), duration: 1 })
    const bus = ctx.bus
    if (bus?.once && !bus.hasFired?.('intro:done')) bus.once('intro:done', () => gsap.delayedCall(0.3, land))
    else gsap.delayedCall(0.45, land)
  }
}
