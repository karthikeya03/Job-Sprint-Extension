;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint Indeed] loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, user, autoApply } = await JS.getProfile()
  const token = user?.token || ''

  console.log('[JobSprint Indeed] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) {
    console.log('[JobSprint Indeed] over daily limit')
    return
  }

  const host = window.location.hostname
  const path = window.location.pathname

  // ── smartapply.indeed.com — multi-step apply flow ────────────────────────
  if (host.includes('smartapply') || host.includes('apply.indeed')) {
    await JS.sleep(1500)
    await handleSmartApplyFlow(profile, token)
    return
  }

  // ── in.indeed.com / indeed.com ───────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search)
  const hasQuery = urlParams.has('q') && urlParams.get('q').length > 0

  // Homepage or no search — navigate to jobs
  if (path === '/' || path === '' || !hasQuery) {
    await navigateToJobs(profile)
    return
  }

  // Job results page — apply to listings
  if (path.startsWith('/jobs') || path.startsWith('/job')) {
    await JS.sleep(2000)
    await scrollToLoadAll()
    await applyToListings(profile, token)
    return
  }

  // ─────────────────────────────────────────────────────────────────────────

  async function navigateToJobs(profile) {
    const role = (
      profile.preferred_roles?.[0] ||
      profile.current_job_title ||
      profile.skills?.[0] ||
      'Software Developer'
    ).trim()

    const city = (
      profile.preferred_cities?.[0] ||
      profile.location ||
      ''
    ).trim()

    JS.showToast(`Searching: ${role}${city ? ' in ' + city : ''}`)
    console.log('[JobSprint Indeed] Navigating to jobs for:', role, city)

    const params = new URLSearchParams({
      q: role,
      l: city ? `${city}, India` : 'India',
      iafilter: '1',
      fromage: '14',
    })

    await JS.sleep(500)
    try {
      window.location.replace(`https://in.indeed.com/jobs?${params.toString()}`)
    } catch (err) {
      console.error('[JobSprint Indeed] Navigation error:', err)
      window.location.href = `https://in.indeed.com/jobs?${params.toString()}`
    }
  }

  async function scrollToLoadAll() {
    let prev = 0
    for (let i = 0; i < 6; i++) {
      window.scrollTo(0, document.body.scrollHeight)
      await JS.sleep(1500)
      const curr = document.querySelectorAll('.job_seen_beacon').length
      if (curr === prev) break
      prev = curr
    }
    window.scrollTo(0, 0)
    await JS.sleep(500)
  }

  async function applyToListings(profile, token) {
    const MAX = 10
    let applied = 0

    const cards = Array.from(document.querySelectorAll('.job_seen_beacon'))
      .filter(c => c.querySelector('[data-testid="indeedApply"]'))

    console.log('[JobSprint Indeed] Easily Apply cards:', cards.length)

    if (!cards.length) {
      JS.showToast('No Easily Apply jobs found', 'error')
      return
    }

    for (const card of cards) {
      if (applied >= MAX || await JS.isOverDailyLimit()) break

      const jobTitle    = card.querySelector('.jobTitle a, h2.jobTitle')?.innerText?.trim() || 'Unknown Role'
      const companyName = card.querySelector('[data-testid="company-name"]')?.innerText?.trim() || 'Unknown Company'
      const jobId       = card.querySelector('a[data-jk]')?.dataset?.jk || ''

      if (await JS.isBlacklisted(companyName)) {
        JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error')
        continue
      }

      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await JS.sleep(600)

      const titleLink = card.querySelector('a[data-jk]')
      if (!titleLink) continue
      titleLink.click()
      await JS.sleep(3500)

      const applyBtn = await waitForEl(
        '#indeedApplyButton, [data-testid="indeedApplyButton-test"], button[aria-label*="Apply now"]',
        8000
      )
      if (!applyBtn) continue

      console.log('[JobSprint Indeed] Clicking apply for:', jobTitle)
      applyBtn.click()
      await JS.sleep(1500)

      // Store job info — smartapply page will pick it up
      await setStorage({
        indeed_pending: { jobTitle, companyName, jobId, token, profile }
      })
      return // page navigates to smartapply flow
    }
  }

  // ── SMART APPLY MULTI-STEP FLOW ───────────────────────────────────────────
  // Pages (in order):
  //   1. Location (postal code, city, address) → Continue
  //   2. Resume selection → Continue
  //   3. Questions (text, radio, select) → Continue
  //   4. Work experience (job title, company) → Continue
  //   5. Review → Submit

  async function handleSmartApplyFlow(profile, token) {
    const stored = await getStorage('indeed_pending')
    const pending = stored?.indeed_pending || {}
    const jobTitle    = pending.jobTitle    || 'Unknown Role'
    const companyName = pending.companyName || 'Unknown Company'
    const jobId       = pending.jobId       || ''

    console.log('[JobSprint Indeed] SmartApply flow for:', jobTitle)
    JS.showToast(`Applying: ${jobTitle} at ${companyName}`)

    let attempts = 0
    let submitted = false

    while (attempts < 20 && !submitted) {
      attempts++
      await JS.sleep(1800)

      const url = window.location.href
      console.log('[JobSprint Indeed] Attempt', attempts, '| URL:', url)

      // ── Page: Location ──────────────────────────────────────────────────
      if (await handleLocationPage(profile)) {
        console.log('[JobSprint Indeed] Handled location page')
        continue
      }

      // ── Page: Resume selection ──────────────────────────────────────────
      if (await handleResumePage()) {
        console.log('[JobSprint Indeed] Handled resume page')
        continue
      }

      // ── Page: Questions ─────────────────────────────────────────────────
      if (await handleQuestionsPage(profile, jobTitle, companyName, token)) {
        console.log('[JobSprint Indeed] Handled questions page')
        continue
      }

      // ── Page: Work experience ───────────────────────────────────────────
      if (await handleWorkExpPage(profile)) {
        console.log('[JobSprint Indeed] Handled work exp page')
        continue
      }

      // ── Page: Review / Submit ───────────────────────────────────────────
      // Wait for submit button to actually load on the page
      const submitBtn = await waitForEl(
        '[data-testid="submit-application-button"], button[name="submit-application"]',
        12000
      )
      
      if (submitBtn) {
        console.log('[JobSprint Indeed] Submit button loaded, clicking...')
        await JS.sleep(1000) // Extra wait for button to be fully interactive
        
        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await JS.sleep(600)
        
        // Try clicking the span inside (common with styled buttons)
        const spanInside = submitBtn.querySelector('span')
        if (spanInside) {
          console.log('[JobSprint Indeed] Clicking span inside button...')
          spanInside.click()
          await JS.sleep(2000)
        }
        
        // Try multiple click methods on button itself
        submitBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        submitBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        submitBtn.click()
        submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        
        await JS.sleep(3000)
        
        // Try keyboard Enter on the button
        submitBtn.focus()
        submitBtn.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }))
        submitBtn.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }))
        
        await JS.sleep(3000)
        
        // Check if still on same page — if yes, try form submit
        const stillHere = document.querySelector('[data-testid="submit-application-button"]')
        if (stillHere) {
          console.log('[JobSprint Indeed] Button still present, trying form submit...')
          const form = submitBtn.closest('form')
          if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
            await JS.sleep(3000)
          }
        }
        
        submitted = true
        break
      }

      // ── Fallback: try any Continue button ──────────────────────────────
      const didContinue = await clickContinue()
      if (!didContinue) {
        console.log('[JobSprint Indeed] No action possible, breaking')
        break
      }
    }

    if (submitted) {
      const jobData = {
        job_title:    jobTitle,
        company_name: companyName,
        job_url:      `https://in.indeed.com/viewjob?jk=${jobId}`,
        status:       'applied',
        job_site:     'indeed',
        applied_at:   new Date().toISOString(),
      }

      chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})
      await clearStorage('indeed_pending')

      await fetch('http://localhost:3000/api/tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(jobData),
      }).catch(err => console.warn('[JobSprint Indeed] Tracker error:', err))

      JS.showToast(`Applied: ${jobTitle} at ${companyName}`)
      
      // Navigate back to search results to apply to more jobs
      await JS.sleep(2000)
      const role = (
        profile.preferred_roles?.[0] ||
        profile.current_job_title ||
        profile.skills?.[0] ||
        'Software Developer'
      ).trim()

      const city = (
        profile.preferred_cities?.[0] ||
        profile.location ||
        ''
      ).trim()

      const params = new URLSearchParams({
        q: role,
        l: city ? `${city}, India` : 'India',
        iafilter: '1',
        fromage: '14',
      })

      const searchUrl = `https://in.indeed.com/jobs?${params.toString()}`
      console.log('[JobSprint Indeed] Going back to search:', searchUrl)
      window.location.replace(searchUrl)
      return
    }
  }

  // ── PAGE HANDLERS ─────────────────────────────────────────────────────────

  // Location page — postal code, city, address
  async function handleLocationPage(profile) {
    const postalInput = document.querySelector(
      '[data-testid="location-fields-postal-code-input"]'
    )
    if (!postalInput) return false

    console.log('[JobSprint Indeed] Location page detected')

    // Postal code
    if (!postalInput.value || postalInput.value.trim() === '') {
      const postalCode = profile.postal_code || '534007'
      triggerReactChange(postalInput, postalCode)
      await JS.sleep(300)
    }

    // City / State
    const cityInput = document.querySelector(
      '[data-testid="location-fields-locality-input"]'
    )
    if (cityInput && (!cityInput.value || cityInput.value.trim() === '')) {
      const city = profile.preferred_cities?.[0] || profile.location || 'Andhra Pradesh'
      triggerReactChange(cityInput, city)
      await JS.sleep(400)
      // Dismiss any autocomplete dropdown with Escape
      cityInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
      await JS.sleep(200)
    }

    // Street address (optional — leave blank if not available)
    const addrInput = document.querySelector(
      '[data-testid="location-fields-address-input"]'
    )
    if (addrInput && (!addrInput.value || addrInput.value.trim() === '')) {
      const addr = profile.address || ''
      if (addr) triggerReactChange(addrInput, addr)
      await JS.sleep(200)
    }

    await JS.sleep(500)

    // Continue button for location page
    const continueBtn = document.querySelector(
      '[data-testid="b27b411e4caba40bbf95c656dd53db6a270825b3cfc4c93fa53222f41ed17148"]'
    ) || Array.from(document.querySelectorAll('button[type="button"]'))
         .find(b => b.innerText?.trim().toLowerCase() === 'continue' && !b.disabled)

    if (continueBtn) {
      continueBtn.click()
      await JS.sleep(2000)
      return true
    }

    return true // page was detected, even if continue wasn't found
  }

  // Resume page — just wait and click Continue
  async function handleResumePage() {
    const resumeContinue = document.querySelector(
      '[data-testid="continue-button"]'
    )
    if (!resumeContinue) return false

    // Check if it's actually a resume page (not questions page)
    const isResumePage = !!(
      document.querySelector('[data-testid="resume-file-status"]') ||
      document.querySelector('[data-testid="fileResume"]') ||
      document.querySelector('[data-contents="fileResume"]') ||
      document.querySelector('[aria-label*="resume" i]') ||
      (document.querySelector('h1') && document.querySelector('h1')?.innerText?.toLowerCase().includes('resume'))
    )

    if (!isResumePage) return false

    console.log('[JobSprint Indeed] Resume page detected, waiting for load...')
    await JS.sleep(2000) // Wait for resume to fully load
    resumeContinue.click()
    await JS.sleep(2000)
    return true
  }

  // Questions page — fill all inputs, then continue
  async function handleQuestionsPage(profile, jobTitle, companyName, token) {
    const questionsHeading = document.querySelector(
      '[data-testid="questions-heading"]'
    )
    const hasQuestionInputs = document.querySelector(
      '[data-testid^="input-q_"]'
    )

    if (!questionsHeading && !hasQuestionInputs) return false

    console.log('[JobSprint Indeed] Questions page detected')

    // Fill all question inputs
    const questionItems = document.querySelectorAll('.ia-Questions-item, [id^="q_"]')

    for (const item of questionItems) {
      // Get the question label text
      const labelEl = item.querySelector('[data-testid*="-label"] [data-testid="safe-markup"]')
        || item.querySelector('label span span span')
        || item.querySelector('label')
      const questionText = labelEl?.innerText?.trim() || ''

      if (!questionText) continue

      console.log('[JobSprint Indeed] Question:', questionText)

      // ── Number/text input ─────────────────────────────────────────────
      const textInput = item.querySelector('input[type="text"], input[inputmode="text"], input[type="number"]')
      if (textInput && !textInput.value) {
        const answer = await resolveAnswer(questionText, profile, jobTitle, companyName, token)
        if (answer) {
          triggerReactChange(textInput, String(answer))
          await JS.sleep(200)
        }
        continue
      }

      // ── Textarea ──────────────────────────────────────────────────────
      const textarea = item.querySelector('textarea')
      if (textarea && !textarea.value) {
        const answer = await resolveAnswer(questionText, profile, jobTitle, companyName, token)
        if (answer) {
          triggerReactChange(textarea, answer)
          await JS.sleep(200)
        }
        continue
      }

      // ── Select dropdown ────────────────────────────────────────────────
      const select = item.querySelector('select')
      if (select) {
        const opts = Array.from(select.options).filter(o => o.value && o.value !== 'None')
        if (opts.length) {
          const q = questionText.toLowerCase()
          let chosen = null
          if (q.includes('education') || q.includes('degree') || q.includes('qualification')) {
            chosen = opts.find(o => {
              const qual = (profile.highest_qualification || 'bachelor').toLowerCase()
              return o.text.toLowerCase().includes(qual) ||
                     (qual.includes('b.tech') && o.text.toLowerCase().includes("bachelor"))
            })
          }
          if (!chosen) chosen = opts[0]
          triggerReactChange(select, chosen.value)
          await JS.sleep(200)
        }
        continue
      }

      // ── Radio buttons ──────────────────────────────────────────────────
      const radios = item.querySelectorAll('input[type="radio"]')
      if (radios.length) {
        if ([...radios].some(r => r.checked)) continue // already answered
        const q = questionText.toLowerCase()
        let chosen = null
        if (q.includes('commute') || q.includes('relocat'))
          chosen = [...radios].find(r => r.value?.includes('YES_I_CAN')) || radios[0]
        else if (q.includes('sponsor') || q.includes('visa'))
          chosen = [...radios].find(r => r.value?.toLowerCase().includes('no')) || radios[0]
        else if (q.includes('authoriz') || q.includes('legal') || q.includes('eligible'))
          chosen = [...radios].find(r => r.value?.toLowerCase().includes('yes')) || radios[0]
        else
          chosen = radios[0]
        chosen.click()
        await JS.sleep(200)
        continue
      }
    }

    await JS.sleep(500)

    // Continue button for questions page
    const continueBtn = document.querySelector(
      '[data-testid="30e6dd3d81aa4705705e2ef002ff579b59e06fe7bbe5e8efa2e5839926f47369"]'
    ) || Array.from(document.querySelectorAll('button[type="button"]'))
         .find(b => b.innerText?.trim().toLowerCase() === 'continue' && !b.disabled)

    if (continueBtn) {
      continueBtn.click()
      await JS.sleep(2000)
    }

    return true
  }

  // Work experience page — job title and company
  async function handleWorkExpPage(profile) {
    const jobTitleInput  = document.querySelector('[data-testid="job-title-input"]')
    const companyInput   = document.querySelector('[data-testid="company-name-input"]')

    if (!jobTitleInput && !companyInput) return false

    console.log('[JobSprint Indeed] Work experience page detected')

    if (jobTitleInput && !jobTitleInput.value) {
      const title = profile.current_job_title || profile.preferred_roles?.[0] || 'Software Developer'
      triggerReactChange(jobTitleInput, title)
      await JS.sleep(300)
      jobTitleInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
      await JS.sleep(200)
    }

    if (companyInput && !companyInput.value) {
      const company = profile.current_company || 'Freelance'
      triggerReactChange(companyInput, company)
      await JS.sleep(300)
      companyInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
      await JS.sleep(200)
    }

    await JS.sleep(400)

    const continueBtn = document.querySelector('[data-testid="continue-button"]')
      || Array.from(document.querySelectorAll('button[type="button"]'))
           .find(b => b.innerText?.trim().toLowerCase() === 'continue' && !b.disabled)

    if (continueBtn) {
      continueBtn.click()
      await JS.sleep(2000)
    }

    return true
  }

  // ── SHARED HELPERS ────────────────────────────────────────────────────────

  async function clickContinue() {
    const btn =
      document.querySelector('[data-testid="continue-button"]') ||
      document.querySelector('[data-testid="b27b411e4caba40bbf95c656dd53db6a270825b3cfc4c93fa53222f41ed17148"]') ||
      document.querySelector('[data-testid="30e6dd3d81aa4705705e2ef002ff579b59e06fe7bbe5e8efa2e5839926f47369"]') ||
      Array.from(document.querySelectorAll('button[type="button"]'))
        .find(b => b.innerText?.trim().toLowerCase() === 'continue' && !b.disabled)

    if (btn) {
      btn.click()
      await JS.sleep(2000)
      return true
    }
    return false
  }

  async function resolveAnswer(question, profile, jobTitle, companyName, token) {
    const q = question.toLowerCase()

    // Profile-based fast answers
    if (q.includes('year') && (q.includes('experience') || q.includes('exp')))
      return String(profile.total_experience_years || 1)
    if (q.includes('notice') || q.includes('joining'))
      return String(profile.notice_period_days || 30)
    if (q.includes('ctc') || q.includes('salary') || q.includes('lpa') || q.includes('package'))
      return String(profile.expected_salary_min || profile.current_salary || 5)
    if (q.includes('linkedin'))   return profile.linkedin_url || ''
    if (q.includes('github'))     return profile.portfolio_url || ''
    if (q.includes('portfolio'))  return profile.portfolio_url || ''
    if (q.includes('your name') || q.includes('full name')) return profile.full_name || ''
    if (q.includes('phone') || q.includes('mobile')) return profile.phone || ''
    if (q.includes('city') || q.includes('location'))
      return profile.preferred_cities?.[0] || profile.location || ''
    if (q.includes('postal') || q.includes('zip') || q.includes('pin'))
      return profile.postal_code || '534007'

    // Check for skill-specific experience questions e.g. "How many years of React JS experience"
    const skills = profile.skills || []
    for (const skill of skills) {
      if (q.includes(skill.toLowerCase())) {
        return String(profile.total_experience_years || 1)
      }
    }

    // Fallback to Gemini
    return await getAnswerFromApi(question, profile, jobTitle, companyName, token)
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

  function waitForEl(selector, timeout = 10000) {
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

  function getStorage(key) {
    return new Promise(r => chrome.storage.local.get(key, r))
  }

  function setStorage(data) {
    return new Promise(r => chrome.storage.local.set(data, r))
  }

  function clearStorage(key) {
    return new Promise(r => chrome.storage.local.remove(key, r))
  }

})()