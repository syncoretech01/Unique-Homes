/* ============================================================================
   VOICES — client and contractor testimonials as a considered editorial slider

   Two panels: the quote set large in Fraunces on the left, the related
   project's procedural art plate in a tall frame on the right.

   The swap is the craft here:
     · the quote masks out line by line, then the incoming quote masks in from
       the opposite edge — re-split per change, previous split reverted first
     · the outgoing plate clips away vertically while the incoming plate clips
       in from the opposite edge; both artworks counter-move inside their clip
       so the drawing appears to hold still while the seam travels
     · a hairline accent rule rides that seam across the frame
     · a large ghost numeral cross-fades behind the quote
   ========================================================================== */
import './voices.css'
import { gsap, ScrollTrigger, Observer, SplitText, EASE } from '../../core/motion.js'
import { qs, qsa, el, pad, debounce } from '../../lib/utils.js'
import { mountPlate } from '../../lib/drawings.js'
import { testimonials } from '../../data/content.js'
import { projects } from '../../data/projects.js'

const AUTOPLAY = 7 // seconds per testimonial
const OPEN = 'inset(0% 0% 0% 0%)'
const CLIP_UP = 'inset(0% 0% 100% 0%)' // collapsed against the top edge
const CLIP_DOWN = 'inset(100% 0% 0% 0%)' // collapsed against the bottom edge

const quoted = (item) => `“${item.quote}”`

export default function initVoices(ctx = {}) {
  const root = document.querySelector('[data-section="voices"]')
  if (!root) return

  const els = {
    slider: qs('[data-voices-slider]', root),
    stage: qs('[data-voices-stage]', root),
    quote: qs('[data-voices-quote]', root),
    wrap: qs('[data-voices-quote-wrap]', root),
    author: qs('[data-voices-author]', root),
    role: qs('[data-voices-role]', root),
    link: qs('[data-voices-link]', root),
    project: qs('[data-voices-project]', root),
    metaA: qs('[data-voices-meta-a]', root),
    metaB: qs('[data-voices-meta-b]', root),
    frame: qs('[data-voices-frame]', root),
    sweep: qs('[data-voices-sweep]', root),
    rail: qs('[data-voices-rail]', root),
    current: qs('[data-voices-current]', root),
    total: qs('[data-voices-total]', root),
    prev: qs('[data-voices-prev]', root),
    next: qs('[data-voices-next]', root),
    status: qs('[data-voices-status]', root),
    clients: qs('[data-voices-clients]', root),
  }
  if (!els.slider || !els.stage || !els.quote || !els.wrap || !els.frame) return

  const layers = [qs('[data-voices-layer="0"]', root), qs('[data-voices-layer="1"]', root)]
  const arts = [qs('[data-voices-plate="0"]', root), qs('[data-voices-plate="1"]', root)]
  const ghosts = [qs('[data-voices-ghost="0"]', root), qs('[data-voices-ghost="1"]', root)]
  if (layers.some((n) => !n) || arts.some((n) => !n) || ghosts.some((n) => !n)) return

  /* ------------------------------------------------------------------ DATA */

  const byName = new Map(projects.map((p) => [p.name, p]))
  const items = testimonials
    .map((t, i) => {
      const project = byName.get(t.project) || projects[i % projects.length]
      return project ? { ...t, project, num: pad(i + 1) } : null
    })
    .filter(Boolean)
  if (!items.length) return

  const reduced = !!ctx.reduced
  /* Bits that fade with the quote on entrance. */
  const quoteBits = [els.author, els.role, els.link].filter(Boolean)
  /* Bits that swap on every change (the plate caption travels with them). */
  const swapBits = [...quoteBits, els.metaA, els.metaB].filter(Boolean)

  let index = 0
  let activeLayer = 0
  let activeGhost = 0
  let split = null
  let tl = null
  let linesTween = null
  let started = false

  /* --------------------------------------------------------------- CONTENT */

  const mounted = [-1, -1]

  function mountFor(layer, i) {
    if (mounted[layer] === i) return
    mounted[layer] = i
    const project = items[i].project
    mountPlate(arts[layer], project.plate, {
      label: project.name,
      index: project.index,
      ratio: '3/4',
      strokeScale: 0.9,
    })
  }

  /* SplitText caches the original markup, so the previous split must always be
     reverted before the text underneath it changes. */
  function revertSplit() {
    if (!split) return
    try {
      split.revert()
    } catch {
      /* already reverted by a resize or an interrupted swap */
    }
    split = null
  }

  function setQuoteText(text) {
    revertSplit()
    els.quote.textContent = text
  }

  function buildSplit() {
    revertSplit()
    if (reduced) return null
    split = SplitText.create(els.quote, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: false,
      reduceWhiteSpace: false,
    })
    return split.lines && split.lines.length ? split : null
  }

  function writeText(i) {
    const it = items[i]
    setQuoteText(quoted(it))
    if (els.author) els.author.textContent = it.author
    if (els.role) els.role.textContent = `${it.role} · ${it.company}`
    if (els.project) els.project.textContent = it.project.name
    if (els.link) {
      els.link.setAttribute('href', `/projects/#${it.project.id}`)
      els.link.setAttribute('aria-label', `Open the ${it.project.name} project`)
    }
    if (els.metaA) els.metaA.textContent = it.project.name
    if (els.metaB) els.metaB.textContent = `${it.project.location} · ${it.project.year}`
    if (els.current) els.current.textContent = it.num
  }

  /** Hold the quote block at the height of the longest one so nothing jumps. */
  function measureQuoteHeight() {
    els.quote.style.minHeight = ''
    let tallest = 0
    for (const it of items) {
      setQuoteText(quoted(it))
      buildSplit()
      tallest = Math.max(tallest, els.quote.offsetHeight)
    }
    setQuoteText(quoted(items[index]))
    const s = buildSplit()
    if (s) gsap.set(s.lines, { yPercent: 0 })
    els.quote.style.minHeight = `${Math.ceil(tallest)}px`
  }

  /* ---------------------------------------------------------- CLIENT NAMES */

  function renderClients() {
    if (!els.clients) return
    const seen = new Set()
    items.forEach((it, i) => {
      if (seen.has(it.company)) return
      seen.add(it.company)
      const button = el('button', {
        type: 'button',
        class: 'voices__client',
        text: it.company,
        'data-voices-to': String(i),
        'aria-label': `Show the testimonial from ${it.company}`,
      })
      els.clients.appendChild(el('li', {}, [button]))
    })
    els.clients.addEventListener('click', (event) => {
      const button = event.target.closest('.voices__client')
      if (!button) return
      const target = Number(button.dataset.voicesTo)
      if (!Number.isFinite(target)) return
      go(target, target > index ? 1 : -1, true)
    })
  }

  function updateClients(i) {
    if (!els.clients) return
    qsa('.voices__client', els.clients).forEach((button) => {
      const on = Number(button.dataset.voicesTo) === i
      button.classList.toggle('is-active', on)
      if (on) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    })
  }

  /* --------------------------------------------------------------- AUTOPLAY */

  const setRail = els.rail ? gsap.quickSetter(els.rail, 'scaleX') : () => {}
  const clock = { v: 0 }
  let timer = null
  let inView = false
  let hovered = false
  let focused = false
  let dragging = false

  const canRun = () =>
    started && !reduced && inView && !hovered && !focused && !dragging && !document.hidden

  function syncAuto() {
    if (reduced) return
    const run = canRun()
    root.classList.toggle('is-paused', !run)
    if (!timer) return
    if (run) timer.play()
    else timer.pause()
  }

  function resetAuto() {
    if (reduced) {
      // The rail becomes a position indicator rather than a countdown.
      setRail((index + 1) / items.length)
      return
    }
    if (timer) timer.kill()
    clock.v = 0
    setRail(0)
    timer = gsap.to(clock, {
      v: 1,
      duration: AUTOPLAY,
      ease: 'none',
      paused: true,
      onUpdate: () => setRail(clock.v),
      onComplete: () => {
        timer = null
        go(index + 1, 1, false)
      },
    })
    syncAuto()
  }

  /* ------------------------------------------------------------------ STATE */

  function killTweens() {
    if (tl) {
      tl.kill()
      tl = null
    }
    if (linesTween) {
      linesTween.kill()
      linesTween = null
    }
  }

  /** Snap every layer to the resting state of the current index. */
  function applyRest() {
    writeText(index)
    mountFor(activeLayer, index)

    gsap.set(layers[activeLayer], { autoAlpha: 1, clipPath: OPEN })
    gsap.set(arts[activeLayer], { yPercent: 0, scale: 1 })
    gsap.set(layers[1 - activeLayer], { autoAlpha: 0, clipPath: OPEN })
    gsap.set(arts[1 - activeLayer], { yPercent: 0, scale: 1 })

    ghosts[activeGhost].textContent = items[index].num
    gsap.set(ghosts[activeGhost], { autoAlpha: 1, yPercent: 0, scale: 1 })
    gsap.set(ghosts[1 - activeGhost], { autoAlpha: 0 })

    gsap.set(swapBits, { autoAlpha: 1, y: 0 })
    if (els.sweep) gsap.set(els.sweep, { autoAlpha: 0, scaleX: 0 })

    const s = buildSplit()
    if (s) gsap.set(s.lines, { yPercent: 0 })

    updateClients(index)
  }

  function announce() {
    if (!els.status) return
    const it = items[index]
    els.status.textContent =
      `Testimonial ${index + 1} of ${items.length}. ${it.author}, ${it.company}.`
  }

  /* ------------------------------------------------------------ TRANSITION */

  function go(target, dir = 1, userInitiated = false) {
    const n = items.length
    const next = ((Math.round(target) % n) + n) % n
    if (next === index) return

    // An interrupted swap settles instantly so the new one starts from rest.
    if (tl || linesTween) {
      killTweens()
      applyRest()
    }

    index = next
    resetAuto()
    if (userInitiated) announce()

    if (reduced) {
      applyRest()
      return
    }

    const d = dir >= 0 ? 1 : -1
    const outLayer = layers[activeLayer]
    const outArt = arts[activeLayer]
    activeLayer = 1 - activeLayer
    const inLayer = layers[activeLayer]
    const inArt = arts[activeLayer]
    mountFor(activeLayer, index)

    const outGhost = ghosts[activeGhost]
    activeGhost = 1 - activeGhost
    const inGhost = ghosts[activeGhost]
    inGhost.textContent = items[index].num

    const outLines = split && split.lines ? split.lines.slice() : []
    const from = d > 0 ? 'start' : 'end'
    const frameH = els.frame.offsetHeight || 0

    // The old lines live in DOM that the re-split destroys, so the copy swap
    // waits for the out-stagger to finish.
    const outStep = 0.04
    const outDur = 0.42
    const swapAt = outLines.length
      ? outDur + outStep * (outLines.length - 1) + 0.02
      : 0.24

    tl = gsap.timeline({
      defaults: { ease: EASE.inOut },
      onComplete: () => {
        gsap.set(outLayer, { autoAlpha: 0, clipPath: OPEN })
        gsap.set(outArt, { yPercent: 0, scale: 1 })
        gsap.set(outGhost, { autoAlpha: 0 })
        if (els.sweep) gsap.set(els.sweep, { autoAlpha: 0, scaleX: 0 })
        tl = null
      },
    })

    /* ---- quote masks out, line by line ---- */
    if (outLines.length) {
      tl.to(outLines, {
        yPercent: -112 * d,
        duration: outDur,
        stagger: { each: outStep, from },
      }, 0)
    }

    /* ---- attribution out ---- */
    tl.to(swapBits, {
      autoAlpha: 0,
      y: -10 * d,
      duration: 0.3,
      ease: 'power2.in',
      stagger: 0.025,
    }, 0)

    /* ---- ghost numeral cross-fade ---- */
    tl.to(outGhost, { autoAlpha: 0, yPercent: -18 * d, scale: 0.95, duration: 0.66 }, 0)
    tl.set(inGhost, { autoAlpha: 0, yPercent: 22 * d, scale: 1.06 }, 0)
    tl.to(inGhost, { autoAlpha: 1, yPercent: 0, scale: 1, duration: 0.95, ease: EASE.out }, 0.1)

    /* ---- plate: two clips travelling as one seam, artwork counter-moving ---- */
    tl.set(inLayer, { autoAlpha: 1, clipPath: d > 0 ? CLIP_DOWN : CLIP_UP }, 0)
    tl.set(inArt, { yPercent: 12 * d, scale: 1.09 }, 0)
    tl.to(outLayer, { clipPath: d > 0 ? CLIP_UP : CLIP_DOWN, duration: 0.95 }, 0)
    tl.to(outArt, { yPercent: -12 * d, scale: 1.05, duration: 0.95 }, 0)
    tl.to(inLayer, { clipPath: OPEN, duration: 0.95 }, 0)
    tl.to(inArt, { yPercent: 0, scale: 1, duration: 1.2, ease: EASE.out }, 0)

    /* ---- accent hairline riding the seam ---- */
    if (els.sweep && frameH) {
      tl.set(els.sweep, {
        autoAlpha: 1,
        scaleX: 0,
        transformOrigin: d > 0 ? 'left center' : 'right center',
        y: d > 0 ? frameH : 0,
      }, 0)
      tl.to(els.sweep, { y: d > 0 ? 0 : frameH, duration: 0.95 }, 0)
      tl.to(els.sweep, { scaleX: 1, duration: 0.34, ease: 'power2.out' }, 0)
      tl.to(els.sweep, {
        scaleX: 0,
        transformOrigin: d > 0 ? 'right center' : 'left center',
        duration: 0.36,
        ease: 'power2.in',
      }, 0.56)
    }

    /* ---- swap the copy, then mask the new quote in from the far edge ---- */
    tl.call(() => {
      writeText(index)
      updateClients(index)
      const s = buildSplit()
      if (!s) return
      gsap.set(s.lines, { yPercent: 112 * d })
      linesTween = gsap.to(s.lines, {
        yPercent: 0,
        duration: 0.9,
        ease: EASE.out,
        stagger: { each: 0.055, from },
        onComplete: () => {
          linesTween = null
        },
      })
    }, null, swapAt)

    tl.set(swapBits, { y: 14 * d }, swapAt)
    tl.to(swapBits, {
      autoAlpha: 1,
      y: 0,
      duration: 0.66,
      ease: EASE.out,
      stagger: 0.05,
    }, swapAt + 0.08)
  }

  /* ---------------------------------------------------------------- INTRO */

  function intro() {
    if (started) return
    started = true
    if (reduced) {
      resetAuto()
      return
    }
    const s = split && split.lines && split.lines.length ? split : buildSplit()
    gsap.set(els.wrap, { autoAlpha: 1 })
    if (s) {
      gsap.set(s.lines, { yPercent: 112 })
      linesTween = gsap.to(s.lines, {
        yPercent: 0,
        duration: 1.0,
        ease: EASE.out,
        stagger: 0.06,
        onComplete: () => {
          linesTween = null
        },
      })
    }
    gsap.set(quoteBits, { autoAlpha: 0, y: 16 })
    gsap.to(quoteBits, {
      autoAlpha: 1,
      y: 0,
      duration: 0.72,
      ease: EASE.out,
      stagger: 0.06,
      delay: 0.3,
    })
    gsap.fromTo(
      ghosts[activeGhost],
      { autoAlpha: 0, yPercent: 20 },
      { autoAlpha: 1, yPercent: 0, duration: 1.15, ease: EASE.out }
    )
    resetAuto()
  }

  /* ------------------------------------------------------------ FIRST PAINT */

  if (els.total) els.total.textContent = pad(items.length)
  renderClients()

  writeText(index)
  mountFor(activeLayer, index)
  ghosts[0].textContent = items[0].num
  ghosts[1].textContent = ''
  gsap.set(layers[1], { autoAlpha: 0 })
  gsap.set(ghosts[1], { autoAlpha: 0 })
  if (els.sweep) gsap.set(els.sweep, { autoAlpha: 0, scaleX: 0 })
  updateClients(index)

  /* -------------------------------------------------------------- CONTROLS */

  if (els.prev) els.prev.addEventListener('click', () => go(index - 1, -1, true))
  if (els.next) els.next.addEventListener('click', () => go(index + 1, 1, true))

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const t = event.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    event.preventDefault()
    const d = event.key === 'ArrowRight' ? 1 : -1
    go(index + d, d, true)
  })

  els.slider.addEventListener('pointerenter', () => {
    hovered = true
    syncAuto()
  })
  els.slider.addEventListener('pointerleave', () => {
    hovered = false
    syncAuto()
  })
  els.slider.addEventListener('focusin', () => {
    focused = true
    syncAuto()
  })
  els.slider.addEventListener('focusout', (event) => {
    if (els.slider.contains(event.relatedTarget)) return
    focused = false
    syncAuto()
  })
  document.addEventListener('visibilitychange', syncAuto)

  /* --------------------------------------------------------- DRAG AND SWIPE */

  function swipe(target, type) {
    if (!target) return
    let used = false
    Observer.create({
      target,
      type,
      dragMinimum: 34,
      tolerance: 20,
      lockAxis: true,
      preventDefault: false,
      onPress: () => {
        used = false
        dragging = true
        syncAuto()
      },
      onRelease: () => {
        dragging = false
        syncAuto()
      },
      onLeft: () => {
        if (used) return
        used = true
        go(index + 1, 1, true)
      },
      onRight: () => {
        if (used) return
        used = true
        go(index - 1, -1, true)
      },
    })
  }

  swipe(els.stage, 'touch')
  if (!ctx.touch) swipe(els.frame, 'pointer')

  /* ------------------------------------------------------- IN VIEW + LAYOUT */

  const viewTrigger = ScrollTrigger.create({
    trigger: root,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      inView = self.isActive
      syncAuto()
    },
  })
  inView = viewTrigger.isActive

  const fontsReady =
    document.fonts && document.fonts.status !== 'loaded' ? document.fonts.ready : Promise.resolve()

  function relayout() {
    measureQuoteHeight()
  }

  let lastWidth = window.innerWidth
  window.addEventListener(
    'resize',
    debounce(() => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      if (tl || linesTween) return
      relayout()
    }, 220)
  )

  if (reduced) {
    applyRest()
    started = true
    resetAuto()
    fontsReady.then(relayout)
    return
  }

  gsap.set(els.wrap, { autoAlpha: 0 })

  fontsReady.then(() => {
    relayout()
    ScrollTrigger.create({
      trigger: els.stage,
      start: 'top 80%',
      once: true,
      onEnter: intro,
    })
    // Landing deep-linked below the section must not leave it hidden.
    if (!started && els.stage.getBoundingClientRect().top < window.innerHeight * 0.8) intro()
  })
}
