import { boot } from '../core/app.js'
import initPageHero from '../sections/page-hero/page-hero.js'
import initStudioStory from '../sections/studio-story/studio-story.js'
import initStudioTeam from '../sections/studio-team/studio-team.js'
import initRecognition from '../sections/recognition/recognition.js'
import initCta from '../sections/cta/cta.js'

boot({
  page: 'studio',
  sections: [
    ['page-hero', initPageHero],
    ['studio-story', initStudioStory],
    ['studio-team', initStudioTeam],
    ['recognition', initRecognition],
    ['cta', initCta],
  ],
})
