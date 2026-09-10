/* ============================================================================
   SHARED MATERIAL LIBRARY
   Every 3D scene on the site pulls from this palette so the whole WebGL layer
   reads as one material world: board-formed concrete, warm oak, low-iron
   glass, blackened steel and terracotta. Textures are generated procedurally
   on a 2D canvas — no image assets, no network.
   ========================================================================== */
import * as THREE from 'three'
import { mulberry32 } from '../../lib/utils.js'

/* ------------------------------------------------------------- PALETTE */
export const PAL = {
  paper: 0xfbf9f5,
  bone: 0xf3efe8,
  shell: 0xebe5db,
  sand: 0xdfd7c9,
  stone: 0xc4baa8,
  ash: 0x918a7c,
  graphite: 0x5d5850,
  ink: 0x1a1714,
  terra: 0xae4e2a,
  terraLite: 0xcf6e42,
  ochre: 0xc2934a,
  blueprint: 0x27415a,
  moss: 0x4f5f49,
  oak: 0xb98d5c,
  oakDeep: 0x8a6238,
  brass: 0xb08d4f,
  glass: 0xdfe9ec,
}

export const color = (hex) => new THREE.Color(hex).convertSRGBToLinear()

/* ------------------------------------------------------- CANVAS TEXTURES */

const texCache = new Map()
const cached = (key, make) => {
  if (!texCache.has(key)) texCache.set(key, make())
  return texCache.get(key)
}

function canvas2d(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')]
}

/** Fine value-noise field — the base for every surface imperfection. */
export function noiseTexture(size = 512, contrast = 0.5, seed = 7) {
  return cached(`noise-${size}-${contrast}-${seed}`, () => {
    const [c, ctx] = canvas2d(size)
    const img = ctx.createImageData(size, size)
    const rnd = mulberry32(seed)
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (rnd() - 0.5) * 255 * contrast
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.NoColorSpace
    return t
  })
}

/** Board-formed concrete: soft cloud mottling plus horizontal shutter lines. */
export function concreteTexture(size = 1024, seed = 11) {
  return cached(`concrete-${size}-${seed}`, () => {
    const [c, ctx] = canvas2d(size)
    const rnd = mulberry32(seed)

    ctx.fillStyle = '#8c8c8c'
    ctx.fillRect(0, 0, size, size)

    // Cloudy aggregate blotches
    for (let i = 0; i < 900; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const r = 6 + rnd() * 70
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const tone = 118 + Math.floor(rnd() * 60)
      g.addColorStop(0, `rgba(${tone},${tone},${tone},${0.05 + rnd() * 0.14})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Timber shutter board lines every ~1/8 of the surface
    const boards = 8
    for (let i = 0; i <= boards; i++) {
      const y = (i / boards) * size
      ctx.strokeStyle = 'rgba(60,60,60,0.30)'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.beginPath()
      ctx.moveTo(0, y + 2)
      ctx.lineTo(size, y + 2)
      ctx.stroke()
    }

    // Tie-bolt holes on a grid — the giveaway detail of board-formed concrete
    for (let ry = 0; ry < boards; ry++) {
      for (let rx = 0; rx < 5; rx++) {
        const x = ((rx + 0.5) / 5) * size
        const y = ((ry + 0.5) / boards) * size
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7)
        g.addColorStop(0, 'rgba(40,40,40,0.55)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Fine speckle
    const img = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rnd() - 0.5) * 26
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)

    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.NoColorSpace
    t.anisotropy = 4
    return t
  })
}

/** Straight-grain oak, used for soffits, screens and joinery. */
export function timberTexture(size = 512, seed = 23) {
  return cached(`timber-${size}-${seed}`, () => {
    const [c, ctx] = canvas2d(size)
    const rnd = mulberry32(seed)
    ctx.fillStyle = '#b98d5c'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 240; i++) {
      const x = rnd() * size
      const w = 0.6 + rnd() * 3.2
      ctx.strokeStyle = `rgba(${90 + rnd() * 60},${60 + rnd() * 40},${30 + rnd() * 30},${0.05 + rnd() * 0.18})`
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      for (let y = 0; y <= size; y += 24) {
        ctx.lineTo(x + Math.sin((y / size) * Math.PI * 2 + i) * 3.5, y)
      }
      ctx.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Blueprint / setting-out grid, used on ground planes and drawing surfaces. */
export function gridTexture(size = 1024, divisions = 32, lineColor = '#27415a', bg = '#eef1f4') {
  return cached(`grid-${size}-${divisions}-${lineColor}-${bg}`, () => {
    const [c, ctx] = canvas2d(size)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
    const step = size / divisions
    ctx.strokeStyle = lineColor
    for (let i = 0; i <= divisions; i++) {
      const major = i % 8 === 0
      ctx.globalAlpha = major ? 0.32 : 0.12
      ctx.lineWidth = major ? 2 : 1
      const p = Math.round(i * step) + 0.5
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, size)
      ctx.moveTo(0, p)
      ctx.lineTo(size, p)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  })
}

/** Soft radial alpha blob — fake contact shadow under floating objects. */
export function radialShadowTexture(size = 256) {
  return cached(`radial-${size}`, () => {
    const [c, ctx] = canvas2d(size)
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.42)')
    g.addColorStop(0.45, 'rgba(0,0,0,0.16)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.NoColorSpace
    return t
  })
}

/* ----------------------------------------------------------- MATERIALS */

export function concreteMaterial(opts = {}) {
  const map = concreteTexture()
  return new THREE.MeshStandardMaterial({
    color: color(opts.color ?? 0xd7d1c6),
    roughness: 0.86,
    metalness: 0.0,
    roughnessMap: map,
    bumpMap: map,
    bumpScale: 0.28,
    envMapIntensity: 0.75,
    ...opts.override,
  })
}

export function plasterMaterial(hex = PAL.paper) {
  return new THREE.MeshStandardMaterial({
    color: color(hex),
    roughness: 0.94,
    metalness: 0,
    bumpMap: noiseTexture(256, 0.35),
    bumpScale: 0.06,
    envMapIntensity: 0.8,
  })
}

export function glassMaterial(opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: color(opts.color ?? PAL.glass),
    metalness: 0,
    roughness: 0.045,
    transmission: opts.transmission ?? 0.94,
    thickness: opts.thickness ?? 0.35,
    ior: 1.46,
    transparent: true,
    opacity: 1,
    reflectivity: 0.35,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
    ...opts.override,
  })
}

/** Cheap glass for low-tier devices — no transmission pass. */
export function glassLiteMaterial(opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: color(opts.color ?? PAL.glass),
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.34,
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
  })
}

export function timberMaterial(repeat = 2) {
  const map = timberTexture()
  map.repeat.set(repeat, repeat)
  return new THREE.MeshStandardMaterial({
    color: color(0xffffff),
    map,
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.7,
  })
}

export function metalMaterial(hex = 0x2f2b27, roughness = 0.34) {
  return new THREE.MeshStandardMaterial({
    color: color(hex),
    roughness,
    metalness: 0.92,
    envMapIntensity: 1.2,
  })
}

export function accentMaterial(hex = PAL.terra) {
  return new THREE.MeshStandardMaterial({
    color: color(hex),
    roughness: 0.55,
    metalness: 0.05,
    envMapIntensity: 0.9,
  })
}

export function lineMaterial(hex = PAL.blueprint, opacity = 0.55) {
  return new THREE.LineBasicMaterial({
    color: color(hex),
    transparent: true,
    opacity,
  })
}

/* ------------------------------------------------------------ LIGHTING */

/**
 * The house lighting rig: warm low sun, cool sky fill, and a rim that lifts
 * silhouettes off the light background.
 */
export function lightingRig(scene, opts = {}) {
  const {
    intensity = 1,
    shadows = true,
    sunPosition = [6.5, 9, 5.5],
    shadowArea = 12,
  } = opts

  const hemi = new THREE.HemisphereLight(color(0xf6f2ea), color(0xb4a894), 0.85 * intensity)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(color(0xfff1dc), 2.35 * intensity)
  sun.position.set(...sunPosition)
  if (shadows) {
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 60
    sun.shadow.camera.left = -shadowArea
    sun.shadow.camera.right = shadowArea
    sun.shadow.camera.top = shadowArea
    sun.shadow.camera.bottom = -shadowArea
    sun.shadow.bias = -0.0012
    sun.shadow.normalBias = 0.022
    sun.shadow.radius = 3
  }
  scene.add(sun)

  const fill = new THREE.DirectionalLight(color(0xcfe0ee), 0.55 * intensity)
  fill.position.set(-7, 4.5, -3.5)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(color(0xffd9b8), 0.9 * intensity)
  rim.position.set(-2.5, 3.2, -8)
  scene.add(rim)

  return { hemi, sun, fill, rim }
}

/** Invisible plane that only receives shadow — grounds a floating model. */
export function shadowCatcher(size = 40, opacity = 0.17) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShadowMaterial({ opacity })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true
  return mesh
}

/** Sprite-style soft shadow for scenes without a real shadow map. */
export function fakeShadow(width = 4, depth = 3, opacity = 0.5) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: radialShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    })
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

/* -------------------------------------------------------------- HELPERS */

/** Rounded-corner box profile, extruded — softer than BoxGeometry for UI-ish forms. */
export function roundedBox(w, h, d, r = 0.06, segments = 3) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: r * 0.5,
    bevelSize: r * 0.5,
    bevelSegments: segments,
    curveSegments: segments + 2,
  })
  geo.translate(0, 0, -d / 2)
  geo.computeVertexNormals()
  return geo
}

/** Wireframe edge overlay — the "drawing over the model" signature look. */
export function edgeOverlay(geometry, hex = PAL.ink, opacity = 0.22, threshold = 24) {
  const edges = new THREE.EdgesGeometry(geometry, threshold)
  return new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: color(hex), transparent: true, opacity })
  )
}
