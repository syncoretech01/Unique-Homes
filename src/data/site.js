/* ============================================================================
   SITE CONTENT — brand, navigation, contact, credentials
   Placeholder copy for a fictional studio. Phone numbers use the reserved
   555 range; replace all of this with real studio details before launch.
   ========================================================================== */

export const brand = {
  name: 'Unique Homes and Design',
  short: 'UH&D',
  initials: 'UHD',
  tagline: 'Architecture, engineering and visualisation under one roof.',
  since: 2009,
  description:
    'A residential architecture and engineering studio producing permit-ready drawing sets, site-tailored civil packages and photoreal visualisation — all in house.',
}

export const contact = {
  email: 'studio@uniquehomesanddesign.com',
  emailNew: 'newwork@uniquehomesanddesign.com',
  phone: '+1 (512) 555-0142',
  phoneHref: 'tel:+15125550142',
  address: {
    line1: '1204 East Sixth Street',
    line2: 'Suite 300',
    city: 'Austin',
    state: 'TX',
    zip: '78702',
    country: 'United States',
  },
  hours: 'Monday – Friday, 8:30 – 18:00 CT',
  timezone: 'America/Chicago',
  tzLabel: 'CT',
  coords: { lat: 30.2672, lng: -97.7431 },
  social: [
    { label: 'Instagram', href: '#', handle: '@uniquehomesanddesign' },
    { label: 'LinkedIn', href: '#', handle: 'unique-homes-and-design' },
    { label: 'Pinterest', href: '#', handle: 'uhd.studio' },
    { label: 'Houzz', href: '#', handle: 'uhd-austin' },
  ],
}

export const nav = [
  { label: 'Studio', href: '/studio/', index: '01', blurb: 'Who we are, how we work' },
  { label: 'Services', href: '/services/', index: '02', blurb: 'Drawings, civil, visualisation' },
  { label: 'Projects', href: '/projects/', index: '03', blurb: 'Selected residential work' },
  { label: 'Journal', href: '/journal/', index: '04', blurb: 'Notes from the drawing board' },
  { label: 'Contact', href: '/contact/', index: '05', blurb: 'Start a project' },
]

export const stats = [
  { value: 480, suffix: '+', label: 'Drawing sets issued', note: 'Permit-ready packages since 2009' },
  { value: 16, suffix: '', label: 'Years in practice', note: 'Residential and light commercial' },
  { value: 98, suffix: '%', label: 'First-submittal approval', note: 'Across Central Texas jurisdictions' },
  { value: 34, suffix: '', label: 'Jurisdictions permitted', note: 'City, county and ETJ reviews' },
]

export const credentials = [
  { label: 'Licensed Architecture', value: 'TX Reg. No. 00-0000', note: 'Registered practice' },
  { label: 'Professional Engineering', value: 'TX PE Firm F-00000', note: 'Structural and civil' },
  { label: 'Insurance', value: 'Professional liability', note: '$2M per claim / aggregate' },
  { label: 'Software', value: 'Revit · Civil 3D · Corona', note: 'BIM-first documentation' },
]

export const recognitions = [
  { year: '2025', title: 'Residential Architecture Review', award: 'Shortlist — Hill Country House' },
  { year: '2024', title: 'Small Practice Awards', award: 'Documentation Merit' },
  { year: '2024', title: 'Visualisation Annual', award: 'Selected Work — Interiors' },
  { year: '2023', title: 'Regional Design Review', award: 'Honourable Mention — Ridge Addition' },
  { year: '2022', title: 'Home Building Excellence', award: 'Finalist — Adaptive Reuse' },
]

export const marqueeWords = [
  'Structural drawings',
  'Site plans',
  'Photoreal renders',
  'Permit sets',
  'Grading & drainage',
  'Additions',
  'New builds',
  'Cover sheets',
  'Foundation design',
  'Walkthrough animation',
]

/** Copy used by the closing call-to-action on every page. */
export const cta = {
  eyebrow: 'Start a project',
  title: 'Let us draw the\nnext one together.',
  body:
    'Send the site address, a sketch, or nothing at all. We will tell you what the drawing set needs to contain and what it will cost — usually within two working days.',
  primary: { label: 'Start a project', href: '/contact/' },
  secondary: { label: 'See our services', href: '/services/' },
}
