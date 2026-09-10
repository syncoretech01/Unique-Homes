/* ============================================================================
   CONTACT FORM

   The UI kit ([data-form] in src/ui/index.js) already owns validation, the
   error messages, the shake on the first invalid field and the swap to the
   success panel. This module adds the four things it has no opinion about:

     1  the services chips, rendered from src/data/services.js;
     2  the completeness meter — "4 / 9 complete" — driven by input/change;
     3  the submit button's loading state, inserted ahead of the kit by
        intercepting the click that would otherwise submit the form, and
        skipped entirely when the form is not yet valid (a spinner followed
        by an error is a lie);
     4  an honest exit: the success panel's mail button is given a mailto
        pre-filled with everything just typed, written BEFORE the kit resets
        the form, so "this went nowhere" comes with a route that works.

   Everything else — the drawn hairline, the floating label, the invalid
   shake — is CSS or the kit. Bespoke motion is limited to the chip pop and
   the meter tick, and both are skipped under reduced motion.
   ========================================================================== */
import './contact-form.css'
import { gsap, EASE } from '../../core/motion.js'
import { qs, qsa } from '../../lib/utils.js'
import { plateHTML } from '../../lib/drawings.js'
import { brand, contact } from '../../data/site.js'
import { services } from '../../data/services.js'

/* --------------------------------------------------------------- HELPERS */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"]/g, (c) => ENTITIES[c])

/** Mirrors the kit's own rule so the loading state is never shown on a form
    the kit is about to reject. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const MESSAGE_MIN = 20
const LOADING_MS = 820
const MAILTO_BODY_MAX = 1400

/** Drawing colours are read from the token layer, never hardcoded. */
function readPalette() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback
  return {
    a: v('--c-shell', '#EBE5DB'),
    b: v('--c-sand', '#DFD7C9'),
    ink: v('--c-blueprint', '#27415A'),
    accent: v('--c-terra', '#AE4E2A'),
  }
}

function chipHTML(name, value, type) {
  return (
    `<label class="chip contact-form__chip">` +
      `<input class="contact-form__chip-input" type="${type}" name="${esc(name)}" value="${esc(value)}" />` +
      `<span class="contact-form__chip-fill" aria-hidden="true"></span>` +
      `<svg class="contact-form__chip-tick" viewBox="0 0 12 12" aria-hidden="true" focusable="false">` +
        `<circle cx="6" cy="6" r="4.7" /><path d="M3.2 6.3 5.4 8.5 8.9 3.9" />` +
      `</svg>` +
      `<span class="contact-form__chip-text">${esc(value)}</span>` +
    `</label>`
  )
}

/* ------------------------------------------------------------------ INIT */

export default function initContactForm(ctx = {}) {
  const root = document.querySelector('[data-section="contact-form"]')
  if (!root) return

  const form = qs('[data-cf-form]', root)
  if (!form) return

  const reduced = !!ctx.reduced

  /* ------------------------------------------------------- studio data */

  const emailLink = qs('[data-cf-email]', root)
  if (emailLink) {
    emailLink.setAttribute('href', `mailto:${contact.email}`)
    emailLink.textContent = contact.email
  }

  const copyBtn = qs('[data-cf-copy]', root)
  if (copyBtn) copyBtn.dataset.copy = contact.email

  const phoneLink = qs('[data-cf-phone]', root)
  if (phoneLink) {
    phoneLink.setAttribute('href', contact.phoneHref)
    phoneLink.textContent = contact.phone
  }

  const consentText = qs('[data-cf-consent-text]', root)
  if (consentText) {
    consentText.innerHTML =
      `I agree that ${esc(brand.name)} may store these details and contact me about this ` +
      `enquiry. Nothing is passed to anyone else. ` +
      `<span class="contact-form__req" aria-hidden="true">*</span>`
  }

  /* -------------------------------------------------------- site drawing */

  const plateMount = qs('[data-cf-plate]', root)
  if (plateMount) {
    const pal = readPalette()
    plateMount.innerHTML = plateHTML(
      { kind: 'site', a: pal.a, b: pal.b, ink: pal.ink, accent: pal.accent, seed: 23 },
      { ratio: '4/3', showTitleBlock: false, density: 0.85, strokeScale: 0.8 }
    )
  }

  /* ------------------------------------------------------- services chips */

  const servicesMount = qs('[data-cf-services]', form)
  if (servicesMount) {
    const options = services.map((s) => s.label).concat('Not sure — advise me')
    servicesMount.innerHTML = options.map((label) => chipHTML('services', label, 'checkbox')).join('')
  }

  /* ------------------------------------------------------------- readers */

  const value = (name) => {
    const node = qs(`[name="${name}"]`, form)
    return node ? String(node.value || '').trim() : ''
  }
  const chosen = (name) => qsa(`input[name="${name}"]:checked`, form).map((i) => i.value)

  /* ------------------------------------------------------- progress meter */

  const CHECKS = [
    () => value('name').length > 1,
    () => EMAIL_RE.test(value('email')),
    () => value('phone').replace(/\D/g, '').length >= 7,
    () => value('address').length >= 3,
    () => chosen('build').length > 0,
    () => chosen('services').length > 0,
    () => chosen('budget').length > 0,
    () => value('timeline').length > 0,
    () => value('message').length >= MESSAGE_MIN,
  ]

  const progress = qs('[data-cf-progress]', form)
  const progressCount = qs('[data-cf-progress-count]', form)
  const progressFill = qs('[data-cf-progress-fill]', form)
  const total = CHECKS.length
  let lastCount = -1
  let tickTimer = 0

  if (progress) progress.setAttribute('aria-valuemax', String(total))

  function paintProgress() {
    let count = 0
    for (const check of CHECKS) if (check()) count += 1
    if (count === lastCount) return

    const rising = count > lastCount && lastCount >= 0
    lastCount = count

    if (progressCount) progressCount.textContent = `${count} / ${total}`
    if (progressFill) progressFill.style.transform = `scaleX(${count / total})`
    if (progress) {
      progress.setAttribute('aria-valuenow', String(count))
      progress.setAttribute('aria-valuetext', `${count} of ${total} details complete`)
      progress.classList.toggle('is-complete', count === total)

      if (rising && !reduced) {
        progress.classList.remove('is-tick')
        // Re-adding the class alone would not replay the keyframes.
        void progress.offsetWidth
        progress.classList.add('is-tick')
        window.clearTimeout(tickTimer)
        tickTimer = window.setTimeout(() => progress.classList.remove('is-tick'), 700)
      }
    }

    if (count === total && rising && !reduced && submit) {
      gsap.fromTo(submit, { scale: 0.975 }, { scale: 1, duration: 0.7, ease: EASE.back, clearProps: 'transform' })
    }
  }

  /* --------------------------------------------------------- message hint */

  const message = qs('#cf-message', form)
  const hint = qs('[data-cf-hint]', form)
  const hintIdle = hint ? hint.textContent.trim() : ''

  function paintHint() {
    if (!hint || !message) return
    const len = String(message.value || '').trim().length
    if (!len) {
      hint.textContent = hintIdle
      hint.classList.remove('is-met')
      return
    }
    if (len < MESSAGE_MIN) {
      hint.textContent = `${len} / ${MESSAGE_MIN} characters`
      hint.classList.remove('is-met')
      return
    }
    hint.textContent = `${len} characters — enough to work with`
    hint.classList.add('is-met')
  }

  /* ------------------------------------------------------- choice states */

  function syncChoices() {
    qsa('.contact-form__chip', form).forEach((chip) => {
      const input = qs('.contact-form__chip-input', chip)
      chip.classList.toggle('is-active', !!(input && input.checked))
    })
    qsa('.contact-form__seg-item', form).forEach((item) => {
      const input = qs('.contact-form__seg-input', item)
      item.classList.toggle('is-active', !!(input && input.checked))
    })
  }

  /* ------------------------------------------------------------ mailto  */

  function buildMailto() {
    const lines = []
    const push = (label, text) => {
      if (text) lines.push(`${label}: ${text}`)
    }
    push('Name', value('name'))
    push('Email', value('email'))
    push('Phone', value('phone'))
    push('Project address', value('address'))
    push('Project type', chosen('build').join(', '))
    push('Services', chosen('services').join(', '))
    push('Budget', chosen('budget').join(', '))
    push('Timeline', value('timeline'))

    const note = value('message')
    const body = `${lines.join('\n')}${note ? `\n\nAbout the project:\n${note}` : ''}`
    const who = value('name')
    const subject = who ? `Project enquiry — ${who}` : 'Project enquiry'

    return (
      `mailto:${contact.email}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body.slice(0, MAILTO_BODY_MAX))}`
    )
  }

  /* ---------------------------------------------------------- validation */

  /** The kit's rules, restated so we can ask "is this worth a spinner?". */
  function isValid(input) {
    const required = input.hasAttribute('required')
    if (input.type === 'checkbox') return !required || input.checked
    const text = String(input.value || '').trim()
    if (required && !text) return false
    if (text && input.type === 'email' && !EMAIL_RE.test(text)) return false
    const min = Number(input.dataset.minLength || 0)
    if (text && min && text.length < min) return false
    return true
  }

  const invalidFields = () =>
    qsa('input:not([type="hidden"]), textarea, select', form).filter((node) => !isValid(node))

  /* ------------------------------------------------------- submit + load */

  const submit = qs('[data-cf-submit]', form)
  const successMail = qs('[data-cf-success-mail]', root)
  let busy = false
  let loadTimer = 0

  function setLoading(on) {
    if (!submit) return
    submit.classList.toggle('is-loading', on)
    submit.disabled = on
    form.setAttribute('aria-busy', on ? 'true' : 'false')
    if (on) submit.setAttribute('aria-label', 'Checking your details')
    else submit.removeAttribute('aria-label')
  }

  /** Hand the form to the kit, which validates it and paints the outcome. */
  function handOver() {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }

  if (submit) {
    submit.addEventListener('click', (event) => {
      event.preventDefault()
      if (busy) return

      const bad = invalidFields()
      if (bad.length) {
        // The kit messages every invalid field, shakes the first and focuses
        // it; the rest are shaken here so the whole set reads as one refusal.
        handOver()
        if (!reduced) {
          bad.slice(1).forEach((input, i) => {
            const wrap = input.closest('.field')
            if (!wrap) return
            gsap.fromTo(
              wrap,
              { x: -7 },
              { x: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.35)', delay: 0.06 * (i + 1) }
            )
          })
        }
        return
      }

      // Written before the kit resets the form on success.
      if (successMail) successMail.setAttribute('href', buildMailto())

      busy = true
      setLoading(true)
      window.clearTimeout(loadTimer)
      loadTimer = window.setTimeout(() => {
        busy = false
        setLoading(false)
        handOver()
      }, reduced ? 140 : LOADING_MS)
    })
  }

  /* -------------------------------------------------------------- events */

  form.addEventListener('input', () => {
    paintProgress()
    paintHint()
  })

  form.addEventListener('change', (event) => {
    syncChoices()
    paintProgress()

    if (reduced) return
    const target = event.target
    const chip = target && target.closest ? target.closest('.contact-form__chip') : null
    if (chip && target.checked) {
      gsap.fromTo(chip, { scale: 0.95 }, { scale: 1, duration: 0.55, ease: EASE.back, clearProps: 'transform' })
    }
  })

  // The kit calls form.reset() when it reveals the success panel, and again
  // behind "Write another".
  form.addEventListener('reset', () => {
    window.requestAnimationFrame(() => {
      syncChoices()
      lastCount = -1
      paintProgress()
      paintHint()
    })
  })

  /* ----------------------------------------------------------- first run */

  syncChoices()
  paintProgress()
  paintHint()

  // The chips were built after the kit's boot sweep; this makes sure any
  // later enhancement pass sees them.
  ctx.bus?.emit?.('ui:refresh')
}
