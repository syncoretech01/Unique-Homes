/* ============================================================================
   CONTENT — process, team, testimonials, journal, FAQ, manifesto
   ========================================================================== */

export const manifesto = {
  eyebrow: 'The practice',
  title: 'Drawings are\npromises.',
  lede:
    'A construction document is a promise that the thing can be built — at this cost, on this lot, by these people, under this code. We keep that promise by doing the architecture, the engineering and the visualisation in one room.',
  paragraphs: [
    'Most residential projects fail in the gaps between consultants. The architect draws a wall, the engineer sizes a beam that will not fit inside it, and the render shows a window that the framing plan never had room for. Nobody is wrong. The information simply never met.',
    'We removed the gaps. One coordinated model produces the permit set, the site plan and the renders, so a change in any of them is a change in all of them. It is slower for the first two weeks and considerably faster for the next six months.',
  ],
  signature: 'Unique Homes and Design — Austin, Texas',
}

export const process = [
  {
    index: '01',
    title: 'Site & brief',
    duration: 'Week 1',
    summary: 'We read the lot before we draw the house.',
    detail:
      'Survey, topography, easements, tree canopy, drainage patterns and the code that governs all of them. The constraints get written down before anybody has an opinion about the architecture.',
    outputs: ['Constraints map', 'Code summary', 'Budget envelope'],
  },
  {
    index: '02',
    title: 'Test fits',
    duration: 'Weeks 2 – 3',
    summary: 'Three schemes, drawn far enough to be argued with.',
    detail:
      'Massing options tested against setbacks, impervious cover and cost per square foot. Each option is priced roughly, so the conversation is about trade-offs rather than taste.',
    outputs: ['Three massing options', 'Comparative costings', 'Preferred scheme'],
  },
  {
    index: '03',
    title: 'Coordinated model',
    duration: 'Weeks 4 – 6',
    summary: 'One model — architecture, structure and site together.',
    detail:
      'The BIM model becomes the single source of truth. Structural members are sized as they are drawn; the civil grading is modelled against the same datum as the finished floor.',
    outputs: ['Federated BIM model', 'Structural sizing', 'Grading strategy'],
  },
  {
    index: '04',
    title: 'Visualisation',
    duration: 'Weeks 6 – 7',
    summary: 'The house photographed before anybody digs.',
    detail:
      'Renders come off the coordinated model with real specified materials, so what is approved is what is documented and what is built.',
    outputs: ['Exterior hero views', 'Interior sets', 'Material board'],
  },
  {
    index: '05',
    title: 'Documentation',
    duration: 'Weeks 7 – 11',
    summary: 'Every sheet the builder and the reviewer need.',
    detail:
      'Cover sheet through connection details, drawn at the scale the trade actually works at. Schedules generate from the model, so they cannot drift out of step.',
    outputs: ['Permit set', 'Civil package', 'Specifications'],
  },
  {
    index: '06',
    title: 'Permit & build',
    duration: 'Ongoing',
    summary: 'We stay on the drawing until it is a building.',
    detail:
      'We answer the reviewer, issue the revisions, respond to contractor RFIs and update the model as the field forces changes. The as-built set is yours at the end.',
    outputs: ['Review responses', 'RFI log', 'As-built model'],
  },
]

export const team = [
  {
    name: 'Marisol Adeyemi',
    role: 'Principal Architect',
    initials: 'MA',
    since: '2009',
    bio: 'Founded the practice after eleven years documenting institutional work. Believes a wall section tells you everything about a studio.',
    focus: ['Documentation', 'Detailing', 'Code strategy'],
    hue: 18,
  },
  {
    name: 'Devin Okonkwo',
    role: 'Structural Lead, PE',
    initials: 'DO',
    since: '2012',
    bio: 'Sizes members while the architecture is still moving, which is the only way it ever fits. Ten years in long-span timber before residential.',
    focus: ['Framing design', 'Foundations', 'Lateral systems'],
    hue: 200,
  },
  {
    name: 'Ines Vargas',
    role: 'Civil Lead, PE',
    initials: 'IV',
    since: '2015',
    bio: 'Reads a topographic survey the way other people read a floor plan. Has never lost a drainage argument with a reviewer.',
    focus: ['Grading', 'Drainage', 'Permitting'],
    hue: 150,
  },
  {
    name: 'Theo Lindqvist',
    role: 'Visualisation Director',
    initials: 'TL',
    since: '2018',
    bio: 'Came from film lighting. Insists that a render with invented materials is a lie you have to build later.',
    focus: ['Lighting', 'Materials', 'Animation'],
    hue: 38,
  },
  {
    name: 'Priya Raghunathan',
    role: 'Project Architect',
    initials: 'PR',
    since: '2019',
    bio: 'Runs the additions studio. Specialises in old houses that were never drawn in the first place.',
    focus: ['Additions', 'Existing conditions', 'Survey'],
    hue: 280,
  },
  {
    name: 'Sam Whitaker',
    role: 'BIM Manager',
    initials: 'SW',
    since: '2020',
    bio: 'Keeps the model honest. Wrote the sheet-numbering standard everybody here now argues about.',
    focus: ['BIM standards', 'Automation', 'Schedules'],
    hue: 96,
  },
]

export const testimonials = [
  {
    quote:
      'The set went through review on the first submittal. In eleven years of building in this county, that had never happened to me.',
    author: 'Grant Mueller',
    role: 'General Contractor',
    company: 'Mueller Build Co.',
    project: 'Ridge House',
  },
  {
    quote:
      'They showed us a render in week six and the house we walked into two years later was the same building. Same light, same stone, same everything.',
    author: 'Ana & Petros Halkias',
    role: 'Clients',
    company: 'Basin Court',
    project: 'Basin Court',
  },
  {
    quote:
      'Our old bungalow had no drawings at all. They surveyed it, modelled it, and then designed an addition that touches it in exactly four places.',
    author: 'Rachel Boone',
    role: 'Client',
    company: 'Cedar Fold',
    project: 'Cedar Fold',
  },
  {
    quote:
      'The civil package answered questions the reviewer had not asked yet. That is the difference between two weeks and four months.',
    author: 'Daniel Ortiz',
    role: 'Development Manager',
    company: 'Northline Partners',
    project: 'Juniper Row',
  },
]

export const journal = [
  {
    id: 'first-submittal',
    index: '01',
    title: 'What a first-submittal approval actually costs',
    excerpt:
      'Clearing review on the first pass is not luck. It is roughly forty extra hours spent before the set leaves the office — and it saves about four hundred.',
    category: 'Documentation',
    date: 'March 2025',
    readTime: '6 min',
    hue: 22,
  },
  {
    id: 'impervious-cover',
    index: '02',
    title: 'Impervious cover is a design tool, not a limit',
    excerpt:
      'Most lots hit the cover limit at the driveway. Move the driveway and you get a room back — here is how we test it before anybody falls in love with a plan.',
    category: 'Civil',
    date: 'January 2025',
    readTime: '8 min',
    hue: 200,
  },
  {
    id: 'renders-that-lie',
    index: '03',
    title: 'The render that lies to you',
    excerpt:
      'If the visualisation is built from a different model than the drawings, it is marketing. Here is what we changed to make ours evidence instead.',
    category: 'Visualisation',
    date: 'November 2024',
    readTime: '5 min',
    hue: 38,
  },
  {
    id: 'old-houses',
    index: '04',
    title: 'Documenting a house that was never drawn',
    excerpt:
      'Nine out of ten additions start with an existing building nobody has a plan for. Laser survey, tolerance and the art of the honest as-built.',
    category: 'Additions',
    date: 'September 2024',
    readTime: '7 min',
    hue: 150,
  },
  {
    id: 'reading-a-survey',
    index: '05',
    title: 'Reading a topographic survey in ten minutes',
    excerpt:
      'Contours, easements, the sanitary invert and the tree schedule — the four things worth finding on a survey before anybody draws a house.',
    category: 'Civil',
    date: 'July 2024',
    readTime: '9 min',
    hue: 196,
  },
  {
    id: 'cover-sheet',
    index: '06',
    title: 'The cover sheet is not a cover',
    excerpt:
      'A rendering on the front page tells a reviewer nothing. Here is what ours carry instead, and why the sheet index is generated rather than typed.',
    category: 'Documentation',
    date: 'May 2024',
    readTime: '4 min',
    hue: 14,
  },
  {
    id: 'staging-an-addition',
    index: '07',
    title: 'Designing the addition you will build in 2035',
    excerpt:
      'Half our clients build in two moves. Three decisions in the first phase make the second one cheap — and getting them wrong makes it a demolition.',
    category: 'Additions',
    date: 'March 2024',
    readTime: '7 min',
    hue: 120,
  },
  {
    id: 'pier-or-slab',
    index: '08',
    title: 'Pier-and-beam or slab: let the lot decide',
    excerpt:
      'Potential vertical rise, fall across the footprint and flood elevation choose the foundation. Preference does not, and preference is what most people arrive with.',
    category: 'Structure',
    date: 'January 2024',
    readTime: '8 min',
    hue: 268,
  },
]

export const faq = [
  {
    q: 'Do you work outside Central Texas?',
    a: 'Yes. Architectural packages and visualisation travel anywhere — we have documented projects in nine states. Civil work is tied to local jurisdiction knowledge, so outside our region we partner with a local civil engineer of record and coordinate the package from here.',
  },
  {
    q: 'Can you take on just the drawings, or just the renders?',
    a: 'Both. Roughly a third of our work is documentation for other designers, and a quarter is visualisation for studios and builders who model nothing themselves. The three services are designed to work together but none of them requires the others.',
  },
  {
    q: 'How long does a permit set take?',
    a: 'An addition set is typically three to four weeks from an agreed scheme. A ground-up custom home runs six to eleven weeks depending on the structural complexity and how much civil work the lot demands. We give you a dated schedule before you sign anything.',
  },
  {
    q: 'What do you need from me to start?',
    a: 'A site address and a rough idea of what you want to build. That is genuinely enough for a first conversation. Before we draw, we will need a boundary and topographic survey — we can recommend surveyors and coordinate it for you.',
  },
  {
    q: 'Do you stamp and seal the drawings?',
    a: 'Yes. Architectural and structural drawings are sealed by our registered architect and professional engineer, and civil packages are sealed by our civil PE. Everything we issue for permit is submittal-ready.',
  },
  {
    q: 'What happens if the reviewer comes back with comments?',
    a: 'We respond to them. Review responses and the resulting revisions are included in every package we issue — we do not bill hourly for defending our own drawings.',
  },
  {
    q: 'Can you work with my builder’s existing plans?',
    a: 'Often, yes. We will review what exists, tell you honestly what is usable, and quote for the gap. Where the existing set is not salvageable we will say so rather than build on top of it.',
  },
  {
    q: 'How do you charge?',
    a: 'Fixed fee, quoted per package, with the scope written down in plain language. No percentage-of-construction-cost arrangements, and no hourly surprises. Two revision rounds are included in every fee.',
  },
]

/** Short capability lines used in the layered services section. */
export const capabilities = [
  { k: 'BIM-first', v: 'One coordinated model behind every deliverable' },
  { k: 'Sealed sets', v: 'Architect and PE stamps in house' },
  { k: 'Single studio', v: 'No outsourced drafting, no outsourced renders' },
  { k: 'Fixed fees', v: 'Scope written down before work begins' },
]
