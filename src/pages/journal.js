import { boot } from '../core/app.js'
import initPageHero from '../sections/page-hero/page-hero.js'
import initJournalIndex from '../sections/journal-index/journal-index.js'
import initCta from '../sections/cta/cta.js'

boot({
  page: 'journal',
  sections: [
    ['page-hero', initPageHero],
    ['journal-index', initJournalIndex],
    ['cta', initCta],
  ],
})
