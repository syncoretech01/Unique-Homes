/* ============================================================================
   SERVICES — the three pillars of the practice
   ========================================================================== */

export const services = [
  {
    id: 'architectural-packages',
    index: '01',
    label: 'Architectural Packages',
    title: 'Architectural\nPackages',
    lede: 'Detailed structural engineering drawings and cover sheets, sequenced and stamped so the set clears review the first time.',
    body:
      'We produce the complete construction document set — from the cover sheet and code summary through framing plans, foundation details and connection schedules. Every sheet is drawn from one coordinated BIM model, so a change to a beam propagates to the schedule, the section and the detail in the same pass.',
    accent: 'terra',
    theme: 'default',
    deliverables: [
      'Cover sheet, code summary & sheet index',
      'Foundation plan with pier and beam schedules',
      'Floor, roof and ceiling framing plans',
      'Wall sections, typical details & connection schedules',
      'Lateral bracing and shear wall layouts',
      'Door, window and finish schedules',
      'Structural notes and specification sheets',
      'Stamped and sealed submittal set',
    ],
    process: [
      { step: 'Model', note: 'Structure built in BIM before a single sheet is drawn.' },
      { step: 'Coordinate', note: 'Architectural, structural and MEP reconciled in one file.' },
      { step: 'Detail', note: 'Connections and assemblies resolved at 1½" = 1\'-0".' },
      { step: 'Issue', note: 'Sealed set delivered as PDF and DWG with a revision log.' },
    ],
    facts: [
      { k: 'Typical set', v: '18 – 46 sheets' },
      { k: 'Turnaround', v: '3 – 6 weeks' },
      { k: 'Formats', v: 'PDF · DWG · RVT · IFC' },
      { k: 'Revisions', v: 'Two rounds included' },
    ],
    keywords: ['Framing plans', 'Foundation design', 'Connection details', 'Code compliance'],
  },
  {
    id: 'civil-engineering',
    index: '02',
    label: 'Civil Engineering',
    title: 'Civil\nEngineering',
    lede: 'Comprehensive site plans tailored for new builds and home additions — grading, drainage and impervious cover, resolved against the real topography.',
    body:
      'Every lot argues with the building you want to put on it. We survey the constraints — setbacks, easements, drainage patterns, tree protection, impervious cover limits — and design a site plan that satisfies the reviewer and the water at the same time. Additions get the same rigour as ground-up builds, because that is usually where the fight is.',
    accent: 'blueprint',
    theme: 'blueprint',
    deliverables: [
      'Existing conditions and topographic base',
      'Site plan with setbacks, easements & tree protection',
      'Grading and drainage plan with spot elevations',
      'Impervious cover calculations and worksheets',
      'Erosion and sedimentation control plan',
      'Driveway, culvert and access geometry',
      'Utility routing and connection points',
      'Stormwater detention sizing where required',
    ],
    process: [
      { step: 'Survey', note: 'Topography, trees and utilities located on a shared datum.' },
      { step: 'Test fit', note: 'Building footprint tested against every setback and limit.' },
      { step: 'Grade', note: 'Water routed off the structure and away from neighbours.' },
      { step: 'Submit', note: 'Package assembled to each jurisdiction’s checklist.' },
    ],
    facts: [
      { k: 'Lot sizes', v: '0.1 – 40 acres' },
      { k: 'Turnaround', v: '2 – 5 weeks' },
      { k: 'Reviews', v: 'City · County · ETJ' },
      { k: 'Coordination', v: 'Surveyor & geotech included' },
    ],
    keywords: ['Grading & drainage', 'Impervious cover', 'Erosion control', 'Site logistics'],
  },
  {
    id: '3d-renderings',
    index: '03',
    label: '3D Renderings',
    title: '3D\nRenderings',
    lede: 'In-house 3D visualisation — the house photographed before it is built, from the model the drawings are already using.',
    body:
      'Our renders are not a separate marketing exercise. They come off the same coordinated model as the construction set, which means what the client approves is what gets built. Exterior studies, interior sets, material boards, drone-height context shots and walkthrough animation — all produced in the studio, never outsourced.',
    accent: 'ochre',
    theme: 'ink',
    deliverables: [
      'Exterior hero views with real site context',
      'Interior sets with specified finishes and furniture',
      'Material and lighting studies',
      'Sun path and shadow studies by season',
      'Aerial and street-level context shots',
      'Animated walkthroughs at 4K',
      'Real-time 360° panoramas for client review',
      'White-model massing for early design',
    ],
    process: [
      { step: 'Model', note: 'Geometry inherited from the working BIM model.' },
      { step: 'Dress', note: 'Real specified materials, furniture and planting.' },
      { step: 'Light', note: 'Sun position matched to the actual site and date.' },
      { step: 'Render', note: 'Delivered at print resolution with layered passes.' },
    ],
    facts: [
      { k: 'Resolution', v: 'Up to 8K stills' },
      { k: 'Turnaround', v: '5 – 12 days' },
      { k: 'Engine', v: 'Physically based, in house' },
      { k: 'Revisions', v: 'Unlimited on camera & light' },
    ],
    keywords: ['Exterior stills', 'Interior sets', 'Animation', 'Material studies'],
  },
]

export const serviceById = (id) => services.find((s) => s.id === id)

/** Compact list used by the footer, menus and the services overview. */
export const serviceLinks = services.map((s) => ({
  label: s.label,
  href: `/services/#${s.id}`,
  index: s.index,
}))

/** Engagement packages shown on the services page. */
export const packages = [
  {
    name: 'Addition',
    price: 'from $4,800',
    for: 'Single-storey additions, garage conversions, ADUs',
    includes: [
      'Existing conditions documentation',
      'Structural drawings for the addition',
      'Site plan with impervious cover',
      'One exterior render',
      'Permit submittal support',
    ],
    accent: false,
  },
  {
    name: 'New Build',
    price: 'from $12,500',
    for: 'Ground-up custom homes up to 5,000 sq ft',
    includes: [
      'Full architectural package',
      'Complete civil and grading set',
      'Foundation and framing design',
      'Four renders, interior and exterior',
      'Two review cycles with the jurisdiction',
      'Contractor bid-set coordination',
    ],
    accent: true,
  },
  {
    name: 'Visualisation',
    price: 'from $1,900',
    for: 'Studios and builders who need renders only',
    includes: [
      'Model built from your drawings',
      'Up to three hero views',
      'Material and lighting study',
      'One animated walkthrough',
      'Print-resolution delivery',
    ],
    accent: false,
  },
]
