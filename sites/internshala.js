;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint Internshala] loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, user, autoApply } = await JS.getProfile()
  const token = user?.token || ''

  console.log('[JobSprint Internshala] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) {
    console.log('[JobSprint Internshala] over daily limit')
    return
  }

  const path = window.location.pathname

  // ── Step 1: On /jobs root → fill filters and search ─────────────────────
  if (path === '/' || path === '/jobs' || path === '/jobs/') {
    await searchWithFilters(profile)
    return
  }

  // ── Step 2: On filtered results page → apply to listings ─────────────────
  if (path.startsWith('/jobs/') || path.startsWith('/internships/')) {
    await JS.sleep(2000)
    await scrollToLoadAll()
    await applyToListings(profile, token)
  }

  // ─────────────────────────────────────────────────────────────────────────

  async function searchWithFilters(profile) {
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

    console.log('[JobSprint Internshala] Searching for:', role, 'in', city)
    JS.showToast(`Searching: ${role}${city ? ' in ' + city : ''}`)

    // ── Fill Profile/Category input (#category_mobile) ──────────────────
    const categoryInput = document.getElementById('category_mobile')
    if (categoryInput) {
      categoryInput.focus()
      triggerReactChange(categoryInput, role)
      await JS.sleep(600)
      // Pick first suggestion if dropdown appears
      const suggestion = document.querySelector(
        '#category_mobile_dropdown li, [id*="category"] .dropdown-item, [id*="category"] li'
      )
      if (suggestion) {
        suggestion.click()
        await JS.sleep(400)
      }
    }

    // ── Fill Location input (#location_mobile) ──────────────────────────
    if (city) {
      const locationInput = document.getElementById('location_mobile')
      if (locationInput) {
        locationInput.focus()
        triggerReactChange(locationInput, city)
        await JS.sleep(600)
        const citySuggestion = document.querySelector(
          '#location_mobile_dropdown li, [id*="location"] .dropdown-item, [id*="location"] li'
        )
        if (citySuggestion) {
          citySuggestion.click()
          await JS.sleep(400)
        }
      }
    }

    // ── Use URL navigation as the most reliable method ──────────────────
    // Confirmed format: /jobs/keywords-Full%20Stack%20Developer
    const encoded = encodeURIComponent(role)
    const url = `https://internshala.com/jobs/keywords-${encoded}`
    console.log('[JobSprint Internshala] Navigating to:', url)
    await JS.sleep(500)
    window.location.href = url
  }

  // ─── Scroll to lazy-load all cards ────────────────────────────────────────

  async function scrollToLoadAll() {
    console.log('[JobSprint Internshala] Scrolling to load all cards...')
    let prevCount = 0
    for (let i = 0; i < 6; i++) {
      window.scrollTo(0, document.body.scrollHeight)
      await JS.sleep(1500)
      const curr = document.querySelectorAll('.individual_internship.easy_apply').length
      console.log('[JobSprint Internshala] Cards visible:', curr)
      if (curr === prevCount) break
      prevCount = curr
    }
    window.scrollTo(0, 0)
    await JS.sleep(500)
  }

  // ─── Apply to all Easy Apply cards ────────────────────────────────────────

  async function applyToListings(profile, token) {
    const MAX_PER_RUN = 10
    let applied = 0

    const cards = Array.from(
      document.querySelectorAll('.individual_internship.easy_apply.button_easy_apply_t')
    ).filter(card => /^individual_internship_\d+$/.test(card.id))

    console.log('[JobSprint Internshala] Easy-apply cards found:', cards.length)

    if (cards.length === 0) {
      JS.showToast('No Easy Apply jobs found on this page', 'info')
      return
    }

    for (const card of cards) {
      if (applied >= MAX_PER_RUN) break
      if (await JS.isOverDailyLimit()) break

      const internshipId = card.id.replace('individual_internship_', '')
      const jobTitle    = getJobTitleFromCard(card)
      const companyName = getCompanyNameFromCard(card)

      if (await JS.isBlacklisted(companyName)) {
        JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error')
        continue
      }

      console.log('[JobSprint Internshala] Clicking card:', jobTitle, '@', companyName)

      // Scroll card into view before clicking
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await JS.sleep(600)

      card.click()
      await JS.sleep(2000)

      const modal = await waitForElement('#easy_apply_modal', 6000)
      if (!modal || modal.style.display === 'none') {
        console.warn('[JobSprint Internshala] Modal not found, skipping:', internshipId)
        continue
      }

      const success = await handleEasyApplyModal(modal, profile, jobTitle, companyName, token)

      if (success) {
        applied++

        const jobData = {
          job_title: jobTitle,
          company_name: companyName,
          job_url: `https://internshala.com/internship/detail/${internshipId}`,
          status: 'applied',
          job_site: 'internshala',
          applied_at: new Date().toISOString(),
        }

        chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})

        await fetch('http://localhost:3000/api/tracker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(jobData),
        }).catch(err => console.warn('[JobSprint Internshala] Tracker error:', err))

        JS.showToast(`✓ Applied: ${jobTitle} at ${companyName}`)
        await JS.sleep(1200)
      }

      closeModal()
      await JS.sleep(1000)
    }

    console.log('[JobSprint Internshala] Done. Applied:', applied)
    if (applied > 0) JS.showToast(`Applied to ${applied} jobs on Internshala 🎉`)
    else JS.showToast('No new applications made', 'info')
  }

  // ─── Handle the easy_apply_modal ─────────────────────────────────────────

  async function handleEasyApplyModal(modal, profile, jobTitle, companyName, token) {
    try {
      await JS.sleep(800)

      // ── Availability radios ──────────────────────────────────────────────
      const availRadios = Array.from(modal.querySelectorAll('input[type="radio"]'))
      if (availRadios.length > 0) {
        let picked = false
        for (const r of availRadios) {
          const labelEl = r.closest('label') || document.querySelector(`label[for="${r.id}"]`)
          const labelText = (labelEl?.textContent || r.value).toLowerCase()
          if (labelText.includes('immediately') || labelText.includes('yes')) {
            r.click()
            picked = true
            break
          }
        }
        if (!picked) availRadios[0].click()
        await JS.sleep(500)
      }

      // ── Assessment / cover letter questions ──────────────────────────────
      const qContainer = modal.querySelector('#assessment_questions, .questions-container, .cover_letter_container')
      if (qContainer) {
        const formGroups = qContainer.querySelectorAll('.form-group, .assessment_question')
        for (const group of formGroups) {
          const questionEl = group.querySelector('label, .question_label, p')
          const question = questionEl?.textContent?.trim()
          if (!question) continue

          const textInput   = group.querySelector('textarea, input[type="text"]')
          const selectInput = group.querySelector('select')
          const radioInputs = group.querySelectorAll('input[type="radio"]')

          if (textInput && !textInput.value.trim()) {
            const answer = await getAnswerFromApi(question, profile, jobTitle, companyName, token)
            if (answer) {
              triggerReactChange(textInput, answer)
              await JS.sleep(300)
            }
          } else if (selectInput) {
            const answer = await getAnswerFromApi(question, profile, jobTitle, companyName, token)
            if (answer) {
              const opts  = Array.from(selectInput.options)
              const match = opts.find(o => o.text.toLowerCase().includes(answer.toLowerCase().slice(0, 10)))
              triggerReactChange(selectInput, match ? match.value : (opts[1]?.value || opts[0]?.value))
              await JS.sleep(300)
            }
          } else if (radioInputs.length > 0) {
            const answer = await getAnswerFromApi(question, profile, jobTitle, companyName, token)
            let picked = false
            if (answer) {
              for (const r of radioInputs) {
                const val = (r.value || '').toLowerCase()
                if (answer.toLowerCase().includes(val) || val.includes(answer.toLowerCase().slice(0, 5))) {
                  r.click()
                  picked = true
                  break
                }
              }
            }
            if (!picked) radioInputs[0].click()
            await JS.sleep(300)
          }
        }
      }

      await JS.sleep(600)

      // ── Submit ───────────────────────────────────────────────────────────
      const submitBtn = modal.querySelector(
        'input#submit[type="submit"], .submit_button_container input[type="submit"], .easy_apply_footer input[type="submit"]'
      )

      if (!submitBtn) {
        console.warn('[JobSprint Internshala] Submit button not found in modal')
        return false
      }

      submitBtn.click()
      await JS.sleep(3000)

      // ── Success detection ────────────────────────────────────────────────
      // 1. Internshala shows a close-confirm modal on success
      const confirmModal = document.getElementById('easy_apply_modal_close_confirm')
      if (confirmModal && confirmModal.offsetParent !== null) return true

      // 2. Check body text
      const bodyText = document.body.textContent?.toLowerCase() || ''
      if (
        bodyText.includes('successfully applied') ||
        bodyText.includes('application submitted') ||
        bodyText.includes('thank you for applying')
      ) return true

      // 3. Check for error — if no error visible, assume success
      const errorVisible = modal.querySelector('.alert-danger, .error-message, .has-error')
      const alreadyApplied = bodyText.includes('already applied')
      if (alreadyApplied || errorVisible) return false

      // 4. Modal closed itself = optimistic success
      const stillOpen = modal.classList.contains('show') || modal.style.display === 'block'
      return !stillOpen

    } catch (err) {
      console.error('[JobSprint Internshala] Modal error:', err)
      return false
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getJobTitleFromCard(card) {
    return (
      card.querySelector('.profile h3, h3.job-internship-name, .heading_4_5, h3')?.textContent?.trim() ||
      'Unknown Role'
    )
  }

  function getCompanyNameFromCard(card) {
    return (
      card.querySelector('.company_name h4 a, .company_name a, h4.company-name, h4')?.textContent?.trim() ||
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
      // Trim long answers at sentence boundary
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
    const btn = document.querySelector('#easy_apply_modal .close, #easy_apply_modal [data-dismiss="modal"]')
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