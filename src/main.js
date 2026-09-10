import { boot } from './core/app.js'
import initHero from './sections/hero/hero.js'
import initManifesto from './sections/manifesto/manifesto.js'
import initServicesLayers from './sections/services-layers/services-layers.js'
import initStory from './sections/story/story.js'
import initShowcase from './sections/showcase/showcase.js'
import initAnatomy from './sections/anatomy/anatomy.js'
import initGallery3d from './sections/gallery3d/gallery3d.js'
import initProcessColumns from './sections/process-columns/process-columns.js'
import initVoices from './sections/voices/voices.js'
import initJournalPreview from './sections/journal-preview/journal-preview.js'
import initCta from './sections/cta/cta.js'

boot({
  page: 'home',
  sections: [
    ['hero', initHero],
    ['manifesto', initManifesto],
    ['services-layers', initServicesLayers],
    ['story', initStory],
    ['showcase', initShowcase],
    ['anatomy', initAnatomy],
    ['gallery3d', initGallery3d],
    ['process-columns', initProcessColumns],
    ['voices', initVoices],
    ['journal-preview', initJournalPreview],
    ['cta', initCta],
  ],
})
