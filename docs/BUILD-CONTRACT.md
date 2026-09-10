# Unique Homes and Design — Build Contract

Authoritative rules for every module in this codebase. **Read this fully before writing code.**

Project root: `E:\Development\Websites\Unique Homes and Design`
Stack: Vite (MPA) · vanilla ES modules · Three.js · GSAP (all plugins licensed) · Lenis · Motion One. **No frameworks, no TypeScript, no JSX.**

---

## 1. Non-negotiables

1. **Only write the files assigned to you.** Never edit another module's files, `vite.config.js`, `src/core/app.js`, `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/typography.css`, `src/styles/layout.css`, `src/styles/components.css`, `src/styles/core.css`, `src/core/motion.js`, `src/core/scroll.js`, `src/core/reveal.js`, `src/core/webgl/stage.js`, `src/core/webgl/materials.js`, `src/core/transition.js`, `src/lib/utils.js`, or anything in `src/data/`.
2. **No network at runtime.** No CDN links, no Google Fonts `<link>`, no remote images, no `fetch()` to third parties. Every asset is either an npm package, procedurally generated, or inline SVG. External image hosts are firewalled — a remote `<img>` will render broken.
3. **Never start a dev server, run `npm run dev`, `vite`, or open a browser.** The orchestrator does that. You may run `node --check <file>` to validate syntax.
4. **Do not install packages.** Everything you need is installed already.
5. **The site is light, warm and architectural — not dark.** Dark (`data-theme="ink"`) is a deliberate accent used on at most one or two sections per page.

---

## 2. Design language

Use **CSS custom properties only** — never hardcode a colour outside of generated SVG/canvas artwork.

**Colour** — semantic tokens flip automatically inside `[data-theme="ink"]` / `[data-theme="blueprint"]` scopes:
`--bg` `--bg-raised` `--bg-sunken` `--fg` `--fg-soft` `--fg-muted` `--fg-invert` `--accent` `--accent-fg` `--line` `--line-soft` `--line-strong`
Raw ramp when you truly need a fixed value: `--c-paper --c-bone --c-shell --c-sand --c-stone --c-ash --c-graphite --c-ink --c-obsidian --c-terra --c-terra-400 --c-ochre --c-blueprint --c-moss`

**Type** — classes from `typography.css`, never redefine font stacks:
`.t-mega .t-h1 .t-h2 .t-h3 .t-h4 .t-h5 .t-lead .t-body .t-small .t-mono .t-num .eyebrow .link-u .t-dropcap`
Families: `--ff-display` (Fraunces, variable, used at weight 300 for headlines), `--ff-sans` (Inter Tight), `--ff-mono` (JetBrains Mono, used uppercase + tracked for labels/indices).
Sizes: `--fs-2xs … --fs-mega`. Spacing: `--sp-1 … --sp-14`, `--section-y`, `--page-x`, `--gutter`.

**Motion** — easing tokens `--e-out-expo --e-out-quart --e-in-out-quart --e-spring`; durations `--d-fast --d-base --d-slow --d-slower`.

**Layout primitives** (from `layout.css`): `.shell` `.section` `.grid` (12-col) `.sec-head` `.frame` `.rule` `.stack-*` `.sticky` `.v-label` `.corner-index`
**UI kit** (from `components.css`): `.btn` `.btn--ghost` `.btn--accent` `.btn-circle` `.tag` `.card` `.marquee` `.acc` `.field` `.chip` `.stat` `.scroll-cue` `.plate`

House aesthetic: hairline rules, generous negative space, monospaced index numbers (`01 / 08`), oversized Fraunces display type at weight 300, terracotta as the single accent, technical-drawing motifs.

---

## 3. Section module shape

Each section owns **exactly three files**:

```
src/sections/<slug>/<slug>.html    markup partial
src/sections/<slug>/<slug>.css     styles, scoped
src/sections/<slug>/<slug>.js      behaviour, default-exports an init function
```

**HTML partial** — no `<html>`/`<head>`/`<body>`, no `<script>`, no `<link>`. One root element:

```html
<section class="section <slug>" data-section="<slug>" id="<slug>" aria-labelledby="<slug>-title">
  ...
</section>
```

**JS module**:

```js
import './<slug>.css'
import { gsap, ScrollTrigger, EASE, DUR } from '../../core/motion.js'
import { qs, qsa } from '../../lib/utils.js'

export default function initSlug(ctx) {
  const root = document.querySelector('[data-section="<slug>"]')
  if (!root) return                      // page does not include this section
  if (ctx.reduced) { /* static fallback */ return }
  // ...
}
```

`ctx` is `{ page, lenis, stage, gsap, ScrollTrigger, bus, reduced, touch, tier }`.
- `ctx.reduced` — `prefers-reduced-motion`. Always ship a legible static state.
- `ctx.touch` — coarse pointer. Skip hover-only and cursor-follow work.
- `ctx.tier` — `'low' | 'mid' | 'high'`. Scale particle counts / 3D detail.
- `ctx.bus` — `on/once/emit`. Hero-style intro work should wait for `ctx.bus.once('intro:done', fn)`.

**CSS** — every selector must be prefixed with the section class or `[data-section="<slug>"]`. No bare element selectors (`section {}`, `h2 {}`), no `:root`, no `body`, no `!important` unless overriding a third-party inline style.

---

## 4. Declarative animation (prefer this over hand-rolled triggers)

`src/core/reveal.js` runs automatically after boot and wires these attributes anywhere in the DOM:

| attribute | effect |
|---|---|
| `data-reveal="up\|down\|left\|right\|fade\|scale\|scale-down\|clip\|mask\|blur"` | element entrance |
| `data-reveal-group` (+ `data-reveal-kind`, `data-stagger`) | staggered children |
| `data-split="lines\|words\|chars"` | masked text entrance (SplitText) |
| `data-parallax="-0.18"` / `data-parallax-x` / `data-parallax-scale` | scrubbed parallax |
| `data-media-reveal="up\|down\|left\|right"` | frame unmask + inner scale-back |
| `data-counter="480" data-suffix="+"` | number count-up |
| `data-draw` | SVG stroke draw-on (DrawSVG) |
| `data-skew` | scroll-velocity skew |
| `data-lift="10"` | hover lift micro-interaction |
| modifiers | `data-delay` `data-stagger` `data-duration` `data-start` `data-ease` `data-once="false"` |

Write bespoke GSAP only for genuinely bespoke choreography (pins, scrubbed sequences, 3D, drag).

---

## 5. WebGL

One shared renderer. **Never create a `WebGLRenderer` or a second `<canvas>`.**

```js
import { stage, THREE, fitDistance } from '../../core/webgl/stage.js'
import { lightingRig, concreteMaterial, glassMaterial, timberMaterial, metalMaterial,
         accentMaterial, plasterMaterial, shadowCatcher, fakeShadow, edgeOverlay,
         roundedBox, gridTexture, concreteTexture, PAL, color } from '../../core/webgl/materials.js'

const slot = stage.createSlot({
  el: mountEl,                        // the DOM box the scene is drawn into
  fov: 35,
  setup({ scene, camera, slot }) { /* build once */ },
  update({ dt, elapsed, slot }) { /* per frame while visible */ },
  resize({ width, height, slot }) { /* optional */ },
})
```

Slot gives you `slot.progress` (0→1 through viewport), `slot.centerOffset` (-1→1), `slot.pointer` / `slot.pointerSmooth` (element-local, -1→1), `slot.hovered`, `slot.visible`, `slot.tier`.

Rules:
- The mount element needs a real size in CSS and the class `gl-slot`. HTML that must paint over the canvas gets `.above-gl`.
- Scenes are transparent by default; the section's CSS background shows through.
- Guard for `document.documentElement.classList.contains('no-webgl')` — provide a CSS/SVG fallback inside `.gl-slot__fallback`.
- Budget: ≤ 60k triangles per scene, ≤ 3 lights beyond `lightingRig`, no post-processing passes.
- Use `glassLiteMaterial()` and lower segment counts when `slot.tier === 'low'`.
- Drive scroll-linked 3D from `slot.progress` or a GSAP ScrollTrigger writing to a plain object — never read `getBoundingClientRect()` inside `update`.

---

## 6. Imagery

There are **no photographs**. All imagery is generated by `src/lib/drawings.js`:

```js
import { plateHTML, mountPlate, drawingSVG, grainDataURI } from '../../lib/drawings.js'

mountPlate(frameEl, project.plate, { label: project.name, index: project.index })
// or
frameEl.innerHTML = plateHTML({ kind: 'section', a: '#E9E3D8', b: '#D2C8B6', ink: '#27415A', accent: '#AE4E2A', seed: 12 })
```

`kind` ∈ `plan | section | elevation | axon | site | framing | detail | contour | grid`. Output is deterministic per `seed`. Project records in `src/data/projects.js` each carry a `plate` object — always use it so a project looks identical everywhere it appears.

---

## 7. Content

Never invent copy that contradicts the data layer. Import from:

- `src/data/site.js` — `brand, contact, nav, stats, credentials, recognitions, marqueeWords, cta`
- `src/data/services.js` — `services, serviceById, serviceLinks, packages`
- `src/data/projects.js` — `projects, featuredProjects, projectById, projectFilters`
- `src/data/content.js` — `manifesto, process, team, testimonials, journal, faq, capabilities`

Static markup in `.html` partials may hard-code copy that matches the data layer; anything list-shaped should be rendered from data in JS so it stays in sync.

The business: a residential architecture + engineering studio in Austin, Texas. Three services — **Architectural Packages** (detailed structural engineering drawings, cover sheets), **Civil Engineering** (comprehensive site plans for new builds and home additions), **3D Renderings** (in-house 3D visualisation). Tone: precise, confident, plain-spoken, never salesy. British-leaning spelling ("visualisation") is used consistently.

---

## 8. Responsive & accessibility

- Must work from **360px to 2560px**. Test 360 / 768 / 1024 / 1440 / 1920 mentally at minimum.
- Never let the page scroll horizontally. Horizontal-scroll sections must be inside their own `overflow: hidden` wrapper.
- Pinned/scrubbed sections: use `ScrollTrigger.matchMedia` semantics via `gsap.matchMedia()` and provide a simple stacked layout under 768px.
- Fluid type via the `--fs-*` tokens; avoid fixed `px` font sizes.
- One `<h1>` per page (the page hero owns it). Sections use `<h2>`.
- Interactive elements are real `<button>`/`<a>`, keyboard reachable, with visible `:focus-visible`.
- Decorative SVG/canvas gets `aria-hidden="true"`.
- Respect `ctx.reduced` everywhere.

---

## 9. Performance

- Animate `transform` / `opacity` / `clip-path` only. Never animate `top/left/width/height`.
- Pointer-driven motion uses `gsap.quickTo()` / `gsap.quickSetter()`, never `gsap.to()` per event.
- No `getBoundingClientRect()` inside a ticker/RAF unless cached and invalidated on resize.
- One `ScrollTrigger` per behaviour, not per element, where a stagger will do.
- `will-change` only on elements that actually animate, and drop it when idle.
- Prefer CSS transitions for simple hover states; GSAP for choreography.

---

## 10. Quality bar

This is an award-level portfolio site for a real business. Every section must:
- look intentional at rest, not just in motion;
- have real hierarchy — a label, a headline, supporting copy, and a clear next action;
- carry at least one considered micro-interaction;
- read correctly on a phone.

Ship complete work. No `TODO`, no placeholder `lorem`, no commented-out experiments.
