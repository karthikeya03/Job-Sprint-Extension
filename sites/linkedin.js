;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint LinkedIn] loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, user, autoApply } = await JS.getProfile()
  const token = user?.token || ''

  console.log('[JobSprint LinkedIn] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) {
    console.log('[JobSprint LinkedIn] over daily limit')
    return
  }

  const path = window.location.pathname
  const urlParams = new URLSearchParams(window.location.search)
  const hasKeywords = urlParams.has('keywords') && urlParams.get('keywords').length > 0

  // ── Step 1: Not on search results OR no keywords in URL → navigate ─────────
  if (!path.startsWith('/jobs/search') || !hasKeywords) {
    await navigateToFilteredJobs(profile)
    return
  }

  // ── Step 2: On search results WITH keywords → scroll and apply ────────────
  await JS.sleep(2000)
  await scrollToLoadAll()
  await applyToListings(profile, token)

  // ─────────────────────────────────────────────────────────────────────────

  async function navigateToFilteredJobs(profile) {
    const role = (
      profile.preferred_roles?.[0] ||
      profile.current_job_title ||
      profile.skills?.[0] ||
      ''
    ).trim()

    const city = (
      profile.preferred_cities?.[0] ||
      profile.location ||
      ''
    ).trim()

    if (!role) {
      JS.showToast('No preferred role found in profile', 'error')
      return
    }

    console.log('[JobSprint LinkedIn] Searching for:', role, 'in', city)
    JS.showToast(`Searching: ${role}${city ? ' in ' + city : ''}`)

    // Append ", India" so LinkedIn picks India location, not US
    const locationStr = city ? `${city}, India` : 'India'
    const params = new URLSearchParams({
      keywords: role,
      location: locationStr,
      f_LCA: 'true',
      origin: 'JOB_SEARCH_PAGE_SEARCH_BUTTON'
    })

    const url = `https://www.linkedin.com/jobs/search/?${params.toString()}`
    console.log('[JobSprint LinkedIn] Navigating to:', url)
    await JS.sleep(500)
    window.location.href = url
  }

  // ─── Scroll to lazy-load all job cards ────────────────────────────────────

  async function scrollToLoadAll() {
    console.log('[JobSprint LinkedIn] Scrolling to load all cards...')
    const list = document.querySelector(
      '.jobs-search-results-list, .scaffold-layout__list'
    )
    let prevCount = 0
    for (let i = 0; i < 6; i++) {
      if (list) list.scrollTop = list.scrollHeight
      else window.scrollTo(0, document.body.scrollHeight)
      await JS.sleep(1500)
      const curr = document.querySelectorAll(
        '.job-card-container--clickable, [data-job-id]'
      ).length
      console.log('[JobSprint LinkedIn] Cards visible:', curr)
      if (curr === prevCount) break
      prevCount = curr
    }
    if (list) list.scrollTop = 0
    else window.scrollTo(0, 0)
    await JS.sleep(500)
  }

  // ─── Apply to all Easy Apply job cards ────────────────────────────────────

  async function applyToListings(profile, token) {
    const MAX_PER_RUN = 10
    let applied = 0

    const cards = Array.from(
      document.querySelectorAll(
        '.job-card-container--clickable, .jobs-search-results__list-item'
      )
    )

    console.log('[JobSprint LinkedIn] Job cards found:', cards.length)

    if (cards.length === 0) {
      JS.showToast('No jobs found on this page', 'error')
      return
    }

    for (const card of cards) {
      if (applied >= MAX_PER_RUN) break
      if (await JS.isOverDailyLimit()) break

      const jobTitle    = getJobTitleFromCard(card)
      const companyName = getCompanyNameFromCard(card)
      const jobId       = card.dataset?.jobId ||
        card.querySelector('[data-job-id]')?.dataset?.jobId || ''

      if (await JS.isBlacklisted(companyName)) {
        JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error')
        continue
      }

      console.log('[JobSprint LinkedIn] Clicking card:', jobTitle, '@', companyName)

      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await JS.sleep(600)
      card.click()
      await JS.sleep(2500)

      // Check if Easy Apply button exists (not external apply)
      const applyBtn = document.querySelector('#jobs-apply-button-id')
      if (!applyBtn) continue

      const ariaLabel = applyBtn.getAttribute('aria-label') || ''
      if (ariaLabel.includes('company website')) {
        console.log('[JobSprint LinkedIn] External apply, skipping:', jobTitle)
        continue
      }

      applyBtn.click()
      await JS.sleep(2000)

      const modal = await waitForElement('[data-test-modal-id="easy-apply-modal"]', 6000)
      if (!modal) {
        console.warn('[JobSprint LinkedIn] Modal not found, skipping:', jobTitle)
        continue
      }

      const success = await handleEasyApplyModal(modal, profile, jobTitle, companyName, token)

      if (success) {
        applied++

        const jobData = {
          job_title:    jobTitle,
          company_name: companyName,
          job_url:      `https://www.linkedin.com/jobs/view/${jobId}`,
          status:       'applied',
          job_site:     'linkedin',
          applied_at:   new Date().toISOString(),
        }

        chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})

        await fetch('http://localhost:3000/api/tracker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(jobData),
        }).catch(err => console.warn('[JobSprint LinkedIn] Tracker error:', err))

        JS.showToast(`✓ Applied: ${jobTitle} at ${companyName}`)
        await JS.sleep(1200)
      }

      closeModal()
      await JS.sleep(1500)
    }

    console.log('[JobSprint LinkedIn] Done. Applied:', applied)
    if (applied > 0) JS.showToast(`Applied to ${applied} jobs on LinkedIn 🎉`)
    else JS.showToast('No new applications made', 'error')
  }

  // ─── Handle Easy Apply modal (multi-step) ─────────────────────────────────

  async function handleEasyApplyModal(modal, profile, jobTitle, companyName, token) {
    try {
      await JS.sleep(800)

      let attempts = 0

      while (attempts < 10) {
        attempts++

        await fillModalPage(modal, profile, jobTitle, companyName, token)
        await JS.sleep(500)

        // Submit button visible → submit
        const submitBtn = modal.querySelector('[data-live-test-easy-apply-submit-button]')
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click()
          await JS.sleep(2500)

          const bodyText = document.body.textContent?.toLowerCase() || ''
          if (
            bodyText.includes('application submitted') ||
            bodyText.includes('applied to') ||
            !document.querySelector('[data-test-modal-id="easy-apply-modal"]')
          ) return true

          const errorVisible = modal.querySelector('.artdeco-inline-feedback--error')
          if (errorVisible) return false

          return true
        }

        // Review button → click review
        const reviewBtn = Array.from(modal.querySelectorAll('button')).find(
          b => b.getAttribute('aria-label') === 'Review your application' && !b.disabled
        )
        if (reviewBtn) {
          reviewBtn.click()
          await JS.sleep(1500)
          continue
        }

        // Next button → click next
        const nextBtn = Array.from(modal.querySelectorAll('button')).find(
          b => (
            b.getAttribute('aria-label')?.toLowerCase().includes('next') ||
            b.innerText?.trim() === 'Next'
          ) && !b.disabled
        )
        if (nextBtn) {
          nextBtn.click()
          await JS.sleep(1500)
          continue
        }

        break
      }

      return false

    } catch (err) {
      console.error('[JobSprint LinkedIn] Modal error:', err)
      return false
    }
  }

  // ─── Fill one page of the modal ───────────────────────────────────────────

  async function fillModalPage(modal, profile, jobTitle, companyName, token) {

    // Phone country code
    const countrySelect = modal.querySelector(
      'select[id*="phoneNumber-country"], [data-test-text-entity-list-form-select]'
    )
    if (countrySelect && (!countrySelect.value || countrySelect.value === 'Select an option')) {
      triggerReactChange(countrySelect, 'India (+91)')
      await JS.sleep(300)
    }

    // Phone number
    const phoneInput = modal.querySelector('input[id*="phoneNumber-nationalNumber"]')
    if (phoneInput && !phoneInput.value) {
      const phone = (profile.phone || '').replace(/^\+91\s?/, '').trim()
      triggerReactChange(phoneInput, phone)
      await JS.sleep(300)
    }

    // ALL selects including multipleChoice (email etc)
    const allSelects = modal.querySelectorAll(
      'select:not([disabled]):not([id*="phoneNumber-country"])'
    )
    for (const sel of allSelects) {
      if (sel.value && sel.value !== 'Select an option') continue
      const options = Array.from(sel.options).filter(
        o => o.value && o.value !== 'Select an option'
      )
      if (!options.length) continue
      if (sel.id.includes('multipleChoice')) {
        const emailOpt = options.find(o => o.value.includes('@')) || options[0]
        triggerReactChange(sel, emailOpt.value)
        await JS.sleep(300)
        continue
      }
      const label = modal.querySelector(`label[for="${sel.id}"]`)
      const q = (label?.innerText?.trim() || '').toLowerCase()
      let chosen = null
      if (q.includes('sponsor') || q.includes('visa'))          chosen = options.find(o => o.text.toLowerCase().includes('no'))
      else if (q.includes('authoriz') || q.includes('legally')) chosen = options.find(o => o.text.toLowerCase().includes('yes'))
      else if (q.includes('relocat'))                           chosen = options.find(o => o.text.toLowerCase().includes('yes'))
      chosen = chosen || options[0]
      triggerReactChange(sel, chosen.value)
      await JS.sleep(200)
    }

    // Text inputs and textareas
    const textInputs = modal.querySelectorAll(
      'input[type="text"]:not([disabled]):not([id*="phoneNumber-nationalNumber"]), ' +
      'input[type="number"]:not([disabled]), ' +
      'textarea:not([disabled])'
    )
    for (const input of textInputs) {
      if (input.value) continue
      const label = modal.querySelector(`label[for="${input.id}"]`)
      const questionText = label?.innerText?.trim() || input.placeholder || ''
      if (!questionText) continue
      const answer = await resolveAnswer(questionText, profile, jobTitle, companyName, token)
      if (answer) {
        triggerReactChange(input, answer)
        await JS.sleep(200)
      }
    }

    // Other selects (fallback - already handled above but kept for safety)
    const selects = modal.querySelectorAll(
      'select:not([disabled]):not([id*="phoneNumber-country"]):not([id*="multipleChoice"])'
    )
    for (const select of selects) {
      if (select.value && select.value !== 'Select an option') continue
      const options = Array.from(select.options).filter(
        o => o.value && o.value !== 'Select an option'
      )
      if (!options.length) continue
      const label = modal.querySelector(`label[for="${select.id}"]`)
      const q = (label?.innerText?.trim() || '').toLowerCase()
      let chosen = null
      if (q.includes('sponsor') || q.includes('visa'))       chosen = options.find(o => o.text.toLowerCase().includes('no'))
      else if (q.includes('authoriz') || q.includes('legally')) chosen = options.find(o => o.text.toLowerCase().includes('yes'))
      else if (q.includes('relocat'))                          chosen = options.find(o => o.text.toLowerCase().includes('yes'))
      chosen = chosen || options[0]
      triggerReactChange(select, chosen.value)
      await JS.sleep(200)
    }

    // Radio buttons
    const radios = modal.querySelectorAll('input[type="radio"]:not([disabled])')
    const radioGroups = {}
    for (const r of radios) {
      if (!radioGroups[r.name]) radioGroups[r.name] = []
      radioGroups[r.name].push(r)
    }
    for (const group of Object.values(radioGroups)) {
      if (group.some(r => r.checked)) continue
      const label = modal.querySelector(`label[for="${group[0].id}"]`)
      const q = (label?.innerText || '').toLowerCase()
      const chosen = (q.includes('sponsor') || q.includes('visa'))
        ? (group.find(r => r.value?.toLowerCase().includes('no')) || group[0])
        : (group.find(r => r.value?.toLowerCase().includes('yes')) || group[0])
      chosen.click()
      await JS.sleep(200)
    }
  }

  // ─── Resolve answer: profile first, then API ──────────────────────────────

  async function resolveAnswer(question, profile, jobTitle, companyName, token) {
    const q = question.toLowerCase()
    if (q.includes('year') && q.includes('experience')) return String(profile.total_experience_years || 1)
    if (q.includes('notice') || q.includes('joining'))   return String(profile.notice_period_days || 30)
    if (q.includes('salary') || q.includes('ctc') || q.includes('lpa')) return String(profile.expected_salary_min || profile.current_salary || 5)
    if (q.includes('linkedin'))   return profile.linkedin_url || ''
    if (q.includes('github') || q.includes('portfolio')) return profile.portfolio_url || ''
    if (q.includes('your name') || q.includes('full name')) return profile.full_name || ''
    if (q.includes('city') || q.includes('location')) return profile.preferred_cities?.[0] || profile.location || ''
    return await getAnswerFromApi(question, profile, jobTitle, companyName, token)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getJobTitleFromCard(card) {
    return (
      card.querySelector(
        '.job-card-list__title, .job-card-container__link strong, a[class*="job-card"] strong'
      )?.innerText?.trim() ||
      card.querySelector('a[class*="job-card"]')?.innerText?.trim() ||
      'Unknown Role'
    )
  }

  function getCompanyNameFromCard(card) {
    return (
      card.querySelector(
        '.job-card-container__primary-description, .artdeco-entity-lockup__subtitle span'
      )?.innerText?.trim() ||
      'Unknown Company'
    )
  }

  async function getAnswerFromApi(question, profileData, jobTitle, companyName, token) {
    try {
      const res = await fetch('http://localhost:3000/api/answer-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question, jobTitle, companyName, profile: profileData }),
      })
      if (!res.ok) return ''
      const payload = await res.json()
      let answer = (payload.answer || '').trim()
      if (answer.length > 300) {
        const cut = answer.lastIndexOf('.', 300)
        answer = answer.substring(0, cut > 50 ? cut + 1 : 250).trim()
      }
      return answer
    } catch { return '' }
  }

  function triggerReactChange(el, value) {
    const proto =
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype :
      el.tagName === 'SELECT'   ? window.HTMLSelectElement.prototype :
                                  window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value); else el.value = value
    el.dispatchEvent(new Event('input',  { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function closeModal() {
    const btn = document.querySelector(
      '[data-test-modal-close-btn], button[aria-label="Dismiss"]'
    )
    if (btn) btn.click()
  }

  function waitForElement(selector, timeout = 10000) {
    const el = document.querySelector(selector)
    if (el) return Promise.resolve(el)
    return new Promise(resolve => {
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector)
        if (found) { obs.disconnect(); resolve(found) }
      })
      obs.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => { obs.disconnect(); resolve(null) }, timeout)
    })
  }

})()