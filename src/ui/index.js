/* ============================================================================
   SHARED UI BEHAVIOURS
   One boot call from src/core/app.js wires every cross-section interaction.
   Nothing here is section-specific: markup opts in through attributes and
   the behaviour arrives for free.

     .btn                       fill + roll-up label + twin-arrow injection
     [data-magnetic]            pointer-attracted element (+ inner parallax)
     [data-tilt]                3D tilt, specular glare, depth layers
     [data-acc]                 height-animated accordion, full ARIA
     .marquee                   seamless loop + scroll-velocity shear
     [data-tabs]                tablist with a sliding indicator
     [data-copy]                copy to clipboard with a 'Copied' swap
     [data-form]                inline validation + honest success state
     [data-clock-ui]            live studio clock
     [data-split-hover]         two-layer character roll
     [data-scroll-to]           eased scroll to a target

   Every pass is idempotent and null-safe: absent attributes cost one empty
   querySelectorAll. A debounced MutationObserver re-runs the enhancement
   pass so sections that build their DOM after boot are covered too.
   ========================================================================== */
import './ui.css'
import { gsap, EASE, DUR, queueRefresh } from '../core/motion.js'
import { scrollTo, scrollVelocity } from '../core/scroll.js'
import { grainDataURI } from '../lib/drawings.js'
import { contact } from '../data/site.js'
import {
  qs,
  qsa,
  el,
  clamp,
  dataNum,
  debounce,
  prefersReducedMotion,
  isTouch,
} from '../lib/utils.js'

/* ------------------------------------------------------------------ STATE */

const env = {
  reduced: false,
  touch: false,
  hover: true,
  bus: null,
}

/** Selector describing every node that is worth a re-scan. */
const WATCHED =
  '.btn,[data-magnetic],[data-tilt],[data-acc],.marquee,[data-tabs],[data-form],[data-split-hover],[data-clock-ui]'

const seen = {
  btn: new WeakSet(),
  magnetic: new WeakSet(),
  tilt: new WeakSet(),
  acc: new WeakSet(),
  marquee: new WeakSet(),
  tabs: new WeakSet(),
  form: new WeakSet(),
  split: new WeakSet(),
}

let booted = false
let idSeed = 0
/** Bumped on scroll / resize so cached rects are re-measured lazily. */
let rectEpoch = 0
let liveRegion = null

const uid = (prefix) => `${prefix}-${(idSeed += 1).toString(36)}`
const isEl = (n) => !!n && n.nodeType === 1

/** Announce a short message to assistive tech without moving focus. */
function announce(message) {
  if (!liveRegion || !message) return
  liveRegion.textContent = ''
  // A frame of empty content makes repeat announcements fire reliably.
  requestAnimationFrame(() => {
    liveRegion.textContent = message
  })
}

/* ------------------------------------------------------------------------ */
/*  1 — BUTTONS                                                             */
/*  Injects the structure components.css draws: an .btn__fill wipe, a       */
/*  .btn__label > span[data-text] roll-up, and optional twin arrows.        */
/* ------------------------------------------------------------------------ */

const ARROW_SVG = `<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M2 8 8 2M3.4 2H8v4.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/></svg>`

function wrapLabel(text) {
  const label = el('span', { class: 'btn__label' })
  const inner = el('span', { 'data-text': text, text })
  label.appendChild(inner)
  return label
}

function enhanceButtons(root) {
  qsa('.btn', root).forEach((btn) => {
    if (seen.btn.has(btn)) return
    seen.btn.add(btn)

    /* -- fill wipe ----------------------------------------------------- */
    if (!qs(':scope > .btn__fill', btn)) {
      btn.insertBefore(el('span', { class: 'btn__fill', 'aria-hidden': 'true' }), btn.firstChild)
    }

    /* -- roll-up label -------------------------------------------------- */
    if (!qs('.btn__label', btn)) {
      const children = Array.from(btn.childNodes)
      for (const node of children) {
        if (node.nodeType === 3) {
          const text = node.textContent.replace(/\s+/g, ' ').trim()
          if (!text) continue
          btn.replaceChild(wrapLabel(text), node)
          continue
        }
        // A bare, class-less <span> around the caption is common in markup.
        if (
          isEl(node) &&
          node.tagName === 'SPAN' &&
          !node.className &&
          !node.children.length &&
          node.textContent.trim()
        ) {
          btn.replaceChild(wrapLabel(node.textContent.trim()), node)
        }
      }
    } else {
      // Author-written label: make sure the duplicate line has its text.
      qsa('.btn__label > span', btn).forEach((span) => {
        if (!span.dataset.text) span.dataset.text = span.textContent.trim()
      })
    }

    /* -- twin arrow ----------------------------------------------------- */
    if (btn.hasAttribute('data-arrow') && !qs('.btn__arrow', btn)) {
      const arrow = el('span', { class: 'btn__arrow', 'aria-hidden': 'true' })
      arrow.innerHTML = ARROW_SVG + ARROW_SVG
      btn.appendChild(arrow)
    }
  })
}

/* ------------------------------------------------------------------------ */
/*  2 — MAGNETIC                                                            */
/* ------------------------------------------------------------------------ */

function enhanceMagnetic(root) {
  if (env.reduced || !env.hover) return

  qsa('[data-magnetic]', root).forEach((node) => {
    if (seen.magnetic.has(node)) return
    seen.magnetic.add(node)

    const strength = dataNum(node, 'magnetic', 0.35)
    const inner = qs('[data-magnetic-inner]', node)
    const innerStrength = inner ? dataNum(inner, 'magneticInner', strength * 1.6) : 0

    const xTo = gsap.quickTo(node, 'x', { duration: 0.62, ease: EASE.out })
    const yTo = gsap.quickTo(node, 'y', { duration: 0.62, ease: EASE.out })
    const ixTo = inner ? gsap.quickTo(inner, 'x', { duration: 0.78, ease: EASE.out }) : null
    const iyTo = inner ? gsap.quickTo(inner, 'y', { duration: 0.78, ease: EASE.out }) : null

    let rect = null
    let epoch = -1

    const measure = () => {
      rect = node.getBoundingClientRect()
      epoch = rectEpoch
    }

    const move = (e) => {
      if (e.pointerType === 'touch') return
      if (!rect || epoch !== rectEpoch) measure()
      if (!rect.width || !rect.height) return
      const dx = e.clientX - (rect.left + rect.width * 0.5)
      const dy = e.clientY - (rect.top + rect.height * 0.5)
      xTo(dx * strength)
      yTo(dy * strength)
      if (ixTo) {
        ixTo(dx * innerStrength)
        iyTo(dy * innerStrength)
      }
    }

    const release = () => {
      node.classList.remove('is-magnetic')
      xTo(0)
      yTo(0)
      if (ixTo) {
        ixTo(0)
        iyTo(0)
      }
    }

    node.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return
      measure()
      node.classList.add('is-magnetic')
    })
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerleave', release)
    node.addEventListener('pointercancel', release)
    node.addEventListener('blur', release, true)
  })
}

/* ------------------------------------------------------------------------ */
/*  3 — TILT                                                                */
/* ------------------------------------------------------------------------ */

function enhanceTilt(root) {
  if (env.reduced || !env.hover) return

  qsa('[data-tilt]', root).forEach((node) => {
    if (seen.tilt.has(node)) return
    seen.tilt.add(node)

    const max = dataNum(node, 'tiltMax', 9)
    const perspective = dataNum(node, 'tiltPerspective', 1000)
    const sign = node.hasAttribute('data-tilt-invert') ? -1 : 1

    let glare = qs(':scope > .tilt__glare', node)
    if (!glare && !node.hasAttribute('data-tilt-noglare')) {
      glare = el('span', { class: 'tilt__glare', 'aria-hidden': 'true' })
      node.appendChild(glare)
    }

    // ui.css owns transform-style: preserve-3d so depth layers share the space.
    gsap.set(node, { transformPerspective: perspective })

    const rotX = gsap.quickTo(node, 'rotationX', { duration: 0.7, ease: EASE.out })
    const rotY = gsap.quickTo(node, 'rotationY', { duration: 0.7, ease: EASE.out })

    const layers = qsa('[data-tilt-depth]', node).map((layer) => ({
      node: layer,
      depth: dataNum(layer, 'tiltDepth', 20),
      set: gsap.quickTo(layer, 'z', { duration: 0.7, ease: EASE.out }),
    }))

    let rect = null
    let epoch = -1

    const measure = () => {
      rect = node.getBoundingClientRect()
      epoch = rectEpoch
    }

    const move = (e) => {
      if (e.pointerType === 'touch') return
      if (!rect || epoch !== rectEpoch) measure()
      if (!rect.width || !rect.height) return
      const px = clamp((e.clientX - rect.left) / rect.width)
      const py = clamp((e.clientY - rect.top) / rect.height)
      rotX(sign * (0.5 - py) * 2 * max)
      rotY(sign * (px - 0.5) * 2 * max)
      if (glare) {
        glare.style.setProperty('--tilt-gx', `${(px * 100).toFixed(2)}%`)
        glare.style.setProperty('--tilt-gy', `${(py * 100).toFixed(2)}%`)
      }
    }

    const enter = (e) => {
      if (e.pointerType === 'touch') return
      measure()
      node.classList.add('is-tilting')
      layers.forEach((l) => l.set(l.depth))
    }

    const leave = () => {
      node.classList.remove('is-tilting')
      rotX(0)
      rotY(0)
      layers.forEach((l) => l.set(0))
    }

    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('pointercancel', leave)
  })
}

/* ------------------------------------------------------------------------ */
/*  4 — ACCORDIONS                                                          */
/* ------------------------------------------------------------------------ */

function accParts(item) {
  return {
    trigger: qs('.acc__trigger', item),
    panel: qs('.acc__panel', item),
  }
}

function enhanceAccordions(root) {
  qsa('[data-acc]', root).forEach((group) => {
    if (seen.acc.has(group)) return
    seen.acc.add(group)

    qsa('.acc__item', group).forEach((item) => {
      const { trigger, panel } = accParts(item)
      if (!trigger || !panel) return

      if (!panel.id) panel.id = uid('acc-panel')
      if (!trigger.id) trigger.id = uid('acc-trigger')

      if (trigger.tagName === 'BUTTON' && !trigger.hasAttribute('type')) {
        trigger.setAttribute('type', 'button')
      } else if (trigger.tagName !== 'BUTTON') {
        trigger.setAttribute('role', 'button')
        if (!trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0')
      }

      trigger.setAttribute('aria-controls', panel.id)
      panel.setAttribute('role', 'region')
      panel.setAttribute('aria-labelledby', trigger.id)

      // components.css pads .acc__panel-inner — create it when absent so the
      // measured height always includes the closing gap.
      if (!qs(':scope > .acc__panel-inner', panel)) {
        const inner = el('div', { class: 'acc__panel-inner' })
        while (panel.firstChild) inner.appendChild(panel.firstChild)
        panel.appendChild(inner)
      }

      const open = item.classList.contains('is-open')
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
      panel.hidden = !open
      panel.style.height = open ? 'auto' : '0px'
    })
  })
}

function setAccordion(item, open, { instant = false } = {}) {
  const { trigger, panel } = accParts(item)
  if (!trigger || !panel) return
  if (item.classList.contains('is-open') === open) return

  const group = item.closest('[data-acc]')
  item.classList.toggle('is-open', open)
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false')

  gsap.killTweensOf(panel)
  const duration = instant || env.reduced ? 0 : DUR.base
  panel.classList.add('is-animating')

  if (open) {
    panel.hidden = false
    gsap.fromTo(
      panel,
      { height: panel.offsetHeight },
      {
        height: 'auto',
        duration,
        ease: EASE.out,
        onComplete() {
          panel.style.height = 'auto'
          panel.classList.remove('is-animating')
          queueRefresh()
        },
      }
    )
  } else {
    gsap.to(panel, {
      height: 0,
      duration,
      ease: EASE.inOut,
      onComplete() {
        panel.hidden = true
        panel.style.height = '0px'
        panel.classList.remove('is-animating')
        queueRefresh()
      },
    })
  }

  if (group) env.bus?.emit?.('acc:toggle', { group, item, open })
}

function toggleAccordion(trigger) {
  const item = trigger.closest('.acc__item')
  if (!item) return
  const group = item.closest('[data-acc]')
  const willOpen = !item.classList.contains('is-open')

  if (group && willOpen && 'accSingle' in group.dataset && group.dataset.accSingle !== 'false') {
    qsa('.acc__item.is-open', group).forEach((other) => {
      if (other !== item) setAccordion(other, false)
    })
  }
  setAccordion(item, willOpen)
}

function accordionKeys(e, trigger) {
  const group = trigger.closest('[data-acc]')
  if (!group) return
  const triggers = qsa('.acc__trigger', group)
  const i = triggers.indexOf(trigger)
  if (i < 0) return

  let next = -1
  if (e.key === 'ArrowDown') next = (i + 1) % triggers.length
  else if (e.key === 'ArrowUp') next = (i - 1 + triggers.length) % triggers.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = triggers.length - 1
  else if ((e.key === 'Enter' || e.key === ' ') && trigger.tagName !== 'BUTTON') {
    e.preventDefault()
    toggleAccordion(trigger)
    return
  }

  if (next >= 0) {
    e.preventDefault()
    triggers[next].focus()
  }
}

/* ------------------------------------------------------------------------ */
/*  5 — MARQUEES                                                            */
/* ------------------------------------------------------------------------ */

const marquees = []
let velocityRunning = false

function measureSetWidth(track) {
  const style = getComputedStyle(track)
  const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 0
  let width = 0
  for (const child of track.children) width += child.offsetWidth
  return width + gap * track.children.length
}

function deadenClone(node) {
  node.setAttribute('aria-hidden', 'true')
  if (node.id) node.removeAttribute('id')
  qsa('[id]', node).forEach((n) => n.removeAttribute('id'))
  qsa('a, button, input, select, textarea, [tabindex]', node).forEach((n) => {
    n.setAttribute('tabindex', '-1')
  })
}

function buildMarquee(entry) {
  const { root, track } = entry
  const containerWidth = root.clientWidth
  if (!containerWidth) return

  // Restore the authored item set, then repeat it until one track is at
  // least as wide as the viewport slot it lives in.
  track.innerHTML = entry.baseHTML
  const setWidth = measureSetWidth(track)
  if (setWidth <= 0) return

  const reps = clamp(Math.ceil(containerWidth / setWidth), 1, 24)
  if (reps > 1) {
    const base = Array.from(track.children).map((n) => n.cloneNode(true))
    for (let r = 1; r < reps; r += 1) {
      base.forEach((n) => {
        const copy = n.cloneNode(true)
        deadenClone(copy)
        track.appendChild(copy)
      })
    }
  }

  // A twin track sitting immediately after makes the -100% keyframe seamless.
  qsa(':scope > .marquee__track[data-marquee-clone]', root).forEach((n) => n.remove())
  const twin = track.cloneNode(true)
  twin.setAttribute('data-marquee-clone', '')
  deadenClone(twin)
  root.appendChild(twin)

  entry.tracks = [track, twin]
  entry.reps = reps
  entry.width = setWidth * reps

  const speed = dataNum(root, 'marqueeSpeed', 0)
  if (speed > 0) {
    root.style.setProperty('--marquee-duration', `${(entry.width / speed).toFixed(2)}s`)
  }

  // Restart both tracks together so their phases stay locked.
  entry.tracks.forEach((t) => {
    t.style.animation = 'none'
  })
  void root.offsetWidth
  entry.tracks.forEach((t) => {
    t.style.animation = ''
  })
}

function startVelocityLoop() {
  if (velocityRunning) return
  velocityRunning = true
  let current = 0

  gsap.ticker.add(() => {
    const target = clamp(scrollVelocity() * 0.0042, -7, 7)
    current += (target - current) * 0.12
    if (Math.abs(current) < 0.004 && Math.abs(target) < 0.004) {
      if (current !== 0) {
        current = 0
        for (const entry of marquees) entry.root.style.setProperty('--marquee-skew', '0deg')
      }
      return
    }
    for (const entry of marquees) {
      if (!entry.visible) continue
      entry.root.style.setProperty('--marquee-skew', `${(current * entry.react).toFixed(3)}deg`)
    }
  })
}

let marqueeObserver = null

function enhanceMarquees(root) {
  qsa('.marquee', root).forEach((node) => {
    if (seen.marquee.has(node)) return
    const track = qs(':scope > .marquee__track', node)
    if (!track) return
    seen.marquee.add(node)

    const entry = {
      root: node,
      track,
      tracks: [track],
      baseHTML: track.innerHTML,
      reps: 1,
      width: 0,
      visible: true,
      react: dataNum(node, 'marqueeReact', 1),
    }
    marquees.push(entry)
    buildMarquee(entry)

    if (!marqueeObserver && 'IntersectionObserver' in window) {
      marqueeObserver = new IntersectionObserver(
        (records) => {
          records.forEach((record) => {
            const hit = marquees.find((m) => m.root === record.target)
            if (!hit) return
            hit.visible = record.isIntersecting
            hit.root.classList.toggle('is-paused', !record.isIntersecting)
            if (!record.isIntersecting) hit.root.style.setProperty('--marquee-skew', '0deg')
          })
        },
        { rootMargin: '160px 0px' }
      )
    }
    marqueeObserver?.observe(node)
  })

  if (marquees.length && !env.reduced) startVelocityLoop()
}

const rebuildMarquees = debounce(() => {
  marquees.forEach(buildMarquee)
}, 220)

/* ------------------------------------------------------------------------ */
/*  6 — TABS                                                                */
/* ------------------------------------------------------------------------ */

const tabState = new WeakMap()

function tabKey(node) {
  return node.dataset.tab || node.dataset.tabPanel || ''
}

function placeIndicator(state, animate) {
  const { list, indicator, active } = state
  if (!indicator || !active || !list) return
  const listRect = list.getBoundingClientRect()
  const tabRect = active.getBoundingClientRect()
  if (!tabRect.width) return

  const x = tabRect.left - listRect.left + list.scrollLeft
  const pill = state.variant === 'pill'
  const y = pill
    ? tabRect.top - listRect.top
    : tabRect.top - listRect.top + tabRect.height - (state.thickness || 1)

  indicator.style.height = `${pill ? tabRect.height : state.thickness || 1}px`

  const to = { x, y, scaleX: tabRect.width, duration: DUR.base, ease: EASE.out, overwrite: 'auto' }
  if (animate && !env.reduced) gsap.to(indicator, to)
  else gsap.set(indicator, { x, y, scaleX: tabRect.width })
}

function activateTab(trigger, { focus = false, animate = true } = {}) {
  const container = trigger.closest('[data-tabs]')
  const state = container && tabState.get(container)
  if (!state) return
  const key = tabKey(trigger)

  state.triggers.forEach((t) => {
    const on = t === trigger
    t.setAttribute('aria-selected', on ? 'true' : 'false')
    t.setAttribute('tabindex', on ? '0' : '-1')
    t.classList.toggle('is-active', on)
  })

  state.panels.forEach((panel) => {
    const on = tabKey(panel) === key
    if (on) {
      panel.hidden = false
      if (animate && !env.reduced) {
        gsap.fromTo(
          panel,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: DUR.base, ease: EASE.out, clearProps: 'transform,opacity,visibility' }
        )
      }
    } else {
      gsap.killTweensOf(panel)
      panel.hidden = true
    }
  })

  state.active = trigger
  placeIndicator(state, animate)
  if (focus) trigger.focus()
  queueRefresh()
  env.bus?.emit?.('tabs:change', { container, key })
}

function enhanceTabs(root) {
  qsa('[data-tabs]', root).forEach((container) => {
    if (seen.tabs.has(container)) return
    const triggers = qsa('[data-tab]', container)
    if (!triggers.length) return
    seen.tabs.add(container)

    const panels = qsa('[data-tab-panel]', container)
    const list = qs('[data-tabs-list]', container) || triggers[0].parentElement
    const variant = container.dataset.tabsIndicator === 'pill' ? 'pill' : 'line'

    list.classList.add('tabs__list')
    list.setAttribute('role', 'tablist')
    if (container.getAttribute('aria-label')) {
      list.setAttribute('aria-label', container.getAttribute('aria-label'))
    }

    triggers.forEach((trigger) => {
      if (!trigger.id) trigger.id = uid('tab')
      if (trigger.tagName === 'BUTTON' && !trigger.hasAttribute('type')) {
        trigger.setAttribute('type', 'button')
      }
      trigger.setAttribute('role', 'tab')
      const panel = panels.find((p) => tabKey(p) === tabKey(trigger))
      if (panel) {
        if (!panel.id) panel.id = uid('tabpanel')
        trigger.setAttribute('aria-controls', panel.id)
        panel.setAttribute('role', 'tabpanel')
        panel.setAttribute('aria-labelledby', trigger.id)
        if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '0')
      }
    })

    let indicator = qs(':scope > .tabs__indicator', list)
    if (!indicator && container.dataset.tabsIndicator !== 'none') {
      indicator = el('span', { class: `tabs__indicator tabs__indicator--${variant}`, 'aria-hidden': 'true' })
      list.appendChild(indicator)
    }

    const state = {
      container,
      list,
      indicator,
      variant,
      thickness: dataNum(container, 'tabsThickness', variant === 'pill' ? 0 : 1),
      triggers,
      panels,
      active: null,
    }
    tabState.set(container, state)

    const initial =
      triggers.find((t) => t.getAttribute('aria-selected') === 'true') ||
      triggers.find((t) => t.classList.contains('is-active')) ||
      triggers.find((t) => tabKey(t) === container.dataset.tabsDefault) ||
      triggers[0]

    activateTab(initial, { animate: false })
  })
}

function tabKeys(e, trigger) {
  const container = trigger.closest('[data-tabs]')
  const state = container && tabState.get(container)
  if (!state) return
  const list = state.triggers
  const i = list.indexOf(trigger)
  if (i < 0) return

  let next = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % list.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = list.length - 1
  else if (e.key === 'Enter' || e.key === ' ') {
    if (trigger.tagName !== 'BUTTON') {
      e.preventDefault()
      activateTab(trigger)
    }
    return
  }

  if (next >= 0) {
    e.preventDefault()
    activateTab(list[next], { focus: true })
  }
}

const repositionTabs = debounce(() => {
  qsa('[data-tabs]').forEach((container) => {
    const state = tabState.get(container)
    if (state) placeIndicator(state, false)
  })
}, 180)

/* ------------------------------------------------------------------------ */
/*  7 — COPY TO CLIPBOARD                                                   */
/* ------------------------------------------------------------------------ */

const copyTimers = new WeakMap()

function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => legacyCopy(text))
  }
  return Promise.resolve(legacyCopy(text))
}

function legacyCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch (err) {
    ok = false
  }
  area.remove()
  return ok
}

function copyLabelNode(node) {
  return qs('[data-copy-label]', node) || qs('.btn__label > span', node) || node
}

function handleCopy(node) {
  const value = node.dataset.copy || node.textContent.trim()
  if (!value) return
  const label = copyLabelNode(node)
  const done = node.dataset.copyDone || 'Copied'

  writeClipboard(value).then((ok) => {
    if (ok === false) {
      announce('Copying is blocked in this browser — select the text instead')
      return
    }

    const prev = copyTimers.get(node)
    if (prev) {
      clearTimeout(prev.timer)
      label.textContent = prev.text
      if (prev.dataText !== null) label.dataset.text = prev.dataText
    }

    const original = {
      text: label.textContent,
      dataText: label.dataset.text ?? null,
    }

    label.textContent = done
    if (original.dataText !== null) label.dataset.text = done
    node.classList.add('is-copied')
    // Re-adding the class alone would not replay the keyframes.
    label.classList.remove('ui-copy-flash')
    void label.offsetWidth
    label.classList.add('ui-copy-flash')
    announce(`${done}: ${value}`)

    const timer = setTimeout(() => {
      label.textContent = original.text
      if (original.dataText !== null) label.dataset.text = original.dataText
      node.classList.remove('is-copied')
      label.classList.remove('ui-copy-flash')
      copyTimers.delete(node)
    }, 1600)

    copyTimers.set(node, { timer, ...original })
  })
}

/* ------------------------------------------------------------------------ */
/*  8 — FORMS                                                               */
/* ------------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const FIELD_SELECTOR = 'input:not([type="hidden"]):not([type="submit"]), textarea, select'

function fieldWrap(input) {
  return input.closest('.field') || input.parentElement
}

function errorNode(input, create = false) {
  const wrap = fieldWrap(input)
  if (!wrap) return null
  let node = qs('.field__error', wrap)
  if (!node && create) {
    node = el('span', { class: 'field__error' })
    wrap.appendChild(node)
  }
  if (node && !node.id) node.id = uid('field-error')
  return node
}

function validateField(input) {
  const wrap = fieldWrap(input)
  if (!wrap) return true

  const value = (input.value || '').trim()
  const min = dataNum(input, 'minLength', 0)
  const isEmail = input.type === 'email' || input.dataset.validate === 'email'
  const required = input.hasAttribute('required') || input.dataset.required === 'true'
  let message = ''

  if (required && !value) {
    message = input.dataset.errorRequired || 'This field is required'
  } else if (value && isEmail && !EMAIL_RE.test(value)) {
    message = input.dataset.errorEmail || 'Enter a valid email address'
  } else if (value && min > 0 && value.length < min) {
    message = input.dataset.errorMin || `Please write at least ${min} characters`
  } else if (required && input.type === 'checkbox' && !input.checked) {
    message = input.dataset.errorRequired || 'This field is required'
  }

  const node = errorNode(input, !!message)
  if (message) {
    if (node) {
      node.textContent = message
      const described = (input.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(Boolean)
      if (!described.includes(node.id)) described.push(node.id)
      input.setAttribute('aria-describedby', described.join(' '))
    }
    wrap.classList.add('is-invalid')
    input.setAttribute('aria-invalid', 'true')
    return false
  }

  wrap.classList.remove('is-invalid')
  input.removeAttribute('aria-invalid')
  if (node) node.textContent = ''
  return true
}

function successEmail(form) {
  return form.dataset.formEmail === 'new' ? contact.emailNew : contact.email
}

function buildSuccess(form, container) {
  const address = successEmail(form)
  const box = el('div', {
    class: 'ui-form-success',
    'data-form-success': '',
    role: 'status',
    'aria-live': 'polite',
    tabindex: '-1',
  })
  box.appendChild(el('p', { class: 'ui-form-success__eyebrow', text: 'No backend attached' }))
  box.appendChild(
    el('p', {
      class: 'ui-form-success__title',
      text: 'This demo form does not send mail yet.',
    })
  )
  const body = el('p', { class: 'ui-form-success__body' })
  body.appendChild(document.createTextNode('Email us directly at '))
  body.appendChild(el('a', { href: `mailto:${address}`, text: address, 'data-form-success-email': '' }))
  body.appendChild(document.createTextNode(' or call '))
  body.appendChild(el('a', { href: contact.phoneHref, text: contact.phone }))
  body.appendChild(
    document.createTextNode(' — we read everything and usually reply within two working days.')
  )
  box.appendChild(body)

  const actions = el('div', { class: 'ui-form-success__actions' })
  actions.appendChild(
    el('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'data-form-reset': '', text: 'Write another' })
  )
  box.appendChild(actions)

  container.appendChild(box)
  return box
}

function formShell(form) {
  return form.closest('[data-form-shell]') || form.parentElement || form
}

function enhanceForms(root) {
  qsa('[data-form]', root).forEach((form) => {
    if (seen.form.has(form)) return
    seen.form.add(form)

    if (form.tagName === 'FORM') form.setAttribute('novalidate', '')

    const shell = formShell(form)
    let success = qs('[data-form-success]', shell)
    // The success state must outlive the form being hidden.
    if (success && form.contains(success)) shell.appendChild(success)
    if (!success) success = buildSuccess(form, shell)
    success.hidden = true
    if (!success.hasAttribute('tabindex')) success.setAttribute('tabindex', '-1')
    if (!success.hasAttribute('role')) success.setAttribute('role', 'status')

    // Fill any authored slot with the real address.
    const address = successEmail(form)
    qsa('[data-form-success-email]', success).forEach((slot) => {
      if (slot.tagName === 'A') slot.setAttribute('href', `mailto:${address}`)
      if (!slot.textContent.trim()) slot.textContent = address
    })

    qsa(FIELD_SELECTOR, form).forEach((input) => {
      if (input.dataset.minLength && !input.hasAttribute('minlength')) {
        input.setAttribute('minlength', input.dataset.minLength)
      }
    })
  })
}

function submitForm(form) {
  const inputs = qsa(FIELD_SELECTOR, form)
  let firstInvalid = null

  inputs.forEach((input) => {
    const ok = validateField(input)
    if (!ok && !firstInvalid) firstInvalid = input
  })

  if (firstInvalid) {
    const wrap = fieldWrap(firstInvalid)
    if (wrap && !env.reduced) {
      gsap.fromTo(wrap, { x: -7 }, { x: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.35)' })
    }
    firstInvalid.focus({ preventScroll: false })
    announce('Please check the highlighted fields')
    return
  }

  const shell = formShell(form)
  const success = qs('[data-form-success]', shell)
  const reveal = () => {
    form.hidden = true
    if (form.tagName === 'FORM') form.reset()
    qsa('.field.is-invalid', form).forEach((f) => f.classList.remove('is-invalid'))
    if (!success) return
    success.hidden = false
    if (env.reduced) {
      success.focus({ preventScroll: true })
    } else {
      gsap.fromTo(
        success,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: DUR.slow,
          ease: EASE.out,
          clearProps: 'transform',
          onComplete: () => success.focus({ preventScroll: true }),
        }
      )
    }
    queueRefresh()
  }

  // The success region carries role="status" and takes focus, so it does the
  // announcing — a second live message here would double up.
  if (env.reduced) reveal()
  else gsap.to(form, { autoAlpha: 0, y: -14, duration: DUR.fast, ease: EASE.inOut, onComplete: reveal })
}

function restoreForm(button) {
  const shell = button.closest('[data-form-shell]') || button.closest('[data-form-success]')?.parentElement
  if (!shell) return
  const form = qs('[data-form]', shell)
  const success = qs('[data-form-success]', shell)
  if (!form) return

  const show = () => {
    form.hidden = false
    if (env.reduced) {
      gsap.set(form, { clearProps: 'opacity,visibility,transform' })
      qs(FIELD_SELECTOR, form)?.focus({ preventScroll: true })
    } else {
      gsap.fromTo(
        form,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: DUR.base,
          ease: EASE.out,
          clearProps: 'transform,opacity,visibility',
          onComplete: () => qs(FIELD_SELECTOR, form)?.focus({ preventScroll: true }),
        }
      )
    }
    queueRefresh()
  }

  if (!success) {
    show()
    return
  }
  if (env.reduced) {
    success.hidden = true
    show()
  } else {
    gsap.to(success, {
      autoAlpha: 0,
      y: -12,
      duration: DUR.fast,
      ease: EASE.inOut,
      onComplete() {
        success.hidden = true
        gsap.set(success, { clearProps: 'opacity,visibility,transform' })
        show()
      },
    })
  }
}

/* ------------------------------------------------------------------------ */
/*  9 — LIVE CLOCK                                                          */
/* ------------------------------------------------------------------------ */

let clockTimer = null
let clockWired = false
const clockFormats = new Map()

function clockFormatter(mode) {
  if (clockFormats.has(mode)) return clockFormats.get(mode)
  const opts = {
    timeZone: contact.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  if (mode !== 'hm') opts.second = '2-digit'
  let fmt = null
  try {
    fmt = new Intl.DateTimeFormat('en-GB', opts)
  } catch (err) {
    fmt = null
  }
  clockFormats.set(mode, fmt)
  return fmt
}

function paintClock(nodes) {
  const now = new Date()
  nodes.forEach((node) => {
    const mode = node.dataset.clockUi || 'hms'
    const fmt = clockFormatter(mode)
    let text = fmt ? fmt.format(now) : now.toTimeString().slice(0, mode === 'hm' ? 5 : 8)
    if (node.dataset.clockTz !== 'false') text += ` ${contact.tzLabel}`
    if (node.textContent !== text) node.textContent = text
  })
}

/** Safe to call on every enhancement pass — the interval is wired once. */
function initClock() {
  const nodes = qsa('[data-clock-ui]')
  if (!nodes.length) return
  paintClock(nodes)
  if (clockWired) return
  clockWired = true

  const tick = () => paintClock(qsa('[data-clock-ui]'))
  const start = () => {
    if (clockTimer) return
    tick()
    clockTimer = setInterval(tick, 1000)
  }
  const stop = () => {
    clearInterval(clockTimer)
    clockTimer = null
  }

  start()
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop()
    else start()
  })
}

/* ------------------------------------------------------------------------ */
/*  10 — GRAIN OVERLAY                                                      */
/* ------------------------------------------------------------------------ */

function initGrain() {
  if (env.reduced) return
  if (qs('.grain')) return
  let uri = ''
  try {
    uri = grainDataURI()
  } catch (err) {
    uri = ''
  }
  if (!uri) return
  const node = el('div', { class: 'grain', 'aria-hidden': 'true' })
  node.style.backgroundImage = uri.startsWith('url(') ? uri : `url("${uri}")`
  document.body.appendChild(node)
}

/* ------------------------------------------------------------------------ */
/*  11 — SPLIT HOVER                                                        */
/* ------------------------------------------------------------------------ */

function buildSplitHover(node) {
  const source = (node.dataset.splitHoverText || node.textContent || '').replace(/\s+/g, ' ').trim()
  if (!source) return

  const readable = el('span', { class: 'u-sr', text: source })
  const visual = el('span', { class: 'sh__vis', 'aria-hidden': 'true' })

  let index = 0
  source.split(' ').forEach((word, w) => {
    if (w > 0) visual.appendChild(document.createTextNode(' '))
    const wordNode = el('span', { class: 'sh__word' })
    for (const char of Array.from(word)) {
      const charNode = el('span', { class: 'sh__char' })
      charNode.style.setProperty('--i', String(index))
      charNode.appendChild(el('span', { class: 'sh__a', text: char }))
      charNode.appendChild(el('span', { class: 'sh__b', text: char, 'aria-hidden': 'true' }))
      wordNode.appendChild(charNode)
      index += 1
    }
    visual.appendChild(wordNode)
  })

  node.textContent = ''
  node.appendChild(readable)
  node.appendChild(visual)
}

function enhanceSplitHover(root) {
  if (env.reduced) return
  qsa('[data-split-hover]', root).forEach((node) => {
    if (seen.split.has(node)) return
    seen.split.add(node)
    if (qs(':scope > .sh__vis', node)) return
    buildSplitHover(node)
  })
}

/* ------------------------------------------------------------------------ */
/*  12 — SCROLL TO                                                          */
/* ------------------------------------------------------------------------ */

function handleScrollTo(node, e) {
  const value = node.dataset.scrollTo
  if (!value) return
  e.preventDefault()

  const offset = dataNum(node, 'scrollOffset', -Math.round(window.innerHeight * 0.02))
  if (value === 'top') {
    scrollTo(0, { offset: 0 })
    return
  }
  const target = document.querySelector(value)
  if (!target) return
  scrollTo(target, { offset })
}

/* ------------------------------------------------------------------------ */
/*  DELEGATION + OBSERVATION                                                */
/* ------------------------------------------------------------------------ */

function onClick(e) {
  const target = e.target
  if (!target?.closest) return

  const accTrigger = target.closest('.acc__trigger')
  if (accTrigger && accTrigger.closest('[data-acc]')) {
    e.preventDefault()
    toggleAccordion(accTrigger)
    return
  }

  const tab = target.closest('[data-tab]')
  if (tab && tab.closest('[data-tabs]')) {
    e.preventDefault()
    activateTab(tab)
    return
  }

  const reset = target.closest('[data-form-reset]')
  if (reset) {
    e.preventDefault()
    restoreForm(reset)
    return
  }

  const copy = target.closest('[data-copy]')
  if (copy) {
    e.preventDefault()
    handleCopy(copy)
    return
  }

  const jump = target.closest('[data-scroll-to]')
  if (jump) handleScrollTo(jump, e)
}

function onKeydown(e) {
  const target = e.target
  if (!target?.closest) return

  const accTrigger = target.closest('.acc__trigger')
  if (accTrigger && accTrigger.closest('[data-acc]')) {
    accordionKeys(e, accTrigger)
    return
  }

  const tab = target.closest('[data-tab]')
  if (tab && tab.closest('[data-tabs]')) tabKeys(e, tab)
}

function onFocusOut(e) {
  const input = e.target
  if (!isEl(input) || !input.matches?.(FIELD_SELECTOR)) return
  const form = input.closest('[data-form]')
  if (!form) return
  validateField(input)
}

function onInput(e) {
  const input = e.target
  if (!isEl(input) || !input.matches?.(FIELD_SELECTOR)) return
  const form = input.closest('[data-form]')
  if (!form) return
  const wrap = fieldWrap(input)
  if (wrap?.classList.contains('is-invalid')) validateField(input)
}

function onSubmit(e) {
  if (!isEl(e.target)) return
  const form = e.target.closest?.('[data-form]')
  if (!form) return
  e.preventDefault()
  submitForm(form)
}

/** Full enhancement sweep. Idempotent — already-wired nodes are skipped. */
function enhance(root = document) {
  enhanceButtons(root)
  enhanceMagnetic(root)
  enhanceTilt(root)
  enhanceAccordions(root)
  enhanceMarquees(root)
  enhanceTabs(root)
  enhanceForms(root)
  enhanceSplitHover(root)
  initClock()
}

const scheduleEnhance = debounce(() => {
  enhance(document)
  // Late DOM changes page height (collapsed panels, duplicated marquees).
  queueRefresh()
}, 140)

function observe() {
  if (!('MutationObserver' in window)) return
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!isEl(node)) continue
        if (node.matches?.(WATCHED) || node.querySelector?.(WATCHED)) {
          scheduleEnhance()
          return
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

/* ------------------------------------------------------------------------ */
/*  PUBLIC                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Wire every shared UI behaviour. Called once from boot().
 * @param {object} ctx  { reduced, touch, bus, ... }
 */
export function initUI(ctx = {}) {
  if (booted) return
  booted = true

  env.reduced = ctx.reduced ?? prefersReducedMotion()
  env.touch = ctx.touch ?? isTouch()
  env.hover = !env.touch && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  env.bus = ctx.bus || null

  liveRegion = qs('.ui-live')
  if (!liveRegion) {
    liveRegion = el('div', { class: 'ui-live', role: 'status', 'aria-live': 'polite' })
    document.body.appendChild(liveRegion)
  }

  initGrain()
  enhance(document)
  observe()

  document.addEventListener('click', onClick)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('focusout', onFocusOut, true)
  document.addEventListener('input', onInput, true)
  document.addEventListener('submit', onSubmit, true)

  const invalidate = () => {
    rectEpoch += 1
  }
  window.addEventListener('scroll', invalidate, { passive: true })
  window.addEventListener(
    'resize',
    () => {
      invalidate()
      rebuildMarquees()
      repositionTabs()
    },
    { passive: true }
  )

  if (document.fonts?.ready) {
    document.fonts.ready
      .then(() => {
        rebuildMarquees()
        repositionTabs()
      })
      .catch(() => {})
  }

  env.bus?.on?.('ui:refresh', () => {
    enhance(document)
    rebuildMarquees()
    repositionTabs()
  })
  env.bus?.once?.('intro:done', () => {
    enhance(document)
    rebuildMarquees()
    repositionTabs()
  })
}

export default initUI
