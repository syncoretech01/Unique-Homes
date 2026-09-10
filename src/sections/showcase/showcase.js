/* ============================================================================
   SHOWCASE — horizontal parallax gallery of selected projects.

   Desktop (>900px, motion allowed):
     the stage pins, the track translates at 1x, each plate counter-translates
     inside its frame at ~0.16x (so the drawing reads as standing still while
     the frame slides over it), captions drift the other way at ~0.05x, and a
     ghost numeral behind everything creeps along at 0.13x. Cards away from the
     viewport centre lose a little scale and most of their saturation.
     Drag-to-scrub with inertia moves the page scroll, so scroll, drag and
     keyboard all share one source of truth.

   <=900px or reduced motion:
     no pin, no scroll-driven transform — a native scroll-snapping row with the
     same cards and the same (cheap) plate parallax.
   ========================================================================== */
import './showcase.css'
import { gsap, ScrollTrigger, Observer, EASE } from '../../core/motion.js'
import { clamp, pad, debounce } from '../../lib/utils.js'
import { mountPlate } from '../../lib/drawings.js'
import { featuredProjects, projects } from '../../data/projects.js'

/* ------------------------------------------------------------------ TUNING */
const COUNT = 6
const PLATE_RATE = 0.16 // counter-translate factor of the plate
const PLATE_OVER = 0.14 // available overhang, as a fraction of card width
const CAP_RATE = 0.05 // caption drift (leads the card)
const CAP_MAX = 26 // px
const GHOST_RATE = 0.13
const SCALE_DROP = 0.085
const SAT_DROP = 0.8
const FALLOFF = 0.6 // distance-from-centre normalising band, × viewport width
const DRAG_SCALE = 1.15
const HOLD = 0.1 // extra pinned scroll after the last card lands, × vw

const DESKTOP = '(min-width: 901px) and (prefers-reduced-motion: no-preference)'
const NATIVE = '(max-width: 900px), (prefers-reduced-motion: reduce)'

/* -------------------------------------------------------------------- DATA */

/** Featured work first, topped up from the rest, then back into sheet order. */
function pickProjects(n) {
  const picked = []
  const seen = new Set()
  for (const p of featuredProjects) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    picked.push(p)
  }
  for (const p of projects) {
    if (picked.length >= n) break
    if (seen.has(p.id)) continue
    seen.add(p.id)
    picked.push(p)
  }
  return picked.slice(0, n).sort((a, b) => String(a.index).localeCompare(String(b.index)))
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function cardMarkup(p) {
  const meta = [p.year, p.type, p.size].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join('')
  const services = (p.services || [])
    .map((s) => `<span class="showcase__service">${esc(s)}</span>`)
    .join('')
  const label = `${p.name} — ${p.type}, ${p.location}, ${p.year}. View project.`

  return (
    `<a class="showcase__card" href="/projects/#${esc(p.id)}"` +
    ` data-cursor="view" data-cursor-text="View project"` +
    ` aria-label="${esc(label)}">` +
      `<span class="showcase__card-frame">` +
        `<span class="showcase__plate"><span class="showcase__plate-inner" data-plate></span></span>` +
        `<span class="showcase__edges" aria-hidden="true">` +
          `<span class="showcase__edge showcase__edge--t"></span>` +
          `<span class="showcase__edge showcase__edge--r"></span>` +
          `<span class="showcase__edge showcase__edge--b"></span>` +
          `<span class="showcase__edge showcase__edge--l"></span>` +
        `</span>` +
        `<span class="showcase__idx" aria-hidden="true">${esc(p.index)}</span>` +
        `<span class="showcase__view" aria-hidden="true">` +
          `<span class="showcase__view-label">View project</span>` +
          `<span class="showcase__view-arrow">&#8599;</span>` +
        `</span>` +
      `</span>` +
      `<span class="showcase__caption">` +
        `<span class="showcase__meta">${meta}</span>` +
        `<span class="showcase__name">${esc(p.name)}</span>` +
        `<span class="showcase__place">${esc(p.location)}</span>` +
        `<span class="showcase__summary">${esc(p.summary)}</span>` +
        `<span class="showcase__services">${services}</span>` +
      `</span>` +
    `</a>`
  )
}

/* -------------------------------------------------------------------- INIT */

export default function initShowcase(ctx = {}) {
  const root = document.querySelector('[data-section="showcase"]')
  if (!root) return

  const stage = root.querySelector('[data-stage]')
  const viewport = root.querySelector('[data-viewport]')
  const track = root.querySelector('[data-track]')
  if (!stage || !viewport || !track) return

  const items = pickProjects(COUNT)
  if (!items.length) return

  const reduced = !!ctx.reduced
  const lenis = ctx.lenis || null

  /* ---------------------------------------------------------------- BUILD */
  track.innerHTML = items.map(cardMarkup).join('')
  const cards = Array.from(track.children)

  const nodes = cards.map((card, i) => {
    const frame = card.querySelector('.showcase__card-frame')
    const plate = card.querySelector('.showcase__plate')
    const caption = card.querySelector('.showcase__caption')

    mountPlate(card.querySelector('[data-plate]'), items[i].plate, {
      label: items[i].name,
      index: items[i].index,
      width: 1120,
      height: 840,
      strokeScale: 1.05,
    })

    return {
      card,
      frame,
      plate,
      caption,
      left: 0,
      width: 1,
      filter: '',
      dim: '',
      setScale: gsap.quickSetter(card, 'scale'),
      setPlateX: gsap.quickSetter(plate, 'x', 'px'),
      setCapX: gsap.quickSetter(caption, 'x', 'px'),
    }
  })

  const ghost = root.querySelector('[data-ghost]')
  const fill = root.querySelector('[data-fill]')
  const ticksBox = root.querySelector('[data-ticks]')
  const currentEl = root.querySelector('[data-current]')
  const totalEl = root.querySelector('[data-total]')
  const allCountEl = root.querySelector('[data-all-count]')
  const hintEl = root.querySelector('[data-hint]')

  if (totalEl) totalEl.textContent = pad(items.length)
  if (allCountEl) allCountEl.textContent = pad(projects.length)

  let ticks = []
  if (ticksBox) {
    ticksBox.innerHTML = items
      .map((_, i) => {
        const at = items.length > 1 ? ((i / (items.length - 1)) * 100).toFixed(3) : '0'
        return `<span class="showcase__tick" style="left:${at}%"></span>`
      })
      .join('')
    ticks = Array.from(ticksBox.children)
  }

  const setGhostX = ghost ? gsap.quickSetter(ghost, 'x', 'px') : null
  const setFill = fill ? gsap.quickSetter(fill, 'scaleX') : null

  /* -------------------------------------------------------------- METRICS */
  let vw = 1
  let maxX = 0
  let depth = true // scale + desaturation pass (desktop only)
  let parallax = !reduced
  let active = -1

  function measure() {
    vw = viewport.clientWidth || 1
    let padRight = 0
    const cs = window.getComputedStyle(track)
    padRight = parseFloat(cs.paddingRight) || 0
    for (const n of nodes) {
      n.left = n.card.offsetLeft
      n.width = n.card.offsetWidth || 1
    }
    const last = nodes[nodes.length - 1]
    const contentW = last ? last.left + last.width + padRight : vw
    maxX = Math.max(0, Math.round(contentW - vw))
  }

  function setActive(i) {
    if (i === active) return
    active = i
    for (let k = 0; k < cards.length; k++) cards[k].classList.toggle('is-active', k === i)
    for (let k = 0; k < ticks.length; k++) ticks[k].classList.toggle('is-on', k <= i)
    if (currentEl) currentEl.textContent = pad(i + 1)
    if (ghost) {
      ghost.textContent = items[i] ? items[i].index : pad(i + 1)
      if (!reduced) {
        gsap.fromTo(
          ghost,
          { yPercent: 9, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.55, ease: EASE.out, overwrite: 'auto' }
        )
      }
    }
  }

  /** One cheap pass over cached rects — no layout reads. */
  function apply(x) {
    const centre = vw * 0.5
    const band = Math.max(1, vw * FALLOFF)
    let best = 0
    let bestD = Infinity

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const dx = x + n.left + n.width * 0.5 - centre
      const ad = Math.abs(dx)
      if (ad < bestD) {
        bestD = ad
        best = i
      }

      const t = clamp(ad / band, 0, 1)
      const e = t * t * (3 - 2 * t) // smoothstep

      if (parallax) {
        const over = n.width * PLATE_OVER
        n.setPlateX(clamp(-dx * PLATE_RATE, -over, over))
        n.setCapX(clamp(dx * CAP_RATE, -CAP_MAX, CAP_MAX))
      }

      if (depth) {
        n.setScale(1 - SCALE_DROP * e)
        // The filter rides the plate, not the frame: the plate is already a
        // promoted layer (it translates every frame), so a colour-matrix
        // filter on it stays on the GPU — and the accent bar keeps its colour.
        const filter = `saturate(${(1 - SAT_DROP * e).toFixed(3)}) contrast(${(1 - 0.06 * e).toFixed(3)})`
        if (filter !== n.filter) {
          n.filter = filter
          n.plate.style.filter = filter
        }
        const dim = (1 - 0.5 * e).toFixed(3)
        if (dim !== n.dim) {
          n.dim = dim
          n.caption.style.opacity = dim
        }
      }
    }

    if (setGhostX) setGhostX(x * GHOST_RATE)
    if (setFill) setFill(maxX ? clamp(-x / maxX, 0, 1) : 0)
    setActive(best)
  }

  function resetVisuals() {
    gsap.set(track, { clearProps: 'transform' })
    for (const n of nodes) {
      gsap.set([n.card, n.caption, n.plate], { clearProps: 'transform' })
      n.plate.style.filter = ''
      n.caption.style.opacity = ''
      n.filter = ''
      n.dim = ''
    }
    if (ghost) gsap.set(ghost, { clearProps: 'transform' })
  }

  /* ------------------------------------------------------------- ENTRANCE */
  if (!reduced) {
    gsap.fromTo(
      nodes.map((n) => n.frame),
      { clipPath: 'inset(0 0 100% 0)' },
      {
        clipPath: 'inset(0 0 0% 0)',
        duration: 1.15,
        stagger: 0.07,
        ease: EASE.out,
        clearProps: 'clipPath',
        scrollTrigger: { trigger: root, start: 'top 74%', once: true },
      }
    )
  }

  /* ------------------------------------------------------- SCROLL PLUMBING */
  const maxScroll = () => ScrollTrigger.maxScroll(window)
  const currentScroll = () => (lenis ? lenis.scroll : window.scrollY)

  function jumpTo(y) {
    const v = clamp(y, 0, maxScroll())
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(v, { immediate: true, force: true })
    } else {
      window.scrollTo(0, v)
    }
  }

  function easeTo(y) {
    const v = clamp(y, 0, maxScroll())
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(v, { duration: 0.8, force: true })
    } else {
      window.scrollTo({ top: v, behavior: reduced ? 'auto' : 'smooth' })
    }
  }

  /* ================================================================ MODES */
  const mq = gsap.matchMedia()

  /* -------------------------------------------------------- PINNED / 1..n */
  mq.add(DESKTOP, () => {
    root.classList.add('is-pinned')
    viewport.setAttribute('data-cursor', 'drag')
    if (hintEl) hintEl.textContent = 'Drag or scroll'

    depth = true
    parallax = true

    let alive = true
    const setTrackX = gsap.quickSetter(track, 'x', 'px')
    const total = () => Math.max(1, maxX + vw * HOLD)

    measure()

    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: () => '+=' + total(),
      pin: stage,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefreshInit: () => measure(),
      // `self`, not the outer `st` — onRefresh fires synchronously inside
      // create(), before the const binding exists.
      onRefresh: (self) => {
        measure()
        const x = -Math.min(self.progress * total(), maxX)
        setTrackX(x)
        apply(x)
      },
      onUpdate: (self) => {
        const x = -Math.min(self.progress * total(), maxX)
        setTrackX(x)
        apply(x)
      },
      onToggle: (self) => root.classList.toggle('is-live', self.isActive),
    })

    /* Focus inside an overflow:hidden box still scrolls it — undo that. */
    const pinScroll = () => {
      if (viewport.scrollLeft !== 0) viewport.scrollLeft = 0
    }
    viewport.addEventListener('scroll', pinScroll, { passive: true })

    /* --- drag to scrub, with inertia --------------------------------- */
    let glideTween = null
    let dragged = 0

    const killGlide = () => {
      if (glideTween) glideTween.kill()
      glideTween = null
    }

    const glide = (vx) => {
      const v = clamp(vx, -3200, 3200)
      if (Math.abs(v) < 80) return
      const proxy = { y: currentScroll() }
      glideTween = gsap.to(proxy, {
        y: proxy.y - v * 0.3,
        duration: clamp(Math.abs(v) / 2400, 0.35, 1.25),
        ease: 'power3.out',
        overwrite: true,
        onUpdate: () => jumpTo(proxy.y),
      })
    }

    const observer = Observer.create({
      target: viewport,
      type: 'pointer,touch',
      dragMinimum: 4,
      tolerance: 6,
      lockAxis: true,
      preventDefault: false,
      onPress: () => {
        killGlide()
        dragged = 0
      },
      onDragStart: (self) => {
        if (self.lockedAxis === 'x') root.classList.add('is-dragging')
      },
      onDrag: (self) => {
        if (self.lockedAxis !== 'x') return
        dragged += Math.abs(self.deltaX)
        jumpTo(currentScroll() - self.deltaX * DRAG_SCALE)
      },
      onDragEnd: (self) => {
        root.classList.remove('is-dragging')
        if (self.lockedAxis === 'x') glide(self.velocityX)
      },
      onRelease: () => root.classList.remove('is-dragging'),
    })

    /* A drag that ends over a card must not follow the link. */
    const swallowClick = (e) => {
      if (dragged <= 8) return
      dragged = 0
      e.preventDefault()
      e.stopPropagation()
    }
    track.addEventListener('click', swallowClick, true)

    const onWheel = () => killGlide()
    viewport.addEventListener('wheel', onWheel, { passive: true })

    /* --- keyboard: bring the focused card to the centre --------------- */
    const onFocusIn = (e) => {
      const card = e.target.closest ? e.target.closest('.showcase__card') : null
      if (!card) return
      const i = cards.indexOf(card)
      if (i < 0) return
      killGlide()
      const n = nodes[i]
      const want = clamp(-(n.left + n.width * 0.5 - vw * 0.5), -maxX, 0)
      const p = clamp(-want / total(), 0, 1)
      easeTo(st.start + p * (st.end - st.start))
    }
    track.addEventListener('focusin', onFocusIn)

    /* The other mode's teardown runs in the same tick — paint after it. */
    requestAnimationFrame(() => {
      if (!alive) return
      measure()
      const x = -Math.min(st.progress * total(), maxX)
      setTrackX(x)
      apply(x)
    })

    return () => {
      alive = false
      killGlide()
      observer.kill()
      viewport.removeEventListener('scroll', pinScroll)
      viewport.removeEventListener('wheel', onWheel)
      track.removeEventListener('click', swallowClick, true)
      track.removeEventListener('focusin', onFocusIn)
      viewport.removeAttribute('data-cursor')
      root.classList.remove('is-pinned', 'is-live', 'is-dragging')
      active = -1
      resetVisuals()
    }
  })

  /* ---------------------------------------------------- NATIVE SNAP ROW */
  mq.add(NATIVE, () => {
    root.classList.add('is-native')
    if (hintEl) hintEl.textContent = reduced ? 'Scroll the row' : 'Swipe to browse'

    let alive = true
    depth = false
    parallax = !reduced

    measure()
    apply(-viewport.scrollLeft)

    let queued = false
    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        apply(-viewport.scrollLeft)
      })
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })

    const onResize = debounce(() => {
      measure()
      apply(-viewport.scrollLeft)
    }, 180)
    window.addEventListener('resize', onResize)

    const live = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => root.classList.toggle('is-live', self.isActive),
    })

    /* Native focus scrolling already centres the card; just keep state fresh. */
    const onFocusIn = () => requestAnimationFrame(() => apply(-viewport.scrollLeft))
    track.addEventListener('focusin', onFocusIn)

    /* The other mode's teardown runs in the same tick — paint after it. */
    requestAnimationFrame(() => {
      if (!alive) return
      measure()
      apply(-viewport.scrollLeft)
    })

    return () => {
      alive = false
      viewport.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      track.removeEventListener('focusin', onFocusIn)
      live.kill()
      root.classList.remove('is-native', 'is-live')
      active = -1
      resetVisuals()
    }
  })

  /* Fonts settle after boot and every caption re-wraps — re-measure once. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      measure()
      if (root.classList.contains('is-native')) apply(-viewport.scrollLeft)
    })
  }
}
