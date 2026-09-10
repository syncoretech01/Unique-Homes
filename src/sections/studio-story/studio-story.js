/* ============================================================================
   STUDIO STORY — behaviour

   Everything that also exists in the data layer is re-rendered from it, so the
   studio page can never drift away from the home page's version of the same
   argument:
     · essay paragraphs 1 and 3   src/data/content.js   manifesto.paragraphs
     · the signature line         src/data/content.js   manifesto.signature
     · capabilities table         src/data/content.js   capabilities
     · the six stages             src/data/content.js   process
     · credentials table          src/data/site.js      credentials
     · the figures                src/data/site.js      stats
     · the timeline's first year  src/data/site.js      brand.since

   Bespoke choreography, in order of interest:

     1. The setting-out grid. A survey grid sits behind the essay a few degrees
        out of true and rotates into alignment as the essay is read, while a
        monospaced readout in the margin counts the residual angle down to
        0°00′ and turns terracotta the moment the grid is square. It is the one
        big move in the section, and it is the section's argument in miniature:
        everything here is set out from the same datum.

     2. The marginal sheet. A tall section drawing is wiped over by the framing
        plan of the same building as the essay scrolls — one model, two sheets —
        and the title-block caption changes with it.

     3. The ruler. On desktop the practice's six milestones hang off a hairline
        scale whose minor ticks are one per year, so the 2009 → 2015 gap reads
        six ticks wide and 2018 → 2020 reads two. A terracotta playhead runs
        the scale as the block scrolls; each milestone draws its leader and
        rises in as the playhead reaches its tick. Below 1200px the same DOM is
        a vertical ruled list with a rail that fills as it is read.
   ========================================================================== */
import './studio-story.css'
import { gsap, ScrollTrigger, EASE } from '../../core/motion.js'
import { qs, qsa, clamp, lerp, pad } from '../../lib/utils.js'
import { plateHTML, blueprintBackgroundCSS } from '../../lib/drawings.js'
import { manifesto, capabilities, process } from '../../data/content.js'
import { brand, stats, credentials } from '../../data/site.js'

/* --------------------------------------------------------------- CONSTANTS */

const DESKTOP = '(min-width: 1200px)'
const STACKED = '(max-width: 1199px)'

/** Degrees the setting-out grid starts out of true. */
const TILT = -6.5

/** Title-block captions for the two marginal sheets. */
const SHEET_A = { cap: 'Section AA', scale: '1:50' }
const SHEET_B = { cap: 'Framing plan L01', scale: '1:100' }

/* ------------------------------------------------------------------ UTILS */

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

/** Degrees → the way a surveyor writes them: −06°30′, and 00°00′ at true. */
function formatAngle(deg) {
  const abs = Math.abs(deg)
  let d = Math.floor(abs)
  let m = Math.round((abs - d) * 60)
  if (m === 60) {
    d += 1
    m = 0
  }
  const sign = d === 0 && m === 0 ? '' : '−'
  return `${sign}${pad(d)}°${pad(m)}′`
}

/* ------------------------------------------------------------------ BUILD */

/** Keep the two data-layer paragraphs identical to the home page's. */
function syncEssay(root) {
  qsa('[data-ss-manifesto]', root).forEach((node) => {
    const text = manifesto.paragraphs[Number(node.dataset.ssManifesto)]
    if (text) node.textContent = text
  })
  const sign = qs('[data-ss-sign]', root)
  if (sign && manifesto.signature) sign.textContent = manifesto.signature
}

/**
 * The two marginal sheets: a section of the house, and the framing plan of the
 * same house that wipes over it. The framing sheet is only built when it can
 * actually be seen.
 */
function buildPlates(root, pal, withSecond) {
  const a = qs('[data-ss-art-a]', root)
  const b = qs('[data-ss-art-b]', root)
  const shared = { width: 800, height: 1066, strokeScale: 0.9 }

  if (a) {
    a.innerHTML = plateHTML(
      { kind: 'section', a: pal.plateA, b: pal.plateB, ink: pal.ink, accent: pal.accent, seed: 14 },
      { ...shared, label: 'Coordinated model', index: '02', density: 0.95 }
    )
  }
  if (b && withSecond) {
    b.innerHTML = plateHTML(
      { kind: 'framing', a: pal.plateA, b: pal.plateB, ink: pal.ink, accent: pal.accent, seed: 31 },
      { ...shared, label: 'Coordinated model', index: '02', density: 0.9 }
    )
  }
}

/** Hairline-ruled capability rows — one per record. */
function buildCaps(list) {
  if (!list || !capabilities.length) return
  list.textContent = ''

  capabilities.forEach((cap) => {
    const row = document.createElement('div')
    row.className = 'studio-story__row'

    const rule = document.createElement('i')
    rule.className = 'studio-story__row-rule'
    rule.setAttribute('aria-hidden', 'true')

    const key = document.createElement('dt')
    key.className = 'studio-story__row-k'
    key.textContent = cap.k

    const val = document.createElement('dd')
    val.className = 'studio-story__row-v'
    val.textContent = cap.v

    row.append(rule, key, val)
    list.appendChild(row)
  })
}

/** The same table shape, carrying registration numbers and cover. */
function buildCreds(list) {
  if (!list || !credentials.length) return
  list.textContent = ''

  credentials.forEach((cred) => {
    const row = document.createElement('div')
    row.className = 'studio-story__row studio-story__row--cred'

    const rule = document.createElement('i')
    rule.className = 'studio-story__row-rule'
    rule.setAttribute('aria-hidden', 'true')

    const key = document.createElement('dt')
    key.className = 'studio-story__row-k'
    key.textContent = cred.label

    const cell = document.createElement('dd')
    cell.className = 'studio-story__row-v'

    const value = document.createElement('span')
    value.className = 'studio-story__row-val t-num'
    value.textContent = cred.value

    const note = document.createElement('span')
    note.className = 'studio-story__row-note'
    note.textContent = cred.note

    cell.append(value, note)
    row.append(rule, key, cell)
    list.appendChild(row)
  })
}

/** The six stages, indexed exactly as the process section indexes them. */
function buildSteps(host) {
  if (!host || !process.length) return
  host.textContent = ''

  process.forEach((stage, i) => {
    const step = document.createElement('span')
    step.className = 'studio-story__step'

    const index = document.createElement('i')
    index.className = 't-num'
    index.textContent = stage.index || pad(i + 1)

    step.append(index, document.createTextNode(stage.title))
    host.appendChild(step)
  })
}

/** Four figures, counted up by the reveal engine through data-counter. */
function buildStats(wrap) {
  if (!wrap || !stats.length) return
  const bandRule = qs('.studio-story__stats-rule', wrap)
  wrap.textContent = ''
  if (bandRule) wrap.appendChild(bandRule)

  stats.forEach((entry) => {
    const cell = document.createElement('div')
    cell.className = 'stat studio-story__stat'

    const vRule = document.createElement('i')
    vRule.className = 'studio-story__stat-rule studio-story__stat-rule--v'
    vRule.setAttribute('aria-hidden', 'true')

    const hRule = document.createElement('i')
    hRule.className = 'studio-story__stat-rule studio-story__stat-rule--h'
    hRule.setAttribute('aria-hidden', 'true')

    const label = document.createElement('span')
    label.className = 'stat__label studio-story__stat-label'
    label.textContent = entry.label

    const suffix = entry.suffix || ''
    const num = document.createElement('span')
    num.className = 'stat__num studio-story__stat-num'
    num.dataset.counter = String(entry.value)
    if (suffix) num.dataset.suffix = suffix
    num.textContent = `${entry.value}${suffix}`

    const note = document.createElement('span')
    note.className = 'studio-story__stat-note'
    note.textContent = entry.note

    cell.append(vRule, hRule, label, num, note)
    wrap.appendChild(cell)
  })
}

/* ------------------------------------------------------------------ RULER */

/**
 * Year ticks for the horizontal scale: one major tick per milestone, and one
 * minor tick per intervening year, so the distance between two milestones is
 * legible as time rather than as layout.
 *
 * @param {number[]} years one numeric year per milestone, ascending
 * @returns {{major:boolean,seg:number,t:number}[]} tick descriptors
 */
function tickPlan(years) {
  const plan = []
  years.forEach((year, i) => {
    plan.push({ major: true, seg: i, t: 0 })
    if (i >= years.length - 1) return
    const gap = Math.max(1, years[i + 1] - year)
    const step = gap > 12 ? Math.ceil(gap / 12) : 1
    for (let j = step; j < gap; j += step) plan.push({ major: false, seg: i, t: j / gap })
  })
  return plan
}

/** Milestone years, with the closing "today" resolved against the clock. */
function milestoneYears(miles) {
  const now = new Date().getFullYear()
  const first = Number(brand.since) || 2009
  return miles.map((li, i) => {
    const raw = li.dataset.year
    if (raw === 'today') return Math.max(now, first + 1)
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : first + i
  })
}

/** Centre of each milestone column as a 0–1 fraction of the track. */
function measureCentres(track, miles, fallback) {
  const box = track.getBoundingClientRect()
  if (!box.width) return fallback
  return miles.map((li, i) => {
    const r = li.getBoundingClientRect()
    if (!r.width) return fallback[i]
    return clamp((r.left + r.width / 2 - box.left) / box.width, 0, 1)
  })
}

/* ------------------------------------------------------------------- INIT */

export default function initStudioStory(ctx = {}) {
  const root = document.querySelector('[data-section="studio-story"]')
  if (!root) return

  const reduced = !!ctx.reduced
  const pal = readPalette()

  /* ------------------------------------------------------------ content - */
  syncEssay(root)
  buildPlates(root, pal, !reduced)
  buildCaps(qs('[data-ss-caps]', root))
  buildCreds(qs('[data-ss-creds]', root))
  buildSteps(qs('[data-ss-steps]', root))
  buildStats(qs('[data-ss-stats]', root))

  const gridEl = qs('[data-ss-grid]', root)
  if (gridEl) {
    gridEl.style.backgroundImage = blueprintBackgroundCSS({ size: 30, major: 5, thickness: 1 })
  }

  /* -------------------------------------------------------------- nodes - */
  const essay = qs('[data-ss-essay]', root)
  const angleEl = qs('[data-ss-angle]', root)
  const artB = qs('[data-ss-art-b]', root)
  const capEl = qs('[data-ss-cap]', root)
  const scaleEl = qs('[data-ss-scale]', root)

  const track = qs('.studio-story__track', root)
  const miles = qsa('.studio-story__mile', root)
  const leaders = qsa('.studio-story__leader', root)
  const ruler = qs('[data-ss-ruler]', root)
  const ticksHost = qs('[data-ss-ticks]', root)
  const fill = qs('[data-ss-fill]', root)
  const head = qs('[data-ss-head]', root)
  const vfill = qs('[data-ss-vfill]', root)

  const rowRules = qsa('.studio-story__row-rule', root)
  const rowCells = qsa('.studio-story__row-k, .studio-story__row-v', root)
  const tables = qs('.studio-story__tables', root)

  const statsWrap = qs('[data-ss-stats]', root)
  const bandRule = qs('.studio-story__stats-rule', root)
  const vRules = qsa('.studio-story__stat-rule--v', root)
  const hRules = qsa('.studio-story__stat-rule--h', root)
  const statCells = qsa(
    '.studio-story__stat-label, .studio-story__stat-num, .studio-story__stat-note',
    root
  )

  /* ------------------------------------------------- static fallback ---- */
  if (reduced) {
    gsap.set(rowRules, { scaleX: 1 })
    gsap.set(bandRule, { scaleX: 1 })
    gsap.set(hRules, { scaleX: 1 })
    gsap.set(vRules, { scaleY: 1 })
    gsap.set(leaders, { scaleX: 1, scaleY: 1 })
    gsap.set(fill, { scaleX: 1, opacity: 0.25 })
    gsap.set(vfill, { scaleY: 1, opacity: 0.25 })
    if (gridEl) gsap.set(gridEl, { rotate: 0, scale: 1, opacity: 0.5 })
    if (angleEl) angleEl.textContent = formatAngle(0)
    if (essay) essay.classList.add('is-true')
    miles.forEach((li) => li.classList.add('is-reached'))
    return
  }

  /* ====================================================================== */
  /*  1 — THE SETTING-OUT GRID                                              */
  /* ====================================================================== */

  if (essay && gridEl) {
    let shown = ''
    let square = false
    let gridTween = null

    const onGrid = () => {
      const p = gridTween ? gridTween.progress() : 0
      const text = formatAngle(TILT * (1 - p))
      if (text !== shown) {
        shown = text
        if (angleEl) angleEl.textContent = text
      }
      const isSquare = p > 0.985
      if (isSquare !== square) {
        square = isSquare
        essay.classList.toggle('is-true', isSquare)
      }
    }

    gridTween = gsap.fromTo(
      gridEl,
      { rotate: TILT, scale: 1.07, opacity: 0 },
      {
        rotate: 0,
        scale: 1,
        opacity: 0.62,
        ease: 'none',
        onUpdate: onGrid,
        scrollTrigger: {
          trigger: essay,
          start: 'top 78%',
          end: 'bottom 58%',
          scrub: 0.65,
          invalidateOnRefresh: true,
        },
      }
    )
    onGrid()
  }

  /* ====================================================================== */
  /*  2 — THE MARGINAL SHEET SWAP                                           */
  /* ====================================================================== */

  if (essay && artB) {
    let onB = false

    const swap = (next) => {
      if (next === onB) return
      onB = next
      const sheet = next ? SHEET_B : SHEET_A
      if (capEl) capEl.textContent = sheet.cap
      if (scaleEl) scaleEl.textContent = sheet.scale
      const cap = qs('.studio-story__plate-cap', root)
      if (cap) gsap.fromTo(cap, { opacity: 0.25 }, { opacity: 1, duration: 0.45, ease: EASE.out })
    }

    gsap.fromTo(
      artB,
      { clipPath: 'inset(100% 0% 0% 0%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'none',
        scrollTrigger: {
          trigger: essay,
          start: 'top 42%',
          end: 'bottom 72%',
          scrub: 0.5,
          invalidateOnRefresh: true,
          onUpdate: (self) => swap(self.progress > 0.5),
        },
      }
    )
  }

  /* ====================================================================== */
  /*  3 — THE TIMELINE                                                      */
  /* ====================================================================== */

  if (track && miles.length) {
    const years = milestoneYears(miles)
    const plan = tickPlan(years)
    const evenly = miles.map((_, i) => (i + 0.5) / miles.length)
    let centres = evenly.slice()

    /* Ticks are built once; their positions are re-measured on refresh. */
    const tickEls = []
    if (ticksHost) {
      ticksHost.textContent = ''
      const frag = document.createDocumentFragment()
      plan.forEach((t) => {
        const el = document.createElement('i')
        el.className = 'studio-story__tick' + (t.major ? ' studio-story__tick--major' : ' studio-story__tick--minor')
        frag.appendChild(el)
        tickEls.push(el)
      })
      ticksHost.appendChild(frag)
    }

    /* Tick positions are ascending by construction, which lets the scrub
       repaint only the ticks that actually changed state. */
    const tickPos = tickEls.map(() => 0)

    const placeTicks = () => {
      for (let i = 0; i < tickEls.length; i += 1) {
        const t = plan[i]
        const next = centres[t.seg + 1] === undefined ? 1 : centres[t.seg + 1]
        tickPos[i] = t.major ? centres[t.seg] : lerp(centres[t.seg], next, t.t)
        tickEls[i].style.left = `${(tickPos[i] * 100).toFixed(3)}%`
      }
    }

    const partsOf = (li) =>
      [
        qs('.studio-story__mile-year', li),
        qs('.studio-story__mile-title', li),
        qs('.studio-story__mile-body', li),
      ].filter(Boolean)

    const mm = gsap.matchMedia()

    /* ---------------------------------------------- horizontal ruler ---- */
    mm.add(DESKTOP, () => {
      centres = measureCentres(track, miles, evenly)
      placeTicks()

      const played = miles.map(() => false)
      const timelines = miles.map((li) => {
        const parts = partsOf(li)
        const leader = qs('.studio-story__leader', li)
        gsap.set(parts, { opacity: 0, y: 18 })
        if (leader) gsap.set(leader, { scaleY: 0 })

        const tl = gsap.timeline({ paused: true })
        if (leader) tl.to(leader, { scaleY: 1, duration: 0.55, ease: EASE.out }, 0)
        tl.to(parts, { opacity: 1, y: 0, duration: 0.85, stagger: 0.07, ease: EASE.out }, 0.1)
        return tl
      })

      gsap.set(fill, { scaleX: 0, transformOrigin: 'left center' })
      gsap.set(head, { x: 0, opacity: 0 })

      const setFill = gsap.quickSetter(fill, 'scaleX')
      const setHead = gsap.quickSetter(head, 'x', 'px')
      const setHeadO = gsap.quickSetter(head, 'opacity')
      let width = ruler ? ruler.clientWidth : 0
      let lastO = -1
      let lastTick = -1
      let lastMile = -1

      const apply = (p) => {
        setFill(p)
        setHead(p * width)

        const o = p > 0.004 && p < 0.999 ? 1 : 0
        if (o !== lastO) {
          lastO = o
          setHeadO(o)
        }

        // index of the last tick / milestone the playhead has passed
        let tick = -1
        while (tick + 1 < tickPos.length && p >= tickPos[tick + 1]) tick += 1
        let mile = -1
        while (mile + 1 < centres.length && p >= centres[mile + 1] - 0.004) mile += 1

        if (tick !== lastTick) {
          for (let i = Math.min(tick, lastTick) + 1; i <= Math.max(tick, lastTick); i += 1) {
            tickEls[i].classList.toggle('is-past', i <= tick)
          }
          lastTick = tick
        }

        if (mile !== lastMile) {
          for (let i = Math.min(mile, lastMile) + 1; i <= Math.max(mile, lastMile); i += 1) {
            miles[i].classList.toggle('is-reached', i <= mile)
          }
          lastMile = mile
        }

        for (let i = 0; i <= mile; i += 1) {
          if (played[i]) continue
          played[i] = true
          timelines[i].play()
        }
      }

      const scrub = ScrollTrigger.create({
        trigger: track,
        start: 'top 80%',
        end: 'bottom 62%',
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => {
          centres = measureCentres(track, miles, centres)
          placeTicks()
          width = ruler ? ruler.clientWidth : 0
          apply(self.progress)
        },
      })
      apply(scrub.progress)
    })

    /* ------------------------------------------------ vertical rail ----- */
    mm.add(STACKED, () => {
      if (vfill) {
        gsap.fromTo(
          vfill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: track,
              start: 'top 82%',
              end: 'bottom 68%',
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          }
        )
      }

      miles.forEach((li) => {
        const parts = partsOf(li)
        const leader = qs('.studio-story__leader', li)
        const st = { trigger: li, start: 'top 88%', once: true }

        if (leader) {
          gsap.fromTo(
            leader,
            { scaleX: 0 },
            { scaleX: 1, duration: 0.75, ease: EASE.out, scrollTrigger: st }
          )
        }
        gsap.fromTo(
          parts,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.06,
            ease: EASE.out,
            scrollTrigger: {
              ...st,
              onEnter: () => li.classList.add('is-reached'),
            },
          }
        )
      })
    })
  }

  /* ====================================================================== */
  /*  4 — THE TWO RULED TABLES                                              */
  /* ====================================================================== */

  if (tables && rowRules.length) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: tables, start: 'top 82%', once: true } })
    tl.fromTo(
      rowRules,
      { scaleX: 0 },
      { scaleX: 1, duration: 1.05, ease: EASE.out, stagger: 0.06 },
      0
    ).fromTo(
      rowCells,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: EASE.out, stagger: 0.03 },
      0.12
    )
  }

  /* ====================================================================== */
  /*  5 — THE FIGURES                                                       */
  /* ====================================================================== */

  if (statsWrap && statCells.length) {
    const band = gsap.timeline({ scrollTrigger: { trigger: statsWrap, start: 'top 84%', once: true } })
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
      { y: 0, opacity: 1, duration: 0.9, ease: EASE.out, stagger: 0.05 },
      0.22
    )
  }
}
