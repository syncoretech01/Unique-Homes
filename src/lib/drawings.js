/* ============================================================================
   PROCEDURAL ARCHITECTURAL DRAWINGS
   ----------------------------------------------------------------------------
   This site carries no photographs. Every image is a generated architectural
   drawing produced here: plans, sections, elevations, cutaway axonometrics,
   site plans, framing plans, construction details, contour surveys and
   setting-out grids.

   Everything is deterministic for a given seed (mulberry32), so a project
   renders the identical drawing on every page it appears on.

   Conventions honoured throughout:
     · line weight hierarchy — cut 3 : object 1.6 : hairline 0.7 (× strokeScale)
     · poché (solid fill) for anything the section plane passes through
     · uppercase tracked monospace annotation, small
     · terracotta accent used once or twice per drawing, never more
     · defs ids namespaced from the seed so plates never collide on a page
   ========================================================================== */

import { mulberry32, clamp, pad } from './utils.js'

/* ------------------------------------------------------------------ SETUP */

const SVG_NS = 'http://www.w3.org/2000/svg'

/* One tiny stylesheet per drawing. Scoped to .uhd-dwg so it can never leak.
   vector-effect is not an inherited property, so a descendant selector is the
   only way to keep every hairline crisp without repeating the attribute on a
   few hundred elements. */
const DWG_STYLE =
  '.uhd-dwg *{vector-effect:non-scaling-stroke}' +
  ".uhd-dwg text{font-family:'JetBrains Mono Variable','JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace}"

/* Sheet metadata per drawing type — feeds the title block. */
const SHEET = {
  plan: { no: 'A-1', title: 'GROUND FLOOR PLAN', scale: '1:50' },
  section: { no: 'A-2', title: 'SECTION AA', scale: '1:50' },
  elevation: { no: 'A-3', title: 'ELEVATION', scale: '1:100' },
  axon: { no: 'A-4', title: 'CUTAWAY AXONOMETRIC', scale: 'NTS' },
  site: { no: 'C-1', title: 'SITE PLAN', scale: '1:200' },
  framing: { no: 'S-2', title: 'FRAMING PLAN L01', scale: '1:100' },
  detail: { no: 'A-5', title: 'WALL SECTION DETAIL', scale: '1:5' },
  contour: { no: 'C-2', title: 'EXISTING CONTOURS', scale: '1:500' },
  grid: { no: 'A-0', title: 'SETTING OUT GRID', scale: '1:100' },
}

const KINDS = {
  plan: drawPlan,
  section: drawSection,
  elevation: drawElevation,
  axon: drawAxon,
  site: drawSite,
  framing: drawFraming,
  detail: drawDetail,
  contour: drawContour,
  grid: drawGrid,
}

export const drawingKinds = Object.keys(KINDS)

/* ------------------------------------------------------------- PRIMITIVES */

/** Compact number formatting — keeps generated markup small. */
function f(v) {
  if (!Number.isFinite(v)) return '0'
  const r = Math.round(v * 100) / 100
  return r === 0 ? '0' : String(r)
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function attrs(o) {
  let s = ''
  for (const k in o) {
    const v = o[k]
    if (v === null || v === undefined || v === false || v === '') continue
    s += ` ${k}="${typeof v === 'number' ? f(v) : esc(v)}"`
  }
  return s
}

function tag(name, o = {}, inner) {
  return inner === undefined || inner === null || inner === ''
    ? `<${name}${attrs(o)}/>`
    : `<${name}${attrs(o)}>${inner}</${name}>`
}

const line = (x1, y1, x2, y2, o) => tag('line', { x1, y1, x2, y2, ...o })
const rect = (x, y, w, h, o) => tag('rect', { x, y, width: w, height: h, ...o })
const circ = (cx, cy, r, o) => tag('circle', { cx, cy, r, ...o })
const ellip = (cx, cy, rx, ry, o) => tag('ellipse', { cx, cy, rx, ry, ...o })
const pathEl = (d, o) => tag('path', { d, ...o })
const group = (o, inner) => tag('g', o, inner)

const ptStr = (pts) => pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')
const polyEl = (pts, o) => tag('polygon', { points: ptStr(pts), ...o })
const plineEl = (pts, o) => tag('polyline', { points: ptStr(pts), ...o })

/** Annotation text. Uppercase, tracked, monospaced — house convention. */
function txt(x, y, s, o = {}) {
  const {
    size = 8.4,
    fill = '#000',
    op = 0.82,
    anchor,
    track = 0.13,
    rotate,
    baseline,
    weight,
    upper = true,
  } = o
  const body = esc(upper ? String(s).toUpperCase() : String(s))
  return tag(
    'text',
    {
      x,
      y,
      'font-size': size,
      'font-weight': weight,
      'letter-spacing': track * size,
      'text-anchor': anchor,
      'dominant-baseline': baseline,
      fill,
      'fill-opacity': op,
      transform: rotate ? `rotate(${f(rotate)} ${f(x)} ${f(y)})` : null,
    },
    body
  )
}

/** Rough advance width of a monospaced annotation, in user units. */
const textW = (s, size, track = 0.13) => String(s).length * size * (0.6 + track)

/** Whitelist for values interpolated into a style attribute. */
const cssSafe = (v) => String(v).replace(/[^a-zA-Z0-9#(),.%/\s_-]/g, '').slice(0, 64)

function withAlpha(hex, a) {
  const h = String(hex || '').trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const int = parseInt(full.slice(0, 6), 16)
  if (!Number.isFinite(int)) return `rgb(0 0 0 / ${a})`
  return `rgb(${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255} / ${a})`
}

/** Seeded random with the small vocabulary the generators need. */
function rngOf(seed) {
  const r = mulberry32(Math.abs(Math.round(Number(seed) || 1)) || 1)
  return {
    v: r,
    f: (a = 0, b = 1) => a + (b - a) * r(),
    i: (a, b) => Math.floor(a + (b - a + 1) * r()),
    pick: (arr) => arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))],
    bool: (p = 0.5) => r() < p,
    jitter: (v, amt) => v + (r() - 0.5) * 2 * amt,
  }
}

/** Stable namespace for <defs> ids, so two plates on a page never collide. */
function nsFor(parts) {
  let h = 0x811c9dc5
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return 'u' + (h >>> 0).toString(36)
}

/** Catmull-Rom through the points, emitted as cubic beziers. */
function smoothPath(pts, closed = false, tension = 0.5) {
  const n = pts.length
  if (n < 2) return ''
  const at = (i) => pts[closed ? (i + n * 2) % n : Math.min(n - 1, Math.max(0, i))]
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1x = p1[0] + ((p2[0] - p0[0]) * tension) / 3
    const c1y = p1[1] + ((p2[1] - p0[1]) * tension) / 3
    const c2x = p2[0] - ((p3[0] - p1[0]) * tension) / 3
    const c2y = p2[1] - ((p3[1] - p1[1]) * tension) / 3
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`
  }
  return closed ? d + 'Z' : d
}

function lineIntersect(p1, d1, p2, d2) {
  const den = d1[0] * d2[1] - d1[1] * d2[0]
  if (Math.abs(den) < 1e-6) return [p2[0], p2[1]]
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
  return [p1[0] + d1[0] * t, p1[1] + d1[1] * t]
}

/** Inward offset of a simple polygon by a per-edge distance. */
function offsetPolygon(pts, dists) {
  const n = pts.length
  let area = 0
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % n]
    area += p[0] * q[1] - q[0] * p[1]
  }
  const s = area > 0 ? 1 : -1
  const edges = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % n]
    let dx = q[0] - p[0]
    let dy = q[1] - p[1]
    const L = Math.hypot(dx, dy) || 1
    dx /= L
    dy /= L
    const d = Array.isArray(dists) ? dists[i % dists.length] : dists
    edges.push({ p: [p[0] - dy * s * d, p[1] + dx * s * d], d: [dx, dy] })
  }
  const out = []
  for (let i = 0; i < n; i++) {
    const a = edges[(i - 1 + n) % n]
    const b = edges[i]
    out.push(lineIntersect(a.p, a.d, b.p, b.d))
  }
  return out
}

/* -------------------------------------------------------------- HATCHING */

function patHatch(id, { angle = 45, gap = 6, sw = 0.6, color = '#000', op = 0.35 }) {
  return tag(
    'pattern',
    { id, width: gap, height: gap, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${f(angle)})` },
    line(0, -1, 0, gap + 1, { stroke: color, 'stroke-width': sw, 'stroke-opacity': op })
  )
}

function patCross(id, { gap = 8, sw = 0.55, color = '#000', op = 0.3, angle = 45 }) {
  return tag(
    'pattern',
    { id, width: gap, height: gap, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${f(angle)})` },
    line(0, -1, 0, gap + 1, { stroke: color, 'stroke-width': sw, 'stroke-opacity': op }) +
      line(-1, 0, gap + 1, 0, { stroke: color, 'stroke-width': sw, 'stroke-opacity': op })
  )
}

/** Concrete / hardcore: scattered dots and short dashes. */
function patAggregate(id, { gap = 13, color = '#000', op = 0.4, sw = 0.6 }) {
  const dot = (x, y, r) => circ(x, y, r, { fill: color, 'fill-opacity': op })
  return tag(
    'pattern',
    { id, width: gap, height: gap, patternUnits: 'userSpaceOnUse' },
    dot(gap * 0.22, gap * 0.28, 0.85) +
      dot(gap * 0.74, gap * 0.62, 0.6) +
      dot(gap * 0.46, gap * 0.86, 0.75) +
      line(gap * 0.6, gap * 0.16, gap * 0.86, gap * 0.24, {
        stroke: color,
        'stroke-width': sw,
        'stroke-opacity': op * 0.8,
      })
  )
}

/** Timber grain, used for cut studs and boards. */
function patGrain(id, { gap = 5, color = '#000', op = 0.22, sw = 0.5 }) {
  return tag(
    'pattern',
    { id, width: gap * 4, height: gap, patternUnits: 'userSpaceOnUse' },
    line(0, gap * 0.5, gap * 4, gap * 0.5, { stroke: color, 'stroke-width': sw, 'stroke-opacity': op })
  )
}

/* ------------------------------------------------------------- ANNOTATION */

/**
 * Dimension string: dim line, extension lines, 45° architectural ticks and
 * the value between each pair of stations.
 */
function dimChain(d, opts) {
  const { axis = 'x', stations, at, from, unitsPerPx, size = 7, accentIndex = -1, round: rnd = 5 } = opts
  const p = d.pen
  const ink = d.ink
  const st = stations.slice().sort((a, b) => a - b)
  if (st.length < 2) return ''
  const dir = Math.sign(at - from) || 1
  const tickLen = 3.4
  let out = ''

  const P = (along, off) => (axis === 'x' ? [along, at + off] : [at + off, along])

  // extension lines
  for (const s of st) {
    const a = P(s, dir * -Math.abs(at - from) + dir * 3)
    const b = P(s, dir * 4)
    out += line(a[0], a[1], b[0], b[1], p.hair({ 'stroke-opacity': 0.34 }))
  }
  // dimension line
  const l0 = P(st[0], 0)
  const l1 = P(st[st.length - 1], 0)
  out += line(l0[0], l0[1], l1[0], l1[1], p.thin({ 'stroke-opacity': 0.55 }))
  // ticks
  for (const s of st) {
    const a = P(s, -tickLen)
    const b = P(s, tickLen)
    const av = axis === 'x' ? [a[0] - tickLen, a[1]] : [a[0], a[1] - tickLen]
    const bv = axis === 'x' ? [b[0] + tickLen, b[1]] : [b[0], b[1] + tickLen]
    out += line(av[0], av[1], bv[0], bv[1], p.thin({ 'stroke-opacity': 0.75 }))
  }
  // values
  for (let i = 0; i < st.length - 1; i++) {
    const span = st[i + 1] - st[i]
    const mid = (st[i] + st[i + 1]) / 2
    const mm = Math.max(rnd, Math.round((span * unitsPerPx) / rnd) * rnd)
    const label = String(mm)
    const fits = textW(label, size) < span - 6
    const off = fits ? -4.2 : -4.2 - size * 1.45
    const isAcc = i === accentIndex
    const col = isAcc ? d.accent : ink
    if (axis === 'x') {
      out += txt(mid, at + off, label, { size, fill: col, op: isAcc ? 0.95 : 0.66, anchor: 'middle' })
    } else {
      out += txt(at + off, mid, label, {
        size,
        fill: col,
        op: isAcc ? 0.95 : 0.66,
        anchor: 'middle',
        rotate: -90,
      })
    }
    if (!fits) {
      const a = P(mid, -3.6)
      const b = P(mid, off + size * 0.4)
      out += line(a[0], a[1], b[0], b[1], p.hair({ 'stroke-opacity': 0.3 }))
    }
  }
  return out
}

/**
 * Leader: dot on the subject, elbow, horizontal shoulder, note text.
 * `align` forces which way the note reads from the anchor ('start' | 'end');
 * 'auto' runs it away from the subject.
 */
function leader(d, x, y, tx, ty, note, o = {}) {
  const { accent: useAccent = false, size = 7.2, dot = 1.9, shoulder = 10, op = 0.7, align = 'auto' } = o
  const p = d.pen
  const col = useAccent ? d.accent : d.ink
  const subjectRight = tx < x
  const sx = subjectRight ? tx + shoulder : tx - shoulder
  const side = align === 'auto' ? (subjectRight ? 'end' : 'start') : align
  const pen = useAccent ? p.acc({ 'stroke-width': 0.9 * d.sw, 'stroke-opacity': 0.9 }) : p.hair({ 'stroke-opacity': 0.5 })
  return (
    plineEl([[x, y], [sx, ty], [tx, ty]], pen) +
    circ(x, y, dot, { fill: col, 'fill-opacity': useAccent ? 0.95 : 0.7 }) +
    txt(tx + (side === 'end' ? -3 : 3), ty - 2.6, note, {
      size,
      fill: col,
      op: useAccent ? 0.95 : op,
      anchor: side === 'end' ? 'end' : 'start',
    })
  )
}

/** North point — slim navigator diamond, half solid, ring and N. */
function northArrow(d, cx, cy, r, useAccent = true) {
  const p = d.pen
  const col = useAccent ? d.accent : d.ink
  const tip = [cx, cy - r]
  const tail = [cx, cy + r * 0.86]
  const wing = r * 0.30
  return (
    circ(cx, cy, r * 1.24, p.hair({ 'stroke-opacity': 0.35 })) +
    polyEl([tip, [cx - wing, cy + r * 0.22], tail], { fill: col, 'fill-opacity': 0.9 }) +
    polyEl([tip, [cx + wing, cy + r * 0.22], tail], {
      fill: 'none',
      stroke: col,
      'stroke-width': 0.8 * d.sw,
      'stroke-opacity': 0.85,
    }) +
    txt(cx, cy - r * 1.62, 'N', { size: r * 0.62, fill: col, op: 0.9, anchor: 'middle', track: 0 })
  )
}

/** Graphic scale bar with alternating cells and end values. */
function scaleBar(d, x, y, w, unitLabel = 'M', divisions = 4, total = 10) {
  const p = d.pen
  const h = Math.max(3.6, w * 0.026)
  const cw = w / divisions
  let out = rect(x, y, w, h, p.thin({ 'stroke-opacity': 0.7 }))
  for (let i = 0; i < divisions; i += 2) {
    out += rect(x + i * cw, y, cw, h, { fill: d.ink, 'fill-opacity': 0.72 })
  }
  for (let i = 0; i <= divisions; i++) {
    const v = Math.round((total / divisions) * i)
    out += txt(x + i * cw, y + h + 8.4, String(v), {
      size: 6.4,
      fill: d.ink,
      op: 0.55,
      anchor: 'middle',
    })
  }
  out += txt(x + w + 6, y + h + 8.4, unitLabel, { size: 6.4, fill: d.ink, op: 0.55 })
  return out
}

/** Zig-zag break line across a run. */
function breakLine(d, x1, y1, x2, y2, amp) {
  const dx = x2 - x1
  const dy = y2 - y1
  const L = Math.hypot(dx, dy) || 1
  const ux = dx / L
  const uy = dy / L
  const nx = -uy
  const ny = ux
  const a = 0.42
  const b = 0.5
  const c = 0.58
  const pt = (t, o) => [x1 + dx * t + nx * o, y1 + dy * t + ny * o]
  return plineEl([[x1, y1], pt(a, 0), pt(b, -amp), pt(c, amp), [x2, y2]], d.pen.thin({ 'stroke-opacity': 0.6 }))
}

/** Scale figure — a properly proportioned standing person. */
function figure(d, x, groundY, h) {
  const col = d.ink
  const op = 0.4
  const pen = {
    fill: 'none',
    stroke: col,
    'stroke-opacity': op,
    'stroke-width': h * 0.072,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }
  const headR = h * 0.058
  const headY = groundY - h + headR
  const neckY = headY + headR * 1.9
  const hipY = groundY - h * 0.47
  return (
    circ(x, headY, headR, { fill: col, 'fill-opacity': op }) +
    plineEl([[x, neckY], [x, hipY]], pen) +
    plineEl([[x, hipY], [x - h * 0.022, groundY - h * 0.24], [x - h * 0.052, groundY]], pen) +
    plineEl([[x, hipY], [x + h * 0.036, groundY - h * 0.24], [x + h * 0.05, groundY]], pen) +
    plineEl([[x, neckY + h * 0.03], [x - h * 0.072, groundY - h * 0.60], [x - h * 0.058, groundY - h * 0.40]], pen) +
    plineEl([[x, neckY + h * 0.03], [x + h * 0.068, groundY - h * 0.58], [x + h * 0.082, groundY - h * 0.42]], pen)
  )
}

/** Elevation tree — blobby canopy outline, trunk and a few limbs. */
function treeElevation(d, x, groundY, h, rand) {
  const p = d.pen
  const canopyR = h * 0.36
  const cy = groundY - h + canopyR * 0.94
  const lobes = 13
  const pts = []
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2
    const r = canopyR * (0.82 + 0.3 * Math.sin(a * 3 + rand.f(0, 6)) * 0.5 + rand.f(-0.07, 0.07))
    pts.push([x + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 0.92])
  }
  let out = pathEl(smoothPath(pts, true, 0.62), p.thin({ 'stroke-opacity': 0.5 }))
  for (let i = 0; i < 3; i++) {
    const a = rand.f(0.6, 2.6)
    const rr = canopyR * rand.f(0.28, 0.46)
    out += pathEl(
      `M${f(x + Math.cos(a) * rr - rr)} ${f(cy + Math.sin(a) * rr)}A${f(rr)} ${f(rr * 0.8)} 0 0 1 ${f(
        x + Math.cos(a) * rr + rr
      )} ${f(cy + Math.sin(a) * rr)}`,
      p.hair({ 'stroke-opacity': 0.3 })
    )
  }
  const tw = h * 0.028
  out += polyEl(
    [
      [x - tw, groundY],
      [x - tw * 0.55, cy + canopyR * 0.35],
      [x + tw * 0.55, cy + canopyR * 0.35],
      [x + tw, groundY],
    ],
    p.thin({ 'stroke-opacity': 0.55 })
  )
  out += plineEl([[x, cy + canopyR * 0.5], [x - h * 0.10, cy + canopyR * 0.12]], p.hair({ 'stroke-opacity': 0.4 }))
  out += plineEl([[x, cy + canopyR * 0.62], [x + h * 0.11, cy + canopyR * 0.2]], p.hair({ 'stroke-opacity': 0.4 }))
  return out
}

/** Plan tree — scalloped canopy, centre cross, optional dashed drip line. */
function treePlan(d, cx, cy, r, scallops = 11, drip = false) {
  const p = d.pen
  let dstr = ''
  for (let i = 0; i <= scallops; i++) {
    const a = (i / scallops) * Math.PI * 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) dstr += `M${f(x)} ${f(y)}`
    else dstr += `A${f(r * 0.58)} ${f(r * 0.58)} 0 0 1 ${f(x)} ${f(y)}`
  }
  let out = pathEl(dstr + 'Z', p.thin({ 'stroke-opacity': 0.55 }))
  out += line(cx - r * 0.3, cy, cx + r * 0.3, cy, p.hair({ 'stroke-opacity': 0.6 }))
  out += line(cx, cy - r * 0.3, cx, cy + r * 0.3, p.hair({ 'stroke-opacity': 0.6 }))
  if (drip) out += circ(cx, cy, r * 1.34, p.hair({ 'stroke-opacity': 0.26, 'stroke-dasharray': '3 3' }))
  return out
}

/* ------------------------------------------------------------ TITLE BLOCK */

function titleBlock(d) {
  const { W, H, ink, sw, meta } = d
  const p = d.pen
  const bw = Math.min(W * 0.40, 400)
  const bh = Math.max(Math.min(H * 0.082, 58), 40)
  const bx = W * 0.90 - bw
  const by = H * 0.90 - bh
  const c1 = bx + bw * 0.555
  const c2 = bx + bw * 0.79
  const mid = by + bh * 0.53

  const trunc = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s))

  return group(
    { 'data-title-block': '' },
    rect(bx, by, bw, bh, { fill: '#ffffff', 'fill-opacity': 0.42 }) +
      rect(bx, by, bw, bh, p.thin({ 'stroke-opacity': 0.55 })) +
      line(c1, by, c1, by + bh, p.hair({ 'stroke-opacity': 0.4 })) +
      line(c2, by, c2, by + bh, p.hair({ 'stroke-opacity': 0.4 })) +
      line(bx, mid, bx + bw, mid, p.hair({ 'stroke-opacity': 0.3 })) +
      txt(bx + 9, mid - bh * 0.16, trunc(meta.label || 'UNIQUE HOMES AND DESIGN', 26), {
        size: Math.min(9.2, bh * 0.2),
        fill: ink,
        op: 0.86,
      }) +
      txt(bx + 9, by + bh * 0.85, trunc(meta.title, 26), {
        size: Math.min(7.2, bh * 0.16),
        fill: ink,
        op: 0.48,
      }) +
      txt(c1 + 9, mid - bh * 0.16, meta.sheet, { size: Math.min(8.6, bh * 0.19), fill: ink, op: 0.8 }) +
      txt(c1 + 9, by + bh * 0.85, `SCALE ${meta.scale}`, {
        size: Math.min(6.8, bh * 0.15),
        fill: ink,
        op: 0.46,
      }) +
      txt((c2 + bx + bw) / 2, mid - bh * 0.16, 'UHD', {
        size: Math.min(9.4, bh * 0.21),
        fill: ink,
        op: 0.8,
        anchor: 'middle',
        track: 0.2,
      }) +
      txt((c2 + bx + bw) / 2, by + bh * 0.85, meta.index || meta.rev, {
        size: Math.min(6.8, bh * 0.15),
        fill: ink,
        op: 0.46,
        anchor: 'middle',
      }) +
      line(bx, by + bh, bx + bw, by + bh, {
        stroke: ink,
        'stroke-width': 1.6 * sw,
        'stroke-opacity': 0.5,
      })
  )
}

/** Sheet edge + registration crosses. Bleeds off a cropped plate by design. */
function sheetFrame(d) {
  const { W, H } = d
  const p = d.pen
  const m = Math.min(W, H) * 0.048
  const cross = (x, y, r) =>
    line(x - r, y, x + r, y, p.hair({ 'stroke-opacity': 0.4 })) +
    line(x, y - r, x, y + r, p.hair({ 'stroke-opacity': 0.4 }))
  const r = Math.min(W, H) * 0.016
  return (
    rect(m, m, W - 2 * m, H - 2 * m, p.hair({ 'stroke-opacity': 0.24 })) +
    cross(m, m, r) +
    cross(W - m, m, r) +
    cross(m, H - m, r) +
    cross(W - m, H - m, r)
  )
}

/* ------------------------------------------------------------ WALL SYSTEM */

/**
 * A straight run of wall drawn as poché segments, punched by openings.
 * dir 'h' runs along x at centreline y = c; dir 'v' runs along y at x = c.
 * Openings: { at, w, type: 'window'|'door'|'open'|'slider', side, hinge }
 */
function wallRun(d, dir, a, b, c, t, openings = []) {
  const { ink, sw } = d
  const poche = { fill: ink, 'fill-opacity': 0.86, stroke: ink, 'stroke-width': 0.4 * sw, 'stroke-opacity': 0.9 }
  const list = openings.slice().sort((m, n) => m.at - n.at)
  const seg = (s, e) => {
    if (e - s <= 0.5) return ''
    return dir === 'h' ? rect(s, c - t / 2, e - s, t, poche) : rect(c - t / 2, s, t, e - s, poche)
  }
  let out = ''
  let cursor = a
  for (const op of list) {
    const s = Math.max(a, op.at - op.w / 2)
    const e = Math.min(b, op.at + op.w / 2)
    out += seg(cursor, s)
    out += openingSymbol(d, dir, s, e, c, t, op)
    cursor = e
  }
  out += seg(cursor, b)
  return out
}

function openingSymbol(d, dir, s, e, c, t, op) {
  const p = d.pen
  const P = (along, off) => (dir === 'h' ? [along, c + off] : [c + off, along])
  const seg = (a1, o1, a2, o2, pen) => {
    const A1 = P(a1, o1)
    const A2 = P(a2, o2)
    return line(A1[0], A1[1], A2[0], A2[1], pen)
  }
  const width = e - s
  const jamb = (x) => seg(x, -t / 2, x, t / 2, p.obj({ 'stroke-opacity': 0.75 }))
  const type = op.type || 'window'

  if (type === 'window') {
    return (
      jamb(s) +
      jamb(e) +
      seg(s, -t / 2, e, -t / 2, p.obj({ 'stroke-opacity': 0.7 })) +
      seg(s, t / 2, e, t / 2, p.obj({ 'stroke-opacity': 0.7 })) +
      seg(s, 0, e, 0, p.thin({ 'stroke-opacity': 0.55 }))
    )
  }
  if (type === 'slider') {
    const ov = width * 0.08
    return (
      jamb(s) +
      jamb(e) +
      seg(s, -t / 2, e, -t / 2, p.hair({ 'stroke-opacity': 0.4 })) +
      seg(s, t / 2, e, t / 2, p.hair({ 'stroke-opacity': 0.4 })) +
      seg(s, -t * 0.2, s + width * 0.5 + ov, -t * 0.2, p.obj({ 'stroke-opacity': 0.75 })) +
      seg(e - width * 0.5 - ov, t * 0.2, e, t * 0.2, p.obj({ 'stroke-opacity': 0.75 }))
    )
  }
  if (type === 'open') {
    return jamb(s) + jamb(e) + seg(s, 0, e, 0, p.hair({ 'stroke-opacity': 0.3, 'stroke-dasharray': '5 4' }))
  }
  // door with swing
  const side = op.side || 1
  const hingeAt = op.hinge === -1 ? e : s
  const otherAt = op.hinge === -1 ? s : e
  const tip = P(hingeAt, side * width)
  const hinge = P(hingeAt, 0)
  const other = P(otherAt, 0)
  const ax = tip[0] - hinge[0]
  const ay = tip[1] - hinge[1]
  const bx = other[0] - hinge[0]
  const by = other[1] - hinge[1]
  const sweep = ax * by - ay * bx > 0 ? 1 : 0
  return (
    jamb(s) +
    jamb(e) +
    line(hinge[0], hinge[1], tip[0], tip[1], {
      fill: 'none',
      stroke: d.ink,
      'stroke-width': 1.9 * d.sw,
      'stroke-opacity': 0.8,
    }) +
    pathEl(
      `M${f(tip[0])} ${f(tip[1])}A${f(width)} ${f(width)} 0 0 ${sweep} ${f(other[0])} ${f(other[1])}`,
      p.hair({ 'stroke-opacity': 0.45 })
    )
  )
}

/** Straight stair flight with tread lines, walking line, arrow and break. */
function stairRun(d, x0, y0, x1, y1, treads) {
  const p = d.pen
  const w = x1 - x0
  const step = w / treads
  const my = (y0 + y1) / 2
  let out = rect(x0, y0, w, y1 - y0, p.thin({ 'stroke-opacity': 0.5 }))
  const cut = Math.round(treads * 0.62)
  for (let i = 1; i < treads; i++) {
    const x = x0 + step * i
    const pen = i > cut ? p.hair({ 'stroke-opacity': 0.24 }) : p.thin({ 'stroke-opacity': 0.55 })
    out += line(x, y0, x, y1, pen)
  }
  // section break across the flight
  const bx = x0 + step * cut
  out += plineEl(
    [
      [bx - step * 0.7, y1],
      [bx + step * 0.5, my],
      [bx - step * 0.5, my],
      [bx + step * 0.7, y0],
    ],
    p.thin({ 'stroke-opacity': 0.55 })
  )
  // walking line, up-arrow at the far end
  out += line(x0 + step * 0.4, my, x1 - step * 0.5, my, p.hair({ 'stroke-opacity': 0.55 }))
  out += circ(x0 + step * 0.4, my, 1.7, { fill: d.ink, 'fill-opacity': 0.55 })
  const ah = Math.min(step * 0.9, (y1 - y0) * 0.3)
  out += polyEl(
    [
      [x1 - step * 0.2, my],
      [x1 - step * 0.2 - ah, my - ah * 0.5],
      [x1 - step * 0.2 - ah, my + ah * 0.5],
    ],
    { fill: d.ink, 'fill-opacity': 0.6 }
  )
  out += txt(x0 - 5, my + 2.4, 'UP ' + treads + 'R', { size: 6.4, fill: d.ink, op: 0.55, anchor: 'end' })
  return out
}

/* -------------------------------------------------------- ISO PROJECTION */

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = 0.5

/** True 30° isometric: x right/down, y left/down, z up. */
function iso(x, y, z, o) {
  return [o.cx + (x - y) * COS30 * o.s, o.cy + ((x + y) * SIN30 - z) * o.s]
}

function isoPoly(pts3, o, attr) {
  return polyEl(pts3.map((p) => iso(p[0], p[1], p[2], o)), attr)
}

function isoLine(a, b, o, attr) {
  const A = iso(a[0], a[1], a[2], o)
  const B = iso(b[0], b[1], b[2], o)
  return line(A[0], A[1], B[0], B[1], attr)
}

/**
 * Axonometric box. Returns the three visible faces (top, left = max-y face,
 * right = max-x face) painted back to front, with tone by orientation.
 */
function isoBox(d, o, x, y, z, sx, sy, sz, tone = {}) {
  const { top = 0.05, left = 0.13, right = 0.2, edge = 0.55 } = tone
  const ink = d.ink
  const face = (op) => ({
    fill: ink,
    'fill-opacity': op,
    stroke: ink,
    'stroke-width': 0.9 * d.sw,
    'stroke-opacity': edge,
    'stroke-linejoin': 'round',
  })
  const X = x + sx
  const Y = y + sy
  const Z = z + sz
  return (
    isoPoly([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]], o, face(left)) +
    isoPoly([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]], o, face(right)) +
    isoPoly([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]], o, face(top))
  )
}

/* ==========================================================================
   1 — FLOOR PLAN
   ========================================================================== */

function drawPlan(d) {
  const { box, ann, rand, ink } = d
  const p = d.pen
  let out = sheetFrame(d)

  // dim line offsets measured off the annotation-safe edge
  const dimOuterX = ann.x0 + 16
  const dimInnerX = ann.x0 + 36
  const dimOuterY = ann.y0 + 15
  const dimInnerY = ann.y0 + 36

  const px0 = ann.x0 + 58
  const py0 = ann.y0 + 58
  const px1 = ann.x1 - 10
  const py1 = ann.y1 - ann.h * 0.155
  const PW = px1 - px0
  const PH = py1 - py0
  const gut = Math.min(PW, PH) * 0.12

  const te = Math.min(PW, PH) * 0.024 // exterior wall
  const ti = te * 0.62 // partition

  const vx1 = px0 + PW * rand.jitter(0.315, 0.022)
  const vx2 = px0 + PW * rand.jitter(0.615, 0.022)
  const hy1 = py0 + PH * rand.jitter(0.445, 0.025)
  const hy2 = hy1 + PH * rand.jitter(0.165, 0.012)
  const vxa = px0 + PW * rand.jitter(0.245, 0.018)
  const vxb = px0 + PW * rand.jitter(0.435, 0.018)

  // 1 metre in px, and mm per px for the dimension strings
  const mmPerPx = 12000 / PH
  const mPx = 1000 / mmPerPx

  /* ----- setting-out grid under the plan ----- */
  const gridPen = p.hair({ 'stroke-opacity': 0.14, 'stroke-dasharray': '14 5 2 5' })
  for (const x of [vx1, vx2]) out += line(x, py0 - gut * 0.5, x, py1 + gut * 0.35, gridPen)
  for (const y of [hy1, hy2]) out += line(px0 - gut * 0.5, y, px1 + gut * 0.35, y, gridPen)

  /* ----- exterior envelope ----- */
  const topOpenings = [
    { at: px0 + PW * 0.10, w: PW * 0.105, type: 'window' },
    { at: px0 + PW * 0.235, w: PW * 0.105, type: 'window' },
    { at: (vx1 + vx2) / 2, w: PW * 0.135, type: 'window' },
    { at: vx2 + (px1 - vx2) * 0.42, w: PW * 0.082, type: 'window' },
  ]
  const botOpenings = [
    { at: (px0 + vxa) / 2, w: PW * 0.092, type: 'window' },
    { at: (vxa + vxb) / 2, w: PW * 0.045, type: 'window' },
    { at: (vxb + vx2) / 2, w: PW * 0.078, type: 'window' },
    { at: vx2 + (px1 - vx2) * 0.5, w: PW * 0.105, type: 'window' },
  ]
  const leftOpenings = [{ at: (hy1 + hy2) / 2, w: PH * 0.105, type: 'door', side: 1, hinge: 1 }]
  const rightOpenings = [
    { at: py0 + (hy1 - py0) * 0.55, w: PH * 0.2, type: 'slider' },
    { at: hy2 + (py1 - hy2) * 0.5, w: PH * 0.12, type: 'window' },
  ]

  out += wallRun(d, 'h', px0, px1, py0, te, topOpenings)
  out += wallRun(d, 'h', px0, px1, py1, te, botOpenings)
  out += wallRun(d, 'v', py0, py1, px0, te, leftOpenings)
  out += wallRun(d, 'v', py0, py1, px1, te, rightOpenings)

  /* ----- internal partitions ----- */
  out += wallRun(d, 'h', px0, vx2, hy1, ti, [
    { at: px0 + (vx1 - px0) * 0.62, w: PW * 0.10, type: 'open' },
    { at: vx1 + (vx2 - vx1) * 0.45, w: PW * 0.055, type: 'door', side: -1, hinge: 1 },
  ])
  out += wallRun(d, 'h', px0, vx2, hy2, ti, [
    { at: (px0 + vxa) / 2, w: PW * 0.055, type: 'door', side: 1, hinge: 1 },
    { at: (vxa + vxb) / 2, w: PW * 0.05, type: 'door', side: 1, hinge: -1 },
    { at: (vxb + vx2) / 2, w: PW * 0.055, type: 'door', side: 1, hinge: 1 },
  ])
  out += wallRun(d, 'v', py0, hy1, vx1, ti, [{ at: py0 + (hy1 - py0) * 0.55, w: PH * 0.16, type: 'open' }])
  out += wallRun(d, 'v', py0, py1, vx2, ti, [
    { at: py0 + (hy1 - py0) * 0.6, w: PH * 0.14, type: 'open' },
    { at: hy1 + PH * 0.075, w: PH * 0.06, type: 'door', side: 1, hinge: 1 },
  ])
  out += wallRun(d, 'v', hy2, py1, vxa, ti, [])
  out += wallRun(d, 'v', hy2, py1, vxb, ti, [])

  /* ----- stair in the circulation spine ----- */
  const stX1 = vx2 - te
  const stX0 = stX1 - PW * 0.235
  out += stairRun(d, stX0, hy1 + ti / 2, stX1, hy2 - ti / 2, 13)

  /* ----- kitchen ----- */
  const kx0 = vx2 + ti / 2
  const kx1 = px1 - te / 2
  const ky0 = py0 + te / 2
  const ky1 = hy1 - ti / 2
  const cd = PH * 0.062
  out += rect(kx0, ky0, kx1 - kx0, cd, p.thin({ 'stroke-opacity': 0.6 }))
  out += rect(kx1 - cd, ky0, cd, (ky1 - ky0) * 0.62, p.thin({ 'stroke-opacity': 0.6 }))
  const sinkX = kx0 + (kx1 - kx0) * 0.32
  out += rect(sinkX - mPx * 0.28, ky0 + cd * 0.2, mPx * 0.56, cd * 0.6, p.thin({ 'stroke-opacity': 0.6 }))
  out += circ(sinkX, ky0 + cd * 0.5, cd * 0.13, p.hair({ 'stroke-opacity': 0.5 }))
  const hobX = kx0 + (kx1 - kx0) * 0.66
  out += rect(hobX - mPx * 0.3, ky0 + cd * 0.18, mPx * 0.6, cd * 0.64, p.thin({ 'stroke-opacity': 0.6 }))
  for (let i = 0; i < 4; i++) {
    out += circ(
      hobX - mPx * 0.15 + (i % 2) * mPx * 0.3,
      ky0 + cd * (i < 2 ? 0.36 : 0.64),
      cd * 0.1,
      p.hair({ 'stroke-opacity': 0.5 })
    )
  }
  const isW = (kx1 - kx0) * 0.56
  out += rect((kx0 + kx1) / 2 - isW / 2, ky0 + (ky1 - ky0) * 0.52, isW, cd * 0.92, p.thin({ 'stroke-opacity': 0.6 }))

  /* ----- bathroom fixtures ----- */
  const bx0 = vxa + ti / 2
  const bx1 = vxb - ti / 2
  const by0 = hy2 + ti / 2
  const by1 = py1 - te / 2
  // tiled floor, set out from the door wall — density drives the module
  const tile = d.gap(mPx * 0.6)
  for (let tx = bx0 + tile; tx < bx1 - 0.5; tx += tile) {
    out += line(tx, by0, tx, by1, p.hair({ 'stroke-opacity': 0.16 }))
  }
  for (let ty = by0 + tile; ty < by1 - 0.5; ty += tile) {
    out += line(bx0, ty, bx1, ty, p.hair({ 'stroke-opacity': 0.16 }))
  }

  const tubW = bx1 - bx0 - 4
  out += rect(bx0 + 2, by1 - mPx * 0.78, tubW, mPx * 0.72, p.thin({ 'stroke-opacity': 0.62 }))
  out += rect(bx0 + 5, by1 - mPx * 0.72, tubW - 6, mPx * 0.6, p.hair({ 'stroke-opacity': 0.42, rx: 2 }))
  out += circ(bx0 + 2 + tubW * 0.16, by1 - mPx * 0.42, 1.6, p.hair({ 'stroke-opacity': 0.5 }))
  out += rect(bx0 + 2, by0 + 2, mPx * 0.42, mPx * 0.66, p.thin({ 'stroke-opacity': 0.62 }))
  out += ellip(bx0 + 2 + mPx * 0.21, by0 + 2 + mPx * 0.42, mPx * 0.16, mPx * 0.2, p.hair({ 'stroke-opacity': 0.5 }))
  out += rect(bx1 - mPx * 0.62, by0 + 2, mPx * 0.6, mPx * 0.4, p.thin({ 'stroke-opacity': 0.62 }))
  out += ellip(bx1 - mPx * 0.32, by0 + 2 + mPx * 0.2, mPx * 0.22, mPx * 0.13, p.hair({ 'stroke-opacity': 0.5 }))

  /* ----- beds and joinery ----- */
  const bed = (cx, cy, w, h, rot) => {
    const g = []
    g.push(rect(cx - w / 2, cy - h / 2, w, h, p.thin({ 'stroke-opacity': 0.6 })))
    g.push(rect(cx - w / 2 + w * 0.06, cy - h / 2 + h * 0.06, w * 0.4, h * 0.18, p.hair({ 'stroke-opacity': 0.45 })))
    g.push(rect(cx + w * 0.04, cy - h / 2 + h * 0.06, w * 0.4, h * 0.18, p.hair({ 'stroke-opacity': 0.45 })))
    return group({ transform: rot ? `rotate(${f(rot)} ${f(cx)} ${f(cy)})` : null }, g.join(''))
  }
  out += bed((px0 + vxa) / 2, by1 - mPx * 1.1, mPx * 1.6, mPx * 2.05, 0)
  const b1x0 = vx2 + ti / 2
  out += bed(b1x0 + (px1 - b1x0) * 0.42, hy1 + (py1 - hy1) * 0.42, mPx * 1.6, mPx * 2.05, 0)
  const wardrobe = (x, y, w, h) =>
    rect(x, y, w, h, p.thin({ 'stroke-opacity': 0.55 })) +
    line(x, y, x + w, y + h, p.hair({ 'stroke-opacity': 0.3 })) +
    line(x, y + h, x + w, y, p.hair({ 'stroke-opacity': 0.3 }))
  out += wardrobe(px0 + te / 2, by1 - mPx * 0.65, mPx * 1.5, mPx * 0.6)
  out += wardrobe(px1 - te / 2 - mPx * 0.6, py1 - te / 2 - mPx * 1.9, mPx * 0.6, mPx * 1.8)
  out += rect(vxb + ti / 2 + 3, by0 + 3, mPx * 1.5, mPx * 0.62, p.thin({ 'stroke-opacity': 0.55 }))

  /* ----- hearth (poché against the living-room wall) ----- */
  const hy = py0 + (hy1 - py0) * 0.62
  out += rect(px0 + te / 2, hy - mPx * 0.7, mPx * 0.55, mPx * 1.4, {
    fill: ink,
    'fill-opacity': 0.86,
    stroke: ink,
    'stroke-width': 0.4 * d.sw,
    'stroke-opacity': 0.9,
  })
  out += rect(px0 + te / 2 + mPx * 0.55, hy - mPx * 0.42, mPx * 0.2, mPx * 0.84, p.thin({ 'stroke-opacity': 0.5 }))

  /* ----- room labels ----- */
  const area = (w, h) => ((w * mmPerPx) / 1000) * ((h * mmPerPx) / 1000)
  const roomLabel = (cx, cy, name, w, h) =>
    txt(cx, cy, name, { size: 8.6, fill: ink, op: 0.78, anchor: 'middle', track: 0.18 }) +
    txt(cx, cy + 10.5, area(w, h).toFixed(1) + ' M2', {
      size: 6.4,
      fill: ink,
      op: 0.42,
      anchor: 'middle',
      track: 0.1,
    })

  out += roomLabel((px0 + vx1) / 2, py0 + (hy1 - py0) * 0.36, 'Living', vx1 - px0, hy1 - py0)
  out += roomLabel((vx1 + vx2) / 2, py0 + (hy1 - py0) * 0.32, 'Dining', vx2 - vx1, hy1 - py0)
  out += roomLabel((vx2 + px1) / 2, py0 + (hy1 - py0) * 0.86, 'Kitchen', px1 - vx2, (hy1 - py0) * 0.6)
  out += txt(px0 + (stX0 - px0) * 0.42, (hy1 + hy2) / 2 + 3, 'Hall', {
    size: 7.6,
    fill: ink,
    op: 0.6,
    anchor: 'middle',
    track: 0.18,
  })
  out += roomLabel((px0 + vxa) / 2, hy2 + (py1 - hy2) * 0.3, 'Bed 02', vxa - px0, py1 - hy2)
  out += txt((vxa + vxb) / 2, hy2 + (py1 - hy2) * 0.55, 'Bath', {
    size: 7.4,
    fill: ink,
    op: 0.62,
    anchor: 'middle',
    track: 0.18,
  })
  out += roomLabel((vxb + vx2) / 2, hy2 + (py1 - hy2) * 0.72, 'Study', vx2 - vxb, py1 - hy2)
  out += roomLabel(b1x0 + (px1 - b1x0) * 0.5, hy1 + (py1 - hy1) * 0.82, 'Bed 01', px1 - vx2, py1 - hy1)

  /* ----- section cut marker A-A ----- */
  const cutY = py0 + (hy1 - py0) * 0.78
  const cutL = px0 - 26
  const cutR = px1 + 10
  const cutPen = p.obj({ 'stroke-opacity': 0.55, 'stroke-dasharray': '20 5 3 5' })
  out += line(cutL, cutY, cutR, cutY, cutPen)
  const bub = (cx) =>
    circ(cx, cutY, 8.2, { fill: '#ffffff', 'fill-opacity': 0.5 }) +
    circ(cx, cutY, 8.2, p.thin({ 'stroke-opacity': 0.6 })) +
    txt(cx, cutY + 2.9, 'A', { size: 7.6, fill: ink, op: 0.8, anchor: 'middle', track: 0 })
  out += bub(cutL + 8.2) + bub(cutR - 8.2)
  out += polyEl(
    [
      [cutL + 19, cutY],
      [cutL + 19, cutY + 9],
      [cutL + 27, cutY + 4.5],
    ],
    { fill: ink, 'fill-opacity': 0.6 }
  )

  /* ----- dimension strings ----- */
  out += dimChain(d, {
    axis: 'x',
    stations: [px0, vx1, vx2, px1],
    at: dimInnerY,
    from: py0,
    unitsPerPx: mmPerPx,
  })
  out += dimChain(d, {
    axis: 'x',
    stations: [px0, px1],
    at: dimOuterY,
    from: dimInnerY,
    unitsPerPx: mmPerPx,
    accentIndex: 0,
    size: 7.6,
  })
  out += dimChain(d, {
    axis: 'y',
    stations: [py0, hy1, hy2, py1],
    at: dimInnerX,
    from: px0,
    unitsPerPx: mmPerPx,
  })
  out += dimChain(d, {
    axis: 'y',
    stations: [py0, py1],
    at: dimOuterX,
    from: dimInnerX,
    unitsPerPx: mmPerPx,
    size: 7.6,
  })

  /* ----- north point ----- */
  out += northArrow(d, ann.x0 + 34, ann.y1 - 34, Math.min(box.w, box.h) * 0.030)

  /* ----- a single quiet note ----- */
  out += txt(px0, py1 + 26, 'FFL +0.00 · SLAB ON GRADE', { size: 6.6, fill: ink, op: 0.42 })
  return out
}

/* ==========================================================================
   2 — BUILDING SECTION
   ========================================================================== */

function drawSection(d) {
  const { box, ann, rand, ink, accent, W } = d
  const p = d.pen
  const idEarth = d.id('earth')
  const idAgg = d.id('agg')
  d.def(patHatch(idEarth, { angle: 45, gap: d.gap(7.5), color: ink, op: 0.32, sw: 0.55 }))
  d.def(patAggregate(idAgg, { gap: d.gap(11), color: ink, op: 0.35 }))

  let out = sheetFrame(d)

  const gy = box.y0 + box.h * 0.72
  const bx0 = box.x0 + box.w * 0.185
  const bx1 = box.x0 + box.w * 0.745
  const bw = bx1 - bx0
  const wt = box.w * 0.017
  const ft = box.h * 0.026
  const ffl0 = gy - box.h * 0.014
  const h1 = box.h * rand.jitter(0.235, 0.012)
  const ffl1 = ffl0 - h1
  const wallTop = ffl1 - box.h * rand.jitter(0.215, 0.012)
  const ridge = wallTop - box.h * rand.jitter(0.165, 0.015)
  const oh = box.w * 0.032
  const xm = (bx0 + bx1) / 2

  const mPerPx = 3.15 / h1
  const lvl = (y) => (ffl0 - y) * mPerPx
  const fmt = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2)

  /* ----- earth ----- */
  out += rect(box.x0 - W * 0.08, gy, box.w + W * 0.16, box.y1 + box.h * 0.14 - gy, {
    fill: `url(#${idEarth})`,
  })
  out += line(box.x0 - W * 0.08, gy, box.x1 + W * 0.08, gy, p.cut({ 'stroke-opacity': 0.85 }))
  const ticks = Math.max(4, Math.round(7 * clamp(d.density, 0.5, 2)))
  for (let i = 0; i < ticks; i++) {
    const x = box.x0 + box.w * (i / (ticks - 1)) + rand.f(-12, 12)
    out += line(x, gy, x + rand.f(-10, 10), gy + rand.f(4, 12), p.hair({ 'stroke-opacity': 0.3 }))
  }

  /* ----- substructure ----- */
  const poche = { fill: ink, 'fill-opacity': 0.86, stroke: ink, 'stroke-width': 0.4 * d.sw, 'stroke-opacity': 0.9 }
  const fd = box.h * 0.055
  const ftw = box.h * 0.026
  for (const wx of [bx0, bx1 - wt]) {
    out += rect(wx, gy, wt, fd, poche)
    out += rect(wx - wt * 0.75, gy + fd, wt * 2.5, ftw, poche)
  }
  const slabT = box.h * 0.022
  out += rect(bx0, ffl0, bw, slabT, poche)
  out += rect(bx0, ffl0 + slabT, bw, box.h * 0.022, { fill: `url(#${idAgg})` })
  out += line(bx0, ffl0 + slabT + box.h * 0.022, bx1, ffl0 + slabT + box.h * 0.022, p.hair({ 'stroke-opacity': 0.35 }))

  /* ----- cut walls ----- */
  out += rect(bx0, wallTop, wt, ffl0 - wallTop, poche)
  out += rect(bx1 - wt, wallTop, wt, ffl0 - wallTop, poche)

  /* ----- first floor plate (partial — double height to the right) ----- */
  const voidX = bx0 + bw * 0.62
  out += rect(bx0, ffl1, voidX - bx0, ft, poche)
  out += line(voidX, ffl1, voidX, ffl1 + ft * 2.4, p.obj({ 'stroke-opacity': 0.6 }))

  /* ----- roof ----- */
  const eY = wallTop + box.h * 0.018
  const runX = xm - (bx0 - oh)
  const riseY = eY - ridge
  const rt = box.h * 0.028
  const rtv = (rt * Math.hypot(runX, riseY)) / Math.max(1, runX)
  out += polyEl(
    [
      [bx0 - oh, eY],
      [xm, ridge],
      [bx1 + oh, eY],
      [bx1 + oh, eY + rtv],
      [xm, ridge + rtv],
      [bx0 - oh, eY + rtv],
    ],
    poche
  )
  // raked ceiling and collar tie beyond
  out += plineEl(
    [
      [bx0 + wt, eY + rtv + box.h * 0.012],
      [xm, ridge + rtv + box.h * 0.012],
      [bx1 - wt, eY + rtv + box.h * 0.012],
    ],
    p.thin({ 'stroke-opacity': 0.4 })
  )
  const collarY = ridge + (eY - ridge) * 0.42
  out += line(xm - (xm - bx0) * 0.42, collarY, xm + (xm - bx0) * 0.42, collarY, p.thin({ 'stroke-opacity': 0.45 }))

  /* ----- steel ridge beam — the one accent ----- */
  const rbw = box.w * 0.014
  out += rect(xm - rbw / 2, ridge + rtv, rbw, rbw * 1.5, {
    fill: accent,
    'fill-opacity': 0.9,
    stroke: accent,
    'stroke-width': 0.6 * d.sw,
  })
  out += leader(d, xm + rbw * 0.6, ridge + rtv + rbw * 0.7, ann.x1, ridge - box.h * 0.03, 'Steel ridge beam', {
    accent: true,
    size: 6.8,
    align: 'end',
  })

  /* ----- elements beyond ----- */
  const beyond = p.hair({ 'stroke-opacity': 0.34 })
  const beyondM = p.thin({ 'stroke-opacity': 0.4 })
  const partT = wt * 0.55
  for (const x of [bx0 + bw * 0.28, bx0 + bw * 0.46, bx0 + bw * 0.78]) {
    out += line(x, ffl1 + ft, x, ffl0, beyond)
    out += line(x + partT, ffl1 + ft, x + partT, ffl0, beyond)
  }
  for (const x of [bx0 + bw * 0.24, bx0 + bw * 0.5]) {
    out += line(x, wallTop, x, ffl1, beyond)
  }
  // openings beyond
  out += rect(bx0 + bw * 0.08, ffl0 - box.h * 0.155, bw * 0.16, box.h * 0.145, beyondM)
  out += rect(bx0 + bw * 0.55, ffl0 - box.h * 0.19, bw * 0.2, box.h * 0.18, beyondM)
  out += rect(bx0 + bw * 0.1, ffl1 - box.h * 0.15, bw * 0.14, box.h * 0.12, beyondM)
  out += rect(bx0 + bw * 0.36, ffl1 - box.h * 0.15, bw * 0.14, box.h * 0.12, beyondM)
  // furniture beyond
  out += rect(bx0 + bw * 0.66, ffl0 - box.h * 0.038, bw * 0.16, box.h * 0.038, beyond)
  out += rect(bx0 + bw * 0.16, ffl1 - box.h * 0.03, bw * 0.13, box.h * 0.03, beyond)
  // stair beyond, ground to first
  const sSteps = 12
  const sx0 = bx0 + bw * 0.30
  const sx1 = bx0 + bw * 0.55
  const stepW = (sx1 - sx0) / sSteps
  const stepH = (ffl0 - ffl1) / sSteps
  const stairPts = [[sx0, ffl0]]
  for (let i = 0; i < sSteps; i++) {
    stairPts.push([sx0 + stepW * i, ffl0 - stepH * (i + 1)])
    stairPts.push([sx0 + stepW * (i + 1), ffl0 - stepH * (i + 1)])
  }
  out += plineEl(stairPts, p.thin({ 'stroke-opacity': 0.45 }))
  out += plineEl(
    [
      [sx0, ffl0 - box.h * 0.05],
      [sx1, ffl1 - box.h * 0.05],
    ],
    beyond
  )

  /* ----- scale figures ----- */
  out += figure(d, bx0 + bw * 0.19, ffl0, h1 * 0.585)
  out += figure(d, bx0 + bw * 0.82, ffl0, h1 * 0.585)
  out += figure(d, bx0 + bw * 0.3, ffl1, h1 * 0.585)

  /* ----- level markers ----- */
  const lx = bx1 + box.w * 0.055
  const marks = [
    [ridge, 'RIDGE'],
    [wallTop, 'EAVES'],
    [ffl1, 'FFL 01'],
    [ffl0, 'FFL 00'],
    [gy + fd + ftw, 'U/S FTG'],
  ]
  for (const [y, name] of marks) {
    out += line(bx1 - wt, y, lx, y, p.hair({ 'stroke-opacity': 0.3, 'stroke-dasharray': '4 4' }))
    out += polyEl(
      [
        [lx, y],
        [lx + 5.4, y - 4.4],
        [lx + 10.8, y],
      ],
      { fill: ink, 'fill-opacity': 0.55 }
    )
    out += line(lx, y, lx + 10.8, y, p.thin({ 'stroke-opacity': 0.6 }))
    out += txt(lx + 14, y - 4.6, fmt(lvl(y)), { size: 7, fill: ink, op: 0.72 })
    out += txt(lx + 14, y + 5.6, name, { size: 6, fill: ink, op: 0.4 })
  }

  /* ----- roof pitch triangle ----- */
  const ptx = bx0 - oh + runX * 0.42
  const pty = eY - riseY * 0.42
  const trun = box.w * 0.05
  const trise = (trun * riseY) / Math.max(1, runX)
  out += plineEl(
    [
      [ptx, pty],
      [ptx + trun, pty],
      [ptx + trun, pty - trise],
    ],
    p.thin({ 'stroke-opacity': 0.6 })
  )
  out += txt(ptx + trun * 0.5, pty + 8.4, String(Math.round(trun / trise * 10) / 10), {
    size: 6.4,
    fill: ink,
    op: 0.5,
    anchor: 'middle',
  })
  out += txt(ptx + trun + 4, pty - trise * 0.5, '1', { size: 6.4, fill: ink, op: 0.5 })
  out += txt(ptx, pty - trise - 6, `${Math.round((Math.atan2(riseY, runX) * 180) / Math.PI)}°`, {
    size: 7,
    fill: accent,
    op: 0.9,
  })

  /* ----- overall height dimension ----- */
  out += dimChain(d, {
    axis: 'y',
    stations: [ridge, ffl1, ffl0, gy],
    at: bx0 - box.w * 0.062,
    from: bx0,
    unitsPerPx: mPerPx * 1000,
    round: 25,
  })

  out += txt(ann.x0, ann.y1 - 2, 'SECTION AA — LOOKING NORTH', { size: 6.8, fill: ink, op: 0.42 })
  return out
}

/* ==========================================================================
   3 — ELEVATION
   ========================================================================== */

function drawElevation(d) {
  const { box, ann, rand, ink, accent, W } = d
  const p = d.pen
  const idClipA = d.id('cla')
  const idClipB = d.id('clb')

  const gy = box.y0 + box.h * 0.795
  const bx0 = box.x0 + box.w * 0.205
  const bx1 = box.x0 + box.w * 0.685
  const bw = bx1 - bx0
  const wallTop = gy - box.h * rand.jitter(0.425, 0.02)
  const ridge = wallTop - box.h * rand.jitter(0.16, 0.014)
  const oh = box.w * 0.026
  const xm = (bx0 + bx1) / 2
  const eY = wallTop + box.h * 0.012
  const rt = box.h * 0.017

  const wingW = box.w * 0.165
  const wingTop = gy - box.h * 0.235
  const wx1 = bx1 + wingW

  // eaves sit at 5.40 m; every level label is derived from that one datum
  const mPerPx = 5.4 / Math.max(1, gy - wallTop)

  // clip paths so cladding stays inside each mass
  d.def(
    tag(
      'clipPath',
      { id: idClipA },
      polyEl([
        [bx0, gy],
        [bx0, wallTop],
        [xm, ridge + rt * 1.4],
        [bx1, wallTop],
        [bx1, gy],
      ])
    )
  )
  d.def(tag('clipPath', { id: idClipB }, polyEl([[bx1, gy], [bx1, wingTop - box.h * 0.02], [wx1, wingTop + box.h * 0.02], [wx1, gy]])))

  let out = sheetFrame(d)

  /* ----- tree behind, right ----- */
  out += treeElevation(d, box.x0 + box.w * 0.79, gy, box.h * 0.26, rand)

  /* ----- wing mass ----- */
  out += polyEl([[bx1, gy], [bx1, wingTop - box.h * 0.02], [wx1, wingTop + box.h * 0.02], [wx1, gy]], p.obj({ 'stroke-opacity': 0.75 }))
  out += group(
    { 'clip-path': `url(#${idClipB})` },
    (() => {
      let s = ''
      const gapY = box.h * 0.0165
      for (let y = gy; y > wingTop - box.h * 0.05; y -= gapY) {
        s += line(bx1, y, wx1, y + box.h * 0.011, p.hair({ 'stroke-opacity': 0.22 }))
      }
      return s
    })()
  )
  out += line(bx1 - oh * 0.6, wingTop - box.h * 0.02, wx1 + oh, wingTop + box.h * 0.02, p.obj({ 'stroke-opacity': 0.8 }))
  out += line(bx1 - oh * 0.6, wingTop - box.h * 0.02 + rt * 0.7, wx1 + oh, wingTop + box.h * 0.02 + rt * 0.7, p.thin({ 'stroke-opacity': 0.5 }))

  /* ----- main mass ----- */
  out += polyEl(
    [
      [bx0, gy],
      [bx0, wallTop],
      [xm, ridge + rt * 1.4],
      [bx1, wallTop],
      [bx1, gy],
    ],
    p.obj({ 'stroke-opacity': 0.8 })
  )
  // standing-seam cladding
  out += group(
    { 'clip-path': `url(#${idClipA})` },
    (() => {
      let s = ''
      const gapX = bw / Math.round(bw / (box.w * 0.0165 / Math.max(0.5, d.density)))
      for (let x = bx0 + gapX; x < bx1 - 0.5; x += gapX) {
        s += line(x, gy, x, ridge, p.hair({ 'stroke-opacity': 0.2 }))
      }
      return s
    })()
  )

  /* ----- roof verge, fascia and its shadow ----- */
  const roofTop = [
    [bx0 - oh, eY],
    [xm, ridge],
    [bx1 + oh, eY],
  ]
  const roofUnder = roofTop.map((q) => [q[0], q[1] + rt])
  out += polyEl([...roofTop, ...roofUnder.slice().reverse()], {
    fill: ink,
    'fill-opacity': 0.14,
    stroke: ink,
    'stroke-width': 1.6 * d.sw,
    'stroke-opacity': 0.8,
    'stroke-linejoin': 'miter',
  })
  const shD = box.h * 0.024
  out += polyEl(
    [
      [bx0 - oh + oh * 0.9, eY + rt],
      [xm, ridge + rt],
      [bx1 + oh - oh * 0.9, eY + rt],
      [bx1 + oh - oh * 0.9, eY + rt + shD],
      [xm, ridge + rt + shD],
      [bx0 - oh + oh * 0.9, eY + rt + shD],
    ],
    { fill: ink, 'fill-opacity': 0.11 }
  )

  /* ----- openings ----- */
  const opening = (x, y, w, h, o = {}) => {
    const { mullions = 1, transom = 0, useAccent = false, panel = false } = o
    const col = useAccent ? accent : ink
    let s = rect(x, y, w, h, {
      fill: 'none',
      stroke: col,
      'stroke-width': (useAccent ? 1.9 : 1.6) * d.sw,
      'stroke-opacity': useAccent ? 0.95 : 0.78,
    })
    s += rect(x + 2.4, y + 2.4, w - 4.8, h - 4.8, p.hair({ 'stroke-opacity': 0.4 }))
    s += rect(x + 2.4, y + 2.4, w - 4.8, Math.min(h - 4.8, box.h * 0.014), { fill: ink, 'fill-opacity': 0.13 })
    s += rect(x + 2.4, y + 2.4, Math.min(w - 4.8, box.w * 0.006), h - 4.8, { fill: ink, 'fill-opacity': 0.1 })
    for (let i = 1; i <= mullions; i++) {
      const mx = x + (w / (mullions + 1)) * i
      s += line(mx, y + 2.4, mx, y + h - 2.4, p.thin({ 'stroke-opacity': 0.45 }))
    }
    if (transom) {
      const ty = y + h * 0.32
      s += line(x + 2.4, ty, x + w - 2.4, ty, p.thin({ 'stroke-opacity': 0.45 }))
    }
    if (panel) {
      s += rect(x + w * 0.18, y + h * 0.1, w * 0.64, h * 0.34, p.hair({ 'stroke-opacity': 0.4 }))
      s += rect(x + w * 0.18, y + h * 0.52, w * 0.64, h * 0.36, p.hair({ 'stroke-opacity': 0.4 }))
      s += circ(x + w * 0.84, y + h * 0.5, 1.7, { fill: col, 'fill-opacity': 0.8 })
    }
    // glazing hint and sill
    s += line(x + 3.6, y + h - 4, x + Math.min(w - 4, h * 0.5), y + 3.6, p.hair({ 'stroke-opacity': 0.22 }))
    s += line(x - 1.5, y + h, x + w + 1.5, y + h, p.thin({ 'stroke-opacity': 0.6 }))
    return s
  }

  const gfH = box.h * 0.245
  const gfY = gy - gfH
  out += opening(bx0 + bw * 0.07, gfY, bw * 0.3, gfH, { mullions: 2, transom: 1 })
  const doorW = bw * 0.088
  out += opening(bx0 + bw * 0.46, gy - box.h * 0.19, doorW, box.h * 0.19, { mullions: 0, useAccent: true, panel: true })
  out += opening(bx0 + bw * 0.62, gfY + box.h * 0.05, bw * 0.26, gfH - box.h * 0.05, { mullions: 1 })
  const ffH = box.h * 0.135
  const ffY = wallTop - box.h * 0.0 - ffH - box.h * 0.045
  out += opening(bx0 + bw * 0.1, ffY, bw * 0.2, ffH, { mullions: 1 })
  out += opening(bx0 + bw * 0.42, ffY, bw * 0.2, ffH, { mullions: 1 })
  out += opening(bx0 + bw * 0.72, ffY, bw * 0.16, ffH, { mullions: 0 })
  const gv = bw * 0.075
  out += rect(xm - gv / 2, ridge + rt * 2.6, gv, gv, p.thin({ 'stroke-opacity': 0.6 }))
  for (let i = 1; i < 4; i++) {
    out += line(xm - gv / 2, ridge + rt * 2.6 + (gv / 4) * i, xm + gv / 2, ridge + rt * 2.6 + (gv / 4) * i, p.hair({ 'stroke-opacity': 0.35 }))
  }
  // wing opening
  out += opening(bx1 + wingW * 0.28, gy - box.h * 0.155, wingW * 0.42, box.h * 0.155, { mullions: 1 })

  /* ----- ground ----- */
  out += line(box.x0 - W * 0.08, gy, box.x1 + W * 0.08, gy, p.cut({ 'stroke-opacity': 0.85 }))
  for (let i = 0; i < 22; i++) {
    const x = box.x0 - box.w * 0.04 + (box.w * 1.08 * i) / 21 + rand.f(-6, 6)
    out += line(x, gy + 2.5, x + rand.f(-5, 5), gy + rand.f(5, 11), p.hair({ 'stroke-opacity': 0.24 }))
  }

  /* ----- tree in front, left ----- */
  out += treeElevation(d, box.x0 + box.w * 0.115, gy, box.h * 0.46, rand)

  /* ----- level dashes at right ----- */
  const lx0 = wx1 + box.w * 0.014
  const lx1 = ann.x1
  const levels = [
    [ridge, 'RIDGE'],
    [wallTop, 'EAVES'],
    [ffY + ffH, 'FFL 01'],
    [gy, 'FFL 00'],
  ]
  for (let i = 0; i < levels.length; i++) {
    const [y, name] = levels[i]
    const acc = i === 0
    out += line(lx0, y, lx1, y, {
      fill: 'none',
      stroke: acc ? accent : ink,
      'stroke-width': 0.7 * d.sw,
      'stroke-opacity': acc ? 0.8 : 0.32,
      'stroke-dasharray': '7 4',
    })
    out += txt(lx1, y - 4.4, `${name} +${((gy - y) * mPerPx).toFixed(2)}`, {
      size: 6.6,
      fill: acc ? accent : ink,
      op: acc ? 0.95 : 0.5,
      anchor: 'end',
    })
  }

  out += txt(ann.x0, ann.y1 - 2, 'CEDAR RAINSCREEN · STANDING SEAM ZINC ROOF', {
    size: 6.8,
    fill: ink,
    op: 0.42,
  })
  return out
}

/* ==========================================================================
   4 — CUTAWAY AXONOMETRIC
   ========================================================================== */

function drawAxon(d) {
  const { box, ann, ink, accent } = d
  const p = d.pen
  let out = sheetFrame(d)

  const A = 10
  const B = 7
  const Hw = 3
  const Hc = 1.0
  const t = 0.32
  const lift = 1.7
  const gz = -0.42
  const ext = 2

  // roof geometry, needed before the fit
  const rz = Hw + 0.3 + lift
  const ridgeH = 2.15
  const ov = 0.62
  const rth = 0.2
  const ridgeY = B / 2

  /* Fit: project the model's extreme points, then solve scale and origin so the
     whole composition lands centred inside the annotation-safe box. */
  const extremes = [
    [-ext, -ext, gz],
    [A + ext, -ext, gz],
    [A + ext, B + ext, gz],
    [-ext, B + ext, gz],
    [-ov, ridgeY, rz + ridgeH],
    [A + ov, ridgeY, rz + ridgeH],
    [-ov, -ov, rz],
    [A + ov, B + ov, rz],
  ].map((q) => [(q[0] - q[1]) * COS30, (q[0] + q[1]) * SIN30 - q[2]])
  const ux0 = Math.min(...extremes.map((q) => q[0]))
  const ux1 = Math.max(...extremes.map((q) => q[0]))
  const uy0 = Math.min(...extremes.map((q) => q[1]))
  const uy1 = Math.max(...extremes.map((q) => q[1]))
  const s = Math.min((ann.w * 0.66) / (ux1 - ux0), (ann.h * 0.88) / (uy1 - uy0))
  const o = {
    s,
    cx: (ann.x0 + ann.x1) / 2 - ((ux0 + ux1) / 2) * s,
    cy: (ann.y0 + ann.y1) / 2 - ((uy0 + uy1) / 2) * s,
  }

  const poche = { fill: ink, 'fill-opacity': 0.82, stroke: ink, 'stroke-width': 0.5 * d.sw, 'stroke-opacity': 0.9 }

  /* ----- ground grid ----- */
  const gstep = d.density >= 1.4 ? 0.5 : 1
  for (let i = -ext; i <= A + ext + 0.01; i += gstep) {
    out += isoLine([i, -ext, gz], [i, B + ext, gz], o, p.hair({ 'stroke-opacity': i % 5 === 0 ? 0.22 : 0.1 }))
  }
  for (let j = -ext; j <= B + ext + 0.01; j += gstep) {
    out += isoLine([-ext, j, gz], [A + ext, j, gz], o, p.hair({ 'stroke-opacity': j % 5 === 0 ? 0.22 : 0.1 }))
  }

  /* ----- slab ----- */
  out += isoBox(d, o, -0.45, -0.45, -0.4, A + 0.9, B + 0.9, 0.4, { top: 0.07, left: 0.2, right: 0.28 })

  /* ----- far walls, full height ----- */
  out += isoBox(d, o, 0, 0, 0, t, B, Hw, { top: 0.05, left: 0.1, right: 0.16 })
  out += isoBox(d, o, t, 0, 0, A - t, t, Hw, { top: 0.05, left: 0.1, right: 0.16 })

  /* ----- interior partitions, cut low ----- */
  out += isoBox(d, o, 4.1, t, 0, t * 0.7, B - 2.6, Hc, { top: 0.5, left: 0.12, right: 0.18 })
  out += isoBox(d, o, 4.1 + t * 0.7, 4.0, 0, A - 4.1 - t * 0.7 - t, t * 0.7, Hc, { top: 0.5, left: 0.12, right: 0.18 })
  out += isoBox(d, o, 6.9, t, 0, t * 0.7, 2.0, Hc, { top: 0.5, left: 0.12, right: 0.18 })

  /* ----- near walls, cut low (the cutaway) ----- */
  out += isoBox(d, o, 0, B - t, 0, A, t, Hc, { top: 0.55, left: 0.16, right: 0.22 })
  out += isoBox(d, o, A - t, 0, 0, t, B - t, Hc, { top: 0.55, left: 0.16, right: 0.22 })

  /* ----- stair ----- */
  const steps = 9
  for (let i = 0; i < steps; i++) {
    const z = (Hw / steps) * i
    out += isoBox(d, o, 1.0, 1.0 + i * 0.34, z, 1.3, 0.34, Hw / steps, {
      top: 0.09,
      left: 0.16,
      right: 0.22,
      edge: 0.4,
    })
  }

  /* ----- upper floor plate, partial ----- */
  out += isoBox(d, o, 0, 0, Hw, A, 4.3, 0.3, { top: 0.06, left: 0.14, right: 0.2 })
  out += isoPoly(
    [
      [0, 0, Hw + 0.3],
      [A, 0, Hw + 0.3],
      [A, 4.3, Hw + 0.3],
      [0, 4.3, Hw + 0.3],
    ],
    o,
    { fill: 'none', stroke: ink, 'stroke-width': 1.1 * d.sw, 'stroke-opacity': 0.55 }
  )
  // cut edge of the floor plate reads as poché
  out += isoPoly(
    [
      [0, 4.3, Hw],
      [A, 4.3, Hw],
      [A, 4.3, Hw + 0.3],
      [0, 4.3, Hw + 0.3],
    ],
    o,
    poche
  )

  /* ----- lifted gable roof ----- */
  const roofFace = (y0, y1, z0, z1, tone) =>
    isoPoly(
      [
        [-ov, y0, z0],
        [A + ov, y0, z0],
        [A + ov, y1, z1],
        [-ov, y1, z1],
      ],
      o,
      { fill: ink, 'fill-opacity': tone, stroke: ink, 'stroke-width': 1.1 * d.sw, 'stroke-opacity': 0.62, 'stroke-linejoin': 'round' }
    )
  out += roofFace(-ov, ridgeY, rz, rz + ridgeH, 0.11)
  out += roofFace(B + ov, ridgeY, rz, rz + ridgeH, 0.2)
  // roof thickness at the eaves
  out += isoPoly(
    [
      [-ov, B + ov, rz],
      [A + ov, B + ov, rz],
      [A + ov, B + ov, rz - rth],
      [-ov, B + ov, rz - rth],
    ],
    o,
    { fill: ink, 'fill-opacity': 0.3, stroke: ink, 'stroke-width': 0.9 * d.sw, 'stroke-opacity': 0.6 }
  )
  // gable end (visible +x side)
  out += isoPoly(
    [
      [A + ov, -ov, rz],
      [A + ov, ridgeY, rz + ridgeH],
      [A + ov, B + ov, rz],
      [A + ov, B + ov, rz - rth],
      [A + ov, ridgeY, rz + ridgeH - rth],
      [A + ov, -ov, rz - rth],
    ],
    o,
    { fill: ink, 'fill-opacity': 0.26, stroke: ink, 'stroke-width': 1.1 * d.sw, 'stroke-opacity': 0.65 }
  )
  out += isoLine([-ov, ridgeY, rz + ridgeH], [A + ov, ridgeY, rz + ridgeH], o, p.obj({ 'stroke-opacity': 0.7 }))

  /* ----- explode indicators ----- */
  const dashed = p.hair({ 'stroke-opacity': 0.4, 'stroke-dasharray': '4 4' })
  for (const c of [[-ov, -ov], [A + ov, -ov], [A + ov, B + ov], [-ov, B + ov]]) {
    out += isoLine([c[0], c[1], rz - rth], [c[0], c[1], Hw + 0.34], o, dashed)
  }

  /* ----- numbered callouts ----- */
  const notes = [
    { at: [A + ov, ridgeY, rz + ridgeH], to: [ann.x1, ann.y0 + ann.h * 0.06], n: '01', text: 'Ridge' },
    { at: [A, 4.3, Hw + 0.3], to: [ann.x1, ann.y0 + ann.h * 0.30], n: '02', text: 'L01 plate' },
    { at: [4.1, 3.0, Hc], to: [ann.x0, ann.y0 + ann.h * 0.24], n: '03', text: 'Cut line' },
    { at: [0, B, 0], to: [ann.x0, ann.y0 + ann.h * 0.68], n: '04', text: 'Slab edge' },
  ]
  for (let i = 0; i < notes.length; i++) {
    const nt = notes[i]
    const a = iso(nt.at[0], nt.at[1], nt.at[2], o)
    const useAcc = i === 0
    const left = nt.to[0] < a[0]
    out += plineEl([[a[0], a[1]], [nt.to[0] + (left ? 14 : -14), nt.to[1]], [nt.to[0], nt.to[1]]], useAcc ? p.acc({ 'stroke-width': 0.9 * d.sw, 'stroke-opacity': 0.9 }) : p.hair({ 'stroke-opacity': 0.45 }))
    out += circ(a[0], a[1], 2.6, { fill: useAcc ? accent : ink, 'fill-opacity': useAcc ? 0.95 : 0.7 })
    out += circ(nt.to[0] + (left ? 7 : -7), nt.to[1] - 6.6, 6.6, p.hair({ 'stroke-opacity': 0.5 }))
    out += txt(nt.to[0] + (left ? 7 : -7), nt.to[1] - 4.2, nt.n, {
      size: 6.4,
      fill: useAcc ? accent : ink,
      op: 0.85,
      anchor: 'middle',
      track: 0,
    })
    out += txt(nt.to[0], nt.to[1] + 9.5, nt.text, {
      size: 6.4,
      fill: ink,
      op: 0.5,
      anchor: left ? 'start' : 'end',
    })
  }

  /* ----- iso scale figure on the slab ----- */
  const fp = iso(A - 1.6, B - 1.4, 0, o)
  out += figure(d, fp[0], fp[1], 1.75 * s)

  out += txt(ann.x0, ann.y1 - 2, 'AXONOMETRIC 30° — ROOF LIFTED', { size: 6.8, fill: ink, op: 0.42 })
  return out
}

/* ==========================================================================
   5 — SITE PLAN
   ========================================================================== */

function drawSite(d) {
  const { box, ann, rand, ink, accent } = d
  const p = d.pen
  const idFp = d.id('fp')
  const idDrive = d.id('dv')
  d.def(patHatch(idFp, { angle: 45, gap: d.gap(6), color: ink, op: 0.3, sw: 0.6 }))
  d.def(patAggregate(idDrive, { gap: d.gap(14), color: ink, op: 0.22 }))

  let out = sheetFrame(d)

  const cx = box.x0 + box.w * 0.46
  const cy = box.y0 + box.h * 0.48
  const rx = box.w * 0.33
  const ry = box.h * 0.36

  const bnd = [
    [cx - rx * rand.jitter(1, 0.05), cy - ry * rand.jitter(0.92, 0.06)],
    [cx + rx * rand.jitter(0.86, 0.06), cy - ry * rand.jitter(1.02, 0.05)],
    [cx + rx * rand.jitter(1.04, 0.05), cy + ry * rand.jitter(0.5, 0.08)],
    [cx + rx * rand.jitter(0.72, 0.06), cy + ry * rand.jitter(1.0, 0.05)],
    [cx - rx * rand.jitter(1.06, 0.05), cy + ry * rand.jitter(0.86, 0.06)],
  ]
  const n = bnd.length
  const mPerPx = 46 / (rx * 2)

  /* ----- contours across the site ----- */
  for (let i = 0; i < 5; i++) {
    const pts = []
    const base = box.y0 + box.h * (0.14 + i * 0.185)
    for (let k = 0; k <= 8; k++) {
      const x = box.x0 - box.w * 0.05 + (box.w * 1.1 * k) / 8
      pts.push([x, base + Math.sin(k * 0.72 + i * 0.9 + rand.f(0, 0.3)) * box.h * (0.028 + i * 0.006)])
    }
    const idx = i % 2 === 0
    out += pathEl(
      smoothPath(pts, false, 0.55),
      p.hair({ 'stroke-opacity': idx ? 0.3 : 0.18, 'stroke-width': (idx ? 1.0 : 0.7) * d.sw })
    )
    if (idx) {
      out += txt(box.x0 + box.w * 0.055, pts[1][1] - 3, (148 + i * 2).toFixed(1), {
        size: 6,
        fill: ink,
        op: 0.35,
      })
    }
  }

  /* ----- setbacks ----- */
  const setDist = [box.h * 0.085, box.w * 0.045, box.w * 0.045, box.h * 0.06, box.w * 0.045]
  const setback = offsetPolygon(bnd, setDist)
  out += polyEl(setback, p.thin({ 'stroke-opacity': 0.42, 'stroke-dasharray': '9 5' }))

  /* ----- building footprint ----- */
  const rot = rand.f(-5, 5)
  const fw = rx * 0.86
  const fh = ry * 0.62
  const fx = cx - fw * 0.52
  const fy = cy - fh * 0.34
  const foot = group(
    { transform: `rotate(${f(rot)} ${f(fx + fw / 2)} ${f(fy + fh / 2)})` },
    rect(fx, fy, fw, fh, { fill: `url(#${idFp})` }) +
      rect(fx, fy, fw, fh, p.cut({ 'stroke-opacity': 0.85 })) +
      rect(fx + fw * 0.62, fy + fh, fw * 0.36, fh * 0.52, { fill: `url(#${idFp})` }) +
      rect(fx + fw * 0.62, fy + fh, fw * 0.36, fh * 0.52, p.cut({ 'stroke-opacity': 0.85 })) +
      rect(fx - fw * 0.02, fy - fh * 0.34, fw * 0.44, fh * 0.34, p.thin({ 'stroke-opacity': 0.45, 'stroke-dasharray': '6 4' })) +
      txt(fx + fw * 0.3, fy + fh * 0.46, 'Residence', { size: 7.6, fill: ink, op: 0.72, anchor: 'middle', track: 0.16 }) +
      txt(fx + fw * 0.3, fy + fh * 0.66, 'FFE 152.85', { size: 6.2, fill: ink, op: 0.45, anchor: 'middle' }) +
      txt(fx + fw * 0.8, fy + fh * 1.32, 'Garage', { size: 6.4, fill: ink, op: 0.5, anchor: 'middle', track: 0.14 })
  )
  out += foot

  /* ----- driveway ----- */
  const dEnd = [fx + fw * 0.8, fy + fh * 1.5]
  const dStart = [bnd[3][0] * 0.5 + bnd[4][0] * 0.5, bnd[3][1] * 0.5 + bnd[4][1] * 0.5]
  const dw = box.w * 0.032
  const curve = (off) =>
    `M${f(dStart[0] + off)} ${f(dStart[1])}C${f(dStart[0] + off)} ${f(dStart[1] - box.h * 0.1)} ${f(
      dEnd[0] + off * 2
    )} ${f(dEnd[1] + box.h * 0.14)} ${f(dEnd[0] + off)} ${f(dEnd[1])}`
  out += pathEl(`${curve(-dw)}L${f(dEnd[0] + dw)} ${f(dEnd[1])}L${f(dStart[0] + dw)} ${f(dStart[1])}Z`, {
    fill: `url(#${idDrive})`,
  })
  out += pathEl(curve(-dw), p.thin({ 'stroke-opacity': 0.55 }))
  out += pathEl(curve(dw), p.thin({ 'stroke-opacity': 0.55 }))
  for (let i = 1; i < 6; i++) {
    const tt = i / 6
    const yy = dStart[1] + (dEnd[1] - dStart[1]) * tt
    const xx = dStart[0] + (dEnd[0] - dStart[0]) * tt * tt
    out += line(xx - dw * 0.55, yy, xx + dw * 0.55, yy, p.hair({ 'stroke-opacity': 0.16 }))
  }

  /* ----- boundary, bearings and lengths ----- */
  out += polyEl(bnd, {
    fill: 'none',
    stroke: ink,
    'stroke-width': 2.4 * d.sw,
    'stroke-opacity': 0.85,
    'stroke-dasharray': '26 5 4 5',
  })
  for (let i = 0; i < n; i++) {
    const a = bnd[i]
    const b = bnd[(i + 1) % n]
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
    let flip = false
    if (ang > 90 || ang < -90) {
      ang += 180
      flip = true
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * mPerPx
    const nx = -(b[1] - a[1])
    const ny = b[0] - a[0]
    const nl = Math.hypot(nx, ny) || 1
    const sgn = (mx - cx) * nx + (my - cy) * ny > 0 ? 1 : -1
    const ox = (nx / nl) * 9 * sgn
    const oy = (ny / nl) * 9 * sgn
    out += txt(mx + ox, my + oy + (sgn > 0 ? 6 : -2), `${bearingText(b[0] - a[0], b[1] - a[1], flip)}  ${len.toFixed(2)}`, {
      size: 6.2,
      fill: ink,
      op: 0.55,
      anchor: 'middle',
      rotate: ang,
      track: 0.08,
    })
    out += circ(a[0], a[1], 2.4, { fill: 'none', stroke: ink, 'stroke-width': 0.9 * d.sw, 'stroke-opacity': 0.7 })
  }

  /* ----- key setback dimension in accent ----- */
  const sbA = [(bnd[0][0] + bnd[1][0]) / 2, (bnd[0][1] + bnd[1][1]) / 2]
  const sbB = [(setback[0][0] + setback[1][0]) / 2, (setback[0][1] + setback[1][1]) / 2]
  out += line(sbA[0], sbA[1], sbB[0], sbB[1], p.acc({ 'stroke-width': 1.1 * d.sw }))
  const ar = 4
  out += polyEl([[sbB[0], sbB[1]], [sbB[0] - ar, sbB[1] - ar * 1.5], [sbB[0] + ar, sbB[1] - ar * 1.5]], { fill: accent, 'fill-opacity': 0.9 })
  out += txt(sbB[0] + 6, (sbA[1] + sbB[1]) / 2, `${(Math.hypot(sbB[0] - sbA[0], sbB[1] - sbA[1]) * mPerPx).toFixed(1)} M SETBACK`, {
    size: 6.4,
    fill: accent,
    op: 0.95,
  })

  /* ----- trees ----- */
  const treeCount = Math.round(9 * clamp(d.density, 0.5, 1.8))
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + rand.f(0, 1)
    const rr = rand.f(0.62, 1.05)
    const tx = cx + Math.cos(a) * rx * rr * 0.92
    const ty = cy + Math.sin(a) * ry * rr * 0.86
    const r = box.w * rand.f(0.014, 0.028)
    out += treePlan(d, tx, ty, r, 11, i % 4 === 0)
  }

  /* ----- north point, scale bar, lot note ----- */
  out += northArrow(d, ann.x1 - 32, ann.y0 + 40, Math.min(box.w, box.h) * 0.032)
  out += scaleBar(d, ann.x0, ann.y1 - 26, box.w * 0.15, 'M', 4, 20)
  out += txt(ann.x0, ann.y0 + 10, 'LOT 14 — 0.42 AC', { size: 7.4, fill: ink, op: 0.6 })
  out += txt(ann.x0, ann.y0 + 26, 'IMPERVIOUS COVER 31%', { size: 6.2, fill: ink, op: 0.4 })
  return out
}

function bearingText(dx, dy, flip) {
  let vx = dx
  let vy = dy
  if (flip) {
    vx = -vx
    vy = -vy
  }
  let a = (Math.atan2(vx, -vy) * 180) / Math.PI
  if (a < 0) a += 360
  let q
  let v
  if (a <= 90) {
    q = ['N', 'E']
    v = a
  } else if (a <= 180) {
    q = ['S', 'E']
    v = 180 - a
  } else if (a <= 270) {
    q = ['S', 'W']
    v = a - 180
  } else {
    q = ['N', 'W']
    v = 360 - a
  }
  const deg = Math.floor(v)
  const min = Math.round((v - deg) * 60)
  return `${q[0]} ${deg}°${pad(min)}' ${q[1]}`
}

/* ==========================================================================
   6 — STRUCTURAL FRAMING PLAN
   ========================================================================== */

function drawFraming(d) {
  const { box, ann, rand, ink, accent } = d
  const p = d.pen
  let out = sheetFrame(d)

  const gx0 = ann.x0 + ann.w * 0.11
  const gx1 = ann.x0 + ann.w * 0.66
  const gy0 = ann.y0 + ann.h * 0.16
  const gy1 = ann.y1 - ann.h * 0.24
  const cols = 4
  const rows = 3

  const xs = []
  for (let i = 0; i < cols; i++) xs.push(gx0 + ((gx1 - gx0) * i) / (cols - 1))
  const ys = []
  for (let j = 0; j < rows; j++) ys.push(gy0 + ((gy1 - gy0) * j) / (rows - 1))
  xs[1] += (gx1 - gx0) * rand.jitter(0, 0.02)
  ys[1] += (gy1 - gy0) * rand.jitter(0, 0.025)

  const over = Math.min(box.w, box.h) * 0.075
  const gridPen = p.thin({ 'stroke-opacity': 0.4, 'stroke-dasharray': '22 5 3 5' })
  const bubble = (x, y, s) =>
    circ(x, y, 9.4, { fill: '#ffffff', 'fill-opacity': 0.45 }) +
    circ(x, y, 9.4, p.thin({ 'stroke-opacity': 0.6 })) +
    txt(x, y + 2.9, s, { size: 7.6, fill: ink, op: 0.78, anchor: 'middle', track: 0 })

  for (let i = 0; i < cols; i++) {
    out += line(xs[i], gy0 - over, xs[i], gy1 + over * 0.55, gridPen)
    out += bubble(xs[i], gy0 - over - 9.4, String.fromCharCode(65 + i))
  }
  for (let j = 0; j < rows; j++) {
    out += line(gx0 - over, ys[j], gx1 + over * 0.55, ys[j], gridPen)
    out += bubble(gx0 - over - 9.4, ys[j], String(j + 1))
  }

  /* ----- joists ----- */
  const centres = Math.min(box.w, box.h) * 0.030 / clamp(d.density, 0.55, 1.8)
  const joistPen = p.hair({ 'stroke-opacity': 0.42 })
  // bay 1 (rows 1-2): spanning north-south
  for (let x = xs[0] + centres; x < xs[cols - 1] - 1; x += centres) {
    out += line(x, ys[0], x, ys[1], joistPen)
  }
  // bay 2 (rows 2-3): spanning east-west
  for (let y = ys[1] + centres; y < ys[2] - 1; y += centres) {
    out += line(xs[0], y, xs[cols - 1], y, joistPen)
  }

  /* ----- beams as heavier double lines ----- */
  const beamGap = Math.min(box.w, box.h) * 0.011
  const beamPen = { fill: 'none', stroke: ink, 'stroke-width': 2.2 * d.sw, 'stroke-opacity': 0.82 }
  const beamH = (y, x0, x1, pen) =>
    line(x0, y - beamGap / 2, x1, y - beamGap / 2, pen) + line(x0, y + beamGap / 2, x1, y + beamGap / 2, pen)
  const beamV = (x, y0, y1, pen) =>
    line(x - beamGap / 2, y0, x - beamGap / 2, y1, pen) + line(x + beamGap / 2, y0, x + beamGap / 2, y1, pen)
  for (let j = 0; j < rows; j++) out += beamH(ys[j], xs[0], xs[cols - 1], beamPen)
  out += beamV(xs[0], ys[0], ys[rows - 1], beamPen)
  out += beamV(xs[cols - 1], ys[0], ys[rows - 1], beamPen)
  out += beamV(xs[2], ys[1], ys[2], beamPen)

  /* ----- stair void with accent trimmers ----- */
  const vx0 = xs[1] + (xs[2] - xs[1]) * 0.16
  const vx1 = xs[1] + (xs[2] - xs[1]) * 0.84
  const vy0 = ys[0] + (ys[1] - ys[0]) * 0.22
  const vy1 = ys[0] + (ys[1] - ys[0]) * 0.78
  out += rect(vx0, vy0, vx1 - vx0, vy1 - vy0, { fill: '#ffffff', 'fill-opacity': 0.4 })
  out += rect(vx0, vy0, vx1 - vx0, vy1 - vy0, p.acc({ 'stroke-width': 2.2 * d.sw }))
  out += line(vx0, vy0, vx1, vy1, p.acc({ 'stroke-width': 0.7 * d.sw, 'stroke-opacity': 0.5 }))
  out += line(vx0, vy1, vx1, vy0, p.acc({ 'stroke-width': 0.7 * d.sw, 'stroke-opacity': 0.5 }))
  out += txt((vx0 + vx1) / 2, (vy0 + vy1) / 2 + 3, 'Stair void', {
    size: 6.6,
    fill: accent,
    op: 0.95,
    anchor: 'middle',
    track: 0.16,
  })

  /* ----- columns ----- */
  const cs = Math.min(box.w, box.h) * 0.014
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (i === 2 && j === 1) continue
      out += rect(xs[i] - cs / 2, ys[j] - cs / 2, cs, cs, { fill: ink, 'fill-opacity': 0.88 })
    }
  }

  /* ----- span arrow ----- */
  const sax = xs[0] + (xs[1] - xs[0]) * 0.5
  const say0 = ys[0] + 12
  const say1 = ys[1] - 12
  out += line(sax, say0, sax, say1, p.thin({ 'stroke-opacity': 0.6 }))
  out += polyEl([[sax, say0], [sax - 3.4, say0 + 7], [sax + 3.4, say0 + 7]], { fill: ink, 'fill-opacity': 0.7 })
  out += polyEl([[sax, say1], [sax - 3.4, say1 - 7], [sax + 3.4, say1 - 7]], { fill: ink, 'fill-opacity': 0.7 })
  out += txt(sax + 6, (say0 + say1) / 2, 'Joist span', { size: 6.4, fill: ink, op: 0.55, rotate: -90, anchor: 'middle' })

  /* ----- member call-outs, stacked in a notes column at the right ----- */
  const nx = ann.x0 + ann.w * 0.79
  const nyAt = (t) => ann.y0 + ann.h * t
  out += leader(d, xs[0] + (xs[1] - xs[0]) * 0.7, ys[0] + (ys[1] - ys[0]) * 0.4, nx, nyAt(0.06), '240x45 joists @ 400 c/c', { align: 'start' })
  out += leader(d, xs[2] + (xs[3] - xs[2]) * 0.5, ys[1], nx, nyAt(0.22), 'LVL 300x63 — 2 ply', { align: 'start' })
  out += leader(d, xs[3], ys[2], nx, nyAt(0.38), 'SHS 100x100x5 column', { align: 'start' })
  out += leader(d, vx1, vy0, nx, nyAt(0.54), 'Trimmer 2/240x45', { accent: true, align: 'start' })

  /* ----- grid dimension string ----- */
  out += dimChain(d, {
    axis: 'x',
    stations: xs,
    at: gy1 + over * 0.95,
    from: gy1,
    unitsPerPx: 14000 / (gx1 - gx0),
    round: 25,
  })

  out += txt(ann.x0, ann.y1 - 2, 'FRAMING PLAN — LEVEL 01', { size: 6.8, fill: ink, op: 0.42 })
  return out
}

/* ==========================================================================
   7 — CONSTRUCTION DETAIL
   ========================================================================== */

function drawDetail(d) {
  const { box, ann, ink, accent } = d
  const p = d.pen
  const idIns = d.id('ins')
  const idGrain = d.id('gr')
  const idOsb = d.id('osb')
  d.def(patCross(idIns, { gap: d.gap(7), color: ink, op: 0.16, sw: 0.5, angle: 0 }))
  d.def(patGrain(idGrain, { gap: d.gap(4.5), color: ink, op: 0.2 }))
  d.def(patAggregate(idOsb, { gap: d.gap(8), color: ink, op: 0.3 }))

  let out = sheetFrame(d)

  const layers = [
    { mm: 22, name: '22 cedar rainscreen', kind: 'board' },
    { mm: 38, name: '38 ventilated cavity', kind: 'cavity' },
    { mm: 2, name: 'Breather membrane', kind: 'membrane' },
    { mm: 12, name: '12 OSB sheathing', kind: 'osb' },
    { mm: 140, name: '140 mineral wool + studs', kind: 'insul' },
    { mm: 2, name: 'Vapour control layer', kind: 'vcl' },
    { mm: 25, name: '25 service void', kind: 'void' },
    { mm: 13, name: '12.5 plasterboard + skim', kind: 'board2' },
  ]
  const totalMm = layers.reduce((a, l) => a + l.mm, 0)
  const asmW = box.w * 0.30
  const ppm = asmW / totalMm
  const ax = box.x0 + box.w * 0.52
  const ay0 = box.y0 + box.h * 0.115
  const ay1 = box.y1 - box.h * 0.135
  const ah = ay1 - ay0

  const poche = { fill: ink, 'fill-opacity': 0.86, stroke: ink, 'stroke-width': 0.4 * d.sw, 'stroke-opacity': 0.9 }

  // floor junction band
  const fy0 = ay0 + ah * 0.46
  const fy1 = fy0 + ah * 0.135

  let x = ax
  const bounds = []
  for (const L of layers) {
    const w = L.mm * ppm
    bounds.push({ ...L, x, w })
    x += w
  }

  for (const L of bounds) {
    if (L.kind === 'board') {
      const bh = ah / Math.max(4, Math.round(ah / d.gap(box.h * 0.048)))
      for (let y = ay0; y < ay1 - 0.5; y += bh) {
        const h = Math.min(bh, ay1 - y)
        out += rect(L.x + L.w * 0.18, y, L.w * 0.82, h, { fill: ink, 'fill-opacity': 0.14 })
        out += rect(L.x + L.w * 0.18, y, L.w * 0.82, h, p.thin({ 'stroke-opacity': 0.55 }))
        out += line(L.x, y + h - 1.4, L.x + L.w * 0.18, y + h - 1.4, p.hair({ 'stroke-opacity': 0.4 }))
      }
    } else if (L.kind === 'cavity') {
      out += rect(L.x, ay0, L.w, ah, p.hair({ 'stroke-opacity': 0.3, 'stroke-dasharray': '5 4' }))
      for (let i = 0; i < 3; i++) {
        const y = ay0 + ah * (0.15 + i * 0.3)
        out += line(L.x + L.w * 0.5, y + 12, L.x + L.w * 0.5, y, p.hair({ 'stroke-opacity': 0.45 }))
        out += polyEl(
          [
            [L.x + L.w * 0.5, y - 1],
            [L.x + L.w * 0.5 - 2.4, y + 4],
            [L.x + L.w * 0.5 + 2.4, y + 4],
          ],
          { fill: ink, 'fill-opacity': 0.45 }
        )
      }
      out += rect(L.x, ay0 + ah * 0.62, L.w, ah * 0.1, p.hair({ 'stroke-opacity': 0.35, 'stroke-dasharray': '3 3' }))
    } else if (L.kind === 'membrane') {
      out += line(L.x + L.w / 2, ay0, L.x + L.w / 2, ay1, {
        fill: 'none',
        stroke: ink,
        'stroke-width': 1.3 * d.sw,
        'stroke-opacity': 0.6,
        'stroke-dasharray': '9 3.5',
      })
    } else if (L.kind === 'osb') {
      out += rect(L.x, ay0, L.w, ah, { fill: `url(#${idOsb})` })
      out += rect(L.x, ay0, L.w, ah, p.obj({ 'stroke-opacity': 0.7 }))
    } else if (L.kind === 'insul') {
      out += rect(L.x, ay0, L.w, ah, { fill: `url(#${idIns})` })
      out += rect(L.x, ay0, L.w, ah, p.obj({ 'stroke-opacity': 0.7 }))
      // mineral wool symbol — two interleaved waves
      const amp = L.w * 0.3
      const step = ah / Math.max(4, Math.round(ah / d.gap(box.h * 0.032)))
      for (let k = 0; k < 2; k++) {
        const pts = []
        for (let y = ay0; y <= ay1 + 0.1; y += step / 2) {
          const t = Math.round((y - ay0) / (step / 2))
          pts.push([L.x + L.w / 2 + (t % 2 === 0 ? -amp : amp) * (k ? -1 : 1), y])
        }
        out += pathEl(smoothPath(pts, false, 0.9), p.hair({ 'stroke-opacity': 0.32 }))
      }
      // cut stud beyond
      out += rect(L.x, fy1 + ah * 0.06, L.w, ah * 0.24, { fill: `url(#${idGrain})` })
      out += rect(L.x, fy1 + ah * 0.06, L.w, ah * 0.24, p.thin({ 'stroke-opacity': 0.45, 'stroke-dasharray': '7 4' }))
    } else if (L.kind === 'vcl') {
      out += line(L.x + L.w / 2, ay0, L.x + L.w / 2, ay1, {
        fill: 'none',
        stroke: accent,
        'stroke-width': 1.5 * d.sw,
        'stroke-opacity': 0.9,
        'stroke-dasharray': '11 4',
      })
    } else if (L.kind === 'void') {
      out += rect(L.x, ay0, L.w, ah, p.hair({ 'stroke-opacity': 0.3, 'stroke-dasharray': '5 4' }))
      out += circ(L.x + L.w / 2, ay0 + ah * 0.3, L.w * 0.3, p.hair({ 'stroke-opacity': 0.45 }))
      out += circ(L.x + L.w / 2, ay0 + ah * 0.78, L.w * 0.3, p.hair({ 'stroke-opacity': 0.45 }))
    } else {
      out += rect(L.x, ay0, L.w, ah, { fill: ink, 'fill-opacity': 0.1 })
      out += rect(L.x, ay0, L.w, ah, p.obj({ 'stroke-opacity': 0.7 }))
      out += line(L.x + L.w - 1.6, ay0, L.x + L.w - 1.6, ay1, p.hair({ 'stroke-opacity': 0.4 }))
    }
  }

  /* ----- floor junction crossing the assembly ----- */
  const insL = bounds.find((b) => b.kind === 'insul')
  const rim = { x: insL.x, w: insL.w }
  out += rect(rim.x, fy0, rim.w, fy1 - fy0, poche)
  const joistX1 = ann.x1
  out += rect(rim.x + rim.w, fy0 + (fy1 - fy0) * 0.1, joistX1 - rim.x - rim.w, (fy1 - fy0) * 0.8, {
    fill: `url(#${idGrain})`,
  })
  out += rect(rim.x + rim.w, fy0 + (fy1 - fy0) * 0.1, joistX1 - rim.x - rim.w, (fy1 - fy0) * 0.8, p.obj({ 'stroke-opacity': 0.75 }))
  // deck + finish
  out += rect(rim.x, fy0 - ah * 0.026, joistX1 - rim.x, ah * 0.026, poche)
  out += rect(rim.x, fy0 - ah * 0.042, joistX1 - rim.x, ah * 0.016, { fill: ink, 'fill-opacity': 0.2 })
  out += line(rim.x, fy0 - ah * 0.042, joistX1, fy0 - ah * 0.042, p.obj({ 'stroke-opacity': 0.7 }))
  // ceiling below
  out += rect(rim.x + rim.w, fy1, joistX1 - rim.x - rim.w, ah * 0.018, { fill: ink, 'fill-opacity': 0.12 })
  out += line(rim.x + rim.w, fy1 + ah * 0.018, joistX1, fy1 + ah * 0.018, p.thin({ 'stroke-opacity': 0.55 }))

  /* ----- fixings ----- */
  const screw = (sx, sy, len) =>
    line(sx, sy, sx + len, sy, { fill: 'none', stroke: ink, 'stroke-width': 1.5 * d.sw, 'stroke-opacity': 0.75 }) +
    circ(sx, sy, 1.5, { fill: ink, 'fill-opacity': 0.8 })
  const cl = bounds[0]
  for (let i = 0; i < 5; i++) {
    const sy = ay0 + ah * (0.1 + i * 0.2)
    out += screw(cl.x + cl.w * 0.3, sy, bounds[1].w + cl.w * 0.7)
  }
  out += screw(rim.x + rim.w * 0.2, fy0 + (fy1 - fy0) * 0.5, rim.w * 1.1)
  out += screw(rim.x + rim.w * 0.2, fy0 + (fy1 - fy0) * 0.78, rim.w * 1.1)

  /* ----- break lines ----- */
  out += breakLine(d, ax - box.w * 0.03, ay0, joistX1, ay0, box.h * 0.016)
  out += breakLine(d, ax - box.w * 0.03, ay1, ax + asmW + box.w * 0.02, ay1, box.h * 0.016)

  /* ----- dimension across the build-up ----- */
  out += dimChain(d, {
    axis: 'x',
    stations: [ax, bounds[3].x, bounds[4].x, bounds[4].x + bounds[4].w, ax + asmW],
    at: ay0 - box.h * 0.052,
    from: ay0,
    unitsPerPx: 1 / ppm,
    round: 1,
    size: 6.4,
  })

  /* ----- specification notes to the left ----- */
  const nx = box.x0 + box.w * 0.30
  const n0 = box.y0 + box.h * 0.17
  const nStep = (box.h * 0.62) / (layers.length - 1)
  for (let i = 0; i < bounds.length; i++) {
    const L = bounds[i]
    const ty = n0 + nStep * i
    out += leader(d, L.x + L.w / 2, ay0 + ah * (0.16 + (i / bounds.length) * 0.62), nx, ty, L.name, {
      accent: L.kind === 'vcl',
      size: 6.6,
      shoulder: 12,
    })
  }
  out += leader(d, rim.x + rim.w * 1.6, fy0 + (fy1 - fy0) * 0.5, nx, n0 + nStep * bounds.length, '240x45 floor joist @ 400', {
    size: 6.6,
    shoulder: 12,
  })

  out += txt(ann.x0, ann.y1 - 2, 'DETAIL 03 — INTERMEDIATE FLOOR JUNCTION', { size: 6.8, fill: ink, op: 0.42 })
  return out
}

/* ==========================================================================
   8 — CONTOUR SURVEY
   ========================================================================== */

function drawContour(d) {
  const { box, ann, rand, ink, accent, W, H } = d
  const p = d.pen
  let out = sheetFrame(d)

  const x0 = -W * 0.06
  const x1 = W * 1.06
  const samples = 16
  const count = Math.round(15 * clamp(d.density, 0.5, 1.6))
  const ph = [rand.f(0, 6.28), rand.f(0, 6.28), rand.f(0, 6.28), rand.f(0, 6.28), rand.f(0, 6.28)]
  const baseTop = -H * 0.12
  const spread = H * 1.34
  const gap = spread / Math.max(1, count - 1)
  const baseLevel = 138 + rand.i(0, 8)

  /* Two shared shape functions, each bounded to ±1, with per-contour amplitudes
     that drift slowly down the slope. Because |dA| + |dB| stays well under the
     contour spacing, adjacent contours converge and diverge — reading as steep
     and shallow ground — but can never cross, which they must not. */
  const A1 = gap * 0.62
  const dA = gap * 0.16
  const B1 = gap * 0.26
  const dB = gap * 0.09
  const shapeA = (u) =>
    0.62 * Math.sin(u * 4.1 + ph[0]) + 0.26 * Math.sin(u * 8.6 + ph[1]) + 0.12 * Math.cos(u * 15.2 + ph[2])
  const shapeB = (u) => 0.7 * Math.sin(u * 6.3 + ph[3]) + 0.3 * Math.cos(u * 11.1 + ph[4])
  const contourY = (i, u) => baseTop + gap * i + shapeA(u) * (A1 + dA * i) + shapeB(u) * (B1 + dB * i)

  for (let i = 0; i < count; i++) {
    const pts = []
    for (let k = 0; k <= samples; k++) {
      const u = k / samples
      pts.push([x0 + (x1 - x0) * u, contourY(i, u)])
    }
    const index = i % 5 === 0
    const level = (baseLevel + (count - 1 - i) * 0.5).toFixed(1)

    // an index contour is heavier and carries its level, broken into the line
    const gapAt = 4 + ((i * 3) % 8)
    const g0 = pts[gapAt]
    const g1 = pts[gapAt + 2]
    const lx = (g0[0] + g1[0]) / 2
    const ly = (g0[1] + g1[1]) / 2
    const labelFits = index && lx > ann.x0 + 24 && lx < ann.x1 - 24 && ly > ann.y0 + 10 && ly < ann.y1 - 10

    if (labelFits) {
      out += pathEl(smoothPath(pts.slice(0, gapAt + 1), false, 0.55), p.thin({ 'stroke-width': 1.5 * d.sw, 'stroke-opacity': 0.62 }))
      out += pathEl(smoothPath(pts.slice(gapAt + 2), false, 0.55), p.thin({ 'stroke-width': 1.5 * d.sw, 'stroke-opacity': 0.62 }))
      out += txt(lx, ly + 2.4, level, {
        size: 6.8,
        fill: ink,
        op: 0.7,
        anchor: 'middle',
        rotate: (Math.atan2(g1[1] - g0[1], g1[0] - g0[0]) * 180) / Math.PI,
      })
    } else if (index) {
      out += pathEl(smoothPath(pts, false, 0.55), p.thin({ 'stroke-width': 1.5 * d.sw, 'stroke-opacity': 0.62 }))
    } else {
      out += pathEl(smoothPath(pts, false, 0.55), p.hair({ 'stroke-opacity': 0.3 }))
    }
  }

  /* ----- local high point -----
     Two closed rings dropped into the gap between one pair of contours, sized
     so they sit wholly inside it. A knoll floated across the slope lines would
     read as crossing contours, which is the one thing a survey may never do. */
  const uk = rand.f(0.5, 0.72)
  const kx = x0 + (x1 - x0) * uk
  const kph = [rand.f(0, 6.28), rand.f(0, 6.28)]
  const knollMod = (a) => 1 + 0.15 * Math.sin(a * 3 + kph[0]) + 0.07 * Math.sin(a * 5 + kph[1])
  let kIndex = -1
  for (let i = 1; i < count - 1; i++) {
    const mid = (contourY(i, uk) + contourY(i + 1, uk)) / 2
    if (mid > ann.y0 + 40 && mid < ann.y1 - 70) {
      kIndex = i
      if (i >= Math.round(count * 0.38)) break
    }
  }
  if (kIndex > 0) {
    const yUp = contourY(kIndex, uk)
    const yDn = contourY(kIndex + 1, uk)
    const ky = (yUp + yDn) / 2
    const kry = (yDn - yUp) * 0.3
    const krx = kry * 2.7
    for (let r = 0; r < 2; r++) {
      const scale = 1 - r * 0.46
      const pts = []
      for (let k = 0; k < 13; k++) {
        const a = (k / 13) * Math.PI * 2
        const mod = knollMod(a) * scale
        pts.push([kx + Math.cos(a) * krx * mod, ky + Math.sin(a) * kry * mod])
      }
      out += pathEl(
        smoothPath(pts, true, 0.55),
        r === 0 ? p.thin({ 'stroke-width': 1.5 * d.sw, 'stroke-opacity': 0.6 }) : p.hair({ 'stroke-opacity': 0.36 })
      )
    }
    out += line(kx - 4, ky, kx + 4, ky, p.acc({ 'stroke-width': 0.9 * d.sw, 'stroke-opacity': 0.85 }))
    out += line(kx, ky - 4, kx, ky + 4, p.acc({ 'stroke-width': 0.9 * d.sw, 'stroke-opacity': 0.85 }))
    out += txt(kx + 7, ky - 3, (baseLevel + (count - kIndex) * 0.5 + 0.25).toFixed(2), {
      size: 6.6,
      fill: accent,
      op: 0.95,
    })
  }

  /* ----- spot levels ----- */
  const spots = Math.round(7 * clamp(d.density, 0.5, 1.6))
  for (let i = 0; i < spots; i++) {
    const sx = ann.x0 + ann.w * rand.f(0.03, 0.82)
    const sy = ann.y0 + ann.h * rand.f(0.06, 0.82)
    out += line(sx - 3.4, sy, sx + 3.4, sy, p.thin({ 'stroke-opacity': 0.55 }))
    out += line(sx, sy - 3.4, sx, sy + 3.4, p.thin({ 'stroke-opacity': 0.55 }))
    out += txt(sx + 5.4, sy - 3, (baseLevel + rand.f(0, count * 0.5)).toFixed(2), {
      size: 6.2,
      fill: ink,
      op: 0.45,
    })
  }

  out += scaleBar(d, ann.x0, ann.y1 - 26, box.w * 0.15, 'M', 4, 50)
  out += northArrow(d, ann.x1 - 30, ann.y0 + 36, Math.min(box.w, box.h) * 0.028, false)
  out += txt(ann.x0, ann.y0 + 10, 'EXISTING LEVELS · 500 CONTOUR INTERVAL', { size: 6.6, fill: ink, op: 0.45 })
  return out
}

/* ==========================================================================
   9 — SETTING-OUT GRID
   ========================================================================== */

function drawGrid(d) {
  const { W, H, ann, ink, accent } = d
  const p = d.pen
  const idFine = d.id('gf')
  const idMajor = d.id('gm')
  const m = (Math.min(W, H) / 26) / clamp(d.density, 0.45, 2.2)
  const M = m * 5
  d.def(
    tag(
      'pattern',
      { id: idFine, width: m, height: m, patternUnits: 'userSpaceOnUse' },
      line(0, 0, m, 0, { stroke: ink, 'stroke-width': 0.6, 'stroke-opacity': 0.16 }) +
        line(0, 0, 0, m, { stroke: ink, 'stroke-width': 0.6, 'stroke-opacity': 0.16 })
    )
  )
  d.def(
    tag(
      'pattern',
      { id: idMajor, width: M, height: M, patternUnits: 'userSpaceOnUse' },
      line(0, 0, M, 0, { stroke: ink, 'stroke-width': 0.9, 'stroke-opacity': 0.34 }) +
        line(0, 0, 0, M, { stroke: ink, 'stroke-width': 0.9, 'stroke-opacity': 0.34 })
    )
  )

  let out = rect(-2, -2, W + 4, H + 4, { fill: `url(#${idFine})` })
  out += rect(-2, -2, W + 4, H + 4, { fill: `url(#${idMajor})` })
  out += sheetFrame(d)

  const bubble = (x, y, s, acc) =>
    circ(x, y, 8.6, { fill: '#ffffff', 'fill-opacity': 0.45 }) +
    circ(x, y, 8.6, p.thin({ 'stroke-opacity': acc ? 0.9 : 0.5, stroke: acc ? accent : ink })) +
    txt(x, y + 2.7, s, { size: 7, fill: acc ? accent : ink, op: acc ? 0.95 : 0.7, anchor: 'middle', track: 0 })

  const ox = ann.x0 + M * 0.6
  const oy = ann.y0 + M * 0.6
  const cols = Math.max(2, Math.min(7, Math.floor((ann.x1 - ox) / M) + 1))
  const rows = Math.max(2, Math.min(5, Math.floor((ann.y1 - oy) / M) + 1))
  for (let i = 0; i < cols; i++) out += bubble(ox + i * M, ann.y0 + 10, String.fromCharCode(65 + i), i === 1)
  for (let j = 0; j < rows; j++) out += bubble(ann.x0 + 10, oy + j * M, String(j + 1), false)

  const refPen = p.hair({ 'stroke-opacity': 0.28, 'stroke-dasharray': '18 4 2 4' })
  for (let i = 0; i < cols; i++) out += line(ox + i * M, ann.y0 + 22, ox + i * M, ann.y1, refPen)
  for (let j = 0; j < rows; j++) out += line(ann.x0 + 22, oy + j * M, ann.x1, oy + j * M, refPen)

  out += dimChain(d, {
    axis: 'x',
    stations: [ox, ox + M, ox + M * 2],
    at: ann.y1 - 6,
    from: ann.y1 - 44,
    unitsPerPx: 6000 / M,
    round: 25,
    size: 6.4,
  })
  out += txt(ann.x0, ann.y1 - 2, 'SETTING OUT — 6000 GRID', { size: 6.6, fill: ink, op: 0.4 })
  return out
}

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

/**
 * Generate a complete architectural drawing as SVG markup.
 *
 * @param {'plan'|'section'|'elevation'|'axon'|'site'|'framing'|'detail'|'contour'|'grid'} kind
 * @param {object} [opts]
 * @param {number} [opts.seed=1]           deterministic seed
 * @param {string} [opts.ink='#27415A']    primary drawing ink
 * @param {string} [opts.accent='#AE4E2A'] accent, used once or twice only
 * @param {number} [opts.width=1000]       viewBox width
 * @param {number} [opts.height=700]       viewBox height
 * @param {number} [opts.density=1]        line/element density multiplier
 * @param {string} [opts.label='']         title-block project name
 * @param {string} [opts.index='']         title-block index, e.g. '04'
 * @param {boolean} [opts.showTitleBlock=true]
 * @param {number} [opts.strokeScale=1]    multiplies the 3 : 1.6 : 0.7 hierarchy
 * @param {string} [opts.className='']     extra class on the root <svg>
 * @returns {string} complete `<svg>…</svg>` markup
 */
export function drawingSVG(kind = 'plan', opts = {}) {
  const {
    seed = 1,
    ink = '#27415A',
    accent = '#AE4E2A',
    width = 1000,
    height = 700,
    density = 1,
    label = '',
    index = '',
    showTitleBlock = true,
    strokeScale = 1,
    className = '',
  } = opts || {}

  const k = KINDS[kind] ? kind : 'grid'
  const W = clamp(Number(width) || 1000, 160, 4000)
  const H = clamp(Number(height) || 700, 160, 4000)
  const sw = clamp(Number(strokeScale) || 1, 0.2, 4)
  const rand = rngOf(seed)
  const ns = nsFor([k, seed, ink, accent, Math.round(W), Math.round(H), density, label, index])

  const m = Math.min(W, H) * 0.085
  const box = { x0: m, y0: m, x1: W - m, y1: H - m, w: W - 2 * m, h: H - 2 * m }
  // Everything that must survive a `slice` crop lives inside `ann`.
  const ann = { x0: W * 0.105, y0: H * 0.105, x1: W * 0.895, y1: H * 0.895 }
  ann.w = ann.x1 - ann.x0
  ann.h = ann.y1 - ann.y0

  /* Stroke hierarchy — cut 3 : object 1.6 : hairline 0.7, times strokeScale.
     The shared half of each pen lives in a stylesheet scoped to this drawing's
     own id, which keeps a few hundred elements from repeating the same
     fill/stroke/stroke-width triple. Any call that overrides one of those
     three falls back to full presentation attributes, since a class rule would
     otherwise win over the attribute. */
  const penDefs = {
    uw1: { fill: 'none', stroke: ink, 'stroke-width': 3 * sw, 'stroke-opacity': 0.92 },
    uw2: { fill: 'none', stroke: ink, 'stroke-width': 1.6 * sw, 'stroke-opacity': 0.7 },
    uw3: { fill: 'none', stroke: ink, 'stroke-width': 0.7 * sw, 'stroke-opacity': 0.5 },
    uw4: { fill: 'none', stroke: ink, 'stroke-width': 0.7 * sw, 'stroke-opacity': 0.28 },
    uw5: { fill: 'none', stroke: accent, 'stroke-width': 1.6 * sw, 'stroke-opacity': 0.95 },
  }
  const overrides = (e) => !!e && ('stroke-width' in e || 'stroke' in e || 'fill' in e)
  const pen = (cls) => (e) =>
    overrides(e)
      ? { ...penDefs[cls], ...e }
      : { class: cls, 'stroke-opacity': penDefs[cls]['stroke-opacity'], ...e }
  const penCSS = Object.keys(penDefs)
    .map((c) => `#${ns} .${c}{fill:none;stroke:${penDefs[c].stroke};stroke-width:${f(penDefs[c]['stroke-width'])}}`)
    .join('')

  const defs = []

  const d = {
    W,
    H,
    box,
    ann,
    ink,
    accent,
    sw,
    rand,
    density: clamp(Number(density) || 1, 0.25, 3),
    id: (s) => `${ns}-${s}`,
    def: (s) => defs.push(s),
    /** Tighten or loosen a repeat spacing (hatch pitch, board width, centres). */
    gap: (g) => g / clamp(Number(density) || 1, 0.5, 2),
    pen: {
      cut: pen('uw1'),
      obj: pen('uw2'),
      thin: pen('uw3'),
      hair: pen('uw4'),
      acc: pen('uw5'),
    },
    meta: null,
  }

  const sheet = SHEET[k]
  const elevTitles = ['NORTH ELEVATION', 'WEST ELEVATION', 'SOUTH ELEVATION', 'EAST ELEVATION']
  d.meta = {
    label: label || '',
    index: index || '',
    rev: 'REV ' + String.fromCharCode(65 + (Math.abs(Math.round(Number(seed) || 1)) % 4)),
    sheet: sheet.no + pad(1 + (Math.abs(Math.round(Number(seed) || 1)) % 12), 2),
    scale: sheet.scale,
    title: k === 'elevation' ? elevTitles[Math.abs(Math.round(Number(seed) || 1)) % 4] : sheet.title,
  }

  let body = KINDS[k](d)
  if (showTitleBlock) body += titleBlock(d)

  return (
    `<svg xmlns="${SVG_NS}" id="${ns}" viewBox="0 0 ${f(W)} ${f(H)}" width="100%" height="100%"` +
    ` preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" role="presentation"` +
    ` class="uhd-dwg${className ? ' ' + esc(className) : ''}">` +
    `<style>${DWG_STYLE}${penCSS}</style>` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    `<g vector-effect="non-scaling-stroke" shape-rendering="geometricPrecision" stroke-linecap="butt">${body}</g>` +
    `</svg>`
  )
}

/* --------------------------------------------------------------- GRAIN */

const grainCache = new Map()

/**
 * Monochrome paper-tooth noise as a cached data: URI.
 * RGB is held constant so only the alpha channel carries entropy — that keeps
 * the PNG (and therefore the inline markup) an order of magnitude smaller than
 * full RGB noise, which does not compress at all.
 *
 * @param {number} [size=128] tile size in px
 * @param {number} [alpha=0.5] peak opacity of the tooth
 * @param {number} [seed=3] deterministic seed
 * @returns {string} data: URI
 */
export function grainDataURI(size = 128, alpha = 0.5, seed = 3) {
  const s = Math.round(clamp(Number(size) || 128, 8, 512))
  const a = clamp(Number(alpha) === 0 ? 0 : Number(alpha) || 0.5, 0, 1)
  const sd = Math.abs(Math.round(Number(seed) || 3)) || 3
  const key = `${s}|${a}|${sd}`
  const cached = grainCache.get(key)
  if (cached) return cached

  let uri = ''
  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas')
      canvas.width = s
      canvas.height = s
      const g2d = canvas.getContext('2d')
      if (g2d) {
        const img = g2d.createImageData(s, s)
        const px = img.data
        const r = mulberry32(sd * 7919 + s)
        let prev = 0.5
        for (let i = 0; i < s * s; i++) {
          const raw = r()
          const v = raw < 0.36 ? prev : raw // slight clumping reads as paper, not static
          prev = v
          const o = i * 4
          px[o] = 52
          px[o + 1] = 46
          px[o + 2] = 38
          px[o + 3] = (Math.round(255 * a * v) >> 4) << 4 // quantised — compresses far better
        }
        g2d.putImageData(img, 0, 0)
        uri = canvas.toDataURL('image/png')
      }
    }
  } catch {
    uri = ''
  }
  if (!uri) uri = turbulenceURI(s, a)
  grainCache.set(key, uri)
  return uri
}

function turbulenceURI(size, alpha) {
  const svg =
    `<svg xmlns="${SVG_NS}" width="${size}" height="${size}">` +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>` +
    `<rect width="100%" height="100%" filter="url(#n)" opacity="${f(alpha * 0.7)}"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/* ---------------------------------------------------------------- PLATE */

function parseRatio(ratio) {
  if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) return ratio
  const s = String(ratio || '').trim()
  const mm = s.match(/^(\d*\.?\d+)\s*[/:]\s*(\d*\.?\d+)$/)
  if (mm) {
    const a = parseFloat(mm[1])
    const b = parseFloat(mm[2])
    if (a > 0 && b > 0) return a / b
  }
  const n = parseFloat(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Full markup for an art plate that fills its container.
 *
 * @param {object} plate  { kind, a, b, ink, accent, seed } — the shape stored
 *                        on every record in src/data/projects.js
 * @param {object} [opts] { label, index, caption, showTitleBlock, ratio,
 *                          density, strokeScale, width, height, className }
 * @returns {string} `<div class="plate">…</div>` markup
 */
export function plateHTML(plate = {}, opts = {}) {
  const pl = plate || {}
  const o = opts || {}
  const kind = KINDS[pl.kind] ? pl.kind : 'plan'
  const ink = pl.ink || '#27415A'
  const accent = pl.accent || '#AE4E2A'
  const seed = pl.seed === undefined ? 1 : pl.seed

  // A ratio reshapes the viewBox so the drawing is composed for the frame it
  // will fill, rather than being hard-cropped by `slice`.
  const ar = parseRatio(o.ratio)
  const width = Number(o.width) || 1000
  const height = Number(o.height) || clamp(Math.round(width / (ar || 10 / 7)), 420, 1600)

  const svg = drawingSVG(kind, {
    seed,
    ink,
    accent,
    width,
    height,
    density: o.density === undefined ? 1 : o.density,
    label: o.label || '',
    index: o.index || '',
    showTitleBlock: o.showTitleBlock !== false,
    strokeScale: o.strokeScale === undefined ? 1 : o.strokeScale,
    className: 'plate__svg',
  })

  const styles = []
  if (pl.a) styles.push(`--plate-a:${cssSafe(pl.a)}`)
  if (pl.b) styles.push(`--plate-b:${cssSafe(pl.b)}`)
  if (ar) styles.push(`aspect-ratio:${f(Math.round(ar * 10000) / 10000)}`)

  const grain = grainDataURI(96, 0.52, 3)
  const noiseStyle = `background-image:url(${grain});background-repeat:repeat;background-size:96px 96px`

  const caption = o.caption
    ? `<div class="plate__caption" style="position:absolute;left:0;bottom:0;z-index:2;padding:0.5rem 0.8rem;` +
      `font-family:var(--ff-mono);font-size:var(--fs-2xs);letter-spacing:var(--tr-wider);text-transform:uppercase;` +
      `line-height:1;color:${withAlpha(ink, 0.78)};background:rgb(255 255 255 / 0.6)">${esc(o.caption)}</div>`
    : ''

  return (
    `<div class="plate${o.className ? ' ' + esc(o.className) : ''}"${styles.length ? ` style="${styles.join(';')}"` : ''}>` +
    svg +
    `<div class="plate__glow"></div>` +
    `<div class="plate__noise" style="${noiseStyle}"></div>` +
    caption +
    `</div>`
  )
}

/**
 * Render a plate into an element. No-op when the element is missing.
 *
 * @param {Element|null} el
 * @param {object} [plate] see plateHTML
 * @param {object} [opts]  see plateHTML
 */
export function mountPlate(el, plate = {}, opts = {}) {
  if (!el) return
  el.innerHTML = plateHTML(plate, opts)
}

/**
 * A repeating-linear-gradient stack for setting-out grid backgrounds.
 * Returns a bare CSS value — assign it to `background-image`.
 *
 * @param {object} [opts]
 * @param {number} [opts.size=28]        fine module in px
 * @param {number} [opts.major=5]        modules per major line
 * @param {number} [opts.thickness=1]    line thickness in px
 * @param {string} [opts.color]          fine line colour
 * @param {string} [opts.majorColor]     major line colour
 * @param {number} [opts.angle=0]        rotation of the whole grid in degrees
 * @returns {string} CSS background-image value
 */
export function blueprintBackgroundCSS(opts = {}) {
  const {
    size = 28,
    major = 5,
    thickness = 1,
    color = 'color-mix(in oklab, var(--fg) 7%, transparent)',
    majorColor = 'color-mix(in oklab, var(--fg) 14%, transparent)',
    angle = 0,
  } = opts || {}
  const m = Math.max(4, Number(size) || 28)
  const M = m * Math.max(2, Math.round(Number(major) || 5))
  const t = Math.max(0.5, Number(thickness) || 1)
  const a = Number(angle) || 0
  return [
    `repeating-linear-gradient(${f(90 + a)}deg, ${majorColor} 0 ${f(t)}px, transparent ${f(t)}px ${f(M)}px)`,
    `repeating-linear-gradient(${f(a)}deg, ${majorColor} 0 ${f(t)}px, transparent ${f(t)}px ${f(M)}px)`,
    `repeating-linear-gradient(${f(90 + a)}deg, ${color} 0 ${f(t)}px, transparent ${f(t)}px ${f(m)}px)`,
    `repeating-linear-gradient(${f(a)}deg, ${color} 0 ${f(t)}px, transparent ${f(t)}px ${f(m)}px)`,
  ].join(', ')
}
