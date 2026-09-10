/* ============================================================================
   PROJECTS — selected residential work
   `plate` drives the procedural artwork generator (see src/lib/drawings.js):
   every project renders a unique architectural drawing instead of a photo.
   ========================================================================== */

export const projects = [
  {
    id: 'ridge-house',
    index: '01',
    name: 'Ridge House',
    location: 'Dripping Springs, TX',
    year: '2025',
    type: 'New build',
    size: '4,120 sq ft',
    status: 'In construction',
    services: ['Architectural Packages', 'Civil Engineering', '3D Renderings'],
    summary: 'A long limestone bar set into a ridge, holding the weather off a courtyard.',
    description:
      'The lot fell nine metres from the road to the treeline, so the house became a retaining wall that happens to have rooms behind it. Foundation stepping and drainage were designed together — the same set of section drawings solved both.',
    challenge: 'A nine-metre fall across the building line, with a drainage easement crossing the only buildable terrace.',
    solution:
      'We stepped the foundation in three plates and turned the retaining structure into the north wall of the house, moving the easement crossing into an open carport bay.',
    stats: [
      { k: 'Sheets issued', v: '46' },
      { k: 'Fall across site', v: '9.2 m' },
      { k: 'Review cycles', v: '1' },
      { k: 'Impervious cover', v: '31%' },
    ],
    plate: { kind: 'section', a: '#E9E3D8', b: '#D2C8B6', ink: '#27415A', accent: '#AE4E2A', seed: 12 },
    featured: true,
    tags: ['new-build', 'civil', 'renders'],
  },
  {
    id: 'cedar-fold',
    index: '02',
    name: 'Cedar Fold',
    location: 'Austin, TX',
    year: '2024',
    type: 'Addition',
    size: '1,180 sq ft',
    status: 'Complete',
    services: ['Architectural Packages', '3D Renderings'],
    summary: 'A folded roof plane that lets a 1940s bungalow grow without arguing with it.',
    description:
      'The existing rafters were undersized and out of plane. Rather than fight the old roof, the addition folds under it — a new steel ridge beam carries both, and the junction became the detail the whole project is about.',
    challenge: 'Historic-district massing limits and a roof structure that could not carry the new span.',
    solution:
      'A concealed steel ridge beam picks up both roofs, keeping the ridge line under the height limit while opening the rear elevation completely.',
    stats: [
      { k: 'Sheets issued', v: '24' },
      { k: 'New span', v: '7.4 m' },
      { k: 'Review cycles', v: '1' },
      { k: 'Existing retained', v: '82%' },
    ],
    plate: { kind: 'elevation', a: '#F2EDE4', b: '#DCD3C2', ink: '#2E2A25', accent: '#AE4E2A', seed: 27 },
    featured: true,
    tags: ['addition', 'renders'],
  },
  {
    id: 'basin-court',
    index: '03',
    name: 'Basin Court',
    location: 'Wimberley, TX',
    year: '2024',
    type: 'New build',
    size: '3,340 sq ft',
    status: 'Complete',
    services: ['Architectural Packages', 'Civil Engineering'],
    summary: 'Three volumes around a water court that doubles as the site’s detention.',
    description:
      'Detention was required, so we made it the front door. The courtyard basin holds a two-year storm and reads as a reflecting pool for the other 360 days.',
    challenge: 'Required stormwater detention on a lot with no room for a conventional pond.',
    solution:
      'The central court was sunk 600 mm and lined, functioning as detention volume during storms and as a reflecting court the rest of the year.',
    stats: [
      { k: 'Sheets issued', v: '38' },
      { k: 'Detention', v: '41 m³' },
      { k: 'Review cycles', v: '1' },
      { k: 'Trees retained', v: '14' },
    ],
    plate: { kind: 'site', a: '#EEF1F4', b: '#DDE4EA', ink: '#27415A', accent: '#AE4E2A', seed: 41 },
    featured: true,
    tags: ['new-build', 'civil'],
  },
  {
    id: 'travis-terrace',
    index: '04',
    name: 'Travis Terrace',
    location: 'Lakeway, TX',
    year: '2023',
    type: 'Addition',
    size: '860 sq ft',
    status: 'Complete',
    services: ['Civil Engineering', '3D Renderings'],
    summary: 'A cantilevered terrace that reaches past the setback the house could not.',
    description:
      'The lake view sat exactly where the building envelope stopped. A structural cantilever, permitted as an unenclosed projection, bought eleven feet of view without breaking the envelope.',
    challenge: 'A 25-foot shoreline setback standing between the house and the only reason to live there.',
    solution:
      'An unenclosed steel-framed terrace cantilevers 3.4 m past the wall line — permitted as a projection rather than habitable area.',
    stats: [
      { k: 'Sheets issued', v: '19' },
      { k: 'Cantilever', v: '3.4 m' },
      { k: 'Review cycles', v: '2' },
      { k: 'Renders delivered', v: '6' },
    ],
    plate: { kind: 'axon', a: '#F4EFE6', b: '#E0D6C4', ink: '#2E2A25', accent: '#C2934A', seed: 58 },
    featured: false,
    tags: ['addition', 'civil', 'renders'],
  },
  {
    id: 'quarry-annex',
    index: '05',
    name: 'Quarry Annex',
    location: 'San Marcos, TX',
    year: '2023',
    type: 'Adaptive reuse',
    size: '2,600 sq ft',
    status: 'Complete',
    services: ['Architectural Packages', 'Civil Engineering', '3D Renderings'],
    summary: 'A quarry office turned house, with the crane rail left where it was.',
    description:
      'Every existing member was surveyed and re-rated before we drew a line. The crane rail could carry the new mezzanine, so it stayed — and the whole structural narrative of the house is that decision.',
    challenge: 'An unrated existing steel frame with no drawings and sixty years of modification.',
    solution:
      'Laser survey plus member testing produced an as-built model we could analyse; the original crane rail was re-rated and reused as the mezzanine support.',
    stats: [
      { k: 'Sheets issued', v: '52' },
      { k: 'Steel reused', v: '76%' },
      { k: 'Review cycles', v: '2' },
      { k: 'Survey points', v: '4.2 M' },
    ],
    plate: { kind: 'framing', a: '#EDE8DE', b: '#D6CCB9', ink: '#27415A', accent: '#AE4E2A', seed: 73 },
    featured: true,
    tags: ['reuse', 'renders', 'civil'],
  },
  {
    id: 'juniper-row',
    index: '06',
    name: 'Juniper Row',
    location: 'Austin, TX',
    year: '2022',
    type: 'New build',
    size: '5 × 1,640 sq ft',
    status: 'Complete',
    services: ['Architectural Packages', 'Civil Engineering'],
    summary: 'Five narrow houses sharing one drainage strategy and one party-wall detail.',
    description:
      'Repetition is only cheap if the details are right the first time. One party-wall assembly, drawn once and tested, carried all five units through review together.',
    challenge: 'Five separate permits, one shared drainage system, and a party wall detail repeated forty times.',
    solution:
      'A single typical-details sheet governed all five units, and the drainage was permitted as one shared system with per-unit tie-ins.',
    stats: [
      { k: 'Sheets issued', v: '61' },
      { k: 'Units', v: '5' },
      { k: 'Review cycles', v: '1' },
      { k: 'Shared systems', v: '3' },
    ],
    plate: { kind: 'plan', a: '#F1ECE2', b: '#DBD1BE', ink: '#2E2A25', accent: '#4F5F49', seed: 89 },
    featured: false,
    tags: ['new-build', 'civil'],
  },
  {
    id: 'hollow-studio',
    index: '07',
    name: 'Hollow Studio',
    location: 'Blanco, TX',
    year: '2022',
    type: 'Outbuilding',
    size: '640 sq ft',
    status: 'Complete',
    services: ['Architectural Packages', '3D Renderings'],
    summary: 'A one-room studio with a roof that collects everything that falls on it.',
    description:
      'Off-grid, so the roof had to do two jobs: shed weather and harvest it. The gutter is the structure.',
    challenge: 'No mains water, and a rainwater harvest target of 22,000 litres a year.',
    solution:
      'The roof was pitched to a single structural gutter beam that spans the building and feeds a buried cistern at the low corner.',
    stats: [
      { k: 'Sheets issued', v: '16' },
      { k: 'Harvest', v: '24 kL/yr' },
      { k: 'Review cycles', v: '1' },
      { k: 'Footprint', v: '640 sq ft' },
    ],
    plate: { kind: 'detail', a: '#F4F0E8', b: '#E2DACB', ink: '#2E2A25', accent: '#C2934A', seed: 104 },
    featured: false,
    tags: ['new-build', 'renders'],
  },
  {
    id: 'mesa-additions',
    index: '08',
    name: 'Mesa Additions',
    location: 'Georgetown, TX',
    year: '2021',
    type: 'Addition',
    size: '1,450 sq ft',
    status: 'Complete',
    services: ['Architectural Packages', 'Civil Engineering', '3D Renderings'],
    summary: 'Two additions, ten years apart, drawn so the second one was already possible.',
    description:
      'The first phase was documented as though the second already existed — sleeved footings, stubbed services, a roof edge detailed to be cut. When the family came back, the drawings were waiting.',
    challenge: 'A staged expansion where phase two was a decade away and not yet funded.',
    solution:
      'Phase one included sleeved foundations and capped service runs at the future wall line, so phase two required no demolition of new work.',
    stats: [
      { k: 'Sheets issued', v: '29' },
      { k: 'Phases', v: '2' },
      { k: 'Years between', v: '10' },
      { k: 'Rework', v: 'None' },
    ],
    plate: { kind: 'axon', a: '#EFEAE0', b: '#D9CFBC', ink: '#27415A', accent: '#AE4E2A', seed: 121 },
    featured: false,
    tags: ['addition', 'civil', 'renders'],
  },
]

export const projectFilters = [
  { id: 'all', label: 'All work' },
  { id: 'new-build', label: 'New builds' },
  { id: 'addition', label: 'Additions' },
  { id: 'civil', label: 'Civil' },
  { id: 'renders', label: 'Visualisation' },
  { id: 'reuse', label: 'Adaptive reuse' },
]

export const featuredProjects = projects.filter((p) => p.featured)
export const projectById = (id) => projects.find((p) => p.id === id)
