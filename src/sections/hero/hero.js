/* ============================================================================
   HERO
   The courtyard house rendered live behind the studio's promise.

   Three choreographed moments, in order:

   1. ENTRANCE — on `intro:done` the camera settles from a low, pushed-in
      three-quarter view out to the framing shot while the eight house layers
      fly the last few centimetres into place. A short assembly, not the full
      exploded view (that belongs to the anatomy section).

   2. IMMERSIVE ZOOM — a single pinned, scrubbed ScrollTrigger writes to a
      plain object; the slot's update() reads it and dollies the camera down
      its own view axis, through the courtyard glazing, while the type scales
      and dissolves and a sunlight bloom floods the frame. The next section
      arrives as if from inside the house.

   3. IDLE — a few degrees of pointer parallax and a sun that walks slowly
      across the sky so the shadows are never frozen.

   Everything above is skipped under `ctx.reduced`, which leaves a fully
   legible static hero with a still render. Without WebGL the same box holds
   a generated axonometric drawing instead.
   ========================================================================== */
import './hero.css'
import { gsap, ScrollTrigger, splitText, EASE } from '../../core/motion.js'
import { qs, qsa, clamp } from '../../lib/utils.js'
import { brand, contact } from '../../data/site.js'
import { serviceLinks } from '../../data/services.js'
import { drawingSVG } from '../../lib/drawings.js'
import { stage, THREE } from '../../core/webgl/stage.js'
import { buildHouse, buildSiteGround, buildTrees, frameObject } from '../../core/webgl/models.js'
import { PAL } from '../../core/webgl/materials.js'

/* --------------------------------------------------------------- FRAMING */
/* One entry per aspect band. `fill` scales the vertical-fit distance, and
   the two shifts pan the camera perpendicular to its own axis so the house
   sits clear of the headline: +shiftX moves the subject right, +shiftY moves
   it down, both measured in half-frames. */
const VIEWS = {
  wide: { az: 0.94, el: 0.255, target: [0.2, 2.65, 0.1], fill: 0.92, shiftX: 0.34, shiftY: 0.06 },
  square: { az: 1.02, el: 0.3, target: [0.1, 2.6, 0.0], fill: 1.06, shiftX: 0.14, shiftY: 0.17 },
  portrait: { az: 1.18, el: 0.34, target: [0.0, 2.55, -0.2], fill: 1.38, shiftX: 0.02, shiftY: 0.3 },
}

/* The dolly ends here: inside the north bar, a metre past the courtyard
   glazing, at standing height. */
const DIVE_TARGET = [-1.2, 1.95, -2.3]
const DIVE_BACK = 4.0

/* Specimen trees beyond the plot line. Ordered so a low-tier device keeps
   the ones that read behind the building, and placed clear of the corridor
   the entrance camera travels along. */
const TREE_SPOTS = [
  [-7.4, -10.6], [0.8, -12.4], [-12.6, -3.2], [7.6, -10.2],
  [-13.0, 4.4], [12.4, -5.4], [-8.4, 9.8], [13.0, 2.6],
  [-1.6, 12.6], [5.0, 12.4],
]

const UP = new THREE.Vector3(0, 1, 0)
const _pos = new THREE.Vector3()
const _tgt = new THREE.Vector3()
const _off = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _pan = new THREE.Vector3()
const _size = new THREE.Vector3()

export default function initHero(ctx = {}) {
  const root = document.querySelector('[data-section="hero"]')
  if (!root) return

  const reduced = Boolean(ctx.reduced)
  const bus = ctx.bus || null

  const els = {
    viewport: qs('[data-hero-viewport]', root),
    stage: qs('[data-hero-stage]', root),
    fallback: qs('[data-hero-fallback]', root),
    scrim: qs('.hero__scrim', root),
    flare: qs('[data-hero-flare]', root),
    main: qs('[data-hero-main]', root),
    foot: qs('[data-hero-foot]', root),
    title: qs('.hero__title', root),
    items: qsa('[data-hero-item]', root),
    footItems: qsa('[data-hero-foot-item]', root),
    lede: qs('[data-hero-lede]', root),
    chips: qs('[data-hero-chips]', root),
    coords: qs('[data-hero-coords]', root),
  }

  syncCopy(els)

  /* State shared between the GSAP timelines and the render loop. */
  const S = {
    reduced,
    house: null,
    focus: null,
    sun: null,
    sunA: Math.atan2(6, 7.5),
    sunR: Math.hypot(7.5, 6),
    sunY: 10.5,
    radius: 8,
    view: VIEWS.wide,
    assembly: [],
    intro: { t: reduced ? 1 : 0 },
    drive: { dive: 0 },
    homePos: new THREE.Vector3(),
    homeTgt: new THREE.Vector3(),
    introPos: new THREE.Vector3(),
    introTgt: new THREE.Vector3(),
    divePos: new THREE.Vector3(),
    diveTgt: new THREE.Vector3(...DIVE_TARGET),
  }

  const slot = mountScene(ctx, els, S)
  if (!slot) mountFallback(els)

  /* Hide the entrance layers before first paint. The preloader is still over
     the page at this point, so nothing flickers. */
  if (!reduced) {
    if (els.title) gsap.set(els.title, { autoAlpha: 0 })
    gsap.set([...els.items, ...els.footItems], { autoAlpha: 0, y: 18 })
  }

  const start = () => runIntro(els, S, Boolean(slot), reduced)
  if (reduced) start()
  else if (bus?.hasFired?.('intro:done')) start()
  else if (bus?.once) bus.once('intro:done', start)
  else start()

  if (!reduced) wireScroll(root, els, S)
}

/* ==========================================================================
   COPY — the markup mirrors the data layer; this guarantees it stays true
   ========================================================================== */

function syncCopy(els) {
  if (els.lede && brand.description) els.lede.textContent = brand.description

  if (els.coords && contact.coords) {
    const { lat, lng } = contact.coords
    els.coords.textContent = `${axis(lat, 'N', 'S')} ${axis(lng, 'E', 'W')}`
  }

  if (els.chips) {
    const items = qsa('.hero__chip-item', els.chips)
    serviceLinks.forEach((service, i) => {
      const link = items[i] && qs('.hero__chip', items[i])
      if (!link) return
      link.setAttribute('href', service.href)
      const idx = qs('.hero__chip-idx', link)
      const label = qs('.hero__chip-label', link)
      if (idx) idx.textContent = service.index
      if (label) label.textContent = service.label
    })
    items.slice(serviceLinks.length).forEach((node) => node.remove())
  }
}

const axis = (value, pos, neg) =>
  `${Math.abs(value).toFixed(4)}° ${value >= 0 ? pos : neg}`

/* ==========================================================================
   NO-WEBGL — a generated axonometric holds the frame instead
   ========================================================================== */

function mountFallback(els) {
  if (!els.fallback || els.fallback.childElementCount) return
  els.fallback.innerHTML = drawingSVG('axon', {
    seed: 7,
    ink: '#27415A',
    accent: '#AE4E2A',
    width: 1440,
    height: 960,
    density: 1.05,
    label: 'Courtyard House',
    index: '000',
    strokeScale: 1.15,
  })
}

/* ==========================================================================
   3D
   ========================================================================== */

function mountScene(ctx, els, S) {
  if (!els.stage) return null
  if (document.documentElement.classList.contains('no-webgl')) return null

  return stage.createSlot({
    el: els.stage,
    fov: 34,
    near: 0.1,
    far: 140,

    setup({ scene, camera, slot }) {
      const tier = slot.tier || ctx.tier || 'high'
      const low = tier === 'low'
      const detail = low ? 0.5 : tier === 'mid' ? 0.78 : 1

      const house = buildHouse({
        seed: 7,
        tier,
        detail,
        withSite: true,
        withInterior: true,
        accent: PAL.terra,
        scene,
        lights: true,
      })
      S.house = house
      S.focus = house.parts.envelope
      S.sun = house.group.userData.lights?.sun || null

      /* A wider setting-out plate under the graded pad — the model reads as
         a study model on a drawing board rather than a floating object. */
      const ground = buildSiteGround({
        size: 34,
        divisions: 34,
        repeat: 6,
        contours: low ? 0 : 3,
        contourRadius: 12.5,
        boundary: true,
        accent: PAL.terra,
        catchShadow: false,
        seed: 7,
      })
      ground.position.y = -0.34
      scene.add(ground)

      /* Perimeter planting beyond the plot line, on the lower apron. The
         spots are explicit so nothing ever lands in the corridor the
         entrance camera flies out through. */
      const trees = buildTrees(low ? 4 : 9, {
        seed: 91,
        positions: TREE_SPOTS,
        height: 3.4,
        spread: 0.45,
        tier,
      })
      trees.position.y = -0.34
      scene.add(trees)

      scene.updateMatrixWorld(true)

      const box = new THREE.Box3().setFromObject(house.parts.envelope)
      box.expandByObject(house.parts.roof)
      S.radius = Math.max(box.getSize(_size).length() * 0.5, 1)

      frameScene(camera, slot, S)

      if (!S.reduced) prepareAssembly(S)
    },

    resize({ slot, camera }) {
      if (!S.house) return
      frameScene(camera, slot, S)
    },

    update({ elapsed, slot, camera }) {
      if (!S.house) return

      const dive = clamp(S.drive.dive, 0, 1)
      const intro = clamp(S.intro.t, 0, 1)

      _pos.copy(S.introPos).lerp(S.homePos, intro)
      _tgt.copy(S.introTgt).lerp(S.homeTgt, intro)

      if (dive > 0.0005) {
        _pos.lerp(S.divePos, dive)
        _tgt.lerp(S.diveTgt, dive)
      }

      if (!S.reduced) {
        /* Pointer parallax — a few degrees, faded out as the camera commits
           to the dive so the dolly stays on rails. */
        const k = (1 - dive) * intro
        if (k > 0.002) {
          const ax = (-slot.pointerSmooth.x * 0.055 + Math.sin(elapsed * 0.17) * 0.012) * k
          const ay = (slot.pointerSmooth.y * 0.028 + Math.cos(elapsed * 0.13) * 0.008) * k
          _off.subVectors(_pos, _tgt)
          _off.applyAxisAngle(UP, ax)
          _right.crossVectors(_off, UP).normalize()
          _off.applyAxisAngle(_right, ay)
          _pos.copy(_tgt).add(_off)
        }

        if (S.sun && slot.tier !== 'low') {
          const a = S.sunA + Math.sin(elapsed * 0.043) * 0.3
          S.sun.position.set(
            Math.cos(a) * S.sunR,
            S.sunY + Math.sin(elapsed * 0.031) * 0.85,
            Math.sin(a) * S.sunR
          )
        }
      }

      camera.position.copy(_pos)
      camera.lookAt(_tgt)
    },
  })
}

/**
 * Frame the house for the slot's current aspect and derive every camera pose
 * the section animates between. Called on setup and on every slot resize.
 */
function frameScene(camera, slot, S) {
  const aspect = Math.max(0.2, (slot.width || 1) / (slot.height || 1))
  const view = aspect < 0.95 ? VIEWS.portrait : aspect < 1.4 ? VIEWS.square : VIEWS.wide
  S.view = view

  S.homeTgt.set(view.target[0], view.target[1], view.target[2])

  frameObject(camera, S.focus, {
    padding: 1,
    azimuth: view.az,
    elevation: view.el,
    target: S.homeTgt,
  })

  /* Fit on the vertical field only, then let `fill` decide how much air the
     composition keeps — a pure bounding-sphere fit shrinks the house to
     nothing on a wide hero and crops it on a phone. */
  const vFov = THREE.MathUtils.degToRad(camera.fov || 34)
  const dist = (S.radius / Math.sin(vFov / 2)) * view.fill
  _dir.subVectors(camera.position, S.homeTgt).normalize()
  camera.position.copy(S.homeTgt).addScaledVector(_dir, dist)

  const halfH = dist * Math.tan(vFov / 2)
  const halfW = halfH * aspect
  _dir.negate()
  _right.crossVectors(_dir, UP).normalize()
  _up.crossVectors(_right, _dir).normalize()
  _pan
    .set(0, 0, 0)
    .addScaledVector(_right, -view.shiftX * halfW)
    .addScaledVector(_up, view.shiftY * halfH)

  camera.position.add(_pan)
  S.homeTgt.add(_pan)
  S.homePos.copy(camera.position)

  /* Entrance: pushed in, low, and a little off the settled azimuth. */
  const az0 = view.az - 0.2
  const el0 = view.el * 0.16
  const d0 = dist * 0.44
  S.introPos.set(
    S.homeTgt.x + d0 * Math.cos(el0) * Math.sin(az0),
    S.homeTgt.y + d0 * Math.sin(el0) - 0.4,
    S.homeTgt.z + d0 * Math.cos(el0) * Math.cos(az0)
  )
  S.introTgt.copy(S.homeTgt)
  S.introTgt.y -= dist * 0.02

  /* Dive: straight down the settled view axis, levelled off, ending at the
     glazing line of the north bar. */
  S.diveTgt.set(DIVE_TARGET[0], DIVE_TARGET[1], DIVE_TARGET[2])
  _dir.subVectors(S.homeTgt, S.homePos).normalize()
  _dir.y *= 0.26
  _dir.normalize()
  S.divePos.copy(S.diveTgt).addScaledVector(_dir, -DIVE_BACK)

  camera.near = 0.1
  camera.far = Math.max(90, dist + S.radius * 4)
  camera.updateProjectionMatrix()
}

/** Offset every layer along its own explode vector, ready to fly home. */
function prepareAssembly(S) {
  if (S.assembly.length) return
  const parts = Object.values(S.house.parts || {})
    .filter((p) => p && p.userData && p.userData.explodeDir)
    .sort((a, b) => (a.userData.order ?? 0) - (b.userData.order ?? 0))

  S.assembly = parts.map((group) => {
    const home = group.position.clone()
    const lift = Math.min((group.userData.explodeDist ?? 1) * 0.17, 1.15)
    group.position.copy(home).addScaledVector(group.userData.explodeDir, lift)
    return { group, home }
  })
}

/* ==========================================================================
   ENTRANCE
   ========================================================================== */

function runIntro(els, S, hasGL, reduced) {
  if (reduced) {
    gsap.set([els.title, ...els.items, ...els.footItems].filter(Boolean), {
      autoAlpha: 1,
      clearProps: 'transform',
    })
    S.intro.t = 1
    return
  }

  const tl = gsap.timeline({ defaults: { ease: EASE.out } })

  /* --- camera + assembly ------------------------------------------------ */
  if (hasGL && S.house) {
    tl.to(S.intro, { t: 1, duration: 2.9, ease: EASE.drift }, 0)
    tl.fromTo(
      S.house.group.scale,
      { x: 0.955, y: 0.955, z: 0.955 },
      { x: 1, y: 1, z: 1, duration: 2.5, ease: EASE.out },
      0
    )
    S.assembly.forEach((part, i) => {
      tl.to(
        part.group.position,
        {
          x: part.home.x,
          y: part.home.y,
          z: part.home.z,
          duration: 1.5,
          ease: EASE.out,
        },
        0.12 + i * 0.075
      )
    })
  } else {
    S.intro.t = 1
  }

  /* --- headline: chars rising out of their line masks ------------------- */
  if (els.title) {
    let split = null
    try {
      split = splitText(els.title, { type: 'lines,words,chars', mask: 'lines' })
    } catch (err) {
      split = null
    }
    gsap.set(els.title, { autoAlpha: 1 })

    const lines = (split && split.lines) || []
    let staggered = false

    lines.forEach((line, i) => {
      const chars = qsa('.split-char', line)
      if (!chars.length) return
      staggered = true
      tl.fromTo(
        chars,
        { yPercent: 118, rotate: 4.5, transformOrigin: '0% 100%' },
        {
          yPercent: 0,
          rotate: 0,
          duration: 1.3,
          ease: EASE.out,
          stagger: 0.015,
        },
        0.16 + i * 0.13
      )
    })

    if (!staggered) {
      tl.fromTo(
        els.title,
        { yPercent: 20, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 1.2 },
        0.16
      )
    }
  }

  /* --- everything else follows ------------------------------------------ */
  if (els.items.length) {
    tl.to(
      els.items,
      { autoAlpha: 1, y: 0, duration: 1.05, stagger: 0.085, ease: EASE.out },
      0.42
    )
  }
  if (els.footItems.length) {
    tl.to(
      els.footItems,
      { autoAlpha: 1, y: 0, duration: 1.05, stagger: 0.1, ease: EASE.out },
      0.72
    )
  }

  return tl
}

/* ==========================================================================
   IMMERSIVE ZOOM
   ========================================================================== */

function wireScroll(root, els, S) {
  const mm = gsap.matchMedia()
  const noGL = document.documentElement.classList.contains('no-webgl')

  const build = (pin) => () => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: pin ? '+=100%' : 'bottom top',
        scrub: pin ? 0.6 : true,
        pin: pin ? els.viewport : false,
        pinSpacing: pin,
        anticipatePin: pin ? 1 : 0,
        invalidateOnRefresh: true,
      },
    })

    /* The dolly itself. Pinned, it accelerates so the last third feels like
       falling into the building; unpinned the hero is leaving at the same
       time, so the move front-loads instead and stops short of the glass. */
    tl.fromTo(
      S.drive,
      { dive: 0 },
      { dive: pin ? 1 : 0.82, duration: 1, ease: pin ? 'power1.in' : 'power1.out' },
      0
    )

    /* Type scales and dissolves out of the way of the camera. */
    if (els.main) {
      tl.to(els.main, { scale: 1.14, yPercent: -6, autoAlpha: 0, duration: 0.62 }, 0.02)
    }
    if (els.foot) {
      tl.to(els.foot, { yPercent: 34, autoAlpha: 0, duration: 0.4 }, 0)
    }
    if (els.scrim) {
      tl.to(els.scrim, { autoAlpha: 0, duration: 0.42 }, 0.16)
    }
    /* No-WebGL: the drawing takes the zoom instead of the camera. */
    if (noGL && els.fallback) {
      tl.to(els.fallback, { scale: 1.45, duration: 1 }, 0)
    }
    /* Sunlight through the glazing carries the hand-off to the next section. */
    if (els.flare) {
      tl.fromTo(els.flare, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.42 }, 0.58)
    }

    /* gsap.matchMedia reverts the timeline, its ScrollTrigger and every
       property it touched; the camera driver is the only state it cannot
       know about. */
    return () => {
      S.drive.dive = 0
    }
  }

  /* Pinning below 768px fights the mobile URL bar, so phones get the same
     dolly driven by the hero's own scroll-out instead. */
  mm.add('(min-width: 769px) and (min-height: 560px)', build(true))
  mm.add('(max-width: 768px), (max-height: 559px)', build(false))

  ScrollTrigger.refresh()
}
