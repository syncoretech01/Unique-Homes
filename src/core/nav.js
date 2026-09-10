/* ============================================================================
   SITE CHROME — header, overlay menu, footer utilities.

   Owns:
     · fixed header: stick / hide-on-scroll-down / show-on-scroll-up
     · full-screen overlay menu (GSAP column wipe, staggered links, focus trap)
     · aria-current marking from location.pathname
     · footer back-to-top and the live Austin clock
     · the scroll-progress rail element
   ========================================================================== */
import './nav.css'
import { gsap, EASE } from './motion.js'
import { getLenis, scrollVelocity, stopScroll, startScroll, scrollTo } from './scroll.js'
import { qs, qsa, el, debounce, prefersReducedMotion } from '../lib/utils.js'
import { contact } from '../data/site.js'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const DESKTOP_MQ = '(min-width: 1024px)'
const HIDE_RATIO = 0.2 // hide only after 20% of the viewport has scrolled by
const VEL_GATE = 0.35 // px/frame before a direction change counts

export function initNav(ctx = {}) {
  const reduced = ctx.reduced ?? prefersReducedMotion()

  initRail()
  markCurrent()
  initClock()
  initBackToTop(reduced)

  const head = qs('[data-nav]')
  const overlay = qs('[data-menu]')
  const toggle = qs('[data-menu-toggle]')
  if (!head) return

  const state = { menuOpen: false }
  const header = initHeader(head, state, reduced)
  if (overlay && toggle) initMenu(head, overlay, toggle, state, header, reduced)
}

/* ========================================================================== *
   SCROLL PROGRESS RAIL
   The bar reads --scroll-progress (written by scroll.js) — no JS per frame.
 * ========================================================================== */
function initRail() {
  if (qs('.scroll-rail')) return
  const rail = el('div', { class: 'scroll-rail', 'aria-hidden': 'true' }, [
    el('div', { class: 'scroll-rail__bar' }),
  ])
  document.body.appendChild(rail)
}

/* ========================================================================== *
   CURRENT PAGE
 * ========================================================================== */
function normalisePath(href) {
  if (!href) return '/'
  let path = href
  try {
    path = new URL(href, window.location.origin).pathname
  } catch {
    /* relative fragment or malformed href — fall through with the raw value */
  }
  path = path.replace(/index\.html?$/i, '')
  if (!path.startsWith('/')) path = `/${path}`
  if (!path.endsWith('/')) path += '/'
  return path.replace(/\/{2,}/g, '/')
}

function markCurrent() {
  const here = normalisePath(window.location.pathname)

  qsa('[data-nav-link]').forEach((link) => {
    const path = normalisePath(link.getAttribute('href'))
    const match = path === here || (path !== '/' && here.startsWith(path))
    link.classList.toggle('is-current', match)
    if (match) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })

  const home = qs('[data-nav-home]')
  if (home) {
    const isHome = here === '/'
    home.classList.toggle('is-current', isHome)
    if (isHome) home.setAttribute('aria-current', 'page')
    else home.removeAttribute('aria-current')
  }
}

/* ========================================================================== *
   LIVE STUDIO CLOCK — '14:32 CT', refreshed every 30 seconds
 * ========================================================================== */
function initClock() {
  const clocks = qsa('[data-clock]')
  const years = qsa('[data-year]')
  if (!clocks.length && !years.length) return

  const zone = contact.timezone || 'America/Chicago'
  const label = contact.tzLabel || 'CT'
  let format

  try {
    format = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: zone,
    })
  } catch {
    format = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  }

  const paint = () => {
    const now = new Date()
    const time = `${format.format(now)} ${label}`
    clocks.forEach((node) => {
      if (node.textContent !== time) node.textContent = time
    })
    const year = String(now.getFullYear())
    years.forEach((node) => {
      if (node.textContent !== year) node.textContent = year
    })
  }

  paint()
  window.setInterval(paint, 30000)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) paint()
  })
}

/* ========================================================================== *
   BACK TO TOP
 * ========================================================================== */
function initBackToTop(reduced) {
  qsa('[data-scroll-top]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (getLenis()) scrollTo(0, { duration: reduced ? 0.01 : 1.5 })
      else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    })
  })
}

/* ========================================================================== *
   HEADER — stick past the hero, hide on the way down, return on the way up
 * ========================================================================== */
function initHeader(head, state, reduced) {
  const lenis = getLenis()
  let stuck = false
  let hidden = false
  let lastY = Math.max(0, lenis?.scroll ?? window.scrollY)
  let stickAfter = 72
  let hideAfter = window.innerHeight * HIDE_RATIO

  const hero = qs('[data-nav-hero], [data-section="hero"], [data-hero], .page-hero')
  if (hero?.dataset.theme === 'ink') head.classList.add('site-head--invert')

  const measure = () => {
    const headH = head.offsetHeight || 0
    stickAfter = hero ? Math.max(96, hero.offsetHeight - headH * 1.35) : 72
    hideAfter = window.innerHeight * HIDE_RATIO
  }

  const setStuck = (next) => {
    if (next === stuck) return
    stuck = next
    head.classList.toggle('is-stuck', next)
  }

  const setHidden = (next) => {
    if (next === hidden) return
    hidden = next
    head.classList.toggle('is-hidden', next)
  }

  const update = () => {
    const y = Math.max(0, getLenis()?.scroll ?? window.scrollY)
    const delta = y - lastY
    lastY = y

    setStuck(y > stickAfter)

    // The menu owns the header while it is open.
    if (state.menuOpen) {
      setHidden(false)
      return
    }

    const velocity = scrollVelocity() || delta
    if (y <= hideAfter) setHidden(false)
    else if (velocity > VEL_GATE) setHidden(true)
    else if (velocity < -VEL_GATE) setHidden(false)
  }

  measure()
  update()

  lenis?.on('scroll', update)
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', debounce(() => {
    measure()
    update()
  }, 180), { passive: true })

  if (reduced) head.classList.add('site-head--static')

  // The menu must never leave the header hidden behind it.
  return { show: () => setHidden(false), measure }
}

/* ========================================================================== *
   OVERLAY MENU
 * ========================================================================== */
function initMenu(head, overlay, toggle, state, header, reduced) {
  const root = document.documentElement
  const cols = qsa('.site-menu__col', overlay)
  const lines = qsa('.site-menu__line', overlay)
  const fades = qsa('[data-menu-fade]', overlay)
  const foot = qs('[data-menu-foot]', overlay)
  const headNav = qs('.site-head__nav', head)
  const headAside = qs('[data-nav-aside]', head)

  const desktop = window.matchMedia(DESKTOP_MQ)
  const inertStore = []
  let tl = null

  /* ------------------------------------------------------------ timeline */
  const buildTimeline = () => {
    if (tl) return tl
    tl = gsap.timeline({ paused: true, defaults: { ease: EASE.out } })

    if (cols.length) {
      tl.fromTo(
        cols,
        { scaleY: 0 },
        { scaleY: 1, duration: 0.78, stagger: 0.055, ease: EASE.inOut, transformOrigin: 'top center' },
        0
      )
    }
    if (lines.length) {
      tl.fromTo(
        lines,
        { yPercent: 118, rotate: 3.5, opacity: 0 },
        { yPercent: 0, rotate: 0, opacity: 1, duration: 0.82, stagger: 0.055, transformOrigin: 'left bottom' },
        0.3
      )
    }
    if (fades.length) {
      tl.fromTo(fades, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62, stagger: 0.06 }, 0.52)
    }
    if (foot) {
      tl.fromTo(foot, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62 }, 0.64)
    }
    return tl
  }

  const settle = () => {
    // Reduced-motion (and pre-timeline) resting state for an open menu.
    gsap.set(cols, { scaleY: 1, transformOrigin: 'top center' })
    gsap.set(lines, { yPercent: 0, rotate: 0, opacity: 1 })
    gsap.set([...fades, foot].filter(Boolean), { y: 0, opacity: 1 })
  }

  /* --------------------------------------------------------- background */
  const lockBackground = () => {
    inertStore.length = 0
    qsa('body > *').forEach((node) => {
      // Never inert the menu, the header, or anything that wraps them.
      if (node.contains(overlay) || node.contains(head)) return
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return
      inertStore.push([node, node.hasAttribute('inert')])
      node.setAttribute('inert', '')
    })
    ;[headNav, headAside].forEach((node) => {
      if (!node) return
      inertStore.push([node, node.hasAttribute('inert')])
      node.setAttribute('inert', '')
    })
  }

  const unlockBackground = () => {
    inertStore.forEach(([node, had]) => {
      if (!had) node.removeAttribute('inert')
    })
    inertStore.length = 0
  }

  /* -------------------------------------------------------- focus trap  */
  const isVisible = (node) =>
    !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length)

  const trapTargets = () => {
    const out = []
    const collect = (scope) => {
      if (!scope) return
      qsa(FOCUSABLE, scope).forEach((node) => {
        if (node.closest('[inert]')) return
        if (!isVisible(node)) return
        out.push(node)
      })
    }
    collect(head)
    collect(overlay)
    return out
  }

  const onKeydown = (event) => {
    if (!state.menuOpen) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const items = trapTargets()
    if (!items.length) return

    const index = items.indexOf(document.activeElement)
    if (index === -1) {
      event.preventDefault()
      items[event.shiftKey ? items.length - 1 : 0].focus()
      return
    }
    if (event.shiftKey && index === 0) {
      event.preventDefault()
      items[items.length - 1].focus()
    } else if (!event.shiftKey && index === items.length - 1) {
      event.preventDefault()
      items[0].focus()
    }
  }

  /* ------------------------------------------------------------- open   */
  function openMenu() {
    if (state.menuOpen) return
    state.menuOpen = true

    root.classList.add('is-menu-open')
    head.classList.add('has-menu')
    header?.show()

    overlay.classList.add('is-open')
    overlay.removeAttribute('inert')
    overlay.setAttribute('aria-hidden', 'false')
    toggle.setAttribute('aria-expanded', 'true')
    toggle.setAttribute('aria-label', 'Close menu')

    lockBackground()
    stopScroll()

    if (reduced) settle()
    else buildTimeline().timeScale(1).play()

    const first = qs('.site-menu__link', overlay)
    requestAnimationFrame(() => (first || overlay).focus({ preventScroll: true }))
  }

  /* ------------------------------------------------------------- close  */
  function close() {
    if (!state.menuOpen) return
    state.menuOpen = false

    const restore =
      overlay.contains(document.activeElement) || document.activeElement === document.body

    root.classList.remove('is-menu-open')
    head.classList.remove('has-menu')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', 'Open menu')

    if (restore) toggle.focus({ preventScroll: true })

    overlay.setAttribute('aria-hidden', 'true')
    overlay.setAttribute('inert', '')

    unlockBackground()
    startScroll()

    const done = () => overlay.classList.remove('is-open')

    if (reduced || !tl) {
      done()
      return
    }
    tl.eventCallback('onReverseComplete', done)
    tl.timeScale(1.85).reverse()
  }

  /* ------------------------------------------------------------- wiring */
  toggle.addEventListener('click', () => (state.menuOpen ? close() : openMenu()))

  overlay.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) close()
  })

  document.addEventListener('keydown', onKeydown)

  const onBreakpoint = () => {
    if (state.menuOpen) close()
    header?.measure()
  }
  if (typeof desktop.addEventListener === 'function') desktop.addEventListener('change', onBreakpoint)
  else desktop.addListener(onBreakpoint)

  // A hard resize (orientation change, devtools) should not leave a stale lock.
  window.addEventListener('orientationchange', onBreakpoint)
}

export default initNav
