/* ============================================================================
   STUDIO TEAM — six people, six generated portrait plates

   The design problem: there are no photographs. So each person gets a plate
   that is unmistakably *made*, not missing —

     · a field tinted from their `hue` (CSS, from tokens + the data hue)
     · an architectural drawing fragment whose kind and seed are derived from
       their name, cropped hard by the frame so it reads as a detail
     · their initials set enormous in Fraunces and cut by the bottom edge,
       double-struck with a pale outline offset like a mis-registered print

   Hover choreography is split so nothing fights over one transform:
     · CSS owns the card lift + shadow (so :focus-visible gets it identically)
     · the UI kit's [data-tilt] owns rotationX/rotationY and the z-depth
       parallax of the drawing / initials / marks / sheen layers (quickTo —
       never a tween per pointermove)
     · CSS owns the specular sheen sweep, as a one-shot keyframe so it never
       runs backwards when the pointer leaves
   ========================================================================== */
import './studio-team.css'
import { gsap, EASE, queueRefresh } from '../../core/motion.js'
import { qs, qsa, pad } from '../../lib/utils.js'
import { drawingSVG, grainDataURI } from '../../lib/drawings.js'
import { team } from '../../data/content.js'

/* Drawing kinds offered to the roster. Ordered so that neighbouring cards
   never land on visually similar sheets, and deliberately without 'grid' —
   a bare setting-out grid is too sparse to carry a portrait plate. */
const KINDS = ['section', 'axon', 'contour', 'elevation', 'framing', 'plan', 'detail', 'site']

/* Short sheet labels printed in the corner of each plate. */
const KIND_LABEL = {
  plan: 'Plan · A-1',
  section: 'Section · A-2',
  elevation: 'Elevation · A-3',
  axon: 'Axonometric · A-4',
  detail: 'Wall detail · A-5',
  site: 'Site plan · C-1',
  contour: 'Contours · C-2',
  framing: 'Framing · S-2',
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c])

/** FNV-1a — a stable, well-spread hash so a name always draws the same plate. */
function hashOf(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** HSL → hex. Only ever used to ink generated artwork, never page chrome. */
function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const ch = (n) => {
    const k = (n + h / 30) % 12
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${ch(0)}${ch(8)}${ch(4)}`
}

/**
 * Give every member a distinct drawing kind, chosen from their own name and
 * bumped to the next free slot only when two names collide.
 */
function assignKinds(people) {
  const taken = new Set()
  return people.map((person) => {
    const start = hashOf(person.name) % KINDS.length
    for (let i = 0; i < KINDS.length; i += 1) {
      const kind = KINDS[(start + i) % KINDS.length]
      if (!taken.has(kind)) {
        taken.add(kind)
        return kind
      }
    }
    return KINDS[start]
  })
}

/* ------------------------------------------------------------------------ */
/*  MARKUP                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * The initials, set huge and cut by the bottom of the frame. Drawn as SVG so
 * the type scales exactly with the plate at every breakpoint instead of
 * chasing the column width with a font-size clamp.
 */
function initialsSVG(initials) {
  const glyphs = esc(String(initials || '').slice(0, 3).toUpperCase())
  return (
    `<svg class="studio-team__initials-svg" viewBox="0 0 300 400"` +
    ` preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" role="presentation">` +
    `<text class="studio-team__initials-ghost" x="150" y="440" text-anchor="middle"` +
    ` transform="translate(-11 -13)">${glyphs}</text>` +
    `<text class="studio-team__initials-fill" x="150" y="440" text-anchor="middle">${glyphs}</text>` +
    `</svg>`
  )
}

function cardHTML(person, i, total, kind) {
  const seed = hashOf(`${person.name}/${person.role}`) % 9973
  const ink = hslHex(person.hue, 0.34, 0.27)
  const index = pad(i + 1)
  const nameId = `studio-team-name-${i + 1}`

  const drawing = drawingSVG(kind, {
    seed,
    ink,
    width: 820,
    height: 700,
    density: 0.85,
    strokeScale: 1.2,
    showTitleBlock: false,
  })

  const tags = (person.focus || [])
    .map((f) => `<li class="tag studio-team__tag">${esc(f)}</li>`)
    .join('')

  return (
    `<li class="studio-team__item">` +
      `<article class="studio-team__card" tabindex="0" aria-labelledby="${nameId}"` +
        ` style="--tm-hue:${Number(person.hue) || 24}">` +
        `<div class="studio-team__tilt" data-tilt data-tilt-max="6.5"` +
          ` data-tilt-perspective="1100" data-tilt-noglare>` +

          `<div class="studio-team__portrait">` +
            `<span class="studio-team__field" aria-hidden="true">` +
              `<span class="studio-team__grain"></span>` +
            `</span>` +
            `<span class="studio-team__draw" data-tilt-depth="14" aria-hidden="true">` +
              `<span class="studio-team__draw-art">${drawing}</span>` +
            `</span>` +
            `<span class="studio-team__marks" data-tilt-depth="30" aria-hidden="true">` +
              `<span class="studio-team__frame-line"></span>` +
              `<span class="studio-team__stamp t-num">${index} / ${pad(total)}</span>` +
              `<span class="studio-team__kind">${esc(KIND_LABEL[kind] || 'Drawing')}</span>` +
            `</span>` +
            `<span class="studio-team__initials" data-tilt-depth="46" aria-hidden="true">` +
              initialsSVG(person.initials) +
            `</span>` +
            `<span class="studio-team__sheen" data-tilt-depth="62" aria-hidden="true">` +
              `<span class="studio-team__sheen-band"></span>` +
            `</span>` +
          `</div>` +

          `<div class="studio-team__body">` +
            `<p class="studio-team__meta">` +
              `<span class="studio-team__meta-i t-num">${index}</span>` +
              `<span class="studio-team__meta-line" aria-hidden="true"></span>` +
              `<span class="studio-team__meta-since t-num">Since ${esc(person.since)}</span>` +
            `</p>` +
            `<h3 class="studio-team__name" id="${nameId}">${esc(person.name)}</h3>` +
            `<p class="studio-team__role">${esc(person.role)}</p>` +
            `<p class="studio-team__bio">${esc(person.bio)}</p>` +
            (tags ? `<ul class="studio-team__focus" role="list">${tags}</ul>` : '') +
          `</div>` +

        `</div>` +
      `</article>` +
    `</li>`
  )
}

/* ------------------------------------------------------------------------ */
/*  INIT                                                                     */
/* ------------------------------------------------------------------------ */

export default function initStudioTeam(ctx = {}) {
  const root = document.querySelector('[data-section="studio-team"]')
  if (!root) return

  const grid = qs('[data-team-grid]', root)
  if (!grid) return

  const people = Array.isArray(team) ? team.filter(Boolean) : []
  if (!people.length) return

  /* Paper tooth inside every plate — one cached tile shared by all six. */
  try {
    const grain = grainDataURI(96, 0.42, 11)
    if (grain) root.style.setProperty('--tm-grain', `url("${grain}")`)
  } catch {
    /* canvas unavailable — the plates simply read as flat tinted fields */
  }

  const kinds = assignKinds(people)
  grid.innerHTML = people.map((p, i) => cardHTML(p, i, people.length, kinds[i])).join('')

  const count = qs('[data-team-count]', root)
  if (count) count.textContent = pad(people.length)

  /* Six plates just changed the page height. */
  queueRefresh()

  const cards = qsa('.studio-team__card', grid)
  const inners = qsa('.studio-team__tilt', grid)
  if (!cards.length) return

  if (ctx.reduced) return

  /* Rise + clip, one ScrollTrigger for the whole grid.
     The clip rides the card (CSS never transitions clip-path or opacity) and
     the rise rides the inner tilt layer (CSS never transitions that element),
     so neither animation is ever slowed by a stray CSS transition. */
  gsap.set(cards, { clipPath: 'inset(0 0 100% 0)' })
  gsap.set(inners, { y: 44 })

  const tl = gsap.timeline({
    scrollTrigger: { trigger: grid, start: 'top 84%', once: true },
  })
  tl.to(
    cards,
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.05,
      ease: EASE.out,
      stagger: 0.085,
      clearProps: 'clipPath',
    },
    0
  )
  tl.to(inners, { y: 0, duration: 1.3, ease: EASE.out, stagger: 0.085 }, 0)
}
