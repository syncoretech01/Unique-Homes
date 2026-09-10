# Unique Homes and Design

An award-tier marketing site for a residential architecture and engineering studio — architectural packages, civil engineering and in-house 3D visualisation.

Built with Vite (multi-page), vanilla ES modules, Three.js, GSAP and Lenis. No framework, no runtime network dependencies, and **no image files** — every photograph-shaped thing on this site is drawn in code.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # → dist/
npm run preview    # http://localhost:4180  (serves the production build)
```

Node 18+ required (developed on Node 24).

---

## Pages

| Route | Sections |
|---|---|
| `/` | hero · manifesto · services-layers · story · showcase · anatomy · gallery3d · process-columns · voices · journal-preview · cta |
| `/services/` | page-hero · service-detail · packages · faq · cta |
| `/projects/` | page-hero · projects-index · cta |
| `/studio/` | page-hero · studio-story · studio-team · recognition · cta |
| `/journal/` | page-hero · journal-index · cta |
| `/contact/` | page-hero · contact-form · contact-info |
| `/404.html` | standalone |

---

## How it is put together

```
index.html, services/, projects/, …   page shells (HTML partial includes)
src/
  main.js, pages/*.js                 one entry per page — boots with its section list
  core/
    app.js          bootstrap + event bus + lazy section mounting
    motion.js       GSAP + every plugin, house easing curves  ← import GSAP from here only
    scroll.js       Lenis, driven by the GSAP ticker
    reveal.js       declarative animation engine (data-* attributes)
    cursor.js       custom cursor with per-element intent states
    nav.js          header, overlay menu, footer behaviour
    preloader.js    intro sequence
    transition.js   between-page curtain
    webgl/
      stage.js      ONE renderer, many scenes, drawn via scissor rects
      materials.js  shared material + procedural texture library
      models.js     buildHouse(), buildMassing(), explodeTimeline(), …
  sections/<slug>/  <slug>.html + .css + .js — one folder per section
  lib/drawings.js   the procedural architectural drawing engine
  data/             all site copy
  styles/           tokens, base, typography, layout, components
  ui/index.js       shared behaviours (magnetic, tilt, accordion, forms, marquee…)
```

### One WebGL context, many scenes

`core/webgl/stage.js` owns a single `WebGLRenderer` on one fixed full-viewport canvas. A section binds a scene to a DOM element with `stage.createSlot({ el, setup, update, resize })`; each frame the stage reads that element's rect and renders the scene into exactly that rectangle using the scissor test. Six independent 3D scenes therefore cost one GL context, and because the stage runs on the **same GSAP ticker that drives Lenis**, 3D and scroll can never desync.

Slots expose `progress`, `centerOffset`, `pointerSmooth`, `hovered`, `visible` and `tier`. Off-screen slots are skipped entirely.

### Everything is drawn, nothing is photographed

`src/lib/drawings.js` generates nine kinds of real architectural drawing as SVG — `plan`, `section`, `elevation`, `axon`, `site`, `framing`, `detail`, `contour`, `grid` — deterministically from a seed, with poché walls, door swings, dimension strings, hatch patterns, grid bubbles, leader lines, north arrows, scale bars and title blocks. Materials and 3D textures are painted procedurally onto canvases in `webgl/materials.js`.

That means: no image requests, no broken images, no licensing, and a project looks identical everywhere it appears (each record in `src/data/projects.js` carries its own `plate`).

### Three animation systems, each where it belongs

- **GSAP** owns choreography: pins, scrubbed sequences, timelines, drag, SplitText, DrawSVG.
- **Lenis** owns scroll, driven by the GSAP ticker so nothing can desync.
- **Motion One** (`motion/mini`, ~3KB) owns continuous ambient loops — the live status dot, the
  map pin halo. These never stop, so putting them on the GSAP ticker would make them compete with
  Lenis and WebGL every frame. Compiled to WAAPI, the compositor runs them and they hold their
  timing even while the main thread is saturated. Opt in with `data-pulse` (see `src/ui/ambient.js`).

### Declarative animation

Most motion is markup, not code:

```html
<h2 data-split="lines" data-stagger="0.08">…</h2>
<div data-reveal="up" data-delay="0.2">…</div>
<div data-parallax="-0.18">…</div>
<span data-counter="480" data-suffix="+"></span>
<svg data-draw>…</svg>
```

`core/reveal.js` wires these after boot. Bespoke GSAP is reserved for pins, scrubbed sequences, 3D and drag.

### Performance

- Sections below the fold **initialise as they approach**, not at boot — the page does not build eleven sections and six 3D scenes before first paint.
- The environment map is generated on first 3D use, so pages without 3D never pay for it.
- Pointer-driven motion uses `gsap.quickTo`/`quickSetter`; nothing calls `getBoundingClientRect` inside a ticker.
- `deviceTier()` scales geometry detail, texture size, shadow maps and DPR on weaker hardware.
- Vendor code is split into cached `three` / `gsap` / `lenis` chunks shared by all seven pages.

### Accessibility and resilience

- Full `prefers-reduced-motion` path — every section ships a legible static state.
- `html.no-webgl` fallbacks render an SVG drawing wherever a 3D scene would be.
- Keyboard-operable menu, sliders, accordions, filters and modals with focus trapping and restoration.
- One `<h1>` per page, real buttons and links, visible focus rings, decorative canvas/SVG marked `aria-hidden`.
- A boot-level failsafe removes the loader after 8s no matter what, so a slow device can never be stranded behind the intro.

---

## Content is placeholder

The studio, its people, projects, recognitions and credentials are **fictional**, written to demonstrate the design. Before this goes anywhere near production, replace:

- `src/data/site.js` — name, address, phone (currently a reserved `555` number), email, licence numbers, social links
- `src/data/projects.js`, `content.js`, `services.js` — projects, team, testimonials, journal, FAQ, fees
- The recognitions list in `site.js`, which is illustrative only

The contact and newsletter forms **validate but do not send** — they say so in their success states. Wire them to a real endpoint in `src/ui/index.js` (`data-form` handling) and `src/sections/contact-form/contact-form.js`.

---

## Conventions

`docs/BUILD-CONTRACT.md` is the working agreement every module follows — design tokens, section file shape, WebGL rules, responsive and a11y requirements. Read it before adding a section.

Colours always come from CSS custom properties (`--bg`, `--fg`, `--accent`, `--line` …), which flip automatically inside `[data-theme="ink"]` and `[data-theme="blueprint"]` scopes. Never hardcode a hex outside generated artwork.
