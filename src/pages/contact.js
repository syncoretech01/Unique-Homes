import { boot } from '../core/app.js'
import initPageHero from '../sections/page-hero/page-hero.js'
import initContactForm from '../sections/contact-form/contact-form.js'
import initContactInfo from '../sections/contact-info/contact-info.js'

boot({
  page: 'contact',
  sections: [
    ['page-hero', initPageHero],
    ['contact-form', initContactForm],
    ['contact-info', initContactInfo],
  ],
})
