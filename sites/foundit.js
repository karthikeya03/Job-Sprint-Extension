;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint Foundit] loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, user, autoApply } = await JS.getProfile()
  const token = user?.token || ''

  console.log('[JobSprint Foundit] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) {
    console.log('[JobSprint Foundit] over daily limit')
    return
  }

  const path = window.location.pathname
  const url  = window.location.href

  console.log('[JobSprint Foundit] path:', path)

  // ── Step 2: On search results page (/search/...) ──────────────────────────
  if (path.startsWith('/search/') || url.includes('query=') || url.includes('searchId=')) {
    console.log('[JobSprint Foundit] On search results page')
    await JS.sleep(3000)
    await enableQuickApplyToggle()
    await scrollToLoadCards()
    await applyToListings(profile, token)
    return
  }

  // ── Step 1: On dashboard → fill search and go ─────────────────────────────
  if (path.includes('/seeker/dashboard') || path === '/') {
    console.log('[JobSprint Foundit] On dashboard, filling search')
    await JS.sleep(1500)
    await fillSearchAndGo(profile)
    return
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  console.log('[JobSprint Foundit] Unknown page, going to dashboard')
  window.location.href = 'https://www.foundit.in/seeker/dashboard'

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function enableQuickApplyToggle() {
    const toggleInput = document.getElementById('toggle')
      || document.querySelector('label.quickApplyToggle input, input[class*="quickApply"]')
    if (!toggleInput) {
      await JS.sleep(2000)
      const retry = document.getElementById('toggle')
      if (!retry) { console.log('[JobSprint Foundit] Toggle not found'); return }
      if (!retry.checked) { ;(retry.closest('label') || retry).click(); await JS.sleep(2500) }
      return
    }
    if (!toggleInput.checked) {
      ;(toggleInput.closest('label') || toggleInput).click()
      console.log('[JobSprint Foundit] Quick Apply toggle enabled')
      await JS.sleep(2500)
    }
  }

  /**
   * Foundit experience dropdown is readonly — must click input to open, then pick from list.
   * Actual option texts from screenshot: "Fresher (< 1 year)", "1 Year", "2 Years", "3 Years"...
   */
  async function selectExperienceDropdown(years) {
    const expInput = document.getElementById('Desktop-expAutoComplete--input')
    if (!expInput) {
      console.log('[JobSprint Foundit] Experience input not found')
      return
    }

    // Click to open dropdown
    expInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expInput.dispatchEvent(new MouseEvent('click',     { bubbles: true }))
    expInput.focus()
    await JS.sleep(1000)

    // The dropdown appears as a sibling/nearby element — search broadly
    // It's NOT #searchDropDown — find any visible UL or dropdown near the input
    const allDropdownOptions = Array.from(
      document.querySelectorAll('li, [role="option"]')
    ).filter(el => {
      const text = el.innerText?.trim()
      return text && (
        text.includes('Fresher') ||
        text.includes('Year') ||
        text.includes('Years')
      ) && el.offsetParent !== null // must be visible
    })

    console.log('[JobSprint Foundit] Experience options found:', allDropdownOptions.map(o => o.innerText?.trim()))

    if (!allDropdownOptions.length) {
      console.log('[JobSprint Foundit] No experience options visible')
      return
    }

    // Map years to target label
    // Exact labels: "Fresher (< 1 year)", "1 Year", "2 Years", "3 Years" ...
    let target = ''
    if (years <= 0) {
      target = 'fresher'
    } else if (years === 1) {
      target = '1 year'
    } else {
      target = `${years} years`
    }

    // Find best match (case-insensitive, partial)
    let matched = allDropdownOptions.find(o =>
      o.innerText?.trim().toLowerCase().startsWith(target)
    )

    // Fallback: closest number
    if (!matched) {
      matched = allDropdownOptions.find(o =>
        o.innerText?.trim().toLowerCase().includes(String(years))
      )
    }

    // Last resort: first option (Fresher)
    if (!matched) matched = allDropdownOptions[0]

    if (matched) {
      matched.click()
      console.log('[JobSprint Foundit] Experience selected:', matched.innerText?.trim())
      await JS.sleep(600)
    }
  }

  async function fillSearchAndGo(profile) {
    const role  = (profile.preferred_roles?.[0] || profile.current_job_title || profile.skills?.[0] || 'Software Developer').trim()
    const city  = (profile.preferred_cities?.[0] || profile.location || '').trim()
    const years = profile.total_experience_years || 0

    console.log('[JobSprint Foundit] Searching:', role, '| city:', city, '| exp:', years)

    // ── Skills/role ──
    const skillInput = document.getElementById('Desktop-skillsAutoComplete--input')
    if (skillInput) {
      triggerReactChange(skillInput, role)
      await JS.sleep(1000)
      // Find the visible dropdown for skills (not exp, not location)
      const dd = findVisibleDropdown()
      if (dd) {
        const first = dd.querySelector('li, [role="option"]')
        if (first) { first.click(); await JS.sleep(600) }
      }
    }

    // ── Location ──
    if (city) {
      const locInput = document.getElementById('Desktop-locationAutoComplete--input')
      if (locInput) {
        triggerReactChange(locInput, city)
        await JS.sleep(1000)
        const dd = findVisibleDropdown()
        if (dd) {
          const first = dd.querySelector('li, [role="option"]')
          if (first) { first.click(); await JS.sleep(600) }
        }
      }
    }

    // ── Experience (readonly dropdown — click to open) ──
    await selectExperienceDropdown(years)

    // ── Submit ──
    const searchBtn =
      document.querySelector('button.search_submit_btn') ||
      Array.from(document.querySelectorAll('button[type="submit"]'))
        .find(b => b.closest('form#searchForm'))

    if (searchBtn) {
      searchBtn.click()
      console.log('[JobSprint Foundit] Search submitted')
    } else {
      skillInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 13 }))
    }
  }

  // Find any currently visible dropdown on the page
  function findVisibleDropdown() {
    return Array.from(
      document.querySelectorAll('#searchDropDown, [id*="DropDown"], [class*="dropdown"], ul[class*="suggestion"]')
    ).find(el => el.offsetParent !== null && el.children.length > 0)
  }

  async function scrollToLoadCards() {
    let prev = 0
    for (let i = 0; i < 8; i++) {
      window.scrollTo(0, document.body.scrollHeight)
      await JS.sleep(1500)
      const curr = getAllJobCards().length
      console.log('[JobSprint Foundit] Cards visible:', curr)
      if (curr === prev && curr > 0) break
      prev = curr
    }
    window.scrollTo(0, 0)
    await JS.sleep(500)
  }

  function getAllJobCards() {
    return Array.from(
      document.querySelectorAll('[data-index] .jobCardWrapper, [data-index] [class*="jobCard"]')
    ).filter(Boolean)
  }

  function cardIsQuickApply(card) {
    const btn = card.querySelector('#applyBtn')
    if (!btn) return false
    return btn.innerText?.trim().toLowerCase().includes('quick apply')
  }

  async function applyToListings(profile, token) {
    const MAX = 15
    let applied = 0

    const stored = await getStorage('foundit_applied_urls')
    const appliedUrls = new Set(stored.foundit_applied_urls || [])

    const cards = getAllJobCards()
    console.log('[JobSprint Foundit] Cards found:', cards.length)

    if (!cards.length) {
      JS.showToast('No Quick Apply jobs found on Foundit', 'error')
      return
    }

    for (const card of cards) {
      if (applied >= MAX || await JS.isOverDailyLimit()) break

      const titleEl     = card.querySelector('.jobCardTitle a, h2 a, h3 a')
      const companyEl   = card.querySelector('.jobCardCompany a, [class*="company"] a')
      const jobTitle    = titleEl?.innerText?.trim()   || 'Unknown Role'
      const companyName = companyEl?.innerText?.trim() || 'Unknown Company'
      const jobUrl      = titleEl?.href               || window.location.href

      if (!cardIsQuickApply(card)) { console.log('[JobSprint Foundit] Skip (Apply Now):', jobTitle); continue }
      if (appliedUrls.has(jobUrl))  { console.log('[JobSprint Foundit] Already applied:', jobTitle);  continue }
      if (await JS.isBlacklisted(companyName)) { JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error'); continue }

      console.log('[JobSprint Foundit] Quick Applying:', jobTitle, '@', companyName)
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await JS.sleep(800)

      const qBtn = card.querySelector('#applyBtn')
      if (!qBtn) continue

      qBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      qBtn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      qBtn.click()
      await JS.sleep(2500)

      const confirmed = await handleQuickApplyModal()
      if (confirmed) {
        appliedUrls.add(jobUrl)
        await setStorage({ foundit_applied_urls: [...appliedUrls] })
        await logApplication(jobTitle, companyName, jobUrl, token)
        JS.showToast(`✓ Quick Applied: ${jobTitle} at ${companyName}`)
        applied++
        await JS.sleep(800)
      }
    }

    console.log('[JobSprint Foundit] Done. Applied:', applied)
    if (applied > 0) JS.showToast(`Applied to ${applied} jobs on Foundit 🎉`)
    else JS.showToast('No Quick Apply applications made', 'error')
  }

  async function handleQuickApplyModal() {
    for (let i = 0; i < 8; i++) {
      await JS.sleep(1000)
      const pageText = document.body.innerText?.toLowerCase() || ''
      if (
        pageText.includes('applied successfully') || pageText.includes('application sent') ||
        pageText.includes('you have applied')     || pageText.includes('already applied') ||
        pageText.includes('application submitted')
      ) return true

      const modal = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]')
      if (modal) {
        const btn = Array.from(modal.querySelectorAll('button')).find(b =>
          ['apply','confirm','submit','ok','quick apply'].includes(b.innerText?.trim().toLowerCase())
        )
        if (btn) { btn.click(); await JS.sleep(1500) }
        continue
      }
      if (i >= 1) return true
    }
    return document.body.innerText?.toLowerCase().includes('applied')
  }

  async function logApplication(jobTitle, companyName, jobUrl, token) {
    const jobData = { job_title: jobTitle, company_name: companyName, job_url: jobUrl, status: 'applied', job_site: 'foundit', applied_at: new Date().toISOString() }
    chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})
    fetch('http://localhost:3000/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(jobData),
    }).catch(() => {})
  }

  function triggerReactChange(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                : el.tagName === 'SELECT'   ? window.HTMLSelectElement.prototype
                :                             window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value); else el.value = value
    el.dispatchEvent(new Event('input',  { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function getStorage(key)  { return new Promise(r => chrome.storage.local.get(key, r)) }
  function setStorage(data) { return new Promise(r => chrome.storage.local.set(data, r)) }

})()