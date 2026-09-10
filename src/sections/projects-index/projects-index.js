/* ============================================================================
   PROJECTS INDEX
   ----------------------------------------------------------------------------
   The projects page grid, in two views, plus an immersive zoom into a full
   case study.

   THE INDEX
     · a filter bar built from `projectFilters`, with a Flip.fit() indicator;
     · filtering re-composes an asymmetric editorial grid — spans are assigned
       so every row fills exactly, so removing four projects genuinely
       re-lays-out the page rather than leaving holes. GSAP Flip moves the
       survivors, scales the leavers out and the entrants in;
     · a Grid / Index view toggle, also Flip-driven, where the index view is a
       hairline-ruled table whose rows summon a cursor-following plate.

   THE ZOOM
     Clicking a card takes a Flip state of that card's plate, reparents the
     very same node into the overlay hero and lets Flip grow it into a
     full-bleed image while the grid falls back, blurs and the overlay's paper
     wipes up behind it. Closing runs Flip.fit() in the opposite direction —
     the plate shrinks back onto its card before the paper drops away, and the
     node is handed back to the grid at the end.

   Everything degrades: reduced motion swaps every Flip for an instant state
   change, coarse pointers lose the hover preview, and under 900px the overlay
   becomes a sheet that slides up. `stopScroll()` / `startScroll()` are always
   paired, and the background is inert while the dialog is open.
   ========================================================================== */
import './projects-index.css'
import { gsap, ScrollTrigger, Flip, EASE, splitText, queueRefresh } from '../../core/motion.js'
import { stopScroll, startScroll } from '../../core/scroll.js'
import { mountPlate, plateHTML } from '../../lib/drawings.js'
import { qs, qsa, pad, clamp, debounce } from '../../lib/utils.js'
import { projects, projectFilters, projectById } from '../../data/projects.js'

/* ------------------------------------------------------------------ COPY */

/** Title-block language for each generated drawing kind. */
const KIND_LABEL = {
  plan: 'Ground floor plan',
  section: 'Section AA',
  elevation: 'Elevation',
  axon: 'Cutaway axonometric',
  site: 'Site plan',
  framing: 'Framing plan',
  detail: 'Wall section detail',
  contour: 'Existing contours',
  grid: 'Setting-out grid',
}

/** Kinds a case study can draw its two supporting sheets from. */
const EXTRA_KINDS = ['plan', 'section', 'elevation', 'axon', 'site', 'framing', 'detail', 'contour']

/* One shared plate recipe, so a project's drawing is identical on the card,
   in the hover preview and blown up to full-bleed in the case study. */
const PLATE_OPTS = { ratio: '3 / 2', density: 0.92, strokeScale: 0.8, showTitleBlock: false }

/* --------------------------------------------------------------- LAYOUT */

/* Column spans per grid slot, per breakpoint. Each run of spans adds up to a
   full row, so the editorial rhythm survives any filter. */
const PATTERNS = {
  lg: { cols: 12, spans: [7, 5, 5, 7, 8, 4, 6, 6] },
  md: { cols: 8, spans: [5, 3, 3, 5, 8, 4, 4, 4] },
  sm: { cols: 2, spans: [2, 1, 1, 2, 2, 1, 1, 2] },
}

/* Aspect ratio follows the final span, so a card that grows to fill a row
   also becomes a wider plate. */
const RATIOS = {
  lg: { 12: '16 / 9', 11: '16 / 9', 10: '16 / 9', 9: '16 / 9', 8: '16 / 9', 7: '4 / 3', 6: '5 / 4', 5: '3 / 4', 4: '2 / 3', 3: '2 / 3', 2: '2 / 3', 1: '2 / 3' },
  md: { 8: '16 / 9', 7: '16 / 9', 6: '3 / 2', 5: '4 / 3', 4: '1 / 1', 3: '3 / 4', 2: '3 / 4', 1: '3 / 4' },
  sm: { 2: '4 / 3', 1: '3 / 4' },
}

const VAR_NAMES = {
  lg: ['--pi-span', '--pi-ar'],
  md: ['--pi-span-md', '--pi-ar-md'],
  sm: ['--pi-span-sm', '--pi-ar-sm'],
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
  ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ENTITIES[c])

/** Leading-number split so '9.2 m', '24 kL/yr' and '76%' can all count up. */
const NUM_RE = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/

/**
 * Two supporting drawings per project, deterministic from its plate seed and
 * never the same kind as the project's own plate (or as each other).
 */
function extraKinds(project) {
  const pool = EXTRA_KINDS.filter((k) => k !== project.plate.kind)
  const seed = Math.abs(Math.round(Number(project.plate.seed) || 1))
  const first = pool[seed % pool.length]
  const rest = pool.filter((k) => k !== first)
  const second = rest[(seed * 7 + 3) % rest.length]
  return [first, second]
}

/* ------------------------------------------------------------------ INIT */

export default function initProjectsIndex(ctx = {}) {
  const root = document.querySelector('[data-section="projects-index"]')
  if (!root) return

  const reduced = !!ctx.reduced
  const touch = !!ctx.touch

  const inner = qs('[data-pi-inner]', root)
  const stage = qs('[data-pi-stage]', root)
  const list = qs('[data-pi-list]', root)
  const emptyEl = qs('[data-pi-empty]', root)
  const filterBar = qs('[data-pi-filters]', root)
  const pill = qs('[data-pi-pill]', root)
  const viewBar = qs('[data-pi-views]', root)
  const viewPill = qs('[data-pi-view-pill]', root)
  const countEl = qs('[data-pi-count]', root)
  const countWord = qs('[data-pi-count-word]', root)
  const preview = qs('[data-pi-preview]', root)
  const overlay = qs('[data-pi-overlay]', root)
  if (!stage || !list || !filterBar || !viewBar || !overlay) return

  /* The dialog and the floating preview own the viewport, so they live at the
     top of <body> — that also lets `inert` cover the whole page cleanly. */
  document.body.appendChild(overlay)
  if (preview) document.body.appendChild(preview)

  /* ---------------------------------------------------------- FILTER BAR */
  filterBar.insertAdjacentHTML(
    'beforeend',
    projectFilters
      .map(
        (f, i) =>
          `<button class="chip projects-index__chip${i === 0 ? ' is-active' : ''}" type="button"` +
          ` data-pi-filter="${esc(f.id)}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(f.label)}</button>`
      )
      .join('')
  )
  const chips = qsa('[data-pi-filter]', filterBar)
  const viewBtns = qsa('[data-pi-view]', viewBar)

  /* --------------------------------------------------------------- CARDS */
  list.innerHTML = projects.map(cardHTML).join('')
  const cards = qsa('[data-pi-card]', list)
  const cardById = new Map(cards.map((c) => [c.dataset.id, c]))

  cards.forEach((card) => {
    const project = projectById(card.dataset.id)
    if (!project) return
    mountPlate(qs('[data-pi-plate]', card), project.plate, PLATE_OPTS)
  })

  /* ---------------------------------------------------------------- STATE */
  let activeFilter = projectFilters[0] ? projectFilters[0].id : 'all'
  let view = 'grid'
  let revealBatch = null
  const revealed = new WeakSet()

  const matches = (card, id) => {
    if (id === 'all') return true
    const project = projectById(card.dataset.id)
    return !!project && project.tags.includes(id)
  }
  const visibleCards = () => cards.filter((c) => !c.classList.contains('is-out'))

  /* ------------------------------------------------------- GRID GEOMETRY */
  function assign(order, key) {
    const { cols, spans } = PATTERNS[key]
    const [spanVar, ratioVar] = VAR_NAMES[key]
    const ratios = RATIOS[key]
    const out = []
    let fill = 0
    order.forEach((_card, i) => {
      const span = Math.min(spans[i % spans.length], cols)
      if (fill + span > cols) fill = span
      else fill += span
      out.push(span)
    })
    // Never leave a ragged last row — the final card grows to close it.
    if (out.length && fill < cols) out[out.length - 1] += cols - fill
    order.forEach((card, i) => {
      card.style.setProperty(spanVar, String(out[i]))
      card.style.setProperty(ratioVar, ratios[out[i]] || ratios[cols])
    })
  }

  function layout(order) {
    assign(order, 'lg')
    assign(order, 'md')
    assign(order, 'sm')
  }

  layout(cards)

  /* ------------------------------------------------------- ENTRANCE       */
  function settleCards() {
    if (revealBatch) {
      revealBatch.forEach((t) => t.kill())
      revealBatch = null
    }
    cards.forEach((card) => {
      if (revealed.has(card)) return
      revealed.add(card)
      gsap.set(card, { clearProps: 'opacity,transform,clipPath,willChange' })
    })
  }

  if (!reduced) {
    gsap.set(cards, { opacity: 0, y: 36, clipPath: 'inset(0 0 100% 0)' })
    revealBatch = ScrollTrigger.batch(cards, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => {
        batch.forEach((card) => revealed.add(card))
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          clipPath: 'inset(0 0 0% 0)',
          duration: 1.05,
          stagger: 0.075,
          ease: EASE.out,
          clearProps: 'opacity,transform,clipPath,willChange',
        })
      },
    })
  }

  /* ---------------------------------------------------------- INDICATORS */
  function fit(target, dest, animate) {
    if (!target || !dest) return
    if (animate && !reduced) Flip.fit(target, dest, { duration: 0.55, ease: EASE.out })
    else Flip.fit(target, dest)
  }

  const activeChip = () => chips.find((c) => c.dataset.piFilter === activeFilter) || chips[0]
  const activeViewBtn = () => viewBtns.find((b) => b.dataset.piView === view) || viewBtns[0]

  function placeIndicators(animate) {
    fit(pill, activeChip(), animate)
    fit(viewPill, activeViewBtn(), animate)
  }

  /* ------------------------------------------------------------- COUNTER */
  function setCount(n, animate) {
    if (countWord) countWord.textContent = n === 1 ? 'project' : 'projects'
    if (!countEl) return
    const from = parseInt(countEl.textContent, 10)
    if (!animate || reduced || !Number.isFinite(from)) {
      countEl.textContent = pad(n)
      return
    }
    const obj = { v: from }
    gsap.to(obj, {
      v: n,
      duration: 0.45,
      ease: 'power2.out',
      snap: { v: 1 },
      onUpdate() {
        countEl.textContent = pad(Math.round(obj.v))
      },
    })
  }

  setCount(cards.length, false)

  /* ------------------------------------------------------ LAYOUT CHANGES */
  /* Shared tail for both Flip transitions: hold the list at its old height,
     ease it to the new one, and let Flip own everything inside. */
  let flipRuns = 0

  function runFlip(state, oldHeight, extras) {
    const newHeight = list.offsetHeight
    list.style.height = `${oldHeight}px`
    /* A card's contents snap to the new layout on frame one while its box is
       still interpolating, so clip each card for the duration. Counted, so a
       second filter fired mid-transition does not un-clip the first. */
    flipRuns += 1
    list.classList.add('is-flipping')
    Flip.from(state, {
      duration: 0.74,
      ease: EASE.inOut,
      absolute: true,
      onEnter: (els) =>
        gsap.fromTo(
          els,
          { opacity: 0, scale: 0.86 },
          { opacity: 1, scale: 1, duration: 0.6, delay: 0.16, ease: EASE.out, clearProps: 'opacity,transform' }
        ),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.86, duration: 0.38, ease: 'power2.in' }),
      onComplete() {
        flipRuns = Math.max(0, flipRuns - 1)
        if (!flipRuns) list.classList.remove('is-flipping')
        queueRefresh()
      },
    })
    // The pinned height is released by this tween, never by the Flip, so the
    // two can never race to write the same inline style.
    gsap.to(list, {
      height: newHeight,
      duration: 0.74,
      ease: EASE.inOut,
      overwrite: true,
      clearProps: 'height',
    })
    if (typeof extras === 'function') extras()
  }

  function applyFilter(id, animate) {
    if (id === activeFilter) return
    settleCards()
    activeFilter = id

    chips.forEach((chip) => {
      const on = chip.dataset.piFilter === id
      chip.classList.toggle('is-active', on)
      chip.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
    placeIndicators(animate)

    const state = animate && !reduced ? Flip.getState(cards, { props: 'borderRadius' }) : null
    const oldHeight = list.offsetHeight

    cards.forEach((card) => card.classList.toggle('is-out', !matches(card, id)))
    const survivors = visibleCards()
    layout(survivors)
    if (emptyEl) emptyEl.hidden = survivors.length > 0
    setCount(survivors.length, animate)

    if (state) runFlip(state, oldHeight)
    else queueRefresh()
  }

  function setView(next, animate) {
    if (next === view) return
    settleCards()

    const state = animate && !reduced ? Flip.getState(cards, { props: 'borderRadius' }) : null
    const oldHeight = list.offsetHeight
    // Leaving the grid, the plates and tags fade before their box disappears.
    const fading = state && next === 'index' ? qsa('.projects-index__frame, .projects-index__tags', list) : []

    const commit = () => {
      view = next
      stage.dataset.view = next
      viewBtns.forEach((btn) => btn.setAttribute('aria-pressed', btn.dataset.piView === next ? 'true' : 'false'))
      placeIndicators(animate)
      layout(visibleCards())
      hidePreview()

      if (!state) {
        queueRefresh()
        return
      }
      runFlip(state, oldHeight, () => {
        if (next !== 'grid') return
        gsap.fromTo(
          qsa('.projects-index__frame, .projects-index__tags', list),
          { opacity: 0 },
          { opacity: 1, duration: 0.5, delay: 0.28, stagger: 0.02, ease: EASE.out, clearProps: 'opacity' }
        )
      })
    }

    if (fading.length) gsap.to(fading, { opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: commit })
    else commit()
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => applyFilter(chip.dataset.piFilter, true))
  })
  viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.piView, true))
  })

  /* Indicators need real geometry, which needs fonts. */
  const settleIndicators = () => placeIndicators(false)
  settleIndicators()
  if (document.fonts?.ready) document.fonts.ready.then(settleIndicators).catch(() => {})
  window.addEventListener('resize', debounce(settleIndicators, 180), { passive: true })

  /* ==================================================================== */
  /*  CURSOR-FOLLOWING PLATE PREVIEW (index view)                          */
  /* ==================================================================== */

  const previewFrame = preview ? qs('[data-pi-preview-frame]', preview) : null
  const previewCap = preview ? qs('[data-pi-preview-cap]', preview) : null
  const plateCache = new Map()
  let previewShown = false
  let previewId = ''
  let previewW = 0
  let previewH = 0
  let setPreviewX = null
  let setPreviewY = null

  function hidePreview() {
    if (!preview || !previewShown) return
    previewShown = false
    previewId = ''
    gsap.to(preview, { autoAlpha: 0, scale: 0.92, duration: 0.28, ease: 'power2.in' })
  }

  function initPreview() {
    if (!preview || !previewFrame || reduced || touch) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    gsap.set(preview, { autoAlpha: 0, scale: 0.92, transformOrigin: '0% 50%' })

    const measure = () => {
      previewW = preview.offsetWidth
      previewH = preview.offsetHeight
    }
    measure()

    const coords = (e) => {
      if (!previewW || !previewH) measure()
      return [
        clamp(e.clientX + 26, 12, Math.max(12, window.innerWidth - previewW - 12)),
        clamp(e.clientY - previewH / 2, 12, Math.max(12, window.innerHeight - previewH - 12)),
      ]
    }

    const show = (card, e) => {
      const project = projectById(card.dataset.id)
      if (!project) return
      if (previewId !== project.id) {
        previewId = project.id
        let html = plateCache.get(project.id)
        if (!html) {
          html = plateHTML(project.plate, PLATE_OPTS)
          plateCache.set(project.id, html)
        }
        previewFrame.innerHTML = html
        if (previewCap) previewCap.textContent = `${project.index} — ${KIND_LABEL[project.plate.kind] || 'Drawing'}`
      }

      const [x, y] = coords(e)
      if (!previewShown) {
        previewShown = true
        // Land where the pointer already is, then hand tracking to quickTo —
        // built fresh so it starts from this position rather than the last.
        gsap.set(preview, { x, y })
        setPreviewX = gsap.quickTo(preview, 'x', { duration: 0.55, ease: 'power3.out' })
        setPreviewY = gsap.quickTo(preview, 'y', { duration: 0.55, ease: 'power3.out' })
        gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.42, ease: EASE.out })
        return
      }
      setPreviewX(x)
      setPreviewY(y)
    }

    list.addEventListener('pointermove', (e) => {
      if (view !== 'index' || e.pointerType === 'touch') {
        hidePreview()
        return
      }
      const card = e.target.closest?.('[data-pi-card]')
      if (!card) {
        hidePreview()
        return
      }
      show(card, e)
    })
    list.addEventListener('pointerleave', hidePreview)
    window.addEventListener('resize', debounce(measure, 180), { passive: true })
  }

  initPreview()

  /* ==================================================================== */
  /*  CASE STUDY OVERLAY                                                   */
  /* ==================================================================== */

  const veil = qs('[data-pi-veil]', overlay)
  const panel = qs('[data-pi-panel]', overlay)
  const paper = qs('[data-pi-paper]', overlay)
  const scroller = qs('[data-pi-scroll]', overlay)
  const heroEl = qs('[data-pi-hero]', overlay)
  const heroCap = qs('[data-pi-d-herocap]', overlay)
  const nameEl = qs('[data-pi-d-name]', overlay)
  const blocks = qsa('[data-pi-d-block]', overlay)
  const closeBtns = qsa('[data-pi-close]', overlay)

  const dq = (name) => qs(`[data-pi-d-${name}]`, overlay)

  let isOpen = false
  let busy = false
  let mode = 'flip'
  let currentProject = null
  let opener = null
  let sourceFrame = null
  let movedPlate = null
  let clonedPlate = false
  let nameSplit = null
  let statTweens = []
  const inertStore = []

  const total = pad(projects.length)
  const totalEl = dq('total')
  if (totalEl) totalEl.textContent = total

  /* ------------------------------------------------------------ CONTENT */
  function fillDetail(project) {
    // Retire any previous split first — writing over live SplitText markup
    // would leave its revert() holding the wrong project's name.
    if (nameSplit) {
      nameSplit.revert()
      nameSplit = null
    }

    const idxEl = dq('index')
    if (idxEl) idxEl.textContent = project.index
    if (heroCap) heroCap.textContent = `Fig. ${project.index} — ${KIND_LABEL[project.plate.kind] || 'Drawing'}`

    const eyebrow = dq('eyebrow')
    if (eyebrow) eyebrow.textContent = `${project.type} · ${project.status}`
    if (nameEl) nameEl.textContent = project.name
    const summary = dq('summary')
    if (summary) summary.textContent = project.summary
    const desc = dq('desc')
    if (desc) desc.textContent = project.description
    const challenge = dq('challenge')
    if (challenge) challenge.textContent = project.challenge
    const solution = dq('solution')
    if (solution) solution.textContent = project.solution

    const meta = dq('meta')
    if (meta) {
      meta.innerHTML = [
        ['Location', project.location],
        ['Year', project.year],
        ['Type', project.type],
        ['Size', project.size],
        ['Status', project.status],
      ]
        .map(
          ([k, v]) =>
            `<li class="pd__meta-row"><span class="pd__meta-k">${esc(k)}</span>` +
            `<span class="pd__meta-v">${esc(v)}</span></li>`
        )
        .join('')
    }

    const stats = dq('stats')
    if (stats) {
      stats.innerHTML = project.stats
        .map(
          (s) =>
            `<li class="pd__stat"><span class="pd__stat-num t-num" data-pi-stat="${esc(s.v)}">${esc(s.v)}</span>` +
            `<span class="pd__stat-label">${esc(s.k)}</span></li>`
        )
        .join('')
    }

    const tags = dq('tags')
    if (tags) {
      tags.innerHTML = project.services
        .map((s) => `<li class="tag pd__tag">${esc(s)}</li>`)
        .join('')
    }

    const drawings = dq('drawings')
    if (drawings) {
      const seed = Number(project.plate.seed) || 1
      drawings.innerHTML = extraKinds(project)
        .map((kind, i) => {
          const art = plateHTML(
            { ...project.plate, kind, seed: seed + 137 * (i + 1) },
            {
              ratio: '4 / 3',
              density: 1,
              strokeScale: 0.85,
              showTitleBlock: true,
              label: project.name,
              index: project.index,
            }
          )
          return (
            `<figure class="pd__dwg"><div class="pd__dwg-frame">${art}</div>` +
            `<figcaption class="pd__dwg-cap"><span>${esc(KIND_LABEL[kind] || 'Drawing')}</span>` +
            `<span>${esc(project.index)} · ${esc(String(kind).toUpperCase())}</span></figcaption></figure>`
          )
        })
        .join('')
    }
  }

  /** Count a stat value up, keeping whatever prefix and unit it carries. */
  function countStats() {
    statTweens.forEach((t) => t.kill())
    statTweens = []
    qsa('[data-pi-stat]', overlay).forEach((node) => {
      const raw = node.dataset.piStat || ''
      const m = NUM_RE.exec(raw)
      if (!m || reduced) {
        node.textContent = raw
        return
      }
      const [, prefix, digits, suffix] = m
      const target = parseFloat(digits.replace(/,/g, ''))
      if (!Number.isFinite(target)) {
        node.textContent = raw
        return
      }
      const decimals = (digits.split('.')[1] || '').length
      const obj = { v: 0 }
      const write = () =>
        (node.textContent =
          prefix +
          obj.v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
          suffix)
      write()
      statTweens.push(
        gsap.to(obj, {
          v: target,
          duration: 1.5,
          delay: 0.35,
          ease: 'power2.out',
          snap: decimals ? { v: 1 / 10 ** decimals } : { v: 1 },
          onUpdate: write,
        })
      )
    })
  }

  /* -------------------------------------------------------- BACKGROUND  */
  function lockBackground() {
    inertStore.length = 0
    Array.from(document.body.children).forEach((node) => {
      if (node === overlay || node.contains(overlay)) return
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'LINK') return
      inertStore.push([node, node.hasAttribute('inert'), node.getAttribute('aria-hidden')])
      node.setAttribute('inert', '')
      node.setAttribute('aria-hidden', 'true')
    })
  }

  function unlockBackground() {
    inertStore.forEach(([node, hadInert, ariaHidden]) => {
      if (!hadInert) node.removeAttribute('inert')
      if (ariaHidden === null) node.removeAttribute('aria-hidden')
      else node.setAttribute('aria-hidden', ariaHidden)
    })
    inertStore.length = 0
  }

  /* ------------------------------------------------------------- PLATES */
  function takePlate(card) {
    const plate = card && heroEl ? qs('[data-pi-plate]', card) : null
    if (!plate) return null
    sourceFrame = plate.parentElement
    movedPlate = plate
    clonedPlate = false
    heroEl.appendChild(plate)
    return plate
  }

  function makePlate(project) {
    if (!heroEl) return null
    const node = document.createElement('div')
    node.className = 'projects-index__plate'
    mountPlate(node, project.plate, PLATE_OPTS)
    movedPlate = node
    clonedPlate = true
    sourceFrame = null
    heroEl.appendChild(node)
    return node
  }

  function returnPlate() {
    if (!movedPlate) return
    if (clonedPlate) movedPlate.remove()
    else if (sourceFrame) {
      gsap.killTweensOf(movedPlate)
      // The plate carries no author inline styles, so this is the cleanest way
      // to drop everything Flip wrote onto it.
      movedPlate.removeAttribute('style')
      sourceFrame.appendChild(movedPlate)
    }
    movedPlate = null
    sourceFrame = null
    clonedPlate = false
  }

  /* --------------------------------------------------------------- OPEN */
  const isMobileSheet = () => window.matchMedia('(max-width: 900px)').matches

  function cardIsZoomable(card) {
    if (!card || card.classList.contains('is-out')) return false
    const rect = card.getBoundingClientRect()
    if (!rect.width || !rect.height) return false
    return rect.bottom > 0 && rect.top < window.innerHeight
  }

  function chooseMode(card) {
    if (reduced) return 'instant'
    if (isMobileSheet()) return 'slide'
    return cardIsZoomable(card) ? 'flip' : 'fade'
  }

  function openProject(id, trigger) {
    const project = projectById(id)
    if (!project || isOpen || busy) return
    settleCards()
    hidePreview()

    currentProject = project
    opener = trigger || null
    const card = cardById.get(id) || null
    mode = chooseMode(card)

    fillDetail(project)

    isOpen = true
    busy = true
    overlay.hidden = false
    overlay.classList.add('is-animating')
    if (scroller) scroller.scrollTop = 0

    lockBackground()
    stopScroll()

    const state = mode === 'flip' ? Flip.getState(qs('[data-pi-plate]', card), { props: 'borderRadius' }) : null
    if (mode === 'flip') takePlate(card)
    else makePlate(project)

    const contentTargets = [heroCap, ...blocks].filter(Boolean)

    gsap.set(overlay, { autoAlpha: 1 })
    gsap.set(veil, { opacity: 0 })
    gsap.set(panel, { yPercent: mode === 'slide' ? 100 : 0 })
    gsap.set(paper, { scaleY: mode === 'flip' || mode === 'fade' ? 0 : 1 })

    if (reduced) {
      gsap.set(veil, { opacity: 1 })
      gsap.set(contentTargets, { clearProps: 'opacity,transform' })
      if (movedPlate) gsap.set(movedPlate, { clearProps: 'opacity,transform' })
      finishOpen()
      countStats()
      return
    }

    gsap.set(contentTargets, { opacity: 0, y: 26 })

    const tl = gsap.timeline({ onComplete: finishOpen })
    tl.to(veil, { opacity: 1, duration: 0.5, ease: EASE.out }, 0)

    if (mode === 'slide') {
      tl.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.78, ease: EASE.out }, 0)
    } else {
      tl.fromTo(paper, { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: EASE.inOut }, 0)
    }

    if (state) {
      Flip.from(state, {
        duration: 0.98,
        ease: EASE.inOut,
        props: 'borderRadius',
        onComplete() {
          if (movedPlate) gsap.set(movedPlate, { clearProps: 'transform,width,height,top,left' })
        },
      })
    } else if (movedPlate) {
      tl.fromTo(movedPlate, { scale: 1.08, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: EASE.out }, 0.1)
    }

    tl.to(
      inner,
      { scale: 0.965, filter: 'blur(9px)', opacity: 0.4, duration: 0.9, ease: EASE.inOut, transformOrigin: '50% 30%' },
      0
    )

    tl.to(contentTargets, { opacity: 1, y: 0, duration: 0.7, stagger: 0.055, ease: EASE.out }, 0.42)

    /* The name arrives on its own clock: masked lines rising out of the rule
       above them, a beat after the paper has landed. */
    if (nameEl) {
      nameSplit = splitText(nameEl, { type: 'lines', mask: 'lines', autoSplit: false })
      if (nameSplit && nameSplit.lines.length) {
        tl.fromTo(
          nameSplit.lines,
          { yPercent: 118, rotate: 1.4 },
          { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.08, ease: EASE.out },
          0.52
        )
      }
    }

    countStats()
  }

  function finishOpen() {
    busy = false
    overlay.classList.remove('is-animating')
    if (currentProject) {
      history.replaceState(null, '', `#${currentProject.id}`)
    }
    if (scroller) scroller.focus({ preventScroll: true })
  }

  /* -------------------------------------------------------------- CLOSE */
  function close() {
    if (!isOpen || busy) return
    busy = true

    const contentTargets = [heroCap, ...blocks].filter(Boolean)
    statTweens.forEach((t) => t.kill())
    statTweens = []

    if (reduced) {
      finishClose()
      return
    }

    const target = mode === 'flip' && sourceFrame ? sourceFrame : null
    // The hero has to be on screen for the reverse zoom to mean anything, so
    // a scrolled-down case study rides back to the top first.
    const needsScrollBack = !!target && scroller && scroller.scrollTop > 40

    gsap.to(contentTargets, { opacity: 0, y: 18, duration: 0.32, ease: 'power2.in' })

    const run = () => {
      // Only now: `is-animating` also freezes the scroller, which would have
      // blocked the scroll-back above.
      overlay.classList.add('is-animating')

      const tl = gsap.timeline({ onComplete: finishClose })

      if (mode === 'slide') {
        tl.to(inner, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 0.8, ease: EASE.inOut }, 0)
        tl.to(panel, { yPercent: 100, duration: 0.6, ease: EASE.inOut }, 0)
        tl.to(veil, { opacity: 0, duration: 0.5, ease: EASE.out }, 0.1)
        return
      }

      if (target && movedPlate) {
        /* Flip.fit measures the card's live rect, so the grid's scale has to
           be back at 1 before we ask. The paper is still fully opaque at this
           instant, so resetting it without a tween is invisible. */
        gsap.set(inner, { scale: 1 })
        tl.to(inner, { filter: 'blur(0px)', opacity: 1, duration: 0.8, ease: EASE.inOut }, 0)
        // Shrink the very same plate back onto its card before the paper goes.
        Flip.fit(movedPlate, target, { duration: 0.78, ease: EASE.inOut, props: 'borderRadius' })
        tl.to(paper, { scaleY: 0, duration: 0.62, ease: EASE.inOut }, 0.14)
        tl.to(veil, { opacity: 0, duration: 0.5, ease: EASE.out }, 0.26)
        tl.to({}, { duration: 0.82 }, 0)
        return
      }

      tl.to(inner, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 0.8, ease: EASE.inOut }, 0)
      if (movedPlate) tl.to(movedPlate, { scale: 1.04, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0)
      tl.to(paper, { scaleY: 0, duration: 0.55, ease: EASE.inOut }, 0.1)
      tl.to(veil, { opacity: 0, duration: 0.45, ease: EASE.out }, 0.16)
    }

    if (needsScrollBack) {
      gsap.to(scroller, { scrollTo: { y: 0 }, duration: 0.45, ease: EASE.inOut, onComplete: run })
    } else {
      run()
    }
  }

  function finishClose() {
    returnPlate()
    if (nameSplit) {
      nameSplit.revert()
      nameSplit = null
    }
    overlay.classList.remove('is-animating')
    overlay.hidden = true
    gsap.set(overlay, { clearProps: 'opacity,visibility' })
    gsap.set([veil, panel, paper].filter(Boolean), { clearProps: 'opacity,transform' })
    gsap.set(inner, { clearProps: 'opacity,transform,filter,willChange' })

    unlockBackground()
    startScroll()

    isOpen = false
    busy = false
    currentProject = null

    if (location.hash) history.replaceState(null, '', location.pathname + location.search)

    if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    opener = null
    queueRefresh()
  }

  /* ------------------------------------------------------------- EVENTS */
  list.addEventListener('click', (e) => {
    const hit = e.target.closest?.('[data-pi-open]')
    if (!hit || !list.contains(hit)) return
    const card = hit.closest('[data-pi-card]')
    if (!card) return
    e.preventDefault()
    openProject(card.dataset.id, hit)
  })

  closeBtns.forEach((btn) => btn.addEventListener('click', close))

  if (veil) veil.addEventListener('click', close)
  if (scroller) {
    scroller.addEventListener('click', (e) => {
      // Only a click that lands on the empty scroll surface counts as backdrop.
      if (e.target === scroller || e.target === scroller.firstElementChild) close()
    })
  }

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'Tab') return
    const items = qsa(FOCUSABLE, overlay).filter(
      (n) => !n.hasAttribute('disabled') && (n.offsetWidth || n.offsetHeight || n.getClientRects().length)
    )
    if (!items.length) {
      e.preventDefault()
      scroller?.focus({ preventScroll: true })
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !overlay.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !overlay.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  })

  /* --------------------------------------------------------- DEEP LINKS */
  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent((location.hash || '').slice(1))
    const project = projectById(id)
    if (project && !isOpen) {
      const card = cardById.get(id)
      openProject(id, card ? qs('[data-pi-open]', card) : null)
    } else if (!project && isOpen) close()
  })

  const initialId = decodeURIComponent((location.hash || '').slice(1))
  if (projectById(initialId)) {
    const openDeep = () => {
      const card = cardById.get(initialId)
      if (card) card.scrollIntoView({ block: 'center', behavior: 'auto' })
      openProject(initialId, card ? qs('[data-pi-open]', card) : null)
    }
    if (ctx.bus?.hasFired?.('intro:done')) setTimeout(openDeep, 120)
    else if (ctx.bus?.once) ctx.bus.once('intro:done', () => setTimeout(openDeep, 260))
    else setTimeout(openDeep, 700)
  }
}

/* ------------------------------------------------------------- TEMPLATE */

function cardHTML(project) {
  return (
    `<li class="projects-index__card" data-pi-card data-id="${esc(project.id)}"` +
    ` data-cursor="view" data-cursor-text="Open project">` +
    `<span class="projects-index__idx t-num" aria-hidden="true">${esc(project.index)}</span>` +
    `<div class="projects-index__frame">` +
    `<div class="projects-index__plate" data-pi-plate></div>` +
    `<span class="projects-index__hair" aria-hidden="true">` +
    `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<rect class="projects-index__hair-rect" x="0" y="0" width="100" height="100" pathLength="100" vector-effect="non-scaling-stroke" />` +
    `</svg></span>` +
    `<span class="projects-index__view" aria-hidden="true"><span class="projects-index__view-in">View</span></span>` +
    `</div>` +
    `<div class="projects-index__meta">` +
    `<h3 class="projects-index__name">${esc(project.name)}</h3>` +
    `<p class="projects-index__loc">${esc(project.location)}</p>` +
    `<p class="projects-index__type">${esc(project.type)}</p>` +
    `<p class="projects-index__year t-num">${esc(project.year)}</p>` +
    `</div>` +
    `<ul class="projects-index__tags">` +
    project.services.map((s) => `<li class="tag projects-index__tag">${esc(s)}</li>`).join('') +
    `</ul>` +
    `<button class="projects-index__hit" type="button" data-pi-open>` +
    `<span class="u-sr">Open the ${esc(project.name)} case study</span>` +
    `</button>` +
    `</li>`
  )
}
