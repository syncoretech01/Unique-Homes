/* ============================================================================
   PAGE HERO
   One markup partial serves five pages. The identity — eyebrow, headline,
   lede, meta row, breadcrumb, drawing kind and drawing seed — is selected
   here from ctx.page, so services / projects / studio / journal / contact all
   share a single layout and a single intro choreography.

   Motion: the headline is split into masked lines and released only after
   `intro:done`, alongside a clip-reveal on the framed plate and a hairline
   that draws the full width of the section. Scroll parallax is declared in
   the markup (the reveal engine owns it); the pointer parallax below is the
   only bespoke pointer work, and it is desktop + fine-pointer only.
   ========================================================================== */
import './page-hero.css'
import { gsap, ScrollTrigger, EASE, DUR, splitText, MQ } from '../../core/motion.js'
import { drawingSVG, mountPlate } from '../../lib/drawings.js'
import { el, pad, clamp } from '../../lib/utils.js'
import { brand, contact, nav, cta } from '../../data/site.js'
import { services } from '../../data/services.js'
import { projects } from '../../data/projects.js'
import { journal } from '../../data/content.js'

/* ------------------------------------------------------------------ DATA */

const projectYears = projects
  .map((p) => Number.parseInt(p.year, 10))
  .filter((y) => Number.isFinite(y))

const projectSpan = projectYears.length
  ? `${Math.min(...projectYears)} — ${Math.max(...projectYears)}`
  : ''

const latestEntry = journal[0]

/**
 * Per-page identity. `kind` and `seed` drive both drawings: the large,
 * low-contrast graphic behind the type and the small framed plate beside it
 * (the plate keeps the seed, the background is offset so the two are clearly
 * different sheets from the same set).
 */
const CONTENT = {
  services: {
    eyebrow: 'What we do',
    title: 'Three services,\none coordinated model.',
    lede:
      'Detailed structural drawing sets, comprehensive civil site plans for new builds and additions, and photoreal visualisation produced in house — three disciplines drawn from one model, so a change to a beam reaches the schedule, the section and the render in the same pass.',
    meta: [`${pad(services.length)} disciplines`, 'One coordinated model', 'Drawn in house'],
    kind: 'framing',
    seed: 27,
    caption: 'Roof framing plan',
  },

  projects: {
    eyebrow: 'Selected work',
    title: 'Houses, additions\nand the drawings behind them.',
    lede:
      'New builds, additions and adaptive reuse — documented, engineered and visualised in this office. Every project is shown the way it was drawn: plans, sections and cutaway axonometrics rather than photographs.',
    meta: [`${pad(projects.length)} projects`, projectSpan, 'Central Texas'],
    kind: 'axon',
    seed: 41,
    caption: 'Cutaway axonometric',
  },

  studio: {
    eyebrow: 'The practice',
    title: 'A studio that draws\nwhat it engineers.',
    lede:
      'A construction document is a promise that the thing can be built — at this cost, on this lot, under this code. We keep the promise by doing the architecture, the engineering and the visualisation in one room.',
    meta: [
      `Est. ${brand.since} — ${contact.address.city}, ${contact.address.state}`,
      'Registered practice · TX PE firm',
    ],
    kind: 'plan',
    seed: 8,
    caption: 'Ground floor plan',
  },

  journal: {
    eyebrow: 'Journal',
    title: 'Notes from\nthe drawing board.',
    lede:
      'Essays on documentation, permitting, civil strategy and visualisation — what the last set of drawings taught us, written down before the next one starts.',
    meta: [
      `${pad(journal.length)} entries`,
      latestEntry ? `Latest — ${latestEntry.date}` : 'Written in the studio',
    ],
    kind: 'detail',
    seed: 63,
    caption: 'Wall section detail',
  },

  contact: {
    eyebrow: 'Start a project',
    title: 'Tell us about\nthe site.',
    lede: cta.body,
    meta: [contact.hours, 'Reply within two working days'],
    kind: 'site',
    seed: 19,
    caption: 'Site plan',
  },
}

/* ----------------------------------------------------------------- UTILS */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ENTITIES[c])

/** Drawing colours come from the token layer, never from literals. */
function readPalette() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback
  return {
    ink: v('--c-blueprint', '#27415A'),
    accent: v('--c-terra', '#AE4E2A'),
    plateA: v('--c-bone', '#F3EFE8'),
    plateB: v('--c-sand', '#DFD7C9'),
  }
}

/** "30.2672° N   97.7431° W" — the studio, as a surveyor would write it. */
function formatCoords({ lat = 0, lng = 0 } = {}) {
  const ns = `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'}`
  const ew = `${Math.abs(lng).toFixed(4)}° ${lng < 0 ? 'W' : 'E'}`
  return `${ns} / ${ew}`
}

/** The first identified section after the hero — the scroll cue's target. */
function nextSectionId(root) {
  let node = root.nextElementSibling
  while (node) {
    if (node.id && node.matches('[data-section]')) return node.id
    node = node.nextElementSibling
  }
  return ''
}

/** Fonts settled, then the intro finished — with a hard release either way. */
function heroCue(ctx) {
  const fonts = document.fonts?.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve()

  const intro = new Promise((resolve) => {
    const bus = ctx.bus
    if (!bus || typeof bus.once !== 'function' || bus.hasFired?.('intro:done')) {
      resolve()
      return
    }
    let settled = false
    const release = () => {
      if (settled) return
      settled = true
      resolve()
    }
    bus.once('intro:done', release)
    // Insurance: the headline is never left hidden if the intro never lands.
    setTimeout(release, 5200)
  })

  return Promise.all([fonts, intro])
}

/* ------------------------------------------------------------------ INIT */

export default function initPageHero(ctx = {}) {
  const root = document.querySelector('[data-section="page-hero"]')
  if (!root) return

  const page = ctx.page || document.documentElement.dataset.page || ''
  const cfg = CONTENT[page]
  // The partial ships on five configured pages only; anywhere else the static
  // brand-level copy in the markup already stands on its own.
  if (!cfg) return

  const q = (sel) => root.querySelector(sel)
  const entry = nav.find((item) => item.href === `/${page}/`)

  /* ------------------------------------------------------------- CONTENT */
  const titleEl = q('[data-ph-title]')
  const eyebrowEl = q('[data-ph-eyebrow]')
  const indexEl = q('[data-ph-index]')
  const crumbEl = q('[data-ph-crumb]')
  const coordsEl = q('[data-ph-coords]')
  const ledeEl = q('[data-ph-lede]')
  const metaEl = q('[data-ph-meta]')
  const capEl = q('[data-ph-cap]')

  if (titleEl) titleEl.innerHTML = cfg.title.split('\n').map(escapeHTML).join('<br>')
  if (eyebrowEl) eyebrowEl.textContent = cfg.eyebrow
  if (ledeEl) ledeEl.textContent = cfg.lede
  if (crumbEl) crumbEl.textContent = entry ? entry.label : ''
  if (coordsEl) coordsEl.textContent = formatCoords(contact.coords)
  if (indexEl && entry) indexEl.textContent = `${entry.index} / ${pad(nav.length)}`
  if (capEl) capEl.textContent = `Fig. ${entry ? entry.index : pad(1)} — ${cfg.caption}`

  if (metaEl) {
    metaEl.textContent = ''
    cfg.meta
      .filter(Boolean)
      .forEach((text) => metaEl.appendChild(el('li', { class: 'page-hero__meta-item', text })))
  }

  /* ------------------------------------------------------------ DRAWINGS */
  const palette = readPalette()
  const drawHost = q('[data-ph-drawing]')
  const plateHost = q('[data-ph-plate]')

  if (drawHost) {
    drawHost.innerHTML = drawingSVG(cfg.kind, {
      seed: cfg.seed + 400,
      ink: palette.ink,
      accent: palette.accent,
      width: 1680,
      height: 1040,
      density: 0.95,
      strokeScale: 0.9,
      showTitleBlock: false,
    })
  }

  if (plateHost) {
    mountPlate(
      plateHost,
      {
        kind: cfg.kind,
        a: palette.plateA,
        b: palette.plateB,
        ink: palette.ink,
        accent: palette.accent,
        seed: cfg.seed,
      },
      { ratio: '4/5', density: 0.8, strokeScale: 0.55, showTitleBlock: false }
    )
  }

  /* ----------------------------------------------------------- SCROLL CUE */
  const cue = q('[data-ph-cue]')
  const cueWrap = q('.page-hero__cue-wrap')
  const nextId = nextSectionId(root)
  if (cue) {
    if (nextId) cue.dataset.scrollTo = `#${nextId}`
    else if (cueWrap) cueWrap.hidden = true
  }

  /* Everything above is the static state. Reduced motion stops here. */
  if (ctx.reduced) return

  /* --------------------------------------------------------------- MOTION */
  const art = q('.page-hero__art')
  const artPoint = q('[data-ph-art-point]')
  const plateFig = q('.page-hero__plate')
  const plateArt = plateHost ? plateHost.querySelector('.plate') : null
  const ruleLine = q('[data-ph-rule]')
  const crumbs = q('.page-hero__crumbs')
  const eyebrow = q('.page-hero__eyebrow')
  const metaItems = Array.from(root.querySelectorAll('.page-hero__meta-item'))

  const risers = [crumbs, coordsEl, eyebrow, ledeEl, capEl, cueWrap, ...metaItems].filter(Boolean)

  gsap.set(risers, { autoAlpha: 0, y: 18 })
  if (titleEl) gsap.set(titleEl, { autoAlpha: 0 })
  if (art) gsap.set(art, { autoAlpha: 0 })
  if (plateHost) gsap.set(plateHost, { clipPath: 'inset(0 0 100% 0)' })
  if (plateArt) gsap.set(plateArt, { scale: 1.16 })
  if (ruleLine) gsap.set(ruleLine, { scaleX: 0 })

  let played = false

  const play = () => {
    if (played) return
    played = true

    const tl = gsap.timeline({ defaults: { ease: EASE.out, duration: DUR.slow } })

    if (art) tl.to(art, { autoAlpha: 1, duration: DUR.cinematic, ease: EASE.soft }, 0)
    if (ruleLine) tl.to(ruleLine, { scaleX: 1, duration: 1.5, ease: EASE.inOut }, 0.04)

    tl.to([crumbs, coordsEl].filter(Boolean), {
      autoAlpha: 1,
      y: 0,
      duration: DUR.base,
      stagger: 0.06,
    }, 0.06)

    if (eyebrow) tl.to(eyebrow, { autoAlpha: 1, y: 0, duration: DUR.base }, 0.14)

    if (titleEl) {
      let firstSplit = true
      splitText(titleEl, {
        type: 'lines',
        mask: 'lines',
        onSplit(self) {
          // Re-splits (resize, font swap) restore the rested state instead of
          // replaying the entrance.
          if (!firstSplit) {
            gsap.set(self.lines, { yPercent: 0, rotate: 0 })
            return undefined
          }
          firstSplit = false
          return tl.fromTo(
            self.lines,
            { yPercent: 118, rotate: 1.6 },
            { yPercent: 0, rotate: 0, duration: 1.25, stagger: 0.085, ease: EASE.out },
            0.16
          )
        },
      })
      gsap.set(titleEl, { autoAlpha: 1 })
    }

    if (plateHost) {
      tl.to(plateHost, { clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: EASE.inOut }, 0.3)
    }
    if (plateArt) tl.to(plateArt, { scale: 1, duration: 1.7, ease: EASE.out }, 0.3)
    if (ledeEl) tl.to(ledeEl, { autoAlpha: 1, y: 0 }, 0.42)
    if (metaItems.length) {
      tl.to(metaItems, { autoAlpha: 1, y: 0, duration: DUR.base, stagger: 0.07 }, 0.62)
    }
    if (cueWrap) tl.to(cueWrap, { autoAlpha: 1, y: 0, duration: DUR.base }, 0.88)
    if (capEl) tl.to(capEl, { autoAlpha: 1, y: 0, duration: DUR.base }, 1.0)
  }

  heroCue(ctx).then(play)

  /* The cue belongs to the first screen only. */
  if (cue) {
    gsap.to(cue, {
      opacity: 0,
      y: 14,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: '+=260', scrub: true },
    })
  }

  /* ----------------------------------------------------- POINTER PARALLAX */
  const mq = gsap.matchMedia()

  mq.add(`${MQ.desktop} and ${MQ.hover}`, () => {
    if (!artPoint && !plateFig) return undefined

    const to = (node, prop, amount) => {
      if (!node) return () => {}
      const set = gsap.quickTo(node, prop, { duration: 1.1, ease: 'power3.out' })
      return (n) => set(n * amount)
    }
    const artX = to(artPoint, 'x', 24)
    const artY = to(artPoint, 'y', 15)
    const plateX = to(plateFig, 'x', -8)
    const plateY = to(plateFig, 'y', -6)

    let vw = window.innerWidth || 1
    let vh = window.innerHeight || 1
    let live = true

    const rest = () => {
      artX(0)
      artY(0)
      plateX(0)
      plateY(0)
    }

    const onMove = (e) => {
      if (!live) return
      const nx = clamp((e.clientX / vw) * 2 - 1, -1, 1)
      const ny = clamp((e.clientY / vh) * 2 - 1, -1, 1)
      artX(nx)
      artY(ny)
      plateX(nx)
      plateY(ny)
    }

    const onResize = () => {
      vw = window.innerWidth || 1
      vh = window.innerHeight || 1
    }

    // Off-screen the hero costs nothing.
    const gate = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        live = self.isActive
        if (!live) rest()
      },
    })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
      gate.kill()
      gsap.set([artPoint, plateFig].filter(Boolean), { x: 0, y: 0 })
    }
  })
}
