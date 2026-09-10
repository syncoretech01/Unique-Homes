/* ============================================================================
   ARCHITECTURAL MODEL LIBRARY
   Shared, parameterised, deterministic 3D content for every WebGL section on
   the site: the hero scene, the exploded-assembly scene and the 3D project
   slider all pull their geometry from here so the whole 3D layer reads as one
   building world.

   Nothing in this module touches the renderer, the stage or the DOM layout —
   it returns plain THREE.Object3D trees. Materials and textures come from
   ./materials.js so the palette stays consistent; textures there are cached
   module-wide, so `dispose()` here frees geometries and materials only and
   deliberately leaves the shared texture cache alone.

   ---------------------------------------------------------------------------
   THE HOUSE — a modern courtyard house on a 1.8-unit structural bay grid.
   1 world unit ≈ 1 metre. Origin is the centre of the plan; finished ground
   level is y = 0.

   PLAN (looking down, −Z is "north" / the street, +Z is the garden)

        x −6.0            0.0             +6.0
         ┌────────────────────────────────────┐  z −4.0  roof edge
         │  ┌──────────────┬──────────────┐   │  z −3.4  wall face
         │  │              │              │   │
         │  │   BLOCK A    │   BLOCK B    │   │          north bar
         │  │  two storey  │  one storey  │   │          (10.8 × 3.4)
         │  │  concrete    │  glazed      │   │
         │  └──────────────┴──────────────┘   │  z  0.0
         │  ┌────────┐                        │
         │  │ WING C │      C O U R T Y A R D │          7.6 × 3.4
         │  │ 1 stor.│                        │
         │  └────────┘─ ─ ─ garden wall ─ ─ ─ │  z +3.4
         └────────────────────────────────────┘  z +4.0  roof edge

   SECTION (levels, in world units)
        7.00  roof plate top (Block A)
        6.74  level 2 ceiling            ┐ 2.96 clear
        3.78  level 2 finished floor     ┘
        3.50  level 1 ceiling            ┐ 3.00 clear
        0.50  level 1 finished floor     ┘ (plinth top)
        0.00  finished ground level
       −0.55  pier toe

   The walled envelope is 10.8 × 6.8; with the 0.6 eave the building reads as
   12 × 8 in plan and 7 tall — call buildHouse({ withSite: false }) for exactly
   that bounding box (12.1 × 7.8 × 8.1, the extra height being the pier toes).
   With the site plate on (the default) `bounds` grows to roughly 17 × 8 × 13.5
   — the 14.8 × 10.6 graded plate plus tree canopies overhanging the plot line.
   ========================================================================== */
import * as THREE from 'three'
import { gsap, EASE } from '../motion.js'
import { mulberry32, clamp } from '../../lib/utils.js'
import {
  lightingRig,
  concreteMaterial,
  glassMaterial,
  glassLiteMaterial,
  timberMaterial,
  metalMaterial,
  accentMaterial,
  plasterMaterial,
  shadowCatcher,
  fakeShadow,
  edgeOverlay,
  roundedBox,
  gridTexture,
  concreteTexture,
  PAL,
  color,
} from './materials.js'

/* ==========================================================================
   1 — DIMENSIONS
   Every number the house is built from lives here so the three consuming
   sections stay dimensionally identical.
   ========================================================================== */

const P = {
  /* plan — walled footprint */
  wx0: -5.4, wx1: 5.4, // 10.8 long
  wz0: -3.4, wz1: 3.4, // 6.8 deep (north bar + south-west return)
  barZ1: 0.0, //          north bar stops here; courtyard beyond
  splitX: 0.0, //         Block A | Block B party line
  wingX1: -2.2, //        Wing C east face (courtyard edge)

  /* levels */
  ground: 0.0,
  plinth: 0.5, //         level 1 finished floor
  l1Ceil: 3.5,
  l2Floor: 3.78,
  l2Ceil: 6.74,
  roofTop: 7.0,
  lowRoofTop: 4.0, //     single-storey roof plate top
  pierToe: -0.55,

  /* construction */
  wall: 0.28, //          wall thickness
  eave: 0.6, //           roof overhang
  slab: 0.26, //          roof slab thickness
  bay: 1.8, //            structural bay
  col: 0.24, //           timber column section
  mull: 0.055, //         glazing mullion width
  frame: 0.09, //         glazing frame depth
  reveal: 0.06, //        shadow gap

  /* site */
  padW: 14.8, padD: 10.6,
  terraceW: 12.6, terraceD: 9.0,
  padY0: -0.32, padY1: -0.14,
}

/* The stair well is shared geometry: the structure part trims its joists
   around it, the interior part builds the flight and the floor opening, and
   the roof part sets a rooflight over it. 13 risers of 252 mm on a 307 mm
   going — 39°, steep enough to read as a sculptural flight, shallow enough to
   be believable. */
const STAIR = {
  risers: 13,
  x0: -5.04, //   foot of the flight, against the west wall
  x1: -1.05, //   head of the flight, where it meets the level-2 floor edge
  z: -2.775, //   centre line of the flight
  width: 1.15,
  voidZ1: -2.15, // south edge of the opening in the level-2 floor plate
}

/* Layer metadata for the exploded assembly, bottom of the build-up upwards.
   `order` sequences the timeline; `dist` is how far the layer flies along
   `dir`, which is why the roof travels furthest and the site drops away. */
const LAYERS = {
  site: {
    label: 'Site & grading',
    code: 'S-01',
    info: 'Graded plate with a 150 mm contour step, setting-out grid and the driveway approach.',
    dir: [0, -1, 0],
    dist: 2.6,
    order: 0,
  },
  foundation: {
    label: 'Foundation',
    code: 'F-02',
    info: 'Insulated raft on perimeter edge beams and mass-concrete piers.',
    dir: [0, -1, 0],
    dist: 0.95,
    order: 1,
  },
  structure: {
    label: 'Structure',
    code: 'ST-03',
    info: 'Exposed oak post-and-beam frame on a 1.8 m bay grid, with joists and rafters.',
    dir: [0, 1, 0],
    dist: 1.6,
    order: 2,
  },
  envelope: {
    label: 'Envelope',
    code: 'EN-04',
    info: 'Board-formed concrete blades with rendered plaster infill panels.',
    dir: [0, 1, 0],
    dist: 4.1,
    order: 3,
  },
  glazing: {
    label: 'Glazing',
    code: 'GL-05',
    info: 'Full-height low-iron glazing on 55 mm blackened steel mullions.',
    dir: [0.34, 1, 0.16],
    dist: 5.8,
    order: 4,
  },
  roof: {
    label: 'Roof',
    code: 'RF-06',
    info: 'Warm-deck roof plate, 600 mm eave, timber soffit and a steel fascia edge.',
    dir: [0, 1, 0],
    dist: 7.6,
    order: 5,
  },
  interior: {
    label: 'Interior',
    code: 'IN-07',
    info: 'Floor plates, feature stair, service core and loose furniture.',
    dir: [-0.18, 1, 0.1],
    dist: 2.7,
    order: 6,
  },
  landscape: {
    label: 'Landscape',
    code: 'LS-08',
    info: 'Courtyard planting, specimen trees and a low garden wall.',
    dir: [-0.42, -0.12, 0.9],
    dist: 3.4,
    order: 7,
  },
}

/* ==========================================================================
   2 — SMALL HELPERS
   ========================================================================== */

const r3 = (v) => Math.round(v * 1000) / 1000
const mid = (a, b) => (a + b) / 2
const span = (a, b) => Math.abs(b - a)

/** Recursively set shadow flags on a subtree. */
function shade(root, cast = true, receive = true) {
  root.traverse((o) => {
    if (!o.isMesh) return
    o.castShadow = cast
    o.receiveShadow = receive
  })
  return root
}

/**
 * Geometry / material book-keeper. Box geometries are memoised by dimension so
 * ninety-odd framing members share a handful of buffers, and everything is
 * disposable in one call.
 */
class Kit {
  constructor() {
    this.boxes = new Map()
    this.loose = new Set()
    this.mats = new Set()
  }

  /** Memoised BoxGeometry. */
  box(w, h, d) {
    const key = `${r3(w)}:${r3(h)}:${r3(d)}`
    let g = this.boxes.get(key)
    if (!g) {
      g = new THREE.BoxGeometry(Math.max(w, 1e-4), Math.max(h, 1e-4), Math.max(d, 1e-4))
      this.boxes.set(key, g)
    }
    return g
  }

  /** Register a one-off geometry (extrusions, cylinders) for disposal. */
  track(geo) {
    this.loose.add(geo)
    return geo
  }

  /** Register a material for disposal. */
  own(mat) {
    this.mats.add(mat)
    return mat
  }

  mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }

  /** A box described by its extents — code reads like a setting-out drawing. */
  slab(mat, x0, x1, y0, y1, z0, z1) {
    return this.mesh(
      this.box(span(x0, x1), span(y0, y1), span(z0, z1)),
      mat,
      mid(x0, x1),
      mid(y0, y1),
      mid(z0, z1)
    )
  }

  dispose() {
    for (const g of this.boxes.values()) g.dispose()
    for (const g of this.loose) g.dispose()
    for (const m of this.mats) m.dispose()
    this.boxes.clear()
    this.loose.clear()
    this.mats.clear()
  }
}

/** Dispose every geometry and material under a subtree exactly once. */
function disposeSubtree(root) {
  const geos = new Set()
  const mats = new Set()
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry)
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    list.forEach((m) => mats.add(m))
  })
  geos.forEach((g) => g.dispose())
  mats.forEach((m) => m.dispose())
}

/** Tag a part group with everything the exploded view needs to fly it apart. */
function tagPart(group, key) {
  const meta = LAYERS[key]
  group.name = `part:${key}`
  group.userData = {
    key,
    label: meta.label,
    code: meta.code,
    info: meta.info,
    explodeDir: new THREE.Vector3(...meta.dir).normalize(),
    explodeDist: meta.dist,
    order: meta.order,
  }
  return group
}

/* ==========================================================================
   3 — THE HOUSE
   ========================================================================== */

/**
 * Build the courtyard house.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.seed=1]           deterministic variation
 * @param {'low'|'mid'|'high'} [opts.tier='high']
 * @param {number}  [opts.detail=1]         density multiplier for framing / planting
 * @param {boolean} [opts.withSite=true]    graded ground plate + landscape
 * @param {boolean} [opts.withInterior=true]
 * @param {number}  [opts.accent=PAL.terra] accent colour for the entrance door etc.
 * @param {THREE.Scene} [opts.scene]        optional: add the house and a lighting rig
 * @param {boolean} [opts.lights=true]      only relevant when `scene` is given
 * @returns {{ group: THREE.Group, parts: Object<string,THREE.Group>, bounds: THREE.Box3, dispose: () => void }}
 */
export function buildHouse(opts = {}) {
  const {
    seed = 1,
    tier = 'high',
    detail = 1,
    withSite = true,
    withInterior = true,
    accent = PAL.terra,
    scene = null,
    lights = true,
  } = opts

  const low = tier === 'low'
  const den = clamp(detail, 0.35, 2) * (low ? 0.5 : 1)
  const rnd = mulberry32(Math.floor(seed) || 1)
  const kit = new Kit()

  /* Every seeded decision is taken here, up front, so the same seed always
     produces the same house no matter which parts are switched off. */
  const V = {
    finPitch: 0.4 + rnd() * 0.08,
    bedShift: (rnd() - 0.5) * 0.7,
    driveShift: (rnd() - 0.5) * 0.45,
    treeSeed: 1 + Math.floor(rnd() * 9973),
  }

  const group = new THREE.Group()
  group.name = 'house'

  /* ------------------------------------------------------------ MATERIALS
     Textures inside materials.js are cached module-wide, so anything that
     needs its own tiling gets a cloned map. Clones are tracked and freed by
     dispose(); the shared originals are deliberately left alone. */
  const texClones = []
  const cloneMap = (src, rx, ry = rx) => {
    const t = src.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rx, ry)
    texClones.push(t)
    return t
  }

  /* timberMaterial() mutates the shared oak texture's repeat, so take one
     material and give each variant its own map. */
  const timberSrc = timberMaterial(1)
  const timberVariant = (rep) => {
    const m = timberSrc.clone()
    m.map = cloneMap(timberSrc.map, rep)
    return kit.own(m)
  }

  const M = {
    concrete: kit.own(concreteMaterial()),
    concreteWarm: kit.own(concreteMaterial({ color: 0xcfc7b8 })),
    plaster: kit.own(plasterMaterial(PAL.paper)),
    plasterWarm: kit.own(plasterMaterial(PAL.bone)),
    plasterSoft: kit.own(plasterMaterial(PAL.shell)),
    timber: timberVariant(1.4),
    timberFine: timberVariant(3),
    steel: kit.own(metalMaterial(0x2b2724, 0.32)),
    steelPale: kit.own(metalMaterial(0x6a6459, 0.44)),
    accent: kit.own(accentMaterial(accent)),
    glass: kit.own(low ? glassLiteMaterial() : glassMaterial()),
    stone: kit.own(
      new THREE.MeshStandardMaterial({ color: color(PAL.stone), roughness: 0.95, metalness: 0 })
    ),
    moss: kit.own(
      new THREE.MeshStandardMaterial({ color: color(PAL.moss), roughness: 0.98, metalness: 0 })
    ),
    fabric: kit.own(
      new THREE.MeshStandardMaterial({ color: color(0xb9ac97), roughness: 0.96, metalness: 0 })
    ),
  }
  timberSrc.dispose()

  /* Ground surfaces: the setting-out grid on the terrace, board-formed
     concrete on the driveway. */
  const terraceMat = kit.own(
    new THREE.MeshStandardMaterial({
      color: color(PAL.bone),
      map: cloneMap(gridTexture(1024, 32, '#27415a', '#efeae0'), 6, 4.4),
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.6,
    })
  )

  const driveMap = cloneMap(concreteTexture(), 1.2, 3)
  const driveMat = kit.own(
    new THREE.MeshStandardMaterial({
      color: color(PAL.sand),
      roughnessMap: driveMap,
      bumpMap: driveMap,
      bumpScale: 0.2,
      roughness: 0.92,
      metalness: 0,
    })
  )

  /* Sub-builders own materials that may not end up on a mesh (unused canopy
     tones, say), so keep their disposers. */
  const subDisposers = []

  /* ======================================================== PART: SITE ====
     A lower outer apron, a raised terrace whose edge reads as a single
     contour step, and a driveway running in from the east. */
  const site = tagPart(new THREE.Group(), 'site')
  if (withSite) {
    const px = P.padW / 2
    const pz = P.padD / 2
    const tx = P.terraceW / 2
    const tz = P.terraceD / 2

    const pad = kit.slab(M.stone, -px, px, P.padY0, P.padY1, -pz, pz)
    pad.castShadow = false
    site.add(pad)

    const terrace = kit.slab(terraceMat, -tx, tx, P.padY1, P.ground, -tz, tz)
    terrace.castShadow = false
    site.add(terrace)

    /* A second, shallower step at the garden end — the grade falls away. */
    const step = kit.slab(M.stone, -tx + 0.9, tx - 0.9, P.padY1 - 0.07, P.padY1 + 0.005, tz - 1.4, pz - 0.35)
    step.castShadow = false
    site.add(step)

    /* Driveway: a forecourt on the terrace in front of the north elevation,
       then the run out across the lower apron to the street edge. */
    const dx = 4.2 + V.driveShift
    const forecourt = kit.slab(driveMat, 0.4, P.wx1, P.ground - 0.03, P.ground + 0.004, -tz, P.wz0 - 0.16)
    forecourt.castShadow = false
    site.add(forecourt)
    const driveRun = kit.slab(driveMat, dx - 0.9, dx + 0.9, P.padY1 - 0.03, P.padY1 + 0.006, -pz, -tz)
    driveRun.castShadow = false
    site.add(driveRun)

    /* Entry threshold: a single wide step up to the accent door. */
    const step2 = kit.slab(M.stone, 1.4, 2.7, P.ground, P.ground + 0.17, P.wz0 - 0.62, P.wz0 - 0.16)
    step2.castShadow = false
    site.add(step2)

    shade(site, false, true)
  }
  group.add(site)

  /* ================================================== PART: FOUNDATION ====
     Raft plinth (projecting 160 mm past the wall line so the building sits on
     a base), perimeter edge beams and a run of piers. */
  const foundation = tagPart(new THREE.Group(), 'foundation')
  {
    const o = 0.16 // plinth projection
    const barSlab = kit.slab(M.concreteWarm, P.wx0 - o, P.wx1 + o, P.ground, P.plinth, P.wz0 - o, P.barZ1 + o)
    foundation.add(barSlab)
    const wingSlab = kit.slab(M.concreteWarm, P.wx0 - o, P.wingX1 + o, P.ground, P.plinth, P.barZ1, P.wz1 + o)
    foundation.add(wingSlab)

    /* Edge beams read as a recessed shadow line under the plinth nose. */
    const eb = 0.22
    const beams = [
      [P.wx0, P.wx1, P.wz0, P.wz0 + eb],
      [P.wx0, P.wx1, P.barZ1 - eb, P.barZ1],
      [P.wx0, P.wx0 + eb, P.wz0, P.wz1],
      [P.wx1 - eb, P.wx1, P.wz0, P.barZ1],
      [P.wingX1 - eb, P.wingX1, P.barZ1, P.wz1],
      [P.wx0, P.wingX1, P.wz1 - eb, P.wz1],
    ]
    for (const [x0, x1, z0, z1] of beams) {
      foundation.add(kit.slab(M.concrete, x0, x1, P.ground - 0.34, P.ground + 0.02, z0, z1))
    }

    /* Piers — set out on the column grid, cut back on low tier. */
    const pierSpots = [
      [-5.0, -3.0], [-1.8, -3.0], [1.8, -3.0], [5.0, -3.0],
      [-5.0, -0.4], [-1.8, -0.4], [1.8, -0.4], [5.0, -0.4],
      [-5.0, 2.9], [-2.6, 2.9],
    ]
    const pierCount = Math.max(4, Math.round(pierSpots.length * clamp(den, 0.4, 1)))
    const pierGeo = kit.track(new THREE.CylinderGeometry(0.24, 0.3, span(P.pierToe, P.ground) + 0.1, low ? 6 : 10))
    for (let i = 0; i < pierCount; i++) {
      const [x, z] = pierSpots[i]
      foundation.add(kit.mesh(pierGeo, M.concrete, x, mid(P.pierToe, P.ground) - 0.05, z))
    }
    shade(foundation, true, true)
  }
  group.add(foundation)

  /* =================================================== PART: STRUCTURE ====
     Oak post-and-beam on a 1.8 bay grid. Columns, a spine beam each side of
     the bar, level-1 joists over Block A, and rafters over the single-storey
     wings that run out to express under the eave. */
  const structure = tagPart(new THREE.Group(), 'structure')
  {
    const inset = P.col / 2 + 0.01
    const colGeo = kit.box(P.col, span(P.plinth, P.l1Ceil), P.col)
    const colGeoUpper = kit.box(P.col, span(P.l2Floor, P.l2Ceil), P.col)

    /* Column grid — seven lines across the bar, two grid lines in depth. */
    const gridX = []
    for (let i = 0; i <= 6; i++) {
      let x = P.wx0 + i * P.bay
      if (i === 0) x += inset
      if (i === 6) x -= inset
      gridX.push(x)
    }
    const gridZ = [P.wz0 + inset, P.barZ1 - inset]

    for (const x of gridX) {
      for (const z of gridZ) {
        structure.add(kit.mesh(colGeo, M.timber, x, mid(P.plinth, P.l1Ceil), z))
        /* Upper storey posts only over Block A. */
        if (x <= P.splitX + 0.3) {
          structure.add(kit.mesh(colGeoUpper, M.timber, x, mid(P.l2Floor, P.l2Ceil), z))
        }
      }
    }

    /* Wing C posts. */
    const wingX = [P.wx0 + inset, P.wingX1 - inset]
    const wingZ = [P.barZ1 + 0.5, P.wz1 - inset]
    for (const x of wingX) {
      for (const z of wingZ) {
        structure.add(kit.mesh(colGeo, M.timber, x, mid(P.plinth, P.l1Ceil), z))
      }
    }

    /* Spine beams — deep members carrying the bar in both directions. */
    const bh = 0.36
    structure.add(kit.slab(M.timber, P.wx0, P.wx1, P.l1Ceil - 0.02, P.l1Ceil - 0.02 + bh, gridZ[0] - 0.13, gridZ[0] + 0.13))
    structure.add(kit.slab(M.timber, P.wx0, P.wx1, P.l1Ceil - 0.02, P.l1Ceil - 0.02 + bh, gridZ[1] - 0.13, gridZ[1] + 0.13))
    structure.add(kit.slab(M.timber, P.wx0, P.wingX1, P.l1Ceil - 0.02, P.l1Ceil - 0.02 + bh, P.wz1 - 0.26, P.wz1))
    /* Ridge beam over the two-storey block. */
    structure.add(kit.slab(M.timber, P.wx0, P.splitX + 0.2, P.l2Ceil - 0.3, P.l2Ceil, -1.83, -1.57))

    /* Level-1 joists over Block A. They stop short of the stair well, which
       is trimmed by a beam along its south edge (see STAIR in the interior). */
    const joistPitch = 0.62 / clamp(den, 0.4, 1.6)
    const jz0 = STAIR.voidZ1 + 0.05
    const jz1 = P.barZ1 - 0.15
    const joistGeo = kit.box(0.1, 0.28, span(jz0, jz1))
    for (let x = P.wx0 + 0.5; x < P.splitX; x += joistPitch) {
      structure.add(kit.mesh(joistGeo, M.timberFine, x, P.l1Ceil + 0.14, mid(jz0, jz1)))
    }
    /* Trimmer beam along the stair well. */
    structure.add(
      kit.slab(M.timber, P.wx0, P.splitX + 0.2, P.l1Ceil, P.l2Floor + 0.04, STAIR.voidZ1 - 0.13, STAIR.voidZ1 + 0.13)
    )

    /* Rafters over Block B and Wing C. They sit in the 240 mm zone between the
       glazing head and the underside of the roof slab, and run right out to
       the eave so the tails are exposed under the overhang. */
    const rafPitch = 0.66 / clamp(den, 0.4, 1.6)
    const rafH = P.lowRoofTop - P.slab - P.l1Ceil // 0.24
    const rafY = mid(P.l1Ceil, P.lowRoofTop - P.slab)
    const rafGeoB = kit.box(0.09, rafH, span(P.wz0 - P.eave, P.barZ1 + P.eave))
    for (let x = P.splitX + 0.45; x < P.wx1; x += rafPitch) {
      structure.add(kit.mesh(rafGeoB, M.timberFine, x, rafY, mid(P.wz0 - P.eave, P.barZ1 + P.eave)))
    }
    const rafGeoC = kit.box(0.09, rafH, span(P.barZ1, P.wz1 + P.eave))
    for (let x = P.wx0 + 0.45; x < P.wingX1; x += rafPitch) {
      structure.add(kit.mesh(rafGeoC, M.timberFine, x, rafY, mid(P.barZ1, P.wz1 + P.eave)))
    }
    shade(structure, true, true)
  }
  group.add(structure)

  /* ==================================================== PART: ENVELOPE ====
     Board-formed concrete does the heavy lifting on the exposed north and
     west elevations; rendered plaster panels infill the sheltered faces. Two
     free-standing blades push out into the courtyard. */
  const envelope = tagPart(new THREE.Group(), 'envelope')
  {
    const w = P.wall
    const top1 = P.l1Ceil
    const top2 = P.l2Ceil

    /* Openings in the two-storey shell. Nothing here is booleaned — walls are
       built as the solid pieces left over around each opening, which is both
       cheaper and how the drawings read anyway. */
    const opTop = P.l2Ceil - 0.42 // head of the level-2 openings
    const opBot = P.l2Floor + 0.32 // sill of the level-2 openings

    /* Block A — north elevation, full-height board-formed concrete. */
    envelope.add(kit.slab(M.concrete, P.wx0, P.splitX + 0.2, P.plinth, top2, P.wz0, P.wz0 + w))

    /* Block A — west elevation, with a tall slot for the stair light (G6). */
    envelope.add(kit.slab(M.concrete, P.wx0, P.wx0 + w, P.plinth, top2, P.wz0, -2.55))
    envelope.add(kit.slab(M.concrete, P.wx0, P.wx0 + w, P.plinth, top2, -1.35, P.barZ1))
    envelope.add(kit.slab(M.concrete, P.wx0, P.wx0 + w, P.plinth, opBot, -2.55, -1.35))
    envelope.add(kit.slab(M.concrete, P.wx0, P.wx0 + w, opTop, top2, -2.55, -1.35))

    /* Level-2 volume cantilevers 200 mm over Block B and the courtyard; its
       south face is a glazed band (G5) between a sill band and a head band. */
    envelope.add(kit.slab(M.plasterWarm, P.wx0, P.splitX + 0.2, P.l2Floor - 0.06, opBot, P.barZ1, P.barZ1 + 0.2))
    envelope.add(kit.slab(M.plasterWarm, P.wx0, P.splitX + 0.2, opTop, top2, P.barZ1, P.barZ1 + 0.2))
    envelope.add(kit.slab(M.plasterWarm, P.wx0, -5.05, opBot, opTop, P.barZ1, P.barZ1 + 0.2))
    envelope.add(kit.slab(M.plasterWarm, -0.15, P.splitX + 0.2, opBot, opTop, P.barZ1, P.barZ1 + 0.2))
    /* Level-2 east flank, overhanging the pavilion roof. */
    envelope.add(kit.slab(M.plasterWarm, P.splitX - 0.08, P.splitX + 0.2, P.l2Floor - 0.06, top2, P.wz0, P.barZ1 + 0.2))

    /* Solid returns flanking the level-1 courtyard glazing (G1). */
    envelope.add(kit.slab(M.concrete, P.wx0, -3.9, P.plinth, top1, P.barZ1 - w, P.barZ1))
    envelope.add(kit.slab(M.plaster, -0.75, P.splitX + 0.2, P.plinth, top1, P.barZ1 - w, P.barZ1))

    /* Block B — single-storey pavilion: plaster to the street, glass elsewhere. */
    envelope.add(kit.slab(M.plaster, P.splitX, P.wx1, P.plinth, top1, P.wz0, P.wz0 + w))
    envelope.add(kit.slab(M.plaster, P.wx1 - w, P.wx1, P.plinth, top1, P.wz0, -3.05))
    envelope.add(kit.slab(M.plaster, P.wx1 - w, P.wx1, P.plinth, top1, -0.42, P.barZ1))
    /* Upstand under the low roof, tying the pavilion back to the bar. */
    envelope.add(kit.slab(M.plasterSoft, P.splitX, P.wx1, top1, top1 + 0.24, P.wz0, P.wz0 + w))

    /* Wing C — concrete to the west boundary, plaster to the south; the
       courtyard face is glazed (G4) between the south return and the bar. */
    envelope.add(kit.slab(M.concrete, P.wx0, P.wx0 + w, P.plinth, top1, P.barZ1, P.wz1))
    envelope.add(kit.slab(M.plaster, P.wx0, P.wingX1, P.plinth, top1, P.wz1 - w, P.wz1))
    envelope.add(kit.slab(M.plaster, P.wingX1 - w, P.wingX1, P.plinth, top1, P.wz1 - 1.1, P.wz1))

    /* Free-standing concrete blades reaching out into the courtyard — they
       start at ground level, beyond the plinth nose. */
    envelope.add(kit.slab(M.concrete, P.splitX - 0.14, P.splitX + 0.14, P.ground, top1 + 0.24, P.barZ1, 1.45))
    envelope.add(kit.slab(M.concrete, P.wingX1 - w, -1.05, P.ground, top1, 1.48, 1.76))

    /* Entrance: a steel reveal on the north face with an accent door leaf. */
    envelope.add(kit.slab(M.steelPale, 1.5, 2.6, P.plinth, top1 - 0.55, P.wz0 - 0.02, P.wz0 + 0.06))
    envelope.add(kit.slab(M.accent, 1.62, 2.48, P.plinth + 0.02, P.plinth + 2.42, P.wz0 - 0.05, P.wz0 + 0.02))

    /* Vertical oak brise-soleil shading the level-2 south band. */
    if (!low) {
      const finGeo = kit.box(0.07, opTop - opBot + 0.14, 0.22)
      for (let x = -4.95; x <= -0.3; x += V.finPitch) {
        envelope.add(kit.mesh(finGeo, M.timberFine, x, mid(opBot, opTop), P.barZ1 + 0.32))
      }
    }
    shade(envelope, true, true)
  }
  group.add(envelope)

  /* ===================================================== PART: GLAZING ====
     Full-height glass in five openings, each with a sill rail, a head rail and
     slim mullions at roughly a metre. */
  const glazing = tagPart(new THREE.Group(), 'glazing')
  {
    /**
     * @param {'x'|'z'} axis  the axis the run travels along
     * @param {number} at     the fixed plan coordinate (z for 'x' runs, x for 'z' runs)
     */
    const glassRun = (axis, at, a0, a1, y0, y1, pitch = 1.05) => {
      const run = new THREE.Group()
      const len = span(a0, a1)
      const bays = Math.max(1, Math.round(len / pitch))
      const step = len / bays
      const along = Math.min(a0, a1)

      const pane = axis === 'x'
        ? kit.slab(M.glass, a0, a1, y0 + 0.05, y1 - 0.05, at - 0.012, at + 0.012)
        : kit.slab(M.glass, at - 0.012, at + 0.012, y0 + 0.05, y1 - 0.05, a0, a1)
      pane.castShadow = false
      pane.receiveShadow = false
      run.add(pane)

      /* Sill and head rails. */
      for (const y of [y0, y1]) {
        const rail = axis === 'x'
          ? kit.slab(M.steel, a0, a1, y - 0.05, y + 0.05, at - P.frame / 2, at + P.frame / 2)
          : kit.slab(M.steel, at - P.frame / 2, at + P.frame / 2, y - 0.05, y + 0.05, a0, a1)
        run.add(rail)
      }

      /* Mullions, including the two jambs. */
      for (let i = 0; i <= bays; i++) {
        const p = along + i * step
        const half = P.mull / 2
        const m = axis === 'x'
          ? kit.slab(M.steel, p - half, p + half, y0, y1, at - P.frame / 2, at + P.frame / 2)
          : kit.slab(M.steel, at - P.frame / 2, at + P.frame / 2, y0, y1, p - half, p + half)
        run.add(m)
      }
      glazing.add(run)
      return run
    }

    const y0 = P.plinth + 0.06
    const y1 = P.l1Ceil - 0.06

    /* G1 — Block A to the courtyard. */
    glassRun('x', P.barZ1 - P.wall / 2, -3.9, -0.75, y0, y1, 1.05)
    /* G2 — Block B to the courtyard, the long glazed face. */
    glassRun('x', P.barZ1 - P.wall / 2, P.splitX + 0.16, P.wx1 - 0.16, y0, y1, 1.02)
    /* G3 — Block B east elevation. */
    glassRun('z', P.wx1 - P.wall / 2, -3.05, -0.42, y0, y1, 1.06)
    /* G4 — Wing C to the courtyard, split either side of the garden blade. */
    glassRun('z', P.wingX1 - P.wall / 2, P.barZ1 + 0.16, 1.44, y0, y1, 1.0)
    glassRun('z', P.wingX1 - P.wall / 2, 1.8, P.wz1 - 1.1, y0, y1, 1.0)
    /* G5 — level-2 south band behind the brise-soleil. */
    glassRun('x', P.barZ1 + 0.1, -5.05, -0.15, P.l2Floor + 0.32, P.l2Ceil - 0.42, 1.18)
    /* G6 — a tall slot in the west concrete wall. */
    glassRun('z', P.wx0 + P.wall / 2, -2.55, -1.35, P.l2Floor + 0.32, P.l2Ceil - 0.42, 1.2)

    glazing.traverse((o) => {
      if (!o.isMesh) return
      const isGlass = o.material === M.glass
      o.castShadow = !isGlass
      o.receiveShadow = !isGlass
    })
  }
  group.add(glazing)

  /* ======================================================== PART: ROOF ====
     Flat warm-deck plates at two heights, each with a 600 mm eave, a timber
     soffit and a blackened steel fascia that hangs below the slab to throw a
     shadow line across the elevation. */
  const roof = tagPart(new THREE.Group(), 'roof')
  {
    const e = P.eave

    /**
     * One roof plate: slab, optional oak soffit lining, and a fascia band on
     * all four sides that hangs below the slab to cast a shadow line.
     * The single-storey plates skip the lining so the rafter tails read.
     */
    const plate = (x0, x1, z0, z1, top, soffit = true) => {
      const g = new THREE.Group()
      const bot = top - P.slab
      g.add(kit.slab(M.plasterWarm, x0, x1, bot, top, z0, z1))
      if (soffit) {
        /* Oak lining, held back by the shadow-gap reveal. */
        g.add(
          kit.slab(M.timber, x0 + P.reveal, x1 - P.reveal, bot - 0.05, bot, z0 + P.reveal, z1 - P.reveal)
        )
      }
      const f = 0.07
      const fy0 = bot - 0.13
      g.add(kit.slab(M.steel, x0 - f, x1 + f, fy0, top + 0.02, z0 - f, z0))
      g.add(kit.slab(M.steel, x0 - f, x1 + f, fy0, top + 0.02, z1, z1 + f))
      g.add(kit.slab(M.steel, x0 - f, x0, fy0, top + 0.02, z0, z1))
      g.add(kit.slab(M.steel, x1, x1 + f, fy0, top + 0.02, z0, z1))
      roof.add(g)
      return g
    }

    /* Upper plate over Block A — the tallest element on the site. */
    plate(P.wx0 - e, P.splitX + 0.2 + e, P.wz0 - e, P.barZ1 + 0.2 + e, P.roofTop, true)
    /* Low plate over Block B — deep eave over the glazed courtyard face. */
    plate(P.splitX, P.wx1 + e, P.wz0 - e, P.barZ1 + e, P.lowRoofTop, false)
    /* Low plate over Wing C. */
    plate(P.wx0 - e, P.wingX1 + e, P.barZ1, P.wz1 + e, P.lowRoofTop, false)

    /* A slim accent reveal tucked under the courtyard eave. */
    roof.add(
      kit.slab(M.accent, P.splitX + 0.1, P.wx1 + e - 0.1, P.lowRoofTop - P.slab - 0.09, P.lowRoofTop - P.slab - 0.05, P.barZ1 + e - 0.12, P.barZ1 + e - 0.02)
    )

    /* Rooflight over the stair well, sitting proud of the upper plate. */
    const lx0 = STAIR.x0 + 0.35
    const lx1 = STAIR.x1 - 0.25
    const lz0 = STAIR.z - 0.5
    const lz1 = STAIR.z + 0.5
    const light = kit.slab(M.glass, lx0, lx1, P.roofTop - 0.02, P.roofTop + 0.12, lz0, lz1)
    light.castShadow = false
    roof.add(light)
    roof.add(kit.slab(M.steel, lx0 - 0.07, lx1 + 0.07, P.roofTop, P.roofTop + 0.16, lz0 - 0.07, lz0))
    roof.add(kit.slab(M.steel, lx0 - 0.07, lx1 + 0.07, P.roofTop, P.roofTop + 0.16, lz1, lz1 + 0.07))
    roof.add(kit.slab(M.steel, lx0 - 0.07, lx0, P.roofTop, P.roofTop + 0.16, lz0, lz1))
    roof.add(kit.slab(M.steel, lx1, lx1 + 0.07, P.roofTop, P.roofTop + 0.16, lz0, lz1))

    shade(roof, true, true)
    roof.traverse((o) => {
      if (o.isMesh && o.material === M.glass) {
        o.castShadow = false
        o.receiveShadow = false
      }
    })
  }
  group.add(roof)

  /* ==================================================== PART: INTERIOR ====
     Floor plates, the feature stair, the service core and a little loose
     furniture so the glazed elevations have something to show. */
  const interior = tagPart(new THREE.Group(), 'interior')
  if (withInterior) {
    const ft = 0.06

    /* Level-1 floor plates: the north bar and the Wing C return. */
    interior.add(kit.slab(M.plasterSoft, P.wx0, P.wx1, P.plinth, P.plinth + ft, P.wz0, P.barZ1))
    interior.add(kit.slab(M.plasterSoft, P.wx0, P.wingX1, P.plinth, P.plinth + ft, P.barZ1, P.wz1))

    /* Level-2 floor plate, built in two pieces around the stair well. */
    interior.add(
      kit.slab(M.plasterSoft, P.wx0, P.splitX + 0.2, P.l2Floor - ft, P.l2Floor, STAIR.voidZ1, P.barZ1 + 0.2)
    )
    interior.add(
      kit.slab(M.plasterSoft, STAIR.x1, P.splitX + 0.2, P.l2Floor - ft, P.l2Floor, P.wz0, STAIR.voidZ1)
    )

    /* Service core — bathrooms and plant, running through both levels. */
    interior.add(kit.slab(M.plaster, P.wx0 + P.wall, -3.7, P.plinth + ft, P.l2Ceil - 0.14, -1.4, -0.2))

    /* STAIR — cantilevered oak treads off a folded steel stringer, climbing
       west to east so its head lands on the level-2 floor edge. */
    const rise = span(P.plinth, P.l2Floor) / STAIR.risers
    const going = span(STAIR.x0, STAIR.x1) / STAIR.risers
    const treadGeo = kit.box(going + 0.02, 0.055, STAIR.width)
    for (let i = 1; i < STAIR.risers; i++) {
      interior.add(
        kit.mesh(treadGeo, M.timber, STAIR.x0 + i * going, P.plinth + i * rise, STAIR.z)
      )
    }
    /* The stringer spans nose-to-nose between the first and last tread and is
       dropped by half its depth so it reads as carrying them. */
    const fx = STAIR.x0 + going
    const lx = STAIR.x0 + (STAIR.risers - 1) * going
    const runX = span(fx, lx)
    const runY = runX * (rise / going)
    const stringer = kit.mesh(
      kit.box(Math.hypot(runX, runY), 0.26, 0.05),
      M.steel,
      mid(fx, lx),
      mid(P.plinth + rise, P.plinth + (STAIR.risers - 1) * rise) - 0.16,
      STAIR.z + STAIR.width / 2 + 0.03
    )
    stringer.rotation.z = Math.atan2(runY, runX)
    interior.add(stringer)
    /* Balustrade blade along the south edge of the stair well. */
    interior.add(
      kit.slab(M.steel, P.wx0, STAIR.x1, P.l2Floor, P.l2Floor + 0.95, STAIR.voidZ1 - 0.04, STAIR.voidZ1)
    )

    /* Furniture — dropped entirely on low tier. */
    if (!low) {
      /* Sofa and its back, facing the courtyard glazing in Block B. */
      const sofaGeo = kit.track(roundedBox(2.15, 0.5, 0.9, 0.09, 2))
      interior.add(kit.mesh(sofaGeo, M.fabric, 2.6, P.plinth + ft + 0.25, -1.45))
      interior.add(kit.slab(M.fabric, 1.52, 3.68, P.plinth + ft + 0.5, P.plinth + ft + 0.78, -1.9, -1.66))

      /* Dining table on two steel blades. */
      interior.add(kit.mesh(kit.box(1.9, 0.06, 0.92), M.timber, 3.9, P.plinth + ft + 0.72, -2.5))
      interior.add(kit.slab(M.steel, 3.1, 3.16, P.plinth + ft, P.plinth + ft + 0.72, -2.86, -2.14))
      interior.add(kit.slab(M.steel, 4.64, 4.7, P.plinth + ft, P.plinth + ft + 0.72, -2.86, -2.14))

      /* Bed on level 2, clear of both the core and the stair well. */
      const bedGeo = kit.track(roundedBox(1.9, 0.42, 1.5, 0.07, 2))
      interior.add(kit.mesh(bedGeo, M.fabric, -2.6, P.l2Floor + 0.21, -1.0))
    }

    shade(interior, true, true)
  }
  group.add(interior)

  /* =================================================== PART: LANDSCAPE ====
     A low garden wall closing the courtyard, planting beds and trees. */
  const landscape = tagPart(new THREE.Group(), 'landscape')
  if (withSite) {
    const gw = 0.24
    const gh = 0.92
    /* South and east runs of the garden wall. */
    landscape.add(kit.slab(M.concreteWarm, P.wingX1, P.wx1, P.ground, gh, P.wz1 - gw, P.wz1))
    landscape.add(kit.slab(M.concreteWarm, P.wx1 - gw, P.wx1, P.ground, gh, P.barZ1 + 0.4, P.wz1))
    /* Coping. */
    landscape.add(kit.slab(M.stone, P.wingX1 - 0.03, P.wx1 + 0.03, gh, gh + 0.07, P.wz1 - gw - 0.03, P.wz1 + 0.03))
    landscape.add(kit.slab(M.stone, P.wx1 - gw - 0.03, P.wx1 + 0.03, gh, gh + 0.07, P.barZ1 + 0.4, P.wz1 + 0.03))

    /* Planting beds — courtyard and street edge. */
    landscape.add(kit.slab(M.moss, -1.7 + V.bedShift, 1.6 + V.bedShift, P.ground, P.ground + 0.14, 1.9, 3.05))
    landscape.add(kit.slab(M.moss, 3.0, 4.9, P.ground, P.ground + 0.16, 0.5, 1.5))
    landscape.add(kit.slab(M.moss, -6.2, -1.0, P.padY1, P.padY1 + 0.14, -5.15, -4.55))

    /* Trees come in two groups because the site has two levels: courtyard
       specimens stand on the terrace (y = 0), perimeter planting stands on
       the lower apron (y = padY1). Courtyard trees are built first so the low
       tier keeps the ones that actually read through the glazing. */
    const q = clamp(detail, 0.4, 1)

    const courtyard = buildTrees(Math.max(2, Math.round((low ? 2 : 4) * q)), {
      seed: V.treeSeed,
      positions: [[0.55, 2.4], [3.4, 1.2], [-1.5, 1.25], [4.6, 2.6]],
      tier,
      height: 2.7,
      spread: 0.3,
    })
    courtyard.position.y = P.ground
    landscape.add(courtyard)
    subDisposers.push(courtyard.userData.dispose)

    const perimeter = buildTrees(Math.max(2, Math.round((low ? 2 : 5) * q)), {
      seed: V.treeSeed + 401,
      positions: [
        [-1.5, -4.9], [6.9, 1.5], [-6.9, 2.0], [1.0, 4.9], [-6.9, -4.9],
        [6.9, 4.6], [-4.0, 4.9], [-6.9, -2.0], [6.9, -4.6],
      ],
      tier,
      height: 3.2,
      spread: 0.4,
    })
    perimeter.position.y = P.padY1
    landscape.add(perimeter)
    subDisposers.push(perimeter.userData.dispose)

    shade(landscape, true, true)
  }
  group.add(landscape)

  /* -------------------------------------------------------------- FINISH */
  const bounds = new THREE.Box3().setFromObject(group)
  group.userData.bounds = bounds
  group.userData.tier = tier
  group.userData.seed = seed
  group.userData.variant = V

  let rig = null
  if (scene) {
    scene.add(group)
    if (lights) {
      rig = lightingRig(scene, { shadowArea: 10, sunPosition: [7.5, 10.5, 6] })
      group.userData.lights = rig
    }
  }

  const dispose = () => {
    /* Sub-builders first (they may hold materials no mesh ever used), then
       everything hanging off the tree, then the kit's shared buffers and the
       texture clones this house made. */
    subDisposers.forEach((fn) => fn?.())
    subDisposers.length = 0
    disposeSubtree(group)
    kit.dispose()
    texClones.forEach((t) => t.dispose())
    texClones.length = 0
    if (rig) {
      Object.values(rig).forEach((l) => {
        l.shadow?.map?.dispose()
        l.parent?.remove(l)
        l.dispose?.()
      })
      rig = null
    }
    group.parent?.remove(group)
    group.clear()
  }

  return {
    group,
    parts: { site, foundation, structure, envelope, glazing, roof, interior, landscape },
    bounds,
    dispose,
  }
}

/* ==========================================================================
   4 — ABSTRACT MASSING (project-slider object)
   ========================================================================== */

/**
 * Three to six stacked and offset volumes on a thin plinth, with edge linework
 * so it reads as a chipboard study model. Deterministic from `seed`.
 *
 * @param {object}   [opts]
 * @param {number}   [opts.seed=1]
 * @param {number[]} [opts.palette]        hex colours to draw the volumes from
 * @param {number}   [opts.scale=1]
 * @param {boolean}  [opts.withEdges=true]
 * @param {'low'|'mid'|'high'} [opts.tier='high']
 * @param {number}   [opts.accent=PAL.terra]
 * @param {boolean}  [opts.center=true]    centre the bounding box on the origin
 * @param {boolean}  [opts.shadow=true]    add a soft fake contact shadow
 * @returns {THREE.Group}
 */
export function buildMassing(opts = {}) {
  const {
    seed = 1,
    palette = [PAL.bone, PAL.sand, PAL.shell, PAL.stone, PAL.paper],
    scale = 1,
    withEdges = true,
    tier = 'high',
    accent = PAL.terra,
    center = true,
    shadow = true,
  } = opts

  const low = tier === 'low'
  const rnd = mulberry32(Math.floor(seed) * 7919 + 13)
  const group = new THREE.Group()
  group.name = 'massing'

  const mats = palette.map((hex) =>
    new THREE.MeshStandardMaterial({
      color: color(hex),
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.75,
    })
  )
  const accentMat = accentMaterial(accent)
  const plinthMat = new THREE.MeshStandardMaterial({
    color: color(PAL.graphite),
    roughness: 0.72,
    metalness: 0.05,
  })

  const count = 3 + Math.floor(rnd() * 4) // 3 … 6
  const accentIndex = Math.floor(rnd() * count)
  const softIndex = low ? -1 : Math.floor(rnd() * count)

  let y = 0
  let w = 1.5 + rnd() * 0.8
  let d = 1.1 + rnd() * 0.7
  let maxW = w
  let maxD = d
  let cx = 0
  let cz = 0

  for (let i = 0; i < count; i++) {
    const h = 0.36 + rnd() * 0.62
    /* Each volume steps in or out and slides along one axis — the stack
       stays legible instead of collapsing into a tower. */
    if (i > 0) {
      const shrink = 0.62 + rnd() * 0.42
      w = clamp(w * shrink, 0.42, 2.6)
      d = clamp(d * (0.68 + rnd() * 0.44), 0.36, 2.0)
      const slideX = (rnd() - 0.5) * Math.max(0.2, w * 0.9)
      const slideZ = (rnd() - 0.5) * Math.max(0.16, d * 0.7)
      cx += slideX
      cz += slideZ
    }

    /* One volume gets softened corners so the stack is not all hard boxes;
       roundedBox is already centred on its own origin. */
    const geo = i === softIndex ? roundedBox(w, h, d, 0.055, 1) : new THREE.BoxGeometry(w, h, d)
    const mat = i === accentIndex ? accentMat : mats[i % mats.length]
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(cx, y + h / 2, cz)
    mesh.castShadow = true
    mesh.receiveShadow = true

    if (withEdges) mesh.add(edgeOverlay(geo, PAL.ink, i === accentIndex ? 0.3 : 0.2, 24))
    group.add(mesh)

    maxW = Math.max(maxW, Math.abs(cx) * 2 + w)
    maxD = Math.max(maxD, Math.abs(cz) * 2 + d)
    /* Occasionally leave a shadow-gap reveal between volumes. */
    y += h + (rnd() > 0.72 ? 0.05 : 0)
  }

  /* Thin base plinth, slightly proud of the widest volume. */
  const pw = maxW + 0.52
  const pd = maxD + 0.46
  const plinthGeo = new THREE.BoxGeometry(pw, 0.07, pd)
  const plinth = new THREE.Mesh(plinthGeo, plinthMat)
  plinth.position.y = -0.035
  plinth.receiveShadow = true
  plinth.castShadow = true
  if (withEdges) plinth.add(edgeOverlay(plinthGeo, PAL.ink, 0.3, 24))
  group.add(plinth)

  if (shadow) {
    const sh = fakeShadow(pw * 1.5, pd * 1.6, 0.45)
    sh.position.y = -0.072
    group.add(sh)
  }

  if (center) {
    const box = new THREE.Box3().setFromObject(group)
    const c = box.getCenter(new THREE.Vector3())
    group.children.forEach((child) => {
      child.position.x -= c.x
      child.position.y -= c.y
      child.position.z -= c.z
    })
  }

  group.scale.setScalar(scale)
  group.userData.volumes = count
  group.userData.dispose = () => {
    disposeSubtree(group)
    /* Palette entries the seed never reached still need freeing. */
    mats.forEach((m) => m.dispose())
    accentMat.dispose()
    plinthMat.dispose()
  }
  return group
}

/* ==========================================================================
   5 — SITE GROUND
   ========================================================================== */

/**
 * Setting-out ground plane for the hero and slider scenes.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.size=24]         plane size in world units
 * @param {number}  [opts.divisions=32]    grid squares across the texture
 * @param {number}  [opts.repeat=4]        texture tiling
 * @param {number}  [opts.contours=0]      concentric contour rings to draw
 * @param {number}  [opts.contourRadius]   radius of the outermost ring
 * @param {boolean} [opts.boundary=true]   accent-coloured site boundary
 * @param {number}  [opts.accent=PAL.terra]
 * @param {boolean} [opts.catchShadow=true] add a real shadow-receiving plane
 * @param {number|boolean} [opts.shadow=false] fake shadow width (depth = width * 0.72)
 * @param {number}  [opts.opacity=1]       fade the plate into the page background
 * @param {number}  [opts.seed=2]
 * @returns {THREE.Group}
 */
export function buildSiteGround(opts = {}) {
  const {
    size = 24,
    divisions = 32,
    repeat = 4,
    contours = 0,
    contourRadius = size * 0.34,
    boundary = true,
    accent = PAL.terra,
    catchShadow = true,
    shadow = false,
    opacity = 1,
    seed = 2,
  } = opts

  const rnd = mulberry32(Math.floor(seed) * 977 + 5)
  const group = new THREE.Group()
  group.name = 'site-ground'

  /* The shared grid texture is cached, so clone before changing the tiling. */
  const map = gridTexture(1024, divisions, '#27415a', '#f1ece3').clone()
  map.needsUpdate = true
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeat, repeat)

  const planeGeo = new THREE.PlaneGeometry(size, size, 1, 1)
  const planeMat = new THREE.MeshStandardMaterial({
    color: color(PAL.bone),
    map,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.55,
    transparent: opacity < 1,
    opacity,
  })
  const plane = new THREE.Mesh(planeGeo, planeMat)
  plane.rotation.x = -Math.PI / 2
  plane.receiveShadow = true
  group.add(plane)

  /* Contour rings — slightly irregular so they read as survey lines. */
  if (contours > 0) {
    const ringMat = new THREE.LineBasicMaterial({
      color: color(PAL.blueprint),
      transparent: true,
      opacity: 0.26,
    })
    for (let i = 0; i < contours; i++) {
      const t = (i + 1) / contours
      const baseR = contourRadius * t
      const segs = 72
      const pts = []
      const wobble = 0.06 + rnd() * 0.05
      const phase = rnd() * Math.PI * 2
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2
        const r =
          baseR *
          (1 + Math.sin(a * 3 + phase) * wobble + Math.sin(a * 5 - phase * 1.7) * wobble * 0.45)
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0.004 + i * 0.0015, Math.sin(a) * r))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, ringMat))
    }
  }

  /* Site boundary in the accent colour — the single warm line on the plate. */
  if (boundary) {
    const b = size * 0.42
    const pts = [
      new THREE.Vector3(-b, 0.006, -b),
      new THREE.Vector3(b, 0.006, -b),
      new THREE.Vector3(b, 0.006, b),
      new THREE.Vector3(-b, 0.006, b),
      new THREE.Vector3(-b, 0.006, -b),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({
      color: color(accent),
      transparent: true,
      opacity: 0.7,
    })
    group.add(new THREE.Line(geo, mat))
  }

  if (catchShadow) {
    /* Matched to the plane so framing the group never over-pads. */
    const catcher = shadowCatcher(size, 0.16)
    catcher.position.y = 0.002
    group.add(catcher)
  }

  if (shadow) {
    const w = typeof shadow === 'number' ? shadow : size * 0.36
    const sh = fakeShadow(w, w * 0.72, 0.5)
    sh.position.y = 0.008
    group.userData.fakeShadow = sh
    group.add(sh)
  }

  group.userData.plane = plane
  group.userData.dispose = () => {
    disposeSubtree(group)
    map.dispose() // the clone made above, never the shared original
  }
  return group
}

/* ==========================================================================
   6 — TREES
   ========================================================================== */

/**
 * Stylised low-poly trees: a tapered trunk plus one to three clustered
 * canopies, flat shaded, no textures. Cheap enough to scatter freely.
 *
 * @param {number} [count=6]
 * @param {object} [opts]
 * @param {number} [opts.seed=5]
 * @param {Array<[number,number]>} [opts.positions] explicit x/z spots
 * @param {number} [opts.radius=6]      scatter radius when no positions given
 * @param {number} [opts.inner=2.4]     keep-clear radius when scattering
 * @param {number} [opts.height=2.8]    nominal tree height
 * @param {number} [opts.spread=0.35]   height variance, 0…1
 * @param {'low'|'mid'|'high'} [opts.tier='high']
 * @returns {THREE.Group}
 */
export function buildTrees(count = 6, opts = {}) {
  const {
    seed = 5,
    positions = null,
    radius = 6,
    inner = 2.4,
    height = 2.8,
    spread = 0.35,
    tier = 'high',
  } = opts

  const low = tier === 'low'
  const rnd = mulberry32(Math.floor(seed) * 1543 + 3)
  const group = new THREE.Group()
  group.name = 'trees'

  const trunkMat = new THREE.MeshStandardMaterial({
    color: color(PAL.oakDeep),
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  })
  const canopyMats = [0x5c6b4c, 0x6d7a55, 0x4f5f49].map(
    (hex) =>
      new THREE.MeshStandardMaterial({
        color: color(hex),
        roughness: 0.99,
        metalness: 0,
        flatShading: true,
      })
  )

  const trunkSides = low ? 4 : 6
  const canopyDetail = low ? 0 : 1
  const trunkGeo = new THREE.CylinderGeometry(0.055, 0.11, 1, trunkSides, 1)
  const canopyGeo = new THREE.IcosahedronGeometry(1, canopyDetail)

  const n = Math.max(0, Math.floor(count))
  for (let i = 0; i < n; i++) {
    let x
    let z
    if (positions && positions[i]) {
      x = positions[i][0]
      z = positions[i][1]
    } else {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + rnd() * 0.9
      const r = inner + rnd() * Math.max(0.001, radius - inner)
      x = Math.cos(a) * r
      z = Math.sin(a) * r
    }

    const tree = new THREE.Group()
    const h = height * (1 - spread / 2 + rnd() * spread)
    const trunkH = h * (0.42 + rnd() * 0.12)

    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.scale.set(h / 2.8, trunkH, h / 2.8)
    trunk.position.y = trunkH / 2
    trunk.castShadow = true
    trunk.receiveShadow = true
    tree.add(trunk)

    const blobs = low ? 1 : 1 + Math.floor(rnd() * 3)
    for (let b = 0; b < blobs; b++) {
      const canopy = new THREE.Mesh(canopyGeo, canopyMats[Math.floor(rnd() * canopyMats.length)])
      const cr = h * (0.3 - b * 0.045) * (0.85 + rnd() * 0.4)
      canopy.scale.set(cr * (0.9 + rnd() * 0.3), cr * (0.78 + rnd() * 0.3), cr * (0.9 + rnd() * 0.3))
      canopy.position.set(
        (rnd() - 0.5) * h * 0.22,
        trunkH + h * (0.24 + b * 0.16) - (b > 0 ? h * 0.04 : 0),
        (rnd() - 0.5) * h * 0.22
      )
      canopy.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI)
      canopy.castShadow = true
      canopy.receiveShadow = true
      tree.add(canopy)
    }

    tree.position.set(x, 0, z)
    tree.rotation.z = (rnd() - 0.5) * 0.16
    tree.rotation.x = (rnd() - 0.5) * 0.12
    tree.rotation.y = rnd() * Math.PI * 2
    group.add(tree)
  }

  group.userData.count = n
  group.userData.dispose = () => {
    disposeSubtree(group)
    /* Shared buffers and any canopy tone the seed never picked. */
    trunkGeo.dispose()
    canopyGeo.dispose()
    trunkMat.dispose()
    canopyMats.forEach((m) => m.dispose())
  }
  return group
}

/* ==========================================================================
   7 — SCALE FIGURE
   ========================================================================== */

/* Normalised standing silhouette, feet at y = 0 and crown at y = 1. Traced as
   one closed contour: up the inside of the right leg, across, down the inside
   of the left leg, out to the left foot, up the left side, over the head and
   back down the right side. */
const FIGURE_OUTLINE = [
  [0.014, 0.0], [0.011, 0.43], [-0.011, 0.43], [-0.014, 0.0],
  [-0.062, 0.0], [-0.062, 0.028], [-0.041, 0.046],
  [-0.049, 0.43], [-0.1, 0.472], [-0.104, 0.56], [-0.098, 0.7], [-0.09, 0.758],
  [-0.052, 0.8], [-0.038, 0.845],
  [-0.062, 0.872], [-0.062, 0.94], [-0.03, 0.985], [0.0, 0.995],
  [0.03, 0.985], [0.062, 0.94], [0.062, 0.872],
  [0.038, 0.845], [0.052, 0.8],
  [0.09, 0.758], [0.098, 0.7], [0.104, 0.56], [0.1, 0.472], [0.049, 0.43],
  [0.041, 0.046], [0.062, 0.028], [0.062, 0.0],
]

/**
 * Minimal extruded human silhouette for scale — 1.75 units tall against the
 * house's 3.0-unit floor-to-ceiling.
 *
 * @param {object} [opts]
 * @param {number} [opts.height=1.75]
 * @param {number} [opts.depth=0.1]     extrusion depth
 * @param {number} [opts.color=PAL.graphite]
 * @param {number} [opts.opacity=1]
 * @param {number} [opts.facing=0]      rotation about Y, radians
 * @returns {THREE.Group}
 */
export function buildScaleFigure(opts = {}) {
  const {
    height = 1.75,
    depth = 0.1,
    color: hex = PAL.graphite,
    opacity = 1,
    facing = 0,
  } = opts

  const group = new THREE.Group()
  group.name = 'scale-figure'

  const shape = new THREE.Shape()
  FIGURE_OUTLINE.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth / height,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 1,
  })
  geo.translate(0, 0, -depth / height / 2)
  geo.scale(height, height, height)
  /* The bevel pushes the soles a few millimetres below zero — sit the figure
     back down so it never sinks into a ground plane. */
  geo.computeBoundingBox()
  geo.translate(0, -geo.boundingBox.min.y, 0)
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    color: color(hex),
    roughness: 0.95,
    metalness: 0,
    transparent: opacity < 1,
    opacity,
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = false
  group.add(mesh)
  group.rotation.y = facing

  group.userData.height = height
  group.userData.dispose = () => disposeSubtree(group)
  return group
}

/* ==========================================================================
   8 — DRAWING SHEET
   Canvas-drawn architectural sheet, generated here (not from lib/drawings.js,
   which returns SVG strings for the DOM). Colours are hard-coded because this
   is generated artwork, not UI chrome.
   ========================================================================== */

const SHEET_INK = '#27415a'
const SHEET_PAPER = '#faf7f1'
const SHEET_POCHE = '#d9d2c4'
const SHEET_ACCENT = '#ae4e2a'

function drawingSheetTexture(o) {
  const w = o.pixels
  const h = Math.round(w * o.ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const rnd = mulberry32(Math.floor(o.seed) * 6151 + 17)

  const mono = (size, weight = 500) =>
    `${weight} ${size}px "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace`

  /* paper ------------------------------------------------------------- */
  ctx.fillStyle = SHEET_PAPER
  ctx.fillRect(0, 0, w, h)

  /* faint setting-out grid --------------------------------------------- */
  const cell = w / 40
  ctx.strokeStyle = SHEET_INK
  ctx.lineWidth = 1
  for (let i = 1; i * cell < w; i++) {
    ctx.globalAlpha = i % 5 === 0 ? 0.1 : 0.045
    const x = Math.round(i * cell) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let i = 1; i * cell < h; i++) {
    ctx.globalAlpha = i % 5 === 0 ? 0.1 : 0.045
    const y = Math.round(i * cell) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  /* sheet border -------------------------------------------------------- */
  const m = Math.round(w * 0.035)
  ctx.strokeStyle = SHEET_INK
  ctx.globalAlpha = 0.85
  ctx.lineWidth = Math.max(2, w * 0.0022)
  ctx.strokeRect(m, m, w - m * 2, h - m * 2)
  ctx.globalAlpha = 0.3
  ctx.lineWidth = 1
  ctx.strokeRect(m + 8, m + 8, w - m * 2 - 16, h - m * 2 - 16)
  ctx.globalAlpha = 1

  /* ---------------------------------------------------------------- plan
     Drawn inside the left two-thirds of the sheet. All coordinates are
     normalised 0…1 inside that box so the layout survives any pixel size. */
  const px0 = m + w * 0.045
  const py0 = m + h * 0.075
  const pw = w * 0.6
  const ph = h * 0.66
  const X = (u) => px0 + u * pw
  const Y = (v) => py0 + v * ph

  /* poché walls */
  const wallT = Math.max(4, w * 0.0085)
  ctx.fillStyle = SHEET_POCHE
  ctx.strokeStyle = SHEET_INK
  ctx.lineWidth = Math.max(1.6, w * 0.0018)

  const rectWall = (u0, v0, u1, v1) => {
    const x = X(u0)
    const y = Y(v0)
    const rw = X(u1) - x
    const rh = Y(v1) - y
    ctx.fillRect(x, y, rw, wallT)
    ctx.fillRect(x, y + rh - wallT, rw, wallT)
    ctx.fillRect(x, y, wallT, rh)
    ctx.fillRect(x + rw - wallT, y, wallT, rh)
    ctx.strokeRect(x + 0.5, y + 0.5, rw, rh)
    ctx.strokeRect(x + wallT + 0.5, y + wallT + 0.5, rw - wallT * 2, rh - wallT * 2)
  }

  /* Outer envelope plus a courtyard notch, seeded so sheets differ. */
  const notch = 0.3 + rnd() * 0.16
  rectWall(0.04, 0.06, 0.96, 0.62)
  rectWall(0.04, 0.62, 0.04 + notch, 0.95)

  /* internal partitions */
  const parts = 3 + Math.floor(rnd() * 3)
  ctx.fillStyle = SHEET_POCHE
  for (let i = 0; i < parts; i++) {
    const vertical = rnd() > 0.42
    if (vertical) {
      const u = 0.18 + rnd() * 0.6
      const v0 = 0.06 + rnd() * 0.2
      const v1 = v0 + 0.18 + rnd() * 0.3
      ctx.fillRect(X(u), Y(v0), wallT * 0.7, Y(Math.min(v1, 0.62)) - Y(v0))
    } else {
      const v = 0.2 + rnd() * 0.3
      const u0 = 0.06 + rnd() * 0.4
      const u1 = u0 + 0.16 + rnd() * 0.3
      ctx.fillRect(X(u0), Y(v), X(Math.min(u1, 0.96)) - X(u0), wallT * 0.7)
    }
  }

  /* door swings */
  ctx.strokeStyle = SHEET_INK
  ctx.globalAlpha = 0.6
  ctx.lineWidth = Math.max(1.2, w * 0.0014)
  for (let i = 0; i < 3; i++) {
    const cxu = 0.2 + rnd() * 0.55
    const cyv = 0.2 + rnd() * 0.3
    const r = pw * 0.045
    ctx.beginPath()
    ctx.arc(X(cxu), Y(cyv), r, -Math.PI / 2, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(X(cxu), Y(cyv))
    ctx.lineTo(X(cxu), Y(cyv) - r)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  /* stair — parallel treads with a direction arrow */
  const sx = X(0.62)
  const sy = Y(0.14)
  const sw = pw * 0.14
  const treads = 9
  const sh = ph * 0.3
  ctx.strokeStyle = SHEET_INK
  ctx.lineWidth = Math.max(1.2, w * 0.0014)
  ctx.strokeRect(sx, sy, sw, sh)
  for (let i = 1; i < treads; i++) {
    const yy = sy + (i / treads) * sh
    ctx.beginPath()
    ctx.moveTo(sx, yy)
    ctx.lineTo(sx + sw, yy)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(sx + sw / 2, sy + sh - 6)
  ctx.lineTo(sx + sw / 2, sy + 8)
  ctx.moveTo(sx + sw / 2 - 6, sy + 18)
  ctx.lineTo(sx + sw / 2, sy + 8)
  ctx.lineTo(sx + sw / 2 + 6, sy + 18)
  ctx.stroke()

  /* grid axes with bubbles */
  ctx.setLineDash([10, 7])
  ctx.globalAlpha = 0.45
  const bubbles = 4
  for (let i = 0; i < bubbles; i++) {
    const u = 0.12 + (i / (bubbles - 1)) * 0.76
    ctx.beginPath()
    ctx.moveTo(X(u), Y(-0.045))
    ctx.lineTo(X(u), Y(0.66))
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1
  ctx.font = mono(Math.round(w * 0.014), 600)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < bubbles; i++) {
    const u = 0.12 + (i / (bubbles - 1)) * 0.76
    const bx = X(u)
    const by = Y(-0.055)
    ctx.beginPath()
    ctx.arc(bx, by, w * 0.0135, 0, Math.PI * 2)
    ctx.fillStyle = SHEET_PAPER
    ctx.fill()
    ctx.strokeStyle = SHEET_INK
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.fillStyle = SHEET_INK
    ctx.fillText(String.fromCharCode(65 + i), bx, by + 1)
  }

  /* dimension string under the plan */
  const dy = Y(1.02)
  ctx.strokeStyle = SHEET_INK
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(X(0.04), dy)
  ctx.lineTo(X(0.96), dy)
  ctx.stroke()
  const dims = 4
  for (let i = 0; i <= dims; i++) {
    const u = 0.04 + (i / dims) * 0.92
    ctx.beginPath()
    ctx.moveTo(X(u), dy - 7)
    ctx.lineTo(X(u), dy + 7)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.font = mono(Math.round(w * 0.0125), 500)
  ctx.fillStyle = SHEET_INK
  for (let i = 0; i < dims; i++) {
    const u = 0.04 + ((i + 0.5) / dims) * 0.92
    ctx.fillText(`${2400 + Math.floor(rnd() * 900)}`, X(u), dy + Math.round(w * 0.018))
  }

  /* north arrow */
  const nx = X(0.9)
  const ny = Y(0.78)
  const nr = w * 0.026
  ctx.beginPath()
  ctx.arc(nx, ny, nr, 0, Math.PI * 2)
  ctx.strokeStyle = SHEET_INK
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(nx, ny - nr * 0.78)
  ctx.lineTo(nx + nr * 0.34, ny + nr * 0.5)
  ctx.lineTo(nx, ny + nr * 0.2)
  ctx.lineTo(nx - nr * 0.34, ny + nr * 0.5)
  ctx.closePath()
  ctx.fillStyle = SHEET_ACCENT
  ctx.fill()
  ctx.fillStyle = SHEET_INK
  ctx.font = mono(Math.round(w * 0.013), 600)
  ctx.fillText('N', nx, ny + nr * 1.6)

  /* --------------------------------------------------------- title block */
  const tbw = w * 0.27
  const tbh = h * 0.26
  const tbx = w - m - 10 - tbw
  const tby = h - m - 10 - tbh
  ctx.fillStyle = SHEET_PAPER
  ctx.fillRect(tbx, tby, tbw, tbh)
  ctx.strokeStyle = SHEET_INK
  ctx.lineWidth = Math.max(1.6, w * 0.0018)
  ctx.strokeRect(tbx + 0.5, tby + 0.5, tbw, tbh)

  const rows = 4
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.45
  for (let i = 1; i < rows; i++) {
    const ry = tby + (i / rows) * tbh
    ctx.beginPath()
    ctx.moveTo(tbx, ry)
    ctx.lineTo(tbx + tbw, ry)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  const padx = tbw * 0.055
  ctx.textAlign = 'left'
  ctx.fillStyle = SHEET_INK

  ctx.font = mono(Math.round(w * 0.0128), 600)
  ctx.fillText(o.studio.toUpperCase(), tbx + padx, tby + tbh * 0.125)
  ctx.font = mono(Math.round(w * 0.0102), 400)
  ctx.globalAlpha = 0.62
  ctx.fillText(o.location.toUpperCase(), tbx + padx, tby + tbh * 0.125 + Math.round(w * 0.019))
  ctx.globalAlpha = 1

  ctx.font = mono(Math.round(w * 0.0142), 600)
  ctx.fillText(o.title.toUpperCase(), tbx + padx, tby + tbh * 0.375)

  ctx.font = mono(Math.round(w * 0.0105), 400)
  ctx.globalAlpha = 0.62
  ctx.fillText('SCALE', tbx + padx, tby + tbh * 0.625 - Math.round(w * 0.011))
  ctx.fillText('REV', tbx + tbw * 0.52, tby + tbh * 0.625 - Math.round(w * 0.011))
  ctx.globalAlpha = 1
  ctx.font = mono(Math.round(w * 0.0125), 600)
  ctx.fillText(o.scaleNote, tbx + padx, tby + tbh * 0.625 + Math.round(w * 0.009))
  ctx.fillText(o.revision, tbx + tbw * 0.52, tby + tbh * 0.625 + Math.round(w * 0.009))

  ctx.font = mono(Math.round(w * 0.019), 700)
  ctx.fillStyle = SHEET_ACCENT
  ctx.fillText(o.code.toUpperCase(), tbx + padx, tby + tbh * 0.875)

  /* sheet index, top-left */
  ctx.fillStyle = SHEET_INK
  ctx.globalAlpha = 0.55
  ctx.font = mono(Math.round(w * 0.0115), 500)
  ctx.fillText(`${o.code.toUpperCase()} / ${o.title.toUpperCase()}`, m + 14, m + Math.round(w * 0.022))
  ctx.globalAlpha = 1

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/**
 * A floating architectural sheet — a thin plane carrying a canvas-drawn plan
 * and title block. Deterministic by seed.
 *
 * @param {object} [opts]
 * @param {number} [opts.seed=3]
 * @param {number} [opts.width=3.2]     world width; height follows `ratio`
 * @param {number} [opts.ratio=0.7071]  height / width (ISO A landscape)
 * @param {number} [opts.pixels]        texture width in px (tier-aware default)
 * @param {string} [opts.title='Ground floor plan']
 * @param {string} [opts.code='A-101']
 * @param {string} [opts.scaleNote='1:100 @ A1']
 * @param {string} [opts.revision='C']
 * @param {string} [opts.studio='Unique Homes and Design']
 * @param {string} [opts.location='Austin, Texas']
 * @param {number} [opts.opacity=1]
 * @param {'low'|'mid'|'high'} [opts.tier='high']
 * @returns {THREE.Mesh}
 */
export function buildDrawingSheet(opts = {}) {
  const {
    seed = 3,
    width = 3.2,
    ratio = 0.7071,
    tier = 'high',
    title = 'Ground floor plan',
    code = 'A-101',
    scaleNote = '1:100 @ A1',
    revision = 'C',
    studio = 'Unique Homes and Design',
    location = 'Austin, Texas',
    opacity = 1,
  } = opts

  const pixels = opts.pixels ?? (tier === 'low' ? 768 : 1280)
  const tex = drawingSheetTexture({
    seed,
    ratio,
    pixels,
    title,
    code,
    scaleNote,
    revision,
    studio,
    location,
  })

  const geo = new THREE.PlaneGeometry(width, width * ratio, 1, 1)
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.5,
    transparent: opacity < 1,
    opacity,
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'drawing-sheet'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.userData.texture = tex
  mesh.userData.dispose = () => {
    geo.dispose()
    tex.dispose()
    mat.dispose()
  }
  return mesh
}

/* ==========================================================================
   9 — CAMERA FRAMING
   ========================================================================== */

const _box = new THREE.Box3()
const _size = new THREE.Vector3()
const _center = new THREE.Vector3()

/**
 * Aim a camera at an object so it fits the current viewport with padding.
 * Works for both perspective and orthographic cameras; for perspective it
 * fits the object's bounding sphere in whichever of the two field angles is
 * tighter, so it never crops on a narrow phone slot.
 *
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D} object3D
 * @param {object} [opts]
 * @param {number} [opts.padding=1.2]        >1 pulls the camera back
 * @param {number} [opts.azimuth=0.88]       orbit angle around Y, radians
 * @param {number} [opts.elevation=0.34]     angle above the horizon, radians
 * @param {THREE.Vector3} [opts.target]      look-at point (defaults to the centre)
 * @param {number} [opts.targetYOffset=0]    nudge the look-at point vertically
 * @param {boolean} [opts.adjustClip=true]
 */
export function frameObject(camera, object3D, opts = {}) {
  if (!camera || !object3D) return

  const {
    padding = 1.2,
    azimuth = 0.88,
    elevation = 0.34,
    target = null,
    targetYOffset = 0,
    adjustClip = true,
  } = opts

  _box.setFromObject(object3D)
  if (_box.isEmpty()) return
  _box.getSize(_size)
  _box.getCenter(_center)

  const look = target ? target.clone() : _center.clone()
  look.y += targetYOffset

  const radius = Math.max(_size.length() * 0.5, 1e-3)

  let dist
  if (camera.isOrthographicCamera) {
    const aspect = Math.abs(camera.right - camera.left) / Math.abs(camera.top - camera.bottom) || 1
    const halfH = Math.max(_size.y, (_size.x + _size.z) * 0.5 / aspect) * 0.5
    camera.zoom = Math.max(0.001, camera.top / Math.max(halfH * padding, 1e-3))
    dist = radius * 3
  } else {
    const vFov = THREE.MathUtils.degToRad(camera.fov || 38)
    const aspect = camera.aspect || 1
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const fitV = radius / Math.sin(vFov / 2)
    const fitH = radius / Math.sin(hFov / 2)
    dist = Math.max(fitV, fitH) * padding
  }

  const cosE = Math.cos(elevation)
  camera.position.set(
    look.x + dist * cosE * Math.sin(azimuth),
    look.y + dist * Math.sin(elevation),
    look.z + dist * cosE * Math.cos(azimuth)
  )
  camera.lookAt(look)

  if (adjustClip) {
    camera.near = Math.max(0.05, Math.min(camera.near, dist - radius * 1.6))
    camera.far = Math.max(camera.far, dist + radius * 3)
  }
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

/* ==========================================================================
   10 — EXPLODE TIMELINE
   ========================================================================== */

/**
 * Paused GSAP timeline that flies an assembly apart. Each part travels along
 * its own `userData.explodeDir * explodeDist` with a small rotation settle and
 * an overshoot, sequenced by `userData.order`. Intended to be scrubbed:
 * the timeline is normalised to `opts.duration` (1 by default) so a
 * ScrollTrigger can drive `tl.progress()` or `tl.totalProgress()` directly.
 *
 * @param {Object<string,THREE.Object3D>|THREE.Object3D[]} parts
 * @param {object} [opts]
 * @param {number} [opts.duration=1]     total normalised duration
 * @param {number} [opts.stagger=0.42]   fraction of a segment between parts
 * @param {number} [opts.spin=0.055]     rotation settle, radians
 * @param {number} [opts.lift=1]         multiplier on every explodeDist
 * @param {string} [opts.ease=EASE.back] overshoot ease for the travel
 * @param {boolean} [opts.reset=true]    snap parts back to assembled first
 * @returns {import('gsap').gsap.core.Timeline}
 */
export function explodeTimeline(parts, opts = {}) {
  const {
    duration = 1,
    stagger = 0.42,
    spin = 0.055,
    lift = 1,
    ease = EASE.back,
    reset = true,
  } = opts

  const list = (Array.isArray(parts) ? parts : Object.values(parts || {}))
    .filter((p) => p && p.isObject3D && p.userData && p.userData.explodeDir)
    .sort((a, b) => (a.userData.order ?? 0) - (b.userData.order ?? 0))

  const tl = gsap.timeline({ paused: true, defaults: { ease, duration: 1 } })
  if (!list.length) return tl

  const seg = 1
  const step = seg * stagger

  list.forEach((part, i) => {
    /* Remember the assembled transform once, so rebuilding the timeline (on
       resize, say) never compounds offsets. */
    if (!part.userData.explodeHome) {
      part.userData.explodeHome = {
        position: part.position.clone(),
        rotation: new THREE.Euler().copy(part.rotation),
      }
    }
    const home = part.userData.explodeHome
    if (reset) {
      part.position.copy(home.position)
      part.rotation.copy(home.rotation)
    }

    const dir = part.userData.explodeDir
    const dist = (part.userData.explodeDist ?? 1) * lift
    const at = i * step

    /* Deterministic per-part wobble so the settle never looks mechanical. */
    const sign = i % 2 === 0 ? 1 : -1
    const wob = spin * (0.55 + ((i * 37) % 11) / 11)

    tl.to(
      part.position,
      {
        x: home.position.x + dir.x * dist,
        y: home.position.y + dir.y * dist,
        z: home.position.z + dir.z * dist,
        duration: seg,
        ease,
      },
      at
    )

    tl.to(
      part.rotation,
      {
        x: home.rotation.x + wob * 0.5 * sign,
        y: home.rotation.y + wob * sign,
        z: home.rotation.z - wob * 0.35 * sign,
        duration: seg,
        ease: EASE.soft,
      },
      at
    )
  })

  /* Normalise so consumers can scrub 0 → 1 regardless of part count. */
  if (duration > 0) tl.duration(duration)
  tl.progress(0).pause()
  return tl
}
