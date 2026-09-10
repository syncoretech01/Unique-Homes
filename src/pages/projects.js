import { boot } from '../core/app.js'
import initPageHero from '../sections/page-hero/page-hero.js'
import initProjectsIndex from '../sections/projects-index/projects-index.js'
import initCta from '../sections/cta/cta.js'

boot({
  page: 'projects',
  sections: [
    ['page-hero', initPageHero],
    ['projects-index', initProjectsIndex],
    ['cta', initCta],
  ],
})
