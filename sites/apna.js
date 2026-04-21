;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint Apna] loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, user, autoApply } = await JS.getProfile()
  const token = user?.token || ''

  console.log('[JobSprint Apna] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) {
    console.log('[JobSprint Apna] over daily limit')
    return
  }

  const path = window.location.pathname

  // ── Step 3: Job detail page → click Apply buttons ────────────────────────
  if ((path.includes('/job/') || path.includes('/jobs/')) && path.split('/').length > 3) {

    // Watch for modal from the very first DOM change
    const modalObserver = new MutationObserver(async () => {
      const clicked = clickApplyAnyway()
      if (clicked) {
        modalObserver.disconnect()
        console.log('[JobSprint Apna] Modal caught by observer, clicked Apply Anyway')
        await JS.sleep(1500)
        await clickApplyForJob()
      }
    })
    modalObserver.observe(document.body, { childList: true, subtree: true })

    // Also try immediately in case modal already rendered
    if (clickApplyAnyway()) {
      modalObserver.disconnect()
      console.log('[JobSprint Apna] Modal already present on load, clicked Apply Anyway')
    }

    await JS.sleep(1500)
    modalObserver.disconnect()
    await handleApnaApplyFlow(profile, token)
    return
  }

  // ── Step 1: Not on candidate/jobs → go there ──────────────────────────────
  if (!path.includes('/candidate/jobs')) {
    window.location.href = 'https://apna.co/candidate/jobs'
    return
  }

  // ── Step 2: On candidate/jobs → build search URL and navigate ─────────────
  const alreadySearched = window.location.search.includes('text=')
  if (alreadySearched) {
    console.log('[JobSprint Apna] Already on results page, skipping search')
    await JS.sleep(3000)
    await scrollToLoadAll()
    await applyToListings(profile, token)
    return
  }

  const cityLocationMap = {
    'bangalore':  '651d46ff83cff884b7404dad',
    'bengaluru':  '651d46ff83cff884b7404dad',
    'delhi':      '651d470183cff884b7404dc4',
    'delhi-ncr':  '651d470183cff884b7404dc4',
    'mumbai':     '651d46ff83cff884b740e2c9',
    'hyderabad':  '651d46ff83cff884b7404de9',
    'pune':       '651d46ff83cff884b7404e06',
    'kolkata':    '651d46ff83cff884b7404dfd',
    'chennai':    '651d46ff83cff884b7404e1a',
    'gurgaon':    '651d46ff83cff884b7404dc8',
    'noida':      '651d46ff83cff884b7404dc9',
    'ahmedabad':  '651d46ff83cff884b7404ddb',
    'jaipur':     '651d46ff83cff884b7404de2',
  }

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

  const searchUrl = new URL('https://apna.co/candidate/jobs')
  searchUrl.searchParams.set('text', role)
  searchUrl.searchParams.set('search', 'true')
  searchUrl.searchParams.set('min_experience', '0')
  searchUrl.searchParams.set('raw_text_correction', 'true')

  if (city) {
    const cityKey = city.toLowerCase()
    const locationId = cityLocationMap[cityKey]
    if (locationId) {
      searchUrl.searchParams.set('location_id', '0')
      searchUrl.searchParams.set('location_identifier', locationId)
      searchUrl.searchParams.set('location_type', 'NBCluster')
      searchUrl.searchParams.set('location_name', city)
      console.log('[JobSprint Apna] Added location:', city)
    }
  }

  console.log('[JobSprint Apna] Navigating to search URL:', searchUrl.toString())
  window.location.href = searchUrl.toString()
  return

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Multi-strategy Apply Anyway click.
   * Tries all known selectors simultaneously — whichever works first wins.
   * Returns true if any strategy succeeded.
   */
  function clickApplyAnyway() {
    // Strategy 1: button whose direct text is "Apply Anyway" (image 2 — standalone button)
    const byButtonText = Array.from(document.querySelectorAll('button')).find(b =>
      b.innerText?.trim() === 'Apply Anyway'
    )
    if (byButtonText) {
      byButtonText.click()
      console.log('[JobSprint Apna] clickApplyAnyway: strategy 1 (button text)')
      return true
    }

    // Strategy 2: span inside button (image 1 — span wrapped)
    const bySpan = Array.from(document.querySelectorAll('span'))
      .find(s => s.textContent.trim() === 'Apply Anyway')
      ?.closest('button')
    if (bySpan) {
      bySpan.click()
      console.log('[JobSprint Apna] clickApplyAnyway: strategy 2 (span)')
      return true
    }

    // Strategy 3: z-index overlay — second button in the fixed modal
    const byOverlay = document.querySelector('[style*="z-index: 1000"]')
      ?.querySelectorAll('button')?.[1]
    if (byOverlay) {
      byOverlay.click()
      console.log('[JobSprint Apna] clickApplyAnyway: strategy 3 (z-index overlay)')
      return true
    }

    // Strategy 4: .mt-5 container — second button
    const byMt5 = document.querySelector('.mt-5')
      ?.querySelectorAll('button')?.[1]
    if (byMt5) {
      byMt5.click()
      console.log('[JobSprint Apna] clickApplyAnyway: strategy 4 (mt-5 container)')
      return true
    }

    // Strategy 5: last button on page (brute force fallback)
    // Only use if page text confirms the modal is present
    const pageText = document.body.innerText?.toLowerCase() || ''
    if (pageText.includes('you may not be eligible') || pageText.includes('apply anyway')) {
      const allBtns = document.querySelectorAll('button')
      const lastBtn = allBtns[allBtns.length - 1]
      if (lastBtn) {
        lastBtn.click()
        console.log('[JobSprint Apna] clickApplyAnyway: strategy 5 (brute force last button)')
        return true
      }
    }

    return false
  }

  /**
   * Click "Apply for job" button with full event dispatch for React.
   */
  async function clickApplyForJob() {
    // Strategy 1: span text
    const bySpan = Array.from(document.querySelectorAll('span'))
      .find(s => s.textContent.trim() === 'Apply for job')
      ?.closest('button')
    
    // Strategy 2: button text directly
    const byText = Array.from(document.querySelectorAll('button'))
      .find(b => b.innerText?.trim() === 'Apply for job')

    const btn = bySpan || byText
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await JS.sleep(400)
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      btn.click()
      console.log('[JobSprint Apna] clickApplyForJob: clicked')
      return true
    }
    return false
  }

  async function scrollToLoadAll() {
    let prev = 0
    for (let i = 0; i < 6; i++) {
      window.scrollTo(0, document.body.scrollHeight)
      await JS.sleep(1500)
      const curr = document.querySelectorAll('[data-testid="job-card"]').length
      console.log('[JobSprint Apna] Cards visible:', curr)
      if (curr === prev) break
      prev = curr
    }
    window.scrollTo(0, 0)
    await JS.sleep(500)
  }

  async function applyToListings(profile, token) {
    const MAX = 10
    let applied = 0

    const stored = await getStorage('apna_applied_urls')
    const appliedUrls = new Set(stored.apna_applied_urls || [])

    const cards = Array.from(document.querySelectorAll('[data-testid="job-card"]'))
    console.log('[JobSprint Apna] Cards found:', cards.length)

    if (!cards.length) {
      JS.showToast('No jobs found on Apna', 'error')
      return
    }

    for (const card of cards) {
      if (applied >= MAX || await JS.isOverDailyLimit()) break

      const link = card.closest('a') || card.querySelector('a')
      const href = link?.href || ''

      if (appliedUrls.has(href)) {
        console.log('[JobSprint Apna] Skipping already applied:', href)
        continue
      }

      const jobTitle    = card.querySelector('[data-testid="job-title"]')?.innerText?.trim()    || 'Unknown Role'
      const companyName = card.querySelector('[data-testid="company-title"]')?.innerText?.trim() || 'Unknown Company'

      if (await JS.isBlacklisted(companyName)) {
        JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error')
        continue
      }

      const cardText = card.textContent?.toLowerCase() || ''
      if (cardText.includes('company website')) {
        console.log('[JobSprint Apna] Skipping external job:', jobTitle)
        continue
      }

      console.log('[JobSprint Apna] Job:', jobTitle, '| href:', href)

      appliedUrls.add(href)
      await setStorage({
        apna_applied_urls: [...appliedUrls],
        apna_pending: { jobTitle, companyName, token, profile, returnUrl: window.location.href }
      })

      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await JS.sleep(600)

      if (href) {
        window.location.href = href
        return
      }
    }

    console.log('[JobSprint Apna] Done. Applied:', applied)
    if (applied > 0) JS.showToast(`Applied to ${applied} jobs on Apna 🎉`)
    else JS.showToast('No new applications made', 'error')
  }

  async function handleApnaApplyFlow(profile, token) {
    const stored  = await getStorage('apna_pending')
    const pending = stored?.apna_pending || {}
    const jobTitle    = pending.jobTitle    || 'Unknown Role'
    const companyName = pending.companyName || 'Unknown Company'
    const returnUrl   = pending.returnUrl   || 'https://apna.co/candidate/jobs'

    JS.showToast(`Applying: ${jobTitle} at ${companyName}`)

    const success = await handleApplyButtons()

    if (success) {
      await logApplication(jobTitle, companyName, token)
      JS.showToast(`✓ Applied: ${jobTitle} at ${companyName}`)
    } else {
      JS.showToast(`Skipped: ${jobTitle}`, 'info')
    }

    await clearStorage('apna_pending')
    await JS.sleep(1500)
    window.location.href = returnUrl
  }

  async function handleApplyButtons() {
    // Skip external jobs
    const externalBtn = Array.from(document.querySelectorAll('span, button'))
      .find(el => el.textContent?.trim() === 'Apply on company website')
    if (externalBtn) {
      console.log('[JobSprint Apna] External apply job — skipping')
      return false
    }

    // Already applied?
    const alreadyApplied = Array.from(document.querySelectorAll('button'))
      .find(b => b.innerText?.trim().toLowerCase() === 'applied')
    if (alreadyApplied) {
      console.log('[JobSprint Apna] Already applied, skipping')
      return false
    }

    let attempts = 0
    while (attempts < 15) {
      attempts++
      await JS.sleep(1500)

      // Success detection
      const pageText = document.body.innerText?.toLowerCase() || ''
      if (
        pageText.includes('applied successfully') ||
        pageText.includes('application submitted') ||
        pageText.includes('you have applied')
      ) {
        console.log('[JobSprint Apna] Success detected!')
        return true
      }

      // Priority 1: dismiss modal first
      if (
        pageText.includes('you may not be eligible') ||
        pageText.includes('apply anyway')
      ) {
        const dismissed = clickApplyAnyway()
        if (dismissed) {
          console.log('[JobSprint Apna] Modal dismissed, attempt:', attempts)
          await JS.sleep(2000)
          continue
        }
      }

      // Priority 2: main apply button
      const applied = await clickApplyForJob()
      if (applied) {
        await JS.sleep(2500)
        continue
      }

      // Priority 3: confirmation dialogs (OK / Confirm / Yes / Done)
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.innerText?.trim().toLowerCase().match(/^(ok|confirm|yes|done)$/)
      )
      if (confirmBtn) {
        console.log('[JobSprint Apna] Clicking confirmation button, attempt:', attempts)
        confirmBtn.click()
        await JS.sleep(1500)
        continue
      }

      if (attempts > 5) break
    }

    const finalText = document.body.innerText?.toLowerCase() || ''
    return finalText.includes('applied') || finalText.includes('success')
  }

  async function logApplication(jobTitle, companyName, token) {
    const jobData = {
      job_title:    jobTitle,
      company_name: companyName,
      job_url:      window.location.href,
      status:       'applied',
      job_site:     'apna',
      applied_at:   new Date().toISOString(),
    }
    chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})
    await fetch('http://localhost:3000/api/tracker', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify(jobData),
    }).catch(err => console.warn('[JobSprint Apna] Tracker error:', err))
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