import { boot } from '../core/app.js'
import initPageHero from '../sections/page-hero/page-hero.js'
import initServiceDetail from '../sections/service-detail/service-detail.js'
import initPackages from '../sections/packages/packages.js'
import initFaq from '../sections/faq/faq.js'
import initCta from '../sections/cta/cta.js'

boot({
  page: 'services',
  sections: [
    ['page-hero', initPageHero],
    ['service-detail', initServiceDetail],
    ['packages', initPackages],
    ['faq', initFaq],
    ['cta', initCta],
  ],
})
